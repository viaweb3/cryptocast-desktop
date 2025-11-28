/**
 * 全局常量配置
 * 统一管理魔法值，避免硬编码
 */

/**
 * 原生代币地址常量
 */
export const NATIVE_TOKEN_ADDRESSES = {
  /** EVM 链的原生代币地址（零地址） */
  EVM: '0x0000000000000000000000000000000000000000',
  /** Solana 链的原生代币地址（SOL） */
  SOLANA: 'So11111111111111111111111111111111111111112'
} as const;

/**
 * 检测是否为原生代币
 */
export function isNativeToken(tokenAddress: string | undefined): boolean {
  if (!tokenAddress) return true;
  if (tokenAddress === NATIVE_TOKEN_ADDRESSES.EVM) return true;
  if (tokenAddress === NATIVE_TOKEN_ADDRESSES.SOLANA) return true;
  return false;
}
