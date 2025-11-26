/**
 * 区块链类型检测和通用工具函数
 * 用于消除代码重复，统一链类型判断逻辑
 */

export type ChainType = 'evm' | 'solana';

export interface ChainInfo {
  type: ChainType;
  chainId?: number;
  name: string;
}

export class ChainUtils {
  /**
   * 判断是否为 Solana 链
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
   * 判断是否为 EVM 链
   */
  static isEVMChain(chain: string | number | undefined): boolean {
    if (!chain) return false;
    return !this.isSolanaChain(chain);
  }

  /**
   * 获取链类型
   */
  static getChainType(chain: string | number | undefined): ChainType {
    return this.isSolanaChain(chain) ? 'solana' : 'evm';
  }

  /**
   * 规范化链标识符
   * @param chain 链ID或名称
   * @param chains 可选的链信息数组，用于避免硬编码
   */
  static normalizeChainIdentifier(
    chain: string | number | undefined,
    chains?: Array<{name: string, type?: string, chain_id?: number}>
  ): string {
    if (!chain) return '';

    if (typeof chain === 'number') {
      return chain.toString();
    }

    const chainStr = chain.toString();
    const lowerChain = chainStr.toLowerCase();

    // 如果提供了链信息数组，优先使用数据库中的信息
    if (chains) {
      const chainInfo = chains.find(c =>
        (c.chain_id && c.chain_id.toString() === chainStr) ||
        c.name.toLowerCase().includes(lowerChain) ||
        c.name === chainStr
      );
      if (chainInfo) {
        return chainInfo.name;
      }
    }

    // Fallback to Solana network mapping (deprecated)
    if (lowerChain.includes('mainnet') || lowerChain === 'mainnet-beta') {
      return 'mainnet-beta';
    }
    if (lowerChain.includes('devnet')) {
      return 'devnet';
    }
    if (lowerChain.includes('testnet')) {
      return 'testnet';
    }

    // Fallback to hardcoded Solana chain IDs (deprecated)
    console.warn('[ChainUtils] normalizeChainIdentifier: Using hardcoded chain IDs. Please provide chains parameter.');
    const chainIdAsNumber = parseInt(chainStr);
    if (chainIdAsNumber === 501) return 'mainnet-beta';
    if (chainIdAsNumber === 502) return 'devnet';

    return chain;
  }

  /**
   * 获取链的显示名称
   * @param chain 链ID或名称
   * @param chains 可选的链信息数组，用于避免硬编码
   */
  static getChainDisplayName(
    chain: string | number | undefined,
    chains?: Array<{name: string, type?: string, chain_id?: number}>
  ): string {
    if (!chain) return 'Unknown';

    const chainStr = chain.toString();

    // 如果提供了链信息数组，优先使用
    if (chains) {
      const chainInfo = chains.find(c =>
        (c.chain_id && c.chain_id.toString() === chainStr) ||
        c.name.toLowerCase().includes(chainStr.toLowerCase()) ||
        c.name === chainStr
      );
      if (chainInfo) {
        return chainInfo.name;
      }
    }

    // Fallback to Solana network display names
    if (this.isSolanaChain(chain)) {
      const normalized = this.normalizeChainIdentifier(chainStr);
      switch (normalized) {
        case 'mainnet-beta': return 'Solana Mainnet';
        case 'devnet': return 'Solana Devnet';
        case 'testnet': return 'Solana Testnet';
        default: return `Solana ${chainStr}`;
      }
    }

    // Fallback to hardcoded EVM chain names (deprecated - should use chains parameter)
    console.warn('[ChainUtils] getChainDisplayName: Using hardcoded chain names. Please provide chains parameter.');
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
   * 获取链的简称/首字母
   */
  static getChainInitial(chain: string | number | undefined): string {
    if (!chain) return '?';

    const chainStr = chain.toString().toLowerCase();

    // 特殊链的显示字母
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

    // 默认使用名称的第一个字母
    return chainStr.charAt(0)?.toUpperCase() || '?';
  }

  /**
   * 验证地址格式是否正确
   */
  static isValidAddress(address: string, chain: string | number | undefined): boolean {
    if (!address) return false;

    if (this.isSolanaChain(chain)) {
      // Solana 地址验证
      try {
        // Solana 地址是 Base58 编码，通常是 32-44 个字符
        return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
      } catch {
        return false;
      }
    } else {
      // EVM 地址验证
      return /^0x[a-fA-F0-9]{40}$/.test(address);
    }
  }

  /**
   * 获取链的默认配置
   */
  static getChainConfig(chain: string | number | undefined): Partial<ChainInfo> {
    const type = this.getChainType(chain);

    return {
      type,
      chainId: parseInt(chain?.toString() || '0'),
      name: this.getChainDisplayName(chain),
    };
  }
}