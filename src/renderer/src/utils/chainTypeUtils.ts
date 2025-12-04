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
 * Chain type detection utilities
 * Simplified version - removed hardcoded values and duplicate code
 */

/**
 * Native token address constants
 */
export const NATIVE_TOKEN_ADDRESSES = {
  EVM: '0x0000000000000000000000000000000000000000',
  SOLANA: 'So11111111111111111111111111111111111111112'
} as const;

/**
 * Detect if the token is a native token (ETH/BNB/SOL, etc.)
 */
export function isNativeToken(tokenAddress: string | undefined, chainType?: 'evm' | 'solana'): boolean {
  if (!tokenAddress) return true; // Empty address is treated as native token

  // Check if it's the zero address
  if (tokenAddress === NATIVE_TOKEN_ADDRESSES.EVM) return true;

  // Check if it's Solana's SOL
  if (tokenAddress === NATIVE_TOKEN_ADDRESSES.SOLANA) return true;

  return false;
}

/**
 * Detect if it's a Solana chain (by chain ID)
 */
export function isSolanaChainById(chainId: string | number | undefined): boolean {
  if (!chainId) return false;
  const chainIdStr = chainId.toString();
  return chainIdStr === '501' || chainIdStr === '502' || chainIdStr.toLowerCase().includes('solana');
}

/**
 * Detect if it's a Solana chain
 * Supports objects or chain IDs
 */
export function isSolanaChain(info: ChainInfo | WalletInfo | CampaignInfo | string | number | any): boolean {
  // If it's a string or number, check directly by chain ID
  if (typeof info === 'string' || typeof info === 'number') {
    return isSolanaChainById(info);
  }

  // Check for explicit chain type fields
  if ('chainType' in info && info.chainType === 'solana') return true;
  if ('type' in info && info.type === 'solana') return true;

  // Check various possible chain ID field names
  const chainId = info.chainId || info.chain || info.id;
  if (chainId !== undefined) {
    return isSolanaChainById(chainId);
  }

  // Check if chain name contains solana
  if ('name' in info && info.name && typeof info.name === 'string') {
    return info.name.toLowerCase().includes('solana');
  }

  return false;
}

/**
 * Detect if it's an EVM chain
 */
export function isEVMChain(info: ChainInfo | WalletInfo | CampaignInfo | string | number): boolean {
  return !isSolanaChain(info);
}

/**
 * Get chain type
 */
export function getChainType(info: ChainInfo | WalletInfo | CampaignInfo | string | number): 'evm' | 'solana' {
  return isSolanaChain(info) ? 'solana' : 'evm';
}

/**
 * Validate address format for chain
 */
export function validateAddressForChain(address: string, info: ChainInfo | WalletInfo | CampaignInfo | string | number): boolean {
  if (!address) return false;

  const isSolana = isSolanaChain(info);

  if (isSolana) {
    // Solana address validation (Base58 encoded, 32-44 characters)
    return /^[1-9A-HJ-NP-Za-km-z]+$/.test(address) && address.length >= 32 && address.length <= 44;
  } else {
    // EVM address validation (0x prefix, 40 characters)
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }
}

/**
 * Decode Base64 to byte array
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
 * Convert byte array to hexadecimal string
 */
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Export private key - convert format based on chain type
 */
export function exportPrivateKey(privateKeyBase64: string, info: ChainInfo | WalletInfo | CampaignInfo | string | number): string {
  if (!privateKeyBase64) return '';

  try {
    const privateKeyBytes = base64ToBytes(privateKeyBase64);

    if (isSolanaChain(info)) {
      // Solana private key export (JSON array format)
      return JSON.stringify(Array.from(privateKeyBytes));
    } else {
      // EVM private key export (32-byte hex with 0x prefix)
      const privateKeyHex = bytesToHex(privateKeyBytes);
      return `0x${privateKeyHex}`;
    }
  } catch (error) {
    console.error('Failed to export private key:', error);
    return 'Export failed';
  }
}

/**
 * Get chain display name
 * Prioritizes provided chain information to avoid hardcoding
 */
export function getChainDisplayName(
  chain: string | number | undefined,
  chains?: Array<{ name: string; type?: string; chainId?: number }>
): string {
  if (!chain) return 'Unknown';

  const chainStr = chain.toString();

  // Prioritize provided chain information
  if (chains) {
    const chainInfo = chains.find(c =>
      (c.chainId && c.chainId.toString() === chainStr) ||
      c.name.toLowerCase().includes(chainStr.toLowerCase())
    );
    if (chainInfo) {
      return chainInfo.name;
    }
  }

  // If no chain information is provided, return the chain ID
  return `Chain ${chainStr}`;
}

/**
 * Get chain display badge
 * Uses color configuration from database to avoid hardcoding
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

  // Default values
  let color = '#6B7280';
  let bgColor = 'rgba(107, 114, 128, 0.1)';

  // Use color configuration from database
  if (chains) {
    const chainInfo = chains.find(chain =>
      chain.name.toLowerCase() === displayName.toLowerCase() ||
      chain.name.toLowerCase().includes(displayName.toLowerCase())
    );

    if (chainInfo?.color && chainInfo?.badge_color) {
      color = chainInfo.color;
      // Simple badge background color mapping
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

  // Simple icon selection
  const icon = displayName.toLowerCase().includes('solana') ? '🔥' : '🔷';

  return {
    name: displayName,
    icon,
    color,
    bgColor
  };
}
