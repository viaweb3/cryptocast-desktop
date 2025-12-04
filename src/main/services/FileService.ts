import * as fs from 'fs';
import { promises as fsPromises } from 'fs';
import * as path from 'path';
import { stringify } from 'csv-stringify';
import { parseCSV } from '../utils/csvValidator';
import BigNumber from 'bignumber.js';


export interface CSVRow {
  address: string;
  amount: string;
}

export interface ReportData {
  campaign: any;
  recipients: any[];
  transactions: any[];
  summary: any;
}

export class FileService {
  private db: any;

  constructor(databaseManager: any) {
    this.db = databaseManager.getDatabase();
  }

  async readCSV(filePath: string): Promise<CSVRow[]> {
    try {
      if (!fs.existsSync(filePath)) {
        throw new Error('File not found');
      }

      const fileContent = fs.readFileSync(filePath, 'utf-8');

      // Use unified CSV validator for files with headers
      const result = parseCSV(fileContent, { hasHeaders: true });

      if (!result.isValid || result.validRecords === 0) {
        throw new Error(result.errors.join(', ') || 'CSV file invalid or no valid records');
      }

      return result.sampleData;
    } catch (error) {
      console.error('Failed to read CSV:', error);
      throw new Error(`CSV file reading failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async exportReport(campaignId: string, format: 'csv' = 'csv'): Promise<{ success: boolean; filePath: string }> {
    try {
      const reportData = await this.generateReportData(campaignId);
      const fileName = `campaign_${campaignId}_report.csv`;
      const filePath = await this.exportCSVReport(reportData, fileName);
      return { success: true, filePath };
    } catch (error) {
      console.error('Failed to export report:', error);
      throw new Error(`Report export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async generateReportData(campaignId: string): Promise<ReportData> {
    // Get campaign information
    const campaign = this.db.prepare('SELECT * FROM campaigns WHERE id = ?').get(campaignId);

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    // Get recipient information
    const recipients = this.db.prepare(`
      SELECT * FROM recipients WHERE campaign_id = ? ORDER BY created_at
    `).all(campaignId);

    // Get transaction records
    const transactions = this.db.prepare(`
      SELECT * FROM transactions WHERE campaign_id = ? ORDER BY created_at
    `).all(campaignId);

    // Calculate summary information
    const totalRecipients = recipients.length;
    const sentRecipients = recipients.filter((r: any) => r.status === 'SENT').length;
    const failedRecipients = recipients.filter((r: any) => r.status === 'FAILED').length;
    const pendingRecipients = recipients.filter((r: any) => r.status === 'PENDING').length;

    const totalAmount = recipients.reduce((sum: BigNumber, r: any) => {
      return sum.plus(new BigNumber(r.amount || '0'));
    }, new BigNumber(0));
    const sentAmount = recipients
      .filter((r: any) => r.status === 'SENT')
      .reduce((sum: BigNumber, r: any) => {
        return sum.plus(new BigNumber(r.amount || '0'));
      }, new BigNumber(0));

    const totalGasUsed = transactions.reduce((sum: number, t: any) => sum + (t.gas_used || 0), 0);
    const totalGasCost = transactions.reduce((sum: number, t: any) => sum + (t.gas_cost || 0), 0);

    const summary = {
      totalRecipients,
      sentRecipients,
      failedRecipients,
      pendingRecipients,
      successRate: totalRecipients > 0 ? (sentRecipients / totalRecipients * 100).toFixed(2) : 0,
      totalAmount: totalAmount.toString(),
      sentAmount: sentAmount.toString(),
      totalGasUsed: totalGasUsed.toString(),
      totalGasCost: totalGasCost.toString(),
      campaignStatus: (campaign as any).status || 'unknown',
      createdAt: (campaign as any).created_at || new Date().toISOString(),
      updatedAt: (campaign as any).updated_at || new Date().toISOString(),
    };

    return {
      campaign,
      recipients,
      transactions,
      summary,
    };
  }

  private async exportCSVReport(reportData: ReportData, fileName: string): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        const filePath = path.join(this.getDownloadsDirectory(), fileName);
        const writableStream = fs.createWriteStream(filePath);

        const csvStringifier = stringify({
          header: true,
          columns: [
            'Campaign ID',
            'Campaign Name',
            'Blockchain',
            'Token Address',
            'Recipient Address',
            'Amount',
            'Status',
            'Transaction Hash',
            'Gas Used',
            'Error Message',
            'Created Time',
            'Updated Time'
          ]
        });

        writableStream.on('finish', () => {
          resolve(filePath);
        });

        writableStream.on('error', (error) => {
          reject(new Error(`Failed to write CSV file: ${error.message}`));
        });

        csvStringifier.pipe(writableStream);

        // Write data rows
        reportData.recipients.forEach(recipient => {
          csvStringifier.write([
            reportData.campaign.id,
            reportData.campaign.name,
            reportData.campaign.chain,
            reportData.campaign.token_address,
            recipient.address,
            recipient.amount,
            recipient.status,
            recipient.tx_hash || '',
            recipient.gas_used || '',
            recipient.error_message || '',
            recipient.created_at,
            recipient.updated_at
          ]);
        });

        csvStringifier.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  
  private getDownloadsDirectory(): string {
    const homeDir = require('os').homedir();
    const platform = require('os').platform();

    let downloadsDir: string;

    switch (platform) {
      case 'win32':
        downloadsDir = path.join(homeDir, 'Downloads');
        break;
      case 'darwin':
        downloadsDir = path.join(homeDir, 'Downloads');
        break;
      default:
        downloadsDir = path.join(homeDir, 'Downloads');
        break;
    }

    // Ensure download directory exists
    if (!fs.existsSync(downloadsDir)) {
      fs.mkdirSync(downloadsDir, { recursive: true });
    }

    return downloadsDir;
  }

  async validateCSVFile(filePath: string): Promise<{ valid: boolean; errors: string[] }> {
    try {
      const errors: string[] = [];

      if (!fs.existsSync(filePath)) {
        return { valid: false, errors: ['File not found'] };
      }

      const fileStats = fs.statSync(filePath);
      const fileSizeMB = fileStats.size / (1024 * 1024);

      if (fileSizeMB > 10) {
        errors.push('File size exceeds 10MB limit');
      }

      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const lines = fileContent.split('\n').filter(line => line.trim());

      if (lines.length < 2) {
        errors.push('File must contain at least a header and one data row');
      }

      if (lines.length > 10001) {
        errors.push('File contains more than 10,000 records');
      }

      // Check table headers
      const header = lines[0].toLowerCase();
      if (!header.includes('address') || !header.includes('amount')) {
        errors.push('CSV file must contain "address" and "amount" columns');
      }

      return {
        valid: errors.length === 0,
        errors
      };
    } catch (error) {
      return {
        valid: false,
        errors: [`File validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  async getFileStats(filePath: string): Promise<{ size: number; lines: number; validRows: number }> {
    try {
      if (!fs.existsSync(filePath)) {
        throw new Error('File not found');
      }

      const fileStats = fs.statSync(filePath);
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const lines = fileContent.split('\n').filter(line => line.trim());

      // Try to parse CSV to get valid row count
      try {
        const result = parseCSV(fileContent, { hasHeaders: true });
        return {
          size: fileStats.size,
          lines: lines.length,
          validRows: result.validRecords
        };
      } catch {
        return {
          size: fileStats.size,
          lines: lines.length,
          validRows: 0
        };
      }
    } catch (error) {
      throw new Error(`Failed to get file stats: ${error}`);
    }
  }

  async deleteFile(filePath: string): Promise<void> {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      throw new Error(`Failed to delete file: ${error}`);
    }
  }

  async createBackup(campaignId: string): Promise<string> {
    try {
      const backupData = await this.generateReportData(campaignId);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `backup_campaign_${campaignId}_${timestamp}.csv`;
      const filePath = await this.exportCSVReport(backupData, fileName);
      return filePath;
    } catch (error) {
      throw new Error(`Failed to create backup: ${error}`);
    }
  }
  }