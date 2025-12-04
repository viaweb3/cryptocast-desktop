/**
 * Global constant configuration
 * Centrally manage magic values, avoid hardcoding
 */

/**
 * Native token address constants
 */
export const NATIVE_TOKEN_ADDRESSES = {
  /** Native token address for EVM chains (zero address) */
  EVM: '0x0000000000000000000000000000000000000000',
  /** Native token address for Solana chains (SOL) */
  SOLANA: 'So11111111111111111111111111111111111111112'
} as const;

/**
 * Check if token is native token
 */
export function isNativeToken(tokenAddress: string | undefined): boolean {
  if (!tokenAddress) return true;
  if (tokenAddress === NATIVE_TOKEN_ADDRESSES.EVM) return true;
  if (tokenAddress === NATIVE_TOKEN_ADDRESSES.SOLANA) return true;
  return false;
}
