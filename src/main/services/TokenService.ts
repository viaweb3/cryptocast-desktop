import { ethers } from 'ethers';
import { Connection, PublicKey } from '@solana/web3.js';

export interface TokenInfo {
  name: string;
  symbol: string;
  decimals: number;
  address: string;
  chainType: 'evm' | 'solana';
}

export interface EVMTokenInfo {
  name: string;
  symbol: string;
  decimals: number;
  address: string;
  chainType: 'evm';
}

export interface SolanaTokenInfo {
  name: string;
  symbol: string;
  decimals: number;
  address: string;
  chainType: 'solana';
}

// ERC-20 ABI (只包含需要的函数)
const ERC20_ABI = [
  // 获取代币名称
  {
    constant: true,
    inputs: [],
    name: 'name',
    outputs: [{ name: '', type: 'string' }],
    payable: false,
    stateMutability: 'view',
    type: 'function',
  },
  // 获取代币符号
  {
    constant: true,
    inputs: [],
    name: 'symbol',
    outputs: [{ name: '', type: 'string' }],
    payable: false,
    stateMutability: 'view',
    type: 'function',
  },
  // 获取代币精度
  {
    constant: true,
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    payable: false,
    stateMutability: 'view',
    type: 'function',
  },
];

// Solana Token Program ID
const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');

export class TokenService {
  private chainService: any;

  constructor(chainService: any) {
    this.chainService = chainService;
  }

  /**
   * 获取代币信息（统一接口）
   */
  async getTokenInfo(tokenAddress: string, chainId: string): Promise<TokenInfo | null> {
    try {
      // 获取链信息
      const chain = await this.chainService.getChainByChainId(parseInt(chainId));

      if (!chain) {
        throw new Error(`Chain ${chainId} not found`);
      }

      if (chain.type === 'evm') {
        return await this.getEVMTokenInfo(tokenAddress, chain) as TokenInfo;
      } else if (chain.type === 'solana') {
        return await this.getSolanaTokenInfo(tokenAddress, chain) as TokenInfo;
      } else {
        throw new Error(`Unsupported chain type: ${chain.type}`);
      }
    } catch (error) {
      console.error('Failed to get token info:', error);
      return null;
    }
  }

  /**
   * 获取EVM代币信息
   */
  private async getEVMTokenInfo(tokenAddress: string, chain: any): Promise<EVMTokenInfo | null> {
    try {
      // 验证地址格式
      if (!ethers.isAddress(tokenAddress)) {
        throw new Error('Invalid EVM token address format');
      }

      // 创建provider
      const provider = new ethers.JsonRpcProvider(chain.rpcUrl, undefined, {
        batchMaxCount: 1,
        polling: false,
      });

      // 创建合约实例
      const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);

      // 设置超时Promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Token info request timeout')), 10000);
      });

      // 并行获取代币信息
      const [name, symbol, decimals] = await Promise.race([
        Promise.all([
          contract.name(),
          contract.symbol(),
          contract.decimals()
        ]),
        timeoutPromise
      ]) as [string, string, number];

      return {
        name,
        symbol,
        decimals: Number(decimals),
        address: tokenAddress,
        chainType: 'evm',
      };
    } catch (error) {
      console.error(`Failed to get EVM token info for ${tokenAddress}:`, error);
      throw new Error(`Failed to fetch EVM token info: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 获取Solana代币信息
   */
  private async getSolanaTokenInfo(tokenAddress: string, chain: any): Promise<SolanaTokenInfo | null> {
    try {
      // 验证地址格式
      try {
        new PublicKey(tokenAddress);
      } catch {
        throw new Error('Invalid Solana token address format');
      }

      // 创建连接
      const connection = new Connection(chain.rpcUrl, 'confirmed');

      // 获取代币账户信息
      const accountInfo = await connection.getAccountInfo(new PublicKey(tokenAddress));

      if (!accountInfo) {
        throw new Error('Token account not found');
      }

      // 验证是否为代币账户
      if (!accountInfo.owner.equals(TOKEN_PROGRAM_ID)) {
        throw new Error('Invalid token account - not a valid SPL token');
      }

      // 获取代币信息
      const tokenInfo = await connection.getParsedAccountInfo(new PublicKey(tokenAddress));

      if (!tokenInfo.value) {
        throw new Error('Token account not found');
      }

      // 检查数据是否为ParsedAccountData类型
      const accountData = tokenInfo.value.data as any;
      if (Buffer.isBuffer(accountData)) {
        throw new Error('Unable to parse token account data - received raw buffer');
      }

      if (!accountData.parsed || accountData.program !== 'spl-token') {
        throw new Error('Unable to parse token account info - not a valid SPL token');
      }

      const parsedData = accountData.parsed;
      const tokenMintInfo = parsedData.info;

      return {
        name: tokenMintInfo.name || 'Unknown Token', // SPL token可能没有name字段
        symbol: tokenMintInfo.symbol || 'UNKNOWN',    // SPL token可能没有symbol字段
        decimals: tokenMintInfo.decimals || 0,
        address: tokenAddress,
        chainType: 'solana',
      };
    } catch (error) {
      console.error(`Failed to get Solana token info for ${tokenAddress}:`, error);
      throw new Error(`Failed to fetch Solana token info: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 批量获取代币信息
   */
  async getMultipleTokenInfos(tokenAddresses: string[], chainId: string): Promise<TokenInfo[]> {
    const results: TokenInfo[] = [];

    for (const address of tokenAddresses) {
      try {
        const tokenInfo = await this.getTokenInfo(address, chainId);
        if (tokenInfo) {
          results.push(tokenInfo);
        }
      } catch (error) {
        console.error(`Failed to get token info for ${address}:`, error);
        // 继续处理其他代币
      }
    }

    return results;
  }

  /**
   * 验证代币地址格式
   */
  validateTokenAddress(tokenAddress: string, chainType: 'evm' | 'solana'): boolean {
    if (chainType === 'evm') {
      return ethers.isAddress(tokenAddress);
    } else {
      try {
        new PublicKey(tokenAddress);
        return true;
      } catch {
        return false;
      }
    }
  }

  /**
   * 根据链类型验证代币地址
   */
  async validateTokenAddressForChain(tokenAddress: string, chainId: string): Promise<{
    isValid: boolean;
    chainType?: 'evm' | 'solana';
    error?: string;
  }> {
    try {
      const chain = await this.chainService.getChainByChainId(parseInt(chainId));

      if (!chain) {
        return { isValid: false, error: `Chain ${chainId} not found` };
      }

      if (chain.type === 'evm') {
        const isValid = ethers.isAddress(tokenAddress);
        return {
          isValid,
          chainType: 'evm',
          error: isValid ? undefined : 'Invalid EVM token address format'
        };
      } else if (chain.type === 'solana') {
        try {
          new PublicKey(tokenAddress);
          return {
            isValid: true,
            chainType: 'solana'
          };
        } catch {
          return {
            isValid: false,
            chainType: 'solana',
            error: 'Invalid Solana token address format'
          };
        }
      } else {
        return { isValid: false, error: `Unsupported chain type: ${chain.type}` };
      }
    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}