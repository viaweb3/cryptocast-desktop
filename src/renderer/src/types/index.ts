// Electron API types
export interface ElectronAPI {
  campaign: {
    create: (data: any) => Promise<Campaign>;
    list: (filters?: any) => Promise<Campaign[]>;
    getById: (id: string) => Promise<Campaign | null>;
    start: (id: string) => Promise<{ success: boolean }>;
    pause: (id: string) => Promise<{ success: boolean }>;
    deployContract: (campaignId: string) => Promise<{ success: boolean; contractAddress: string; transactionHash: string; gasUsed: string }>;
    onProgress: (callback: (data: ProgressData) => void) => void;
  };
  wallet: {
    create: (type?: string) => Promise<{ address: string; privateKeyBase64: string }>;
    exportPrivateKey: (privateKeyBase64: string) => Promise<string>;
    getBalance: (address: string, chain: string, tokenAddress?: string) => Promise<BalanceData>;
  };
  chain: {
    getEVMChains: (onlyEnabled?: boolean) => Promise<EVMChain[]>;
    addEVMChain: (chainData: any) => Promise<number>;
    updateEVMChain: (chainId: number, updates: any) => Promise<void>;
    deleteEVMChain: (chainId: number) => Promise<void>;
    testEVMLatency: (chainId: number) => Promise<{ latency: number; blockNumber: number }>;
    getSolanaRPCs: (network?: string, onlyEnabled?: boolean) => Promise<SolanaRPC[]>;
    getActiveSolanaRPC: (network: string) => Promise<SolanaRPC | null>;
    addSolanaRPC: (rpcData: any) => Promise<number>;
    testSolanaRPC: (rpcUrl: string) => Promise<{ success: boolean; latency?: number }>;
    updateSolanaRPCPriority: (id: number, priority: number) => Promise<void>;
    deleteSolanaRPC: (id: number) => Promise<void>;
    healthCheckSolanaRPCs: () => Promise<void>;
  };
  settings: {
    get: () => Promise<any>;
    update: (settings: any) => Promise<{ success: boolean }>;
  };
  file: {
    readCSV: (filePath: string) => Promise<any[]>;
    exportReport: (campaignId: string, format?: string) => Promise<{ success: boolean; filePath: string }>;
  };
  price: {
    getPrice: (symbol: string) => Promise<{ symbol: string; price: number }>;
    getPrices: (symbols: string[]) => Promise<Record<string, number>>;
    getGasPrice: (network: string) => Promise<any>;
    getSummary: () => Promise<any>;
  };
  gas: {
    getInfo: (rpcUrl: string, network: string, tokenPrice?: number) => Promise<any>;
    estimateBatch: (rpcUrl: string, network: string, recipientCount: number, tokenPrice?: number) => Promise<any>;
  };
  contract: {
    deploy: (config: any) => Promise<any>;
    batchTransfer: (contractAddress: string, rpcUrl: string, privateKey: string, recipients: string[], amounts: string[], tokenAddress: string) => Promise<{ success: boolean; data: any }>;
    approveTokens: (rpcUrl: string, privateKey: string, tokenAddress: string, contractAddress: string, amount: string) => Promise<{ success: boolean; txHash: string }>;
    checkApproval: (rpcUrl: string, privateKey: string, tokenAddress: string, contractAddress: string, requiredAmount: string) => Promise<{ approved: boolean }>;
    getTokenInfo: (rpcUrl: string, tokenAddress: string) => Promise<{ symbol: string; name: string; decimals: number }>;
  };
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

// Campaign types
// Enhanced Campaign interface with full functionality
export interface Campaign {
  id: string;
  name: string;
  description?: string;
  chain: string;
  tokenAddress: string;
  tokenSymbol: string;
  tokenDecimals: number;
  status: 'CREATED' | 'FUNDED' | 'READY' | 'SENDING' | 'PAUSED' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  totalRecipients: number;
  completedRecipients: number;
  failedRecipients: number;
  totalAmount: string;
  completedAmount: string;
  walletAddress?: string;
  walletPrivateKeyBase64?: string;
  contractAddress?: string;
  contractDeployedAt?: string;
  startDate?: string;
  endDate?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  recipientCSV?: string; // File path
  gasUsed: string;
  gasEstimate: string;
  batchSize: number;
  sendInterval: number;
  recipients?: Recipient[];
  transactions?: Transaction[];
}

export interface Recipient {
  id: string;
  campaignId: string;
  address: string;
  amount: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'skipped';
  transactionHash?: string;
  gasUsed?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  id: string;
  campaignId: string;
  recipientId: string;
  hash: string;
  from: string;
  to: string;
  amount: string;
  gasUsed: string;
  gasPrice: string;
  status: 'pending' | 'confirmed' | 'failed' | 'replaced';
  blockNumber?: number;
  blockHash?: string;
  timestamp: string;
  error?: string;
}

export interface CampaignEstimate {
  totalRecipients: number;
  totalAmount: string;
  gasEstimate: string;
  gasCostUSD: number;
  estimatedTime: number;
  batchCount: number;
  successProbability: number;
}

export interface CSVValidationResult {
  isValid: boolean;
  totalRecords: number;
  validRecords: number;
  invalidRecords: number;
  errors: CSVValidationError[];
  sampleData: Recipient[];
}

export interface CSVValidationError {
  row: number;
  field: 'address' | 'amount';
  value: string;
  error: string;
}

export interface WalletBalance {
  tokenAddress: string;
  tokenSymbol: string;
  tokenDecimals: number;
  balance: string;
  usdValue?: string;
}

export interface WalletExport {
  version: string;
  timestamp: string;
  wallets: Wallet[];
  settings: AppSettings;
}

export interface ProgressData {
  campaignId: string;
  current: number;
  total: number;
  percentage: number;
}

export interface BalanceData {
  native: string;
  token?: string;
}

// Chain types
export interface EVMChain {
  id?: number;
  type: 'evm';
  chainId: number;
  name: string;
  rpcUrl: string;
  rpcBackup?: string;
  explorerUrl: string;
  symbol: string;
  decimals: number;
  enabled: boolean;
  isCustom: boolean;
}

export interface SolanaRPC {
  id?: number;
  network: 'mainnet-beta' | 'devnet' | 'testnet';
  name: string;
  rpcUrl: string;
  wsUrl?: string;
  priority: number;
  latency?: number;
  uptime24h?: number;
  enabled: boolean;
}

// Settings types
export interface AppSettings {
  chains: EVMChain[];
  gasSettings: GasSettings;
  batchSettings: BatchSettings;
  securitySettings: SecuritySettings;
  notificationSettings: NotificationSettings;
}

export interface GasSettings {
  defaultGasPrice: number; // in Gwei
  defaultGasLimit: number;
  autoAdjustGas: boolean;
  maxGasPrice: number;
  priorityFee: number;
}

export interface BatchSettings {
  batchSize: number;
  sendInterval: number; // in milliseconds
  maxConcurrency: number;
  retryAttempts: number;
  retryDelay: number;
}

export interface SecuritySettings {
  autoBackup: boolean;
  backupInterval: number; // in hours
  encryptPrivateKeys: boolean;
  sessionTimeout: number; // in minutes
  requirePassword: boolean;
}

export interface NotificationSettings {
  emailNotifications: boolean;
  browserNotifications: boolean;
  campaignComplete: boolean;
  campaignFailed: boolean;
  lowBalance: boolean;
  securityAlerts: boolean;
}

// Wallet Management types
export interface ActivityWallet {
  id: string;
  campaignId: string;
  campaignName: string;
  address: string;
  privateKeyBase64?: string;
  balances: WalletBalance[];
  status: 'active' | 'pending' | 'completed' | 'failed';
  totalBalance: string;
  totalCapacity: string;
  createdAt: string;
  updatedAt: string;
  lastBalanceUpdate?: string;
}

export interface WalletDetail {
  wallet: ActivityWallet;
  transactions: WalletTransaction[];
  fundingHistory: FundingRecord[];
  balanceHistory: BalanceHistory[];
}

export interface WalletTransaction {
  id: string;
  walletId: string;
  hash: string;
  type: 'incoming' | 'outgoing' | 'self';
  amount: string;
  tokenSymbol: string;
  tokenAddress: string;
  from: string;
  to: string;
  gasUsed?: string;
  gasPrice?: string;
  status: 'pending' | 'confirmed' | 'failed';
  timestamp: string;
  blockNumber?: number;
}

export interface FundingRecord {
  id: string;
  walletId: string;
  fromAddress: string;
  amount: string;
  tokenSymbol: string;
  tokenAddress: string;
  txHash: string;
  status: 'pending' | 'confirmed' | 'failed';
  timestamp: string;
}

export interface BalanceHistory {
  id: string;
  walletId: string;
  tokenAddress: string;
  tokenSymbol: string;
  balance: string;
  usdValue: string;
  timestamp: string;
}

// Chain Configuration types
export interface ChainConfigurationForm {
  id?: number;
  name: string;
  chainId: number;
  rpcUrl: string;
  rpcBackup?: string;
  explorerUrl: string;
  symbol: string;
  decimals: number;
  gasPrice: number;
  gasLimit: number;
  batchSize: number;
  sendInterval: number;
  enabled: boolean;
  isCustom: boolean;
}

// Network Test Result
export interface NetworkTestResult {
  chainId: number;
  latency: number;
  blockNumber: number;
  gasPrice: number;
  status: 'success' | 'failed';
  error?: string;
  timestamp: string;
}

// Bulk Reward Tool Types
export interface BulkRewardActivity {
  id: string;
  name: string;
  description?: string;
  chain: string;
  chainName: string;
  tokenAddress: string;
  tokenSymbol: string;
  tokenDecimals: number;
  status: 'CREATED' | 'FUNDING' | 'READY' | 'SENDING' | 'PAUSED' | 'COMPLETED' | 'FAILED';
  totalRecipients: number;
  completedRecipients: number;
  failedRecipients: number;
  pendingRecipients: number;
  totalAmount: string;
  completedAmount: string;
  failedAmount: string;
  gasUsed: string;
  gasEstimate: string;
  gasCostUSD: number;
  walletAddress: string;
  batchContractAddress?: string;
  tokenContractAddress: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  batchSize: number;
  sendInterval: number;
  csvFilePath?: string;
  notes?: string;
}

export interface BulkRewardRecipient {
  id: string;
  activityId: string;
  address: string;
  amount: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'SKIPPED';
  transactionHash?: string;
  gasUsed?: string;
  error?: string;
  batchId?: number;
  createdAt: string;
  updatedAt: string;
  processedAt?: string;
}

export interface BulkRewardBatch {
  id: string;
  activityId: string;
  batchNumber: number;
  totalRecipients: number;
  completedRecipients: number;
  failedRecipients: number;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  transactionHash?: string;
  gasUsed?: string;
  gasPrice?: string;
  gasCost?: string;
  errorMessage?: string;
  createdAt: string;
  processedAt?: string;
}

export interface BulkRewardStatistics {
  totalActivities: number;
  successfulActivities: number;
  failedActivities: number;
  ongoingActivities: number;
  totalRecipients: number;
  completedRecipients: number;
  failedRecipients: number;
  totalGasUsed: string;
  totalGasCostUSD: number;
  weeklyActivities: number;
  weeklyGasCostUSD: number;
  successRate: number;
  averageSuccessRate: number;
}

export interface BulkRewardEstimate {
  totalRecipients: number;
  totalAmount: string;
  gasEstimate: string;
  gasCostUSD: number;
  estimatedTime: number; // in minutes
  batchCount: number;
  successProbability: number;
  costPerRecipient: number;
}

export interface BulkRewardDashboardData {
  statistics: BulkRewardStatistics;
  ongoingActivities: BulkRewardActivity[];
  recentActivities: BulkRewardActivity[];
  chainDistribution: Record<string, number>;
  weeklyTrends: {
    date: string;
    activities: number;
    recipients: number;
    gasCost: number;
  }[];
}

export interface BulkRewardCSVValidation {
  isValid: boolean;
  totalRecords: number;
  validRecords: number;
  invalidRecords: number;
  duplicateRecords: number;
  totalAmount: string;
  errors: {
    row: number;
    address: string;
    amount: string;
    error: string;
  }[];
  sampleData: BulkRewardRecipient[];
}

export interface BulkRewardSettings {
  defaultBatchSize: number;
  defaultSendInterval: number;
  maxGasPrice: number;
  priorityGasPrice: number;
  confirmationThreshold: number;
  autoRetry: boolean;
  retryAttempts: number;
  retryDelay: number;
  emailNotifications: boolean;
  webhookUrl?: string;
}

export interface BulkRewardFilter {
  status?: BulkRewardActivity['status'] | 'ALL';
  chain?: string | 'ALL';
  dateRange?: {
    start: string;
    end: string;
  };
  search?: string;
  sortBy?: 'createdAt' | 'updatedAt' | 'totalRecipients' | 'completedAt';
  sortOrder?: 'asc' | 'desc';
  page: number;
  limit: number;
}
