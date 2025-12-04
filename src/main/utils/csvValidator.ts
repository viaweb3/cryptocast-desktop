/**
 * Unified CSV validation and processing utility
 * Supports both headerless and header-based CSV file formats
 */

import { ChainUtils } from './chain-utils';

export interface CSVRow {
  address: string;
  amount: string;
}

export interface CSVValidationResult {
  isValid: boolean;
  totalRecords: number;
  validRecords: number;
  invalidRecords: number;
  errors: string[];
  sampleData: CSVRow[];  // First 5 sample records for preview
  data: CSVRow[];        // All data
}

export interface CSVParseOptions {
  hasHeaders?: boolean; // Whether to include header row
  skipEmptyLines?: boolean; // Whether to skip empty lines
  trim?: boolean; // Whether to trim whitespace
}

/**
 * Validate address format (supports EVM and Solana)
 * Uses unified address validation utility
 */
export function validateAddress(address: string): { isValid: boolean; type?: 'evm' | 'solana' } {
  const trimmedAddress = address.trim();

  // Try EVM address validation first
  if (ChainUtils.isValidAddress(trimmedAddress, 'evm')) {
    return { isValid: true, type: 'evm' };
  }

  // Then try Solana address validation
  if (ChainUtils.isValidAddress(trimmedAddress, '501')) { // Use Solana chain ID
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
export function parseCSV(
  content: string,
  options: CSVParseOptions = {}
): CSVValidationResult {
  const {
    hasHeaders = false,
    skipEmptyLines = true,
    trim = true
  } = options;

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
        errors: ['CSV content is empty'],
        sampleData: [],
        data: []
      };
    }

    let startIndex = 0;
    const headers: string[] = [];

    // Handle header row
    if (hasHeaders) {
      const headerLine = lines[0];
      headers.push(...headerLine.split(',').map(h => trim ? h.trim() : h));
      startIndex = 1;

      // Validate required columns
      if (!headers.some(h => h.toLowerCase().includes('address')) ||
          !headers.some(h => h.toLowerCase().includes('amount'))) {
        return {
          isValid: false,
          totalRecords: lines.length - 1,
          validRecords: 0,
          invalidRecords: lines.length - 1,
          errors: ['CSV must contain address and amount columns'],
          sampleData: [],
          data: []
        };
      }
    }

    const data: CSVRow[] = [];
    const errors: string[] = [];

    // Parse data rows
    for (let i = startIndex; i < lines.length; i++) {
      const lineNum = i + 1; // Keep 1-based line numbering
      const line = lines[i];

      if (!line.trim() && skipEmptyLines) {
        continue;
      }

      const values = line.split(',').map(v => trim ? v.trim() : v);

      if (values.length < 2) {
        errors.push(`Line ${lineNum}: Format error, must contain address and amount`);
        continue;
      }

      let address: string;
      let amount: string;

      if (hasHeaders) {
        // Find corresponding columns based on headers
        const addressIndex = headers.findIndex(h => h.toLowerCase().includes('address'));
        const amountIndex = headers.findIndex(h => h.toLowerCase().includes('amount'));

        if (addressIndex === -1 || amountIndex === -1) {
          errors.push(`Line ${lineNum}: Cannot find address or amount column`);
          continue;
        }

        address = values[addressIndex];
        amount = values[amountIndex];
      } else {
        // Headerless format, first column is address, second column is amount
        address = values[0];
        amount = values[1];
      }

      // Validate address
      const addressValidation = validateAddress(address);
      if (!addressValidation.isValid) {
        errors.push(`Line ${lineNum}: Invalid address format (${address})`);
        continue;
      }

      // Validate amount
      const amountValidation = validateAmount(amount);
      if (!amountValidation.isValid) {
        errors.push(`Line ${lineNum}: Amount must be a number greater than 0 (${amount})`);
        continue;
      }

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
      sampleData: data.slice(0, 5),  // First 5 records for preview
      data: data                      // All data
    };

  } catch (error) {
    return {
      isValid: false,
      totalRecords: 0,
      validRecords: 0,
      invalidRecords: 0,
      errors: [`CSV parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
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

    // Return all data, not just the first 5
    return result.data;

  } catch (error) {
    throw new Error(`CSV file reading failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}