/**
 * Frontend chain type detection and common utility functions
 * Maintains consistent logic with the backend
 */

export type ChainType = 'evm' | 'solana';

export class ChainUtils {
  /**
   * Determine if it's a Solana chain
   */
  static isSolanaChain(chain: string | number | undefined): boolean {
    if (!chain) return false;

    const chainStr = chain.toString().toLowerCase();

    // Check for Solana chain IDs (501 = mainnet, 502 = devnet/testnet)
    const chainIdAsNumber = parseInt(chainStr);
    if (chainIdAsNumber === 501 || chainIdAsNumber === 502) {
      return true;
    }

    return chainStr.includes('solana') ||
           chainStr === 'mainnet-beta' ||
           chainStr === 'devnet' ||
           chainStr === 'testnet';
  }

  /**
   * Get chain type
   */
  static getChainType(chain: string | number | undefined): ChainType {
    return this.isSolanaChain(chain) ? 'solana' : 'evm';
  }

  /**
   * Get chain display name
   */
  static getChainDisplayName(chain: string | number | undefined): string {
    if (!chain) return 'Unknown';

    const chainStr = chain.toString();

    // Solana network display names
    if (this.isSolanaChain(chain)) {
      const lowerChain = chainStr.toLowerCase();
      if (lowerChain.includes('mainnet') || lowerChain === 'mainnet-beta') {
        return 'Solana Mainnet';
      }
      if (lowerChain.includes('devnet')) {
        return 'Solana Devnet';
      }
      if (lowerChain.includes('testnet')) {
        return 'Solana Testnet';
      }
      return `Solana ${chainStr}`;
    }

    // EVM chain display name mapping
    const evmChainNames: Record<string, string> = {
      '1': 'Ethereum',
      '11155111': 'Sepolia',
      '137': 'Polygon',
      '80001': 'Mumbai',
      '42161': 'Arbitrum One',
      '421614': 'Arbitrum Sepolia',
      '10': 'Optimism',
      '11155420': 'OP Sepolia',
      '8453': 'Base',
      '84532': 'Base Sepolia',
      '56': 'BSC',
      '97': 'BSC Testnet',
      '43114': 'Avalanche',
      '43113': 'Avalanche Fuji',
    };

    return evmChainNames[chainStr] || `Chain ${chainStr}`;
  }

  /**
   * Get chain abbreviation/initial
   */
  static getChainInitial(chain: string | number | undefined): string {
    if (!chain) return '?';

    const chainStr = chain.toString().toLowerCase();

    // Display letters for specific chains
    if (chainStr.includes('sepolia') || chainStr === '11155111') return 'S';
    if (chainStr.includes('ethereum') && chainStr !== '1') return 'E';
    if (chainStr === '1') return 'E';
    if (chainStr.includes('polygon')) return 'P';
    if (chainStr.includes('arbitrum')) return 'A';
    if (chainStr.includes('optimism') || chainStr.includes('op')) return 'O';
    if (chainStr.includes('base')) return 'B';
    if (chainStr.includes('bsc') || chainStr.includes('binance')) return 'B';
    if (chainStr.includes('avalanche')) return 'A';
    if (chainStr.includes('solana')) return 'S';

    // Default to the first letter of the name
    return chainStr.charAt(0)?.toUpperCase() || '?';
  }

  /**
   * Get chain badge style
   */
  static getChainBadge(chain: string | number | undefined): { badge: string; name: string } {
    if (!chain) return { badge: 'badge-neutral', name: 'Unknown' };

    const chainStr = chain.toString();
    const chainConfig: Record<string, { badge: string; name: string }> = {
      '1': { badge: 'badge-info', name: 'Ethereum' },
      '11155111': { badge: 'badge-secondary', name: 'Sepolia' },
      '137': { badge: 'badge-secondary', name: 'Polygon' },
      '80001': { badge: 'badge-secondary', name: 'Mumbai' },
      '42161': { badge: 'badge-info', name: 'Arbitrum' },
      '421614': { badge: 'badge-info', name: 'Arbitrum Sepolia' },
      '10': { badge: 'badge-error', name: 'Optimism' },
      '11155420': { badge: 'badge-error', name: 'OP Sepolia' },
      '8453': { badge: 'badge-success', name: 'Base' },
      '84532': { badge: 'badge-success', name: 'Base Sepolia' },
      '56': { badge: 'badge-warning', name: 'BSC' },
      '97': { badge: 'badge-warning', name: 'BSC Testnet' },
      '43114': { badge: 'badge-warning', name: 'Avalanche' },
      '43113': { badge: 'badge-warning', name: 'Avalanche Fuji' },
      '501': { badge: 'badge-accent', name: 'Solana Mainnet' },
      '502': { badge: 'badge-accent', name: 'Solana Devnet' },
      'solana-mainnet-beta': { badge: 'badge-accent', name: 'Solana Mainnet' },
      'solana-devnet': { badge: 'badge-accent', name: 'Solana Devnet' },
      'solana-testnet': { badge: 'badge-accent', name: 'Solana Testnet' },
    };

    if (this.isSolanaChain(chain)) {
      return { badge: 'badge-accent', name: this.getChainDisplayName(chain) };
    }

    return chainConfig[chainStr] || { badge: 'badge-neutral', name: this.getChainDisplayName(chain) };
  }

  /**
   * Normalize chain identifier
   */
  static normalizeChainIdentifier(chain: string | number | undefined): string {
    if (!chain) return '';

    if (typeof chain === 'number') {
      return chain.toString();
    }

    // Handle string type chain identifiers
    const lowerChain = chain.toLowerCase();

    // Solana network mapping
    if (lowerChain.includes('mainnet') || lowerChain === 'mainnet-beta') {
      return 'mainnet-beta';
    }
    if (lowerChain.includes('devnet')) {
      return 'devnet';
    }
    if (lowerChain.includes('testnet')) {
      return 'testnet';
    }

    return chain;
  }
}