/**
 * 统一的私钥处理工具函数
 * 用于消除私钥编码/解码的重复逻辑
 */

import { Buffer } from 'buffer';

export interface PrivateKeyData {
  privateKeyBase64: string;
  privateKeyHex?: string;
  privateKeyBytes?: Buffer;
  isValid: boolean;
  type?: 'evm' | 'solana';
}

/**
 * 统一的私钥Base64编码工具
 */
export class KeyUtils {
  /**
   * 将EVM私钥转换为Base64格式
   * @param privateKeyHex EVM格式的私钥 (0x...)
   * @returns Base64编码的私钥
   */
  static encodeEVMPrivateKey(privateKeyHex: string): string {
    // 移除0x前缀并转换为Buffer
    const privateKeyBuffer = Buffer.from(privateKeyHex.slice(2), 'hex');
    return privateKeyBuffer.toString('base64');
  }

  /**
   * 将Solana私钥转换为Base64格式
   * @param secretKey 64字节的Solana secret key
   * @returns Base64编码的私钥
   */
  static encodeSolanaPrivateKey(secretKey: Uint8Array): string {
    const privateKeyBuffer = Buffer.from(secretKey);
    return privateKeyBuffer.toString('base64');
  }

  /**
   * 从Base64私钥解码为Buffer
   * @param privateKeyBase64 Base64编码的私钥
   * @returns Buffer格式的私钥
   */
  static decodePrivateKey(privateKeyBase64: string): Buffer {
    try {
      return Buffer.from(privateKeyBase64, 'base64');
    } catch (error) {
      console.error('Failed to decode private key from base64:', error);
      throw new Error('Private key decode failed');
    }
  }

  /**
   * 将Base64私钥转换为EVM hex格式
   * @param privateKeyBase64 Base64编码的私钥
   * @returns EVM格式的私钥 (0x...)
   */
  static decodeToEVMHex(privateKeyBase64: string): string {
    const privateKeyBuffer = this.decodePrivateKey(privateKeyBase64);
    return '0x' + privateKeyBuffer.toString('hex');
  }

  /**
   * 将Base64私钥转换为Solana Uint8Array格式
   * @param privateKeyBase64 Base64编码的私钥
   * @returns Solana格式的私钥 (64字节Uint8Array)
   */
  static decodeToSolanaBytes(privateKeyBase64: string): Uint8Array {
    const privateKeyBuffer = this.decodePrivateKey(privateKeyBase64);
    return new Uint8Array(privateKeyBuffer);
  }

  /**
   * 验证私钥格式并获取详细信息
   * @param privateKeyBase64 Base64编码的私钥
   * @param type 可选的私钥类型，如果不提供则自动检测
   * @returns 私钥验证结果
   */
  static validatePrivateKey(privateKeyBase64: string, type?: 'evm' | 'solana'): PrivateKeyData {
    try {
      const privateKeyBytes = this.decodePrivateKey(privateKeyBase64);

      // 如果指定了类型，直接验证
      if (type) {
        if (type === 'evm') {
          // EVM私钥应该是32字节
          if (privateKeyBytes.length !== 32) {
            return {
              privateKeyBase64,
              isValid: false
            };
          }
        } else if (type === 'solana') {
          // Solana私钥应该是64字节
          if (privateKeyBytes.length !== 64) {
            return {
              privateKeyBase64,
              isValid: false
            };
          }
        }

        return {
          privateKeyBase64,
          privateKeyBytes,
          isValid: true,
          type
        };
      }

      // 自动检测类型
      if (privateKeyBytes.length === 32) {
        // 32字节，可能是EVM私钥或32字节Solana私钥
        return {
          privateKeyBase64,
          privateKeyBytes,
          privateKeyHex: '0x' + privateKeyBytes.toString('hex'),
          isValid: true,
          type: 'evm' // 默认认为是EVM
        };
      } else if (privateKeyBytes.length === 64) {
        // 64字节，应该是完整的Solana keypair
        return {
          privateKeyBase64,
          privateKeyBytes,
          isValid: true,
          type: 'solana'
        };
      } else {
        // 无效长度
        return {
          privateKeyBase64,
          isValid: false
        };
      }
    } catch (error) {
      console.error('Private key validation failed:', error);
      return {
        privateKeyBase64,
        isValid: false
      };
    }
  }

  /**
   * 安全地清零Buffer内容
   * @param buffer 要清零的Buffer
   */
  static clearBuffer(buffer: Buffer): void {
    buffer.fill(0);
  }

  /**
   * 安全地生成随机私钥字节
   * @param length 字节长度 (EVM: 32, Solana: 64)
   * @returns 随机私钥Buffer
   */
  static generateRandomPrivateKey(length: 32 | 64): Buffer {
    if (length === 32) {
      // EVM私钥 (32字节)
      const privateKeyBytes = Buffer.alloc(32);
      crypto.getRandomValues(privateKeyBytes);
      return privateKeyBytes;
    } else {
      // Solana私钥 (64字节) - 这里应该使用真正的keypair生成
      // 这里只是简单生成64字节，实际应该使用 @solana/web3.js 的 Keypair.generate()
      throw new Error('Solana keypair generation should use @solana/web3.js Keypair.generate()');
    }
  }

  /**
   * 获取私钥长度信息
   * @param privateKeyBase64 Base64编码的私钥
   * @returns 私钥长度信息
   */
  static getKeyLengthInfo(privateKeyBase64: string): {
    bytes: number;
    bits: number;
    likelyType: 'evm' | 'solana' | 'unknown';
  } {
    try {
      const privateKeyBytes = this.decodePrivateKey(privateKeyBase64);
      const bytes = privateKeyBytes.length;
      const bits = bytes * 8;

      let likelyType: 'evm' | 'solana' | 'unknown';
      if (bytes === 32) {
        likelyType = 'evm';
      } else if (bytes === 64) {
        likelyType = 'solana';
      } else {
        likelyType = 'unknown';
      }

      return { bytes, bits, likelyType };
    } catch (error) {
      return { bytes: 0, bits: 0, likelyType: 'unknown' };
    }
  }
}