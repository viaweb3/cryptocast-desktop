import { ethers } from 'ethers';
import { Connection, PublicKey } from '@solana/web3.js';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { publicKey } from '@metaplex-foundation/umi';
import { fetchDigitalAsset } from '@metaplex-foundation/mpl-token-metadata';

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

// ERC-20 ABI (only includes required functions)
const ERC20_ABI = [
  // Get token name
  {
    constant: true,
    inputs: [],
    name: 'name',
    outputs: [{ name: '', type: 'string' }],
    payable: false,
    stateMutability: 'view',
    type: 'function',
  },
  // Get token symbol
  {
    constant: true,
    inputs: [],
    name: 'symbol',
    outputs: [{ name: '', type: 'string' }],
    payable: false,
    stateMutability: 'view',
    type: 'function',
  },
  // Get token decimals
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
   * Get token information (unified interface)
   */
  async getTokenInfo(tokenAddress: string, chainId: string): Promise<TokenInfo | null> {
    try {
      // Get chain information (supports EVM and Solana)
      const chain = await this.chainService.getChainById(parseInt(chainId));

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
   * Get EVM token information
   */
  private async getEVMTokenInfo(tokenAddress: string, chain: any): Promise<EVMTokenInfo | null> {
    try {
      // Validate address format
      if (!ethers.isAddress(tokenAddress)) {
        throw new Error('Invalid EVM token address format');
      }

      // Create provider
      const provider = new ethers.JsonRpcProvider(chain.rpcUrl, undefined, {
        batchMaxCount: 1,
        polling: false,
      });

      // Create contract instance
      const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);

      // Set timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Token info request timeout')), 10000);
      });

      // Fetch token information in parallel
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
   * Get Solana token information
   */
  private async getSolanaTokenInfo(tokenAddress: string, chain: any): Promise<SolanaTokenInfo | null> {
    try {
      // Validate address format
      try {
        new PublicKey(tokenAddress);
      } catch {
        throw new Error('Invalid Solana token address format');
      }

      // Create connection
      const connection = new Connection(chain.rpcUrl, 'confirmed');

      // Get mint account information
      const mintInfo = await connection.getParsedAccountInfo(new PublicKey(tokenAddress));

      if (!mintInfo?.value) {
        throw new Error('Token mint account not found');
      }

      // Verify if it's a mint account
      const accountData = mintInfo.value.data as any;
      if (Buffer.isBuffer(accountData)) {
        throw new Error('Unable to parse mint account data');
      }

      if (!accountData.parsed || (accountData.program !== 'spl-token' && accountData.program !== 'spl-token-2022')) {
        throw new Error('Not a valid SPL token mint account');
      }

      const parsedData = accountData.parsed.info;
      const decimals = parsedData.decimals || 0;

      // Try to fetch Metaplex token metadata
      let name = 'SPL Token';
      let symbol = 'SPL';

      try {
        const umi = createUmi(chain.rpcUrl);
        const mint = publicKey(tokenAddress);

        // Fetch digital asset metadata
        const asset = await fetchDigitalAsset(umi, mint);

        if (asset?.metadata) {
          name = asset.metadata.name || name;
          symbol = asset.metadata.symbol || symbol;
        }
      } catch (metadataError) {
        console.warn(`Failed to fetch token metadata for ${tokenAddress}, using defaults:`, metadataError);
        // If metadata fetch fails, try to get from known list
        const knownName = this.getTokenNameFromMint(tokenAddress);
        const knownSymbol = this.getTokenSymbolFromMint(tokenAddress);
        if (knownName) name = knownName;
        if (knownSymbol) symbol = knownSymbol;
      }

      return {
        name,
        symbol,
        decimals,
        address: tokenAddress,
        chainType: 'solana',
      };
    } catch (error) {
      console.error(`Failed to get Solana token info for ${tokenAddress}:`, error);
      throw new Error(`Failed to fetch Solana token info: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get token name from mint address (simplified version, can be extended)
   */
  private getTokenNameFromMint(mintAddress: string): string | null {
    // Hardcoded mapping of common SPL tokens
    const knownTokens: { [key: string]: string } = {
      'So11111111111111111111111111111111111111112': 'Wrapped SOL',
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 'USDC',
      'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 'USDT',
      'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': 'Bonk',
      'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So': 'Raydium',
    };
    return knownTokens[mintAddress] || null;
  }

  /**
   * Get token symbol from mint address (simplified version, can be extended)
   */
  private getTokenSymbolFromMint(mintAddress: string): string | null {
    const knownTokens: { [key: string]: string } = {
      'So11111111111111111111111111111111111111112': 'SOL',
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 'USDC',
      'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 'USDT',
      'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': 'BONK',
      'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So': 'RAY',
    };
    return knownTokens[mintAddress] || null;
  }

  /**
   * Get multiple token information in batch
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
        // Continue processing other tokens
      }
    }

    return results;
  }

  /**
   * Validate token address format
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
   * Validate token address for specific chain
   */
  async validateTokenAddressForChain(tokenAddress: string, chainId: string): Promise<{
    isValid: boolean;
    chainType?: 'evm' | 'solana';
    error?: string;
  }> {
    try {
      const chain = await this.chainService.getChainById(parseInt(chainId));

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