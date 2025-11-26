/**
 * 前端默认配置常量
 * 移除硬编码，集中管理默认值
 */

export const DEFAULTS = {
  // 表单默认值
  CAMPAIGN_FORM: {
    chain: '56',          // Default to BSC
    batchSize: {
      evm: 100,           // EVM 默认 100 笔/批
      solana: 10,         // Solana 默认 10 笔/批 (简化的保守值)
    },
    sendInterval: {
      evm: '20000',       // EVM 默认 20 秒
      solana: '5000',     // Solana 默认 5 秒
    }
  },

  // 发送间隔选项 (毫秒)
  SEND_INTERVAL_OPTIONS: {
    solana: [
      { value: '3000', label: '3秒' },
      { value: '5000', label: '5秒' },
      { value: '10000', label: '10秒' },
      { value: '15000', label: '15秒' }
    ],
    evm: [
      { value: '15000', label: '15秒' },
      { value: '20000', label: '20秒' },
      { value: '30000', label: '30秒' },
      { value: '45000', label: '45秒' },
      { value: '60000', label: '60秒' }
    ]
  },

  // UI配置
  UI: {
    pagination_limit: 10,      // 分页大小
    refresh_interval: 10000,    // 余额刷新间隔 10秒
    auto_copy_timeout: 2000,    // 自动复制提示超时
    toast_duration: 3000,       // Toast 显示时长
  },

  // 过滤器选项
  FILTERS: {
    time_ranges: [
      { value: 'all', label: '全部时间' },
      { value: 'today', label: '今天' },
      { value: 'week', label: '本周' },
      { value: 'month', label: '本月' }
    ]
  },

  // 价格假设（USD）- 用于计算估算值
  // 更新日期：2025-11-26
  PRICE_ASSUMPTIONS: {
    ETH: 2925.61,  // Ethereum 当前价格 ~$2,926
    SOL: 138.43,   // Solana 当前价格 ~$138
    BNB: 656.84,   // BNB 当前价格 ~$657
    POL: 1.35,     // Polygon 当前价格 ~$1.35
    AVAX: 40.04,   // Avalanche 当前价格 ~$40
  }
} as const;