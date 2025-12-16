/**
 * Unified CSV validation and processing utilities
 * Supports CSV files with and without headers
 */

export interface CSVRow {
  address: string;
  amount: string;
}

export interface CSVValidationResult {
  isValid: boolean;
  totalRecords: number;
  validRecords: number;
  invalidRecords: number;
  errors: CSVValidationError[];
  sampleData: CSVRow[]; // First 5 sample records for preview
  data: CSVRow[]; // All data
}

export interface CSVValidationError {
  row: number;
  field: 'address' | 'amount';
  value: string;
  error: string;
}

export interface CSVParseOptions {
  hasHeaders?: boolean; // Whether the file contains a header row
  skipEmptyLines?: boolean; // Whether to skip empty lines
  trim?: boolean; // Whether to trim whitespace
  chainType?: 'evm' | 'solana'; // Target blockchain type - validates addresses match this type
}

/**
 * Validate address format (supports EVM and Solana)
 */
export function validateAddress(address: string): { isValid: boolean; type?: 'evm' | 'solana' } {
  const trimmedAddress = address.trim();

  // EVM address validation (0x + 40 hexadecimal characters)
  const isEVMAddress = /^0x[a-fA-F0-9]{40}$/.test(trimmedAddress);
  if (isEVMAddress) {
    return { isValid: true, type: 'evm' };
  }

  // Solana address validation (Base58 encoded, 32-44 characters)
  const isSolanaAddress = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(trimmedAddress);
  if (isSolanaAddress) {
    return { isValid: true, type: 'solana' };
  }

  return { isValid: false };
}

/**
 * Validate amount format
 */
export function validateAmount(amount: string): { isValid: boolean; value?: number } {
  const trimmedAmount = amount.trim();
  const numValue = parseFloat(trimmedAmount);

  if (isNaN(numValue) || numValue <= 0) {
    return { isValid: false };
  }

  return { isValid: true, value: numValue };
}

/**
 * Parse CSV content
 */
export function parseCSV(content: string, options: CSVParseOptions = {}): CSVValidationResult {
  const { hasHeaders = false, skipEmptyLines = true, trim = true } = options;

  try {
    const lines = content.split('\n').filter(line => {
      const trimmed = line.trim();
      return skipEmptyLines ? trimmed.length > 0 : true;
    });

    if (lines.length === 0) {
      return {
        isValid: false,
        totalRecords: 0,
        validRecords: 0,
        invalidRecords: 0,
        errors: [{ row: 0, field: 'address', value: '', error: 'CSV content is empty' }],
        sampleData: [],
        data: []
      };
    }

    let startIndex = 0;
    const headers: string[] = [];

    // Process header row
    if (hasHeaders) {
      const headerLine = lines[0];
      headers.push(...headerLine.split(',').map(h => (trim ? h.trim() : h)));
      startIndex = 1;

      // Validate required columns
      if (
        !headers.some(h => h.toLowerCase().includes('address')) ||
        !headers.some(h => h.toLowerCase().includes('amount'))
      ) {
        return {
          isValid: false,
          totalRecords: lines.length - 1,
          validRecords: 0,
          invalidRecords: lines.length - 1,
          errors: [
            {
              row: 1,
              field: 'address',
              value: headers.join(','),
              error: 'CSV must contain address and amount columns'
            }
          ],
          sampleData: [],
          data: []
        };
      }
    }

    const data: CSVRow[] = [];
    const errors: CSVValidationError[] = [];
    const seenAddresses = new Set<string>(); // Track addresses to detect duplicates

    // Parse data rows
    for (let i = startIndex; i < lines.length; i++) {
      const lineNum = i + 1; // Keep 1-based row numbering
      const line = lines[i];

      if (!line.trim() && skipEmptyLines) {
        continue;
      }

      const values = line.split(',').map(v => (trim ? v.trim() : v));

      if (values.length < 2) {
        errors.push({
          row: lineNum,
          field: 'address',
          value: line,
          error: 'Format error, must contain address and amount'
        });
        continue;
      }

      let address: string;
      let amount: string;

      if (hasHeaders) {
        // Find corresponding columns based on headers
        const addressIndex = headers.findIndex(h => h.toLowerCase().includes('address'));
        const amountIndex = headers.findIndex(h => h.toLowerCase().includes('amount'));

        if (addressIndex === -1 || amountIndex === -1) {
          errors.push({
            row: lineNum,
            field: 'address',
            value: values.join(','),
            error: 'Cannot find address or amount column'
          });
          continue;
        }

        address = values[addressIndex];
        amount = values[amountIndex];
      } else {
        // No header format, first column is address, second column is amount
        address = values[0];
        amount = values[1];
      }

      // Validate address
      const addressValidation = validateAddress(address);
      if (!addressValidation.isValid) {
        errors.push({
          row: lineNum,
          field: 'address',
          value: address,
          error: 'Invalid address format'
        });
        continue;
      }

      // Validate address type matches target chain (if chainType is specified)
      if (options.chainType && addressValidation.type !== options.chainType) {
        const expectedType = options.chainType.toUpperCase();
        const actualType = addressValidation.type?.toUpperCase() || 'UNKNOWN';
        errors.push({
          row: lineNum,
          field: 'address',
          value: address,
          error: `Address type mismatch: expected ${expectedType} address, but got ${actualType} address`
        });
        continue;
      }

      // Normalize address for duplicate detection
      // EVM addresses are case-insensitive, so normalize to lowercase
      // Solana addresses are case-sensitive, so keep as-is
      const normalizedAddress =
        addressValidation.type === 'evm' ? address.toLowerCase() : address.trim();

      // Check for duplicate addresses
      if (seenAddresses.has(normalizedAddress)) {
        errors.push({
          row: lineNum,
          field: 'address',
          value: address,
          error: 'Duplicate address found in CSV'
        });
        continue;
      }

      // Validate amount
      const amountValidation = validateAmount(amount);
      if (!amountValidation.isValid) {
        errors.push({
          row: lineNum,
          field: 'amount',
          value: amount,
          error: 'Amount must be a number greater than 0'
        });
        continue;
      }

      // Add to seen addresses set
      seenAddresses.add(normalizedAddress);

      data.push({
        address: address.trim(),
        amount: amount.trim()
      });
    }

    return {
      isValid: data.length > 0,
      totalRecords: lines.length - startIndex,
      validRecords: data.length,
      invalidRecords: lines.length - startIndex - data.length,
      errors,
      sampleData: data.slice(0, 5), // First 5 records for preview
      data: data // All data
    };
  } catch (error) {
    return {
      isValid: false,
      totalRecords: 0,
      validRecords: 0,
      invalidRecords: 0,
      errors: [
        {
          row: 0,
          field: 'address',
          value: '',
          error: `CSV parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      ],
      sampleData: [],
      data: []
    };
  }
}

/**
 * Read and parse CSV from file (for file upload scenarios)
 */
export async function readCSVFile(filePath: string): Promise<CSVRow[]> {
  const fs = require('fs').promises;

  try {
    const fileContent = await fs.readFile(filePath, 'utf-8');
    const result = parseCSV(fileContent, { hasHeaders: true });

    if (!result.isValid || result.validRecords === 0) {
      throw new Error(result.errors.join(', ') || 'CSV file is invalid or has no valid records');
    }

    // Can return more records here, not just the first 5
    const allData = parseCSV(fileContent, { hasHeaders: true });
    return parseCSV(fileContent, { hasHeaders: true }).sampleData;
  } catch (error) {
    throw new Error(
      `CSV file read failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
