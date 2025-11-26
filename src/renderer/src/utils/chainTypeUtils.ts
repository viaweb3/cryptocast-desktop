import { ChainInfo, CampaignInfo, WalletInfo } from '../../main/database/sqlite-schema';

/**
 * 链类型检测工具
 * 统一链类型判断逻辑，移除硬编码
 */

/**
 * 检测是否为Solana链
 */
export function isSolanaChain(info: ChainInfo | WalletInfo | CampaignInfo): boolean {
  // 1. 优先检查明确的链类型字段
  if ('chainType' in info && info.chainType === 'solana') return true;

  // 2. 检查chainId
  const chainId = info.chainId || info.chain;
  if (chainId !== undefined) {
    const chainIdStr = chainId.toString();
    return chainIdStr === '501' || chainIdStr === '502';
  }

  // 3. 检查网络名称
  const network = (info as any).network || (info as any).chain;
  if (network && typeof network === 'string') {
    return network.toLowerCase().includes('solana');
  }

  // 4. 检查名称字段
  const name = info.name || '';
  if (name.toLowerCase().includes('solana')) return true;

  return false;
}

/**
 * 检测是否为EVM链
 */
export function isEVMChain(info: ChainInfo | WalletInfo | CampaignInfo): boolean {
  return !isSolanaChain(info);
}

/**
 * 获取链类型
 */
export function getChainType(info: ChainInfo | WalletInfo | CampaignInfo): 'evm' | 'solana' {
  return isSolanaChain(info) ? 'solana' : 'evm';
}

/**
 * 验证链地址格式
 */
export function validateAddressForChain(address: string, info: ChainInfo | WalletInfo | CampaignInfo): boolean {
  if (!address) return false;

  const isSolana = isSolanaChain(info);

  if (isSolana) {
    // Solana地址验证 (Base58编码，32-44字符)
    try {
      return /^[1-9A-HJ-NP-Za-km-z][^]+$/.test(address) && address.length >= 32 && address.length <= 44;
    } catch {
      return false;
    }
  } else {
    // EVM地址验证 (0x前缀，40字符)
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }
}

/**
 * Base64解码为字节数组（浏览器兼容）
 */
function base64ToBytes(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * 字节数组转十六进制字符串
 */
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * 导出私钥 - 统一处理不同链类型
 */
export function exportPrivateKey(privateKeyBase64: string, info: ChainInfo | WalletInfo | CampaignInfo): string {
  if (!privateKeyBase64) return '';

  try {
    // 使用浏览器兼容的方式解码 base64
    const privateKeyBytes = base64ToBytes(privateKeyBase64);

    if (isSolanaChain(info)) {
      // Solana私钥导出（JSON数组格式）
      return JSON.stringify(Array.from(privateKeyBytes));
    } else {
      // EVM私钥导出（32字节hex，带0x前缀）
      const privateKeyHex = bytesToHex(privateKeyBytes);
      return `0x${privateKeyHex}`;
    }
  } catch (error) {
    console.error('Failed to export private key:', error);
    return 'Export failed';
  }
}

/**
 * 获取链显示名称
 */
export function getChainDisplayName(
  chain: string | number | undefined,
  chains?: Array<{ name: string; type?: string; chain_id?: number }>
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
  if (chainStr.includes('solana') || chainStr === '501' || chainStr === '502') {
    if (chainStr === '501' || chainStr.includes('mainnet')) return 'Solana Mainnet';
    if (chainStr === '502' || chainStr.includes('devnet')) return 'Solana Devnet';
    if (chainStr.includes('testnet')) return 'Solana Testnet';
    return `Solana ${chainStr}`;
  }

  // Fallback to hardcoded EVM chain names (deprecated)
  console.warn('[getChainDisplayName] Using hardcoded chain names. Please provide chains parameter.');
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
export function getChainInitial(chain: string | number | undefined): string {
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

// 辅助函数：根据badge类型获取背景色
function getBadgeBackground(badgeColor: string): string {
  const badgeBackgrounds: Record<string, string> = {
    'badge-primary': 'rgba(107, 114, 128, 0.1)',
    'badge-secondary': 'rgba(107, 114, 128, 0.1)',
    'badge-neutral': 'rgba(107, 114, 128, 0.1)',
    'badge-info': 'rgba(59, 130, 246, 0.1)',
    'badge-success': 'rgba(34, 197, 94, 0.1)',
    'badge-warning': 'rgba(251, 146, 60, 0.1)',
    'badge-error': 'rgba(239, 68, 68, 0.1)',
    'badge-accent': 'rgba(20, 241, 149, 0.1)'
  };
  return badgeBackgrounds[badgeColor] || 'rgba(107, 114, 128, 0.1)';
}

// 图标映射
function getIcon(name: string): string {
  const icons = ['🔷', '🟣', '🔵', '🟡', '🔴', '🟢', '🟠', '⚡', '🌟', '🚀'];

  // Solana特殊图标
  if (name.toLowerCase().includes('solana')) return '🔥';

  // 基于名称哈希的图标
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash + name.charCodeAt(i)) & 0xffffffff;
  }
  return icons[Math.abs(hash) % icons.length];
}

// Fallback颜色映射（deprecated）
function getFallbackColor(name: string, isSolana: boolean): { color: string; bgColor: string } {
  if (isSolana) {
    return { color: '#14F195', bgColor: 'rgba(20, 241, 149, 0.1)' };
  }

  const evmColors: Record<string, { color: string; bgColor: string }> = {
    'Ethereum': { color: '#627EEA', bgColor: 'rgba(98, 126, 234, 0.1)' },
    'Polygon': { color: '#8247E5', bgColor: 'rgba(130, 71, 229, 0.1)' },
    'Arbitrum': { color: '#28A0F0', bgColor: 'rgba(40, 160, 240, 0.1)' },
    'Optimism': { color: '#FF0420', bgColor: 'rgba(255, 4, 32, 0.1)' },
    'Base': { color: '#0052FF', bgColor: 'rgba(0, 82, 255, 0.1)' },
    'BSC': { color: '#F3BA2F', bgColor: 'rgba(243, 186, 47, 0.1)' },
    'Avalanche': { color: '#E84142', bgColor: 'rgba(232, 65, 66, 0.1)' },
  };

  for (const [chainName, colors] of Object.entries(evmColors)) {
    if (name.toLowerCase().includes(chainName.toLowerCase())) {
      return colors;
    }
  }

  return { color: '#6B7280', bgColor: 'rgba(107, 114, 128, 0.1)' };
}

/**
 * 获取链的显示徽章组件
 * @param info 链信息对象
 * @param chains 包含颜色配置的链列表（可选）
 * @returns 显示徽章的props
 */
export function getChainDisplayBadge(
  info: ChainInfo,
  chains?: Array<{ name: string; color?: string; badge_color?: string }>
): {
  name: string;
  icon: string;
  color: string;
  bgColor: string;
} {
  const displayName = getChainDisplayName(info, chains);

  // 优先使用数据库中的颜色配置
  if (chains && chains.length > 0) {
    const chainInfo = chains.find(chain =>
      chain.name.toLowerCase() === displayName.toLowerCase() ||
      chain.name.toLowerCase().includes(displayName.toLowerCase()) ||
      displayName.toLowerCase().includes(chain.name.toLowerCase())
    );

    if (chainInfo?.color && chainInfo?.badge_color) {
      return {
        name: displayName,
        icon: getIcon(displayName),
        color: chainInfo.color,
        bgColor: getBadgeBackground(chainInfo.badge_color)
      };
    }
  }

  // Fallback to hardcoded colors (deprecated)
  console.warn('[getChainDisplayBadge] Using hardcoded colors. Please provide chains with color data.');
  const isSolana = isSolanaChain(info);
  const { color, bgColor } = getFallbackColor(displayName, isSolana);

  return {
    name: displayName,
    icon: getIcon(displayName),
    color,
    bgColor
  };
}