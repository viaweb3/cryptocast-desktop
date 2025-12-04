/**
 * Unified private key handling utility functions
 * Used to eliminate duplicate logic for private key encoding/decoding
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
 * Unified private key Base64 encoding utility
 */
export class KeyUtils {
  /**
   * Convert EVM private key to Base64 format
   * @param privateKeyHex EVM format private key (0x...)
   * @returns Base64 encoded private key
   */
  static encodeEVMPrivateKey(privateKeyHex: string): string {
    // Remove 0x prefix and convert to Buffer
    const privateKeyBuffer = Buffer.from(privateKeyHex.slice(2), 'hex');
    return privateKeyBuffer.toString('base64');
  }

  /**
   * Convert Solana private key to Base64 format
   * @param secretKey 64-byte Solana secret key
   * @returns Base64 encoded private key
   */
  static encodeSolanaPrivateKey(secretKey: Uint8Array): string {
    const privateKeyBuffer = Buffer.from(secretKey);
    return privateKeyBuffer.toString('base64');
  }

  /**
   * Decode Base64 private key to Buffer
   * @param privateKeyBase64 Base64 encoded private key
   * @returns Buffer format private key
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
   * Convert Base64 private key to EVM hex format
   * @param privateKeyBase64 Base64 encoded private key
   * @returns EVM format private key (0x...)
   */
  static decodeToEVMHex(privateKeyBase64: string): string {
    const privateKeyBuffer = this.decodePrivateKey(privateKeyBase64);
    return '0x' + privateKeyBuffer.toString('hex');
  }

  /**
   * Convert Base64 private key to Solana Uint8Array format
   * @param privateKeyBase64 Base64 encoded private key
   * @returns Solana format private key (64-byte Uint8Array)
   */
  static decodeToSolanaBytes(privateKeyBase64: string): Uint8Array {
    const privateKeyBuffer = this.decodePrivateKey(privateKeyBase64);
    return new Uint8Array(privateKeyBuffer);
  }

  /**
   * Validate private key format and get detailed information
   * @param privateKeyBase64 Base64 encoded private key
   * @param type Optional private key type, auto-detected if not provided
   * @returns Private key validation result
   */
  static validatePrivateKey(privateKeyBase64: string, type?: 'evm' | 'solana'): PrivateKeyData {
    try {
      const privateKeyBytes = this.decodePrivateKey(privateKeyBase64);

      // If type is specified, validate directly
      if (type) {
        if (type === 'evm') {
          // EVM private key should be 32 bytes
          if (privateKeyBytes.length !== 32) {
            return {
              privateKeyBase64,
              isValid: false
            };
          }
        } else if (type === 'solana') {
          // Solana private key should be 64 bytes
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

      // Auto-detect type
      if (privateKeyBytes.length === 32) {
        // 32 bytes, could be EVM private key or 32-byte Solana private key
        return {
          privateKeyBase64,
          privateKeyBytes,
          privateKeyHex: '0x' + privateKeyBytes.toString('hex'),
          isValid: true,
          type: 'evm' // Default to EVM
        };
      } else if (privateKeyBytes.length === 64) {
        // 64 bytes, should be a complete Solana keypair
        return {
          privateKeyBase64,
          privateKeyBytes,
          isValid: true,
          type: 'solana'
        };
      } else {
        // Invalid length
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
   * Securely clear Buffer content
   * @param buffer Buffer to clear
   */
  static clearBuffer(buffer: Buffer): void {
    buffer.fill(0);
  }

  /**
   * Securely generate random private key bytes
   * @param length Byte length (EVM: 32, Solana: 64)
   * @returns Random private key Buffer
   */
  static generateRandomPrivateKey(length: 32 | 64): Buffer {
    if (length === 32) {
      // EVM private key (32 bytes)
      const privateKeyBytes = Buffer.alloc(32);
      crypto.getRandomValues(privateKeyBytes);
      return privateKeyBytes;
    } else {
      // Solana private key (64 bytes) - should use proper keypair generation here
      // This just generates 64 bytes simply, should use @solana/web3.js Keypair.generate() in practice
      throw new Error('Solana keypair generation should use @solana/web3.js Keypair.generate()');
    }
  }

  /**
   * Get private key length information
   * @param privateKeyBase64 Base64 encoded private key
   * @returns Private key length information
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