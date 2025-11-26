import { contextBridge, ipcRenderer } from 'electron';

// 暴露安全的API给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 活动操作
  campaign: {
    create: (data: any) => ipcRenderer.invoke('campaign:create', data),
    list: (filters?: any) => ipcRenderer.invoke('campaign:list', filters),
    getById: (id: string) => ipcRenderer.invoke('campaign:getById', id),
    start: (id: string) => ipcRenderer.invoke('campaign:start', id),
    pause: (id: string) => ipcRenderer.invoke('campaign:pause', id),
    resume: (id: string) => ipcRenderer.invoke('campaign:resume', id),
    updateStatus: (id: string, status: string) => ipcRenderer.invoke('campaign:updateStatus', id, status),
    getDetails: (id: string) => ipcRenderer.invoke('campaign:getDetails', id),
    getTransactions: (id: string, options?: any) => ipcRenderer.invoke('campaign:getTransactions', id, options),
    getRecipients: (id: string) => ipcRenderer.invoke('campaign:getRecipients', id),
    estimate: (request: any) => ipcRenderer.invoke('campaign:estimate', request),
    deployContract: (id: string) => ipcRenderer.invoke('campaign:deployContract', id),
    retryFailedTransactions: (id: string) => ipcRenderer.invoke('campaign:retryFailedTransactions', id),
    withdrawTokens: (campaignId: string, recipientAddress: string) => ipcRenderer.invoke('campaign:withdrawTokens', campaignId, recipientAddress),
    withdrawNative: (campaignId: string, recipientAddress: string) => ipcRenderer.invoke('campaign:withdrawNative', campaignId, recipientAddress),
    onProgress: (callback: any) => {
      ipcRenderer.on('campaign:progress', (_event, data) => callback(data));
    },
  },

  // Solana操作
  solana: {
    getBalance: (rpcUrl: string, walletAddress: string, tokenAddress?: string) =>
      ipcRenderer.invoke('solana:getBalance', rpcUrl, walletAddress, tokenAddress),
    batchTransfer: (rpcUrl: string, privateKeyBase64: string, recipients: string[], amounts: string[], tokenAddress: string) =>
      ipcRenderer.invoke('solana:batchTransfer', rpcUrl, privateKeyBase64, recipients, amounts, tokenAddress),
    getTransactionStatus: (rpcUrl: string, transactionHash: string) =>
      ipcRenderer.invoke('solana:getTransactionStatus', rpcUrl, transactionHash),
    getTokenInfo: (rpcUrl: string, tokenAddress: string) =>
      ipcRenderer.invoke('solana:getTokenInfo', rpcUrl, tokenAddress),
  },

  // 钱包操作
  wallet: {
    create: (type?: string) => ipcRenderer.invoke('wallet:create', type),
    getBalance: (address: string, chain: string, tokenAddress?: string) =>
      ipcRenderer.invoke('wallet:getBalance', address, chain, tokenAddress),
    list: (options?: any) => ipcRenderer.invoke('wallet:list', options),
    getBalances: (campaignId: string) => ipcRenderer.invoke('wallet:getBalances', campaignId),
    exportEVMPrivateKey: (privateKeyBase64: string) => ipcRenderer.invoke('wallet:exportEVMPrivateKey', privateKeyBase64),
    exportSolanaPrivateKey: (privateKeyBase64: string) => ipcRenderer.invoke('wallet:exportSolanaPrivateKey', privateKeyBase64),
  },

  // 区块链操作
  blockchain: {
    getBalance: (address: string, chain: string, tokenAddress?: string) =>
      ipcRenderer.invoke('wallet:getBalance', address, chain, tokenAddress),
    estimateGas: (chain: string, fromAddress: string, toAddress: string, tokenAddress: string, recipientCount: number) =>
      ipcRenderer.invoke('blockchain:estimateGas', chain, fromAddress, toAddress, tokenAddress, recipientCount),
    getTransactionStatus: (txHash: string, chain: string) =>
      ipcRenderer.invoke('blockchain:getTransactionStatus', txHash, chain),
  },

  // 链管理
  chain: {
    getAllChains: () =>
      ipcRenderer.invoke('chain:getAllChains'),
    getEVMChains: () =>
      ipcRenderer.invoke('chain:getEVMChains'),
    addEVMChain: (chainData: any) =>
      ipcRenderer.invoke('chain:addEVMChain', chainData),
    updateEVMChain: (chainId: number, updates: any) =>
      ipcRenderer.invoke('chain:updateEVMChain', chainId, updates),
    deleteEVMChain: (chainId: number) =>
      ipcRenderer.invoke('chain:deleteEVMChain', chainId),
    testEVMLatency: (chainId: number) =>
      ipcRenderer.invoke('chain:testEVMLatency', chainId),
    getSolanaRPCs: (network?: string, onlyEnabled?: boolean) =>
      ipcRenderer.invoke('chain:getSolanaRPCs', network, onlyEnabled),
        addSolanaRPC: (rpcData: any) =>
      ipcRenderer.invoke('chain:addSolanaRPC', rpcData),
    testSolanaRPC: (rpcUrl: string) =>
      ipcRenderer.invoke('chain:testSolanaRPC', rpcUrl),
    updateSolanaRPCPriority: (id: number, priority: number) =>
      ipcRenderer.invoke('chain:updateSolanaRPCPriority', id, priority),
    deleteSolanaRPC: (id: number) =>
      ipcRenderer.invoke('chain:deleteSolanaRPC', id),
      },

  // 设置
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    update: (settings: any) => ipcRenderer.invoke('settings:update', settings),
  },

  // 文件操作
  file: {
    readCSV: (filePath: string) => ipcRenderer.invoke('file:readCSV', filePath),
    exportReport: (campaignId: string) =>
      ipcRenderer.invoke('file:exportReport', campaignId),
  },

  // 价格服务
  price: {
    getPrice: (symbol: string) => ipcRenderer.invoke('price:getPrice', symbol),
    getPrices: (symbols: string[]) => ipcRenderer.invoke('price:getPrices', symbols),
    getCachedPrices: (symbols: string[]) => ipcRenderer.invoke('price:getCachedPrices', symbols),
    getSummary: () => ipcRenderer.invoke('price:getSummary'),
  },

  // 代币服务
  token: {
    getInfo: (tokenAddress: string, chainId: string) =>
      ipcRenderer.invoke('token:getInfo', tokenAddress, chainId),
    validateAddress: (tokenAddress: string, chainId: string) =>
      ipcRenderer.invoke('token:validateAddress', tokenAddress, chainId),
    getMultipleInfo: (tokenAddresses: string[], chainId: string) =>
      ipcRenderer.invoke('token:getMultipleInfo', tokenAddresses, chainId),
  },
});
