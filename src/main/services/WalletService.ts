import { ethers } from 'ethers';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { ChainUtils } from '../utils/chain-utils';
import { KeyUtils } from '../utils/keyUtils';

interface WalletData {
  address: string;
  privateKeyBase64: string;
  type: 'evm' | 'solana';
}

export class WalletService {
  constructor() {
    // Simplified - no password protection needed
  }

  /**
   * Create EVM wallet and return address + base64 encoded private key
   */
  createEVMWallet(): WalletData {
    try {
      const wallet = ethers.Wallet.createRandom();
      const privateKeyBase64 = KeyUtils.encodeEVMPrivateKey(wallet.privateKey);

      return {
        address: wallet.address,
        privateKeyBase64,
        type: 'evm'
      };
    } catch (error) {
      console.error('Failed to create EVM wallet:', error);
      throw new Error('EVM wallet creation failed');
    }
  }

  /**
   * Create Solana wallet and return address + base64 encoded private key
   */
  createSolanaWallet(): WalletData {
    try {
      const keypair = Keypair.generate();
      const privateKeyBase64 = KeyUtils.encodeSolanaPrivateKey(keypair.secretKey);

      return {
        address: keypair.publicKey.toBase58(),
        privateKeyBase64,
        type: 'solana'
      };
    } catch (error) {
      console.error('Failed to create Solana wallet:', error);
      throw new Error('Solana wallet creation failed');
    }
  }

  /**
   * Decode base64 private key to hex string
   */
  decodePrivateKey(privateKeyBase64: string): string {
    try {
      return KeyUtils.decodeToEVMHex(privateKeyBase64);
    } catch (error) {
      console.error('Failed to decode private key:', error);
      throw new Error('Private key decode failed');
    }
  }

  /**
   * Export private key from base64 (for display or export)
   * @deprecated Use exportEVMPrivateKey or exportSolanaPrivateKey instead
   */
  exportPrivateKey(privateKeyBase64: string): string {
    return this.decodePrivateKey(privateKeyBase64);
  }

  /**
   * Export EVM private key in hex format (0x...)
   */
  exportEVMPrivateKey(privateKeyBase64: string): string {
    return this.decodePrivateKey(privateKeyBase64);
  }

  /**
   * Export Solana private key in array format (compatible with Phantom)
   */
  exportSolanaPrivateKey(privateKeyBase64: string): string {
    try {
      const privateKeyBytes = KeyUtils.decodeToSolanaBytes(privateKeyBase64);

      // 验证私钥长度
      if (privateKeyBytes.length !== 64) {
        throw new Error(`Invalid Solana private key length: ${privateKeyBytes.length}. Expected 64 bytes.`);
      }

      // 转换为数组格式 [1,2,3,...]
      const keypairArray = Array.from(privateKeyBytes);
      return '[' + keypairArray.join(',') + ']';
    } catch (error) {
      console.error('Failed to export Solana private key:', error);
      throw new Error('Solana private key export failed');
    }
  }

  /**
   * Get EVM wallet instance from base64 private key
   */
  getEVMWallet(privateKeyBase64: string): ethers.Wallet {
    try {
      const privateKey = this.decodePrivateKey(privateKeyBase64);
      return new ethers.Wallet(privateKey);
    } catch (error) {
      console.error('Failed to get EVM wallet:', error);
      throw new Error('EVM wallet retrieval failed');
    }
  }

  /**
   * Get Solana keypair from base64 private key
   */
  getSolanaKeypair(privateKeyBase64: string): Keypair {
    try {
      const privateKeyBytes = KeyUtils.decodeToSolanaBytes(privateKeyBase64);
      return Keypair.fromSecretKey(privateKeyBytes);
    } catch (error) {
      console.error('Failed to get Solana keypair:', error);
      throw new Error('Solana keypair retrieval failed');
    }
  }

  validateAddress(address: string, type: 'evm' | 'solana'): boolean {
    return ChainUtils.isValidAddress(address, type);
  }

  /**
   * Get wallet balance for EVM chains
   */
  async getEVMBalance(
    address: string,
    rpcUrl: string,
    tokenAddress?: string
  ): Promise<{ balance: string; symbol: string; decimals: number }> {
    try {
      const provider = new ethers.JsonRpcProvider(rpcUrl);

      if (!tokenAddress || tokenAddress === '0x0000000000000000000000000000000000000000') {
        // Native token balance
        const balance = await provider.getBalance(address);
        return {
          balance: ethers.formatEther(balance),
          symbol: 'ETH',
          decimals: 18,
        };
      } else {
        // ERC20 token balance
        const tokenContract = new ethers.Contract(
          tokenAddress,
          ['function balanceOf(address) view returns (uint256)', 'function symbol() view returns (string)', 'function decimals() view returns (uint8)'],
          provider
        );

        const [balance, symbol, decimals] = await Promise.all([
          tokenContract.balanceOf(address),
          tokenContract.symbol(),
          tokenContract.decimals(),
        ]);

        return {
          balance: ethers.formatUnits(balance, decimals),
          symbol,
          decimals: Number(decimals),
        };
      }
    } catch (error) {
      console.error('Failed to get EVM balance:', error);
      throw new Error('EVM balance query failed');
    }
  }
}