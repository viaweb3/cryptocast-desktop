/**
 * 统一的CSV验证和处理工具
 * 支持无头部格式和有头部格式的CSV文件
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
  sampleData: CSVRow[];  // 前5条样本数据，用于预览
  data: CSVRow[];        // 所有数据
}

export interface CSVParseOptions {
  hasHeaders?: boolean; // 是否包含头部行
  skipEmptyLines?: boolean; // 是否跳过空行
  trim?: boolean; // 是否去除空白字符
}

/**
 * 验证地址格式（支持EVM和Solana）
 * 使用统一的地址验证工具
 */
export function validateAddress(address: string): { isValid: boolean; type?: 'evm' | 'solana' } {
  const trimmedAddress = address.trim();

  // 先尝试EVM地址验证
  if (ChainUtils.isValidAddress(trimmedAddress, 'evm')) {
    return { isValid: true, type: 'evm' };
  }

  // 再尝试Solana地址验证
  if (ChainUtils.isValidAddress(trimmedAddress, '501')) { // 使用Solana链ID
    return { isValid: true, type: 'solana' };
  }

  return { isValid: false };
}

/**
 * 验证金额格式
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
 * 解析CSV内容
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
        errors: ['CSV内容为空'],
        sampleData: [],
        data: []
      };
    }

    let startIndex = 0;
    const headers: string[] = [];

    // 处理头部行
    if (hasHeaders) {
      const headerLine = lines[0];
      headers.push(...headerLine.split(',').map(h => trim ? h.trim() : h));
      startIndex = 1;

      // 验证必需的列
      if (!headers.some(h => h.toLowerCase().includes('address')) ||
          !headers.some(h => h.toLowerCase().includes('amount'))) {
        return {
          isValid: false,
          totalRecords: lines.length - 1,
          validRecords: 0,
          invalidRecords: lines.length - 1,
          errors: ['CSV必须包含address和amount列'],
          sampleData: [],
          data: []
        };
      }
    }

    const data: CSVRow[] = [];
    const errors: string[] = [];

    // 解析数据行
    for (let i = startIndex; i < lines.length; i++) {
      const lineNum = i + 1; // 保持1-based行号
      const line = lines[i];

      if (!line.trim() && skipEmptyLines) {
        continue;
      }

      const values = line.split(',').map(v => trim ? v.trim() : v);

      if (values.length < 2) {
        errors.push(`第 ${lineNum} 行: 格式错误，需要包含地址和金额`);
        continue;
      }

      let address: string;
      let amount: string;

      if (hasHeaders) {
        // 根据头部找到对应的列
        const addressIndex = headers.findIndex(h => h.toLowerCase().includes('address'));
        const amountIndex = headers.findIndex(h => h.toLowerCase().includes('amount'));

        if (addressIndex === -1 || amountIndex === -1) {
          errors.push(`第 ${lineNum} 行: 无法找到address或amount列`);
          continue;
        }

        address = values[addressIndex];
        amount = values[amountIndex];
      } else {
        // 无头部格式，第一列是地址，第二列是金额
        address = values[0];
        amount = values[1];
      }

      // 验证地址
      const addressValidation = validateAddress(address);
      if (!addressValidation.isValid) {
        errors.push(`第 ${lineNum} 行: 地址格式无效 (${address})`);
        continue;
      }

      // 验证金额
      const amountValidation = validateAmount(amount);
      if (!amountValidation.isValid) {
        errors.push(`第 ${lineNum} 行: 金额必须是大于0的数字 (${amount})`);
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
      sampleData: data.slice(0, 5),  // 前5条用于预览
      data: data                      // 所有数据
    };

  } catch (error) {
    return {
      isValid: false,
      totalRecords: 0,
      validRecords: 0,
      invalidRecords: 0,
      errors: [`CSV解析失败: ${error instanceof Error ? error.message : '未知错误'}`],
      sampleData: [],
      data: []
    };
  }
}

/**
 * 从文件读取并解析CSV（用于文件上传场景）
 */
export async function readCSVFile(filePath: string): Promise<CSVRow[]> {
  const fs = require('fs').promises;

  try {
    const fileContent = await fs.readFile(filePath, 'utf-8');
    const result = parseCSV(fileContent, { hasHeaders: true });

    if (!result.isValid || result.validRecords === 0) {
      throw new Error(result.errors.join(', ') || 'CSV文件无效或无有效记录');
    }

    // 返回所有数据，而不是只有前5个
    return result.data;

  } catch (error) {
    throw new Error(`CSV文件读取失败: ${error instanceof Error ? error.message : '未知错误'}`);
  }
}