// Types that were previously imported from main
interface ChainInfo {
  id: number;
  name: string;
  rpcUrl: string;
  symbol: string;
  decimals: number;
  chainId: number;
  type: 'evm' | 'solana';
}

interface WalletInfo {
  address: string;
  chainId: number;
  balance: string;
  timestamp: string;
}

interface CampaignInfo {
  id: string;
  name: string;
  chainId: number;
  status: string;
  createdAt: string;
}

/**
 * 链类型检测工具
 * 简化版本 - 移除硬编码和重复代码
 */

/**
 * 原生代币地址常量
 */
export const NATIVE_TOKEN_ADDRESSES = {
  EVM: '0x0000000000000000000000000000000000000000',
  SOLANA: 'So11111111111111111111111111111111111111112'
} as const;

/**
 * 检测是否为原生代币（ETH/BNB/SOL 等）
 */
export function isNativeToken(tokenAddress: string | undefined, chainType?: 'evm' | 'solana'): boolean {
  if (!tokenAddress) return true; // 空地址视为原生代币

  // 检查是否是零地址
  if (tokenAddress === NATIVE_TOKEN_ADDRESSES.EVM) return true;

  // 检查是否是 Solana 的 SOL
  if (tokenAddress === NATIVE_TOKEN_ADDRESSES.SOLANA) return true;

  return false;
}

/**
 * 检测是否为Solana链（根据链ID）
 */
export function isSolanaChainById(chainId: string | number | undefined): boolean {
  if (!chainId) return false;
  const chainIdStr = chainId.toString();
  return chainIdStr === '501' || chainIdStr === '502' || chainIdStr.toLowerCase().includes('solana');
}

/**
 * 检测是否为Solana链
 * 支持对象或链ID
 */
export function isSolanaChain(info: ChainInfo | WalletInfo | CampaignInfo | string | number | any): boolean {
  // 如果是字符串或数字，直接按链ID检查
  if (typeof info === 'string' || typeof info === 'number') {
    return isSolanaChainById(info);
  }

  // 检查明确的链类型字段
  if ('chainType' in info && info.chainType === 'solana') return true;
  if ('type' in info && info.type === 'solana') return true;

  // 检查各种可能的链ID字段名
  const chainId = info.chainId || info.chain || info.id;
  if (chainId !== undefined) {
    return isSolanaChainById(chainId);
  }

  // 检查链名称是否包含solana
  if ('name' in info && info.name && typeof info.name === 'string') {
    return info.name.toLowerCase().includes('solana');
  }

  return false;
}

/**
 * 检测是否为EVM链
 */
export function isEVMChain(info: ChainInfo | WalletInfo | CampaignInfo | string | number): boolean {
  return !isSolanaChain(info);
}

/**
 * 获取链类型
 */
export function getChainType(info: ChainInfo | WalletInfo | CampaignInfo | string | number): 'evm' | 'solana' {
  return isSolanaChain(info) ? 'solana' : 'evm';
}

/**
 * 验证链地址格式
 */
export function validateAddressForChain(address: string, info: ChainInfo | WalletInfo | CampaignInfo | string | number): boolean {
  if (!address) return false;

  const isSolana = isSolanaChain(info);

  if (isSolana) {
    // Solana地址验证 (Base58编码，32-44字符)
    return /^[1-9A-HJ-NP-Za-km-z]+$/.test(address) && address.length >= 32 && address.length <= 44;
  } else {
    // EVM地址验证 (0x前缀，40字符)
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }
}

/**
 * Base64解码为字节数组
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
 * 导出私钥 - 根据链类型转换格式
 */
export function exportPrivateKey(privateKeyBase64: string, info: ChainInfo | WalletInfo | CampaignInfo | string | number): string {
  if (!privateKeyBase64) return '';

  try {
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
 * 优先使用提供的链信息，避免硬编码
 */
export function getChainDisplayName(
  chain: string | number | undefined,
  chains?: Array<{ name: string; type?: string; chainId?: number }>
): string {
  if (!chain) return 'Unknown';

  const chainStr = chain.toString();

  // 优先使用提供的链信息
  if (chains) {
    const chainInfo = chains.find(c =>
      (c.chainId && c.chainId.toString() === chainStr) ||
      c.name.toLowerCase().includes(chainStr.toLowerCase())
    );
    if (chainInfo) {
      return chainInfo.name;
    }
  }

  // 如果没有提供链信息，返回链ID
  return `Chain ${chainStr}`;
}

/**
 * 获取链的显示徽章
 * 使用数据库中的颜色配置，避免硬编码
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
  const displayName = getChainDisplayName(info.chainId || info.name, chains);

  // 默认值
  let color = '#6B7280';
  let bgColor = 'rgba(107, 114, 128, 0.1)';

  // 使用数据库中的颜色配置
  if (chains) {
    const chainInfo = chains.find(chain =>
      chain.name.toLowerCase() === displayName.toLowerCase() ||
      chain.name.toLowerCase().includes(displayName.toLowerCase())
    );

    if (chainInfo?.color && chainInfo?.badge_color) {
      color = chainInfo.color;
      // 简单的badge背景色映射
      const badgeBackgrounds: Record<string, string> = {
        'badge-primary': 'rgba(107, 114, 128, 0.1)',
        'badge-info': 'rgba(59, 130, 246, 0.1)',
        'badge-success': 'rgba(34, 197, 94, 0.1)',
        'badge-warning': 'rgba(251, 146, 60, 0.1)',
        'badge-error': 'rgba(239, 68, 68, 0.1)',
        'badge-accent': 'rgba(20, 241, 149, 0.1)'
      };
      bgColor = badgeBackgrounds[chainInfo.badge_color] || 'rgba(107, 114, 128, 0.1)';
    }
  }

  // 简单的图标选择
  const icon = displayName.toLowerCase().includes('solana') ? '🔥' : '🔷';

  return {
    name: displayName,
    icon,
    color,
    bgColor
  };
}
