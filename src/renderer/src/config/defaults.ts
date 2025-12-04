/**
 * Frontend default configuration constants
 * Remove hardcoded values, centralize default management
 */

export const DEFAULTS = {
  // Form default values
  CAMPAIGN_FORM: {
    chain: '56',          // Default to BSC
    batchSize: {
      evm: 100,           // EVM default 100 transactions per batch
      solana: 10,         // Solana default 10 transactions per batch (simplified conservative value)
    },
    sendInterval: {
      evm: '20000',       // EVM default 20 seconds
      solana: '5000',     // Solana default 5 seconds
    }
  },

  // Send interval options (milliseconds)
  SEND_INTERVAL_OPTIONS: {
    solana: [
      { value: '3000', label: '3 seconds' },
      { value: '5000', label: '5 seconds' },
      { value: '10000', label: '10 seconds' },
      { value: '15000', label: '15 seconds' }
    ],
    evm: [
      { value: '15000', label: '15 seconds' },
      { value: '20000', label: '20 seconds' },
      { value: '30000', label: '30 seconds' },
      { value: '45000', label: '45 seconds' },
      { value: '60000', label: '60 seconds' }
    ]
  },

  // UI configuration
  UI: {
    pagination_limit: 10,      // Pagination size
    refresh_interval: 10000,    // Balance refresh interval 10 seconds
    auto_copy_timeout: 2000,    // Auto copy notification timeout
    toast_duration: 3000,       // Toast display duration
  },

  // Filter options
  FILTERS: {
    time_ranges: [
      { value: 'all', label: 'All Time' },
      { value: 'today', label: 'Today' },
      { value: 'week', label: 'This Week' },
      { value: 'month', label: 'This Month' }
    ]
  },

  // Price assumptions (USD) - Used for calculation estimates
  // Update date: 2025-11-26
  PRICE_ASSUMPTIONS: {
    ETH: 2925.61,  // Ethereum current price ~$2,926
    SOL: 138.43,   // Solana current price ~$138
    BNB: 656.84,   // BNB current price ~$657
    POL: 1.35,     // Polygon current price ~$1.35
    AVAX: 40.04,   // Avalanche current price ~$40
  }
} as const;