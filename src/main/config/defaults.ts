/**
 * 默认配置常量
 * 移除硬编码，集中管理默认值
 */

export const DEFAULTS = {
  // 交易相关默认值
  SEND_INTERVALS: {
    evm: 20000,     // EVM 默认 20 秒
    solana: 5000,   // Solana 默认 5 秒
  },

  BATCH_SIZES: {
    evm: 100,       // EVM 默认 100 笔/批
    solana: 10,     // Solana 默认 10 笔/批 (简化的保守值)
  },

  GAS_LIMITS: {
    // EVM
    standard: 21000,        // 标准转账
    token: 50000,          // ERC20转账
    deploy: 500000,        // 合约部署
    campaign: 200000,      // 活动合约调用
    campaign_deploy: 600000, // 活动合约部署（新增原生代币支持后需要更多 gas）

    // Solana
    solana_base: 5000,     // Solana基础交易费用
    solana_token_account_creation: 2039280,  // SPL账户创建费用
  },

  SOLANA_FEES: {
    // Solana费用配置
    base_fee_per_signature: 5000,
    compute_unit_limit: 200000,
    spl_account_creation_fee: 2039280,
  },

  TIMEOUTS: {
    // 超时配置 (毫秒)
    rpc: 30000,            // RPC请求超时
    transaction: {
      evm: 300000,        // EVM交易确认 5分钟
      solana: 60000,      // Solana交易确认 1分钟
    },
    balance_check: 10000,  // 余额检查间隔
    price_update: 180000,  // 价格更新间隔 3分钟
  },

  RETRY_CONFIG: {
    // 重试配置
    base_delay: 1000,      // 基础延迟 1秒
    max_delay: 30000,      // 最大延迟 30秒
    max_attempts: 5,       // 最大重试次数
  },

  SOLANA_CONFIG: {
    LAMPORTS_PER_SOL: 1000000000,
    compute_unit_limit: 200000,    // 典型的compute unit限制
  },

  PRICE_ASSUMPTIONS: {
    // 默认价格假设（USD）- 用于价格服务不可用时的fallback
    // 更新日期：2025-11-26
    ETH: 2925.61,  // Ethereum 当前价格 ~$2,926
    SOL: 138.43,   // Solana 当前价格 ~$138
    BNB: 656.84,   // BNB 当前价格 ~$657
    POL: 1.35,     // Polygon 当前价格 ~$1.35
    AVAX: 40.04,   // Avalanche 当前价格 ~$40
  },

  UI_CONFIG: {
    // UI相关默认值
    pagination_limit: 10,    // 分页大小
    refresh_interval: 30000, // 自动刷新间隔
    min_window_width: 1000,  // 最小窗口宽度
  }
} as const;