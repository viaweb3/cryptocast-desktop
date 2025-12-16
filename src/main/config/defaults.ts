/**
 * Default configuration constants
 * Remove hardcoding and centralize default values management
 */

export const DEFAULTS = {
  // Transaction-related default values
  SEND_INTERVALS: {
    evm: 20000, // EVM default 20 seconds
    solana: 5000 // Solana default 5 seconds
  },

  BATCH_SIZES: {
    evm: 100, // EVM default 100 transactions/batch
    solana: 10 // Solana default 10 transactions/batch (simplified conservative value)
  },

  GAS_LIMITS: {
    // EVM
    standard: 21000, // Standard transfer
    token: 50000, // ERC20 transfer
    deploy: 500000, // Contract deployment
    campaign: 200000, // Campaign contract call
    campaign_deploy: 600000, // Campaign contract deployment (requires more gas after adding native token support)

    // Solana
    solana_base: 5000, // Solana base transaction fee
    solana_token_account_creation: 2039280 // SPL account creation fee
  },

  SOLANA_FEES: {
    // Solana fee configuration
    base_fee_per_signature: 5000,
    compute_unit_limit: 200000,
    spl_account_creation_fee: 2039280,
    ata_creation_fee_sol: 0.0021 // ATA creation fee in SOL (fixed per address)
  },

  TIMEOUTS: {
    // Timeout configuration (milliseconds)
    rpc: 30000, // RPC request timeout
    transaction: {
      evm: 300000, // EVM transaction confirmation 5 minutes
      solana: 60000 // Solana transaction confirmation 1 minute
    },
    balance_check: 10000, // Balance check interval
    price_update: 180000 // Price update interval 3 minutes
  },

  RETRY_CONFIG: {
    // Retry configuration
    base_delay: 1000, // Base delay 1 second
    max_delay: 30000, // Maximum delay 30 seconds
    max_attempts: 5 // Maximum retry attempts
  },

  SOLANA_CONFIG: {
    LAMPORTS_PER_SOL: 1000000000,
    compute_unit_limit: 200000 // Typical compute unit limit
  },

  PRICE_ASSUMPTIONS: {
    // Default price assumptions (USD) - fallback when price service is unavailable
    // Update date: 2025-11-26
    ETH: 2925.61, // Ethereum current price ~$2,926
    SOL: 138.43, // Solana current price ~$138
    BNB: 656.84, // BNB current price ~$657
    POL: 1.35, // Polygon current price ~$1.35
    AVAX: 40.04 // Avalanche current price ~$40
  },

  UI_CONFIG: {
    // UI-related default values
    pagination_limit: 10, // Pagination size
    refresh_interval: 30000, // Auto-refresh interval
    min_window_width: 1000 // Minimum window width
  }
} as const;
