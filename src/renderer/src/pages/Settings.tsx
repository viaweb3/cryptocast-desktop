import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import {
  AppSettings,
  EVMChain,
  SolanaChain,
  ChainConfigurationForm,
  NetworkTestResult
} from '../types';

// 获取链的显示字母
function getChainInitial(name: string, symbol?: string): string {
  const lowerName = name.toLowerCase();

  // 特殊链的显示字母
  if (lowerName.includes('ethereum') && lowerName.includes('sepolia')) return 'S'; // Sepolia
  if (lowerName.includes('ethereum')) return 'E'; // Ethereum Mainnet
  if (lowerName.includes('polygon')) return 'P'; // Polygon
  if (lowerName.includes('arbitrum')) return 'A'; // Arbitrum
  if (lowerName.includes('base')) return 'B'; // Base
  if (lowerName.includes('optimism')) return 'O'; // Optimism
  if (lowerName.includes('bsc') || lowerName.includes('binance')) return 'B'; // BSC
  if (lowerName.includes('avalanche')) return 'A'; // Avalanche
  if (lowerName.includes('solana')) return 'S'; // Solana

  // 默认使用symbol的第一个字母
  return symbol?.charAt(0)?.toUpperCase() || name.charAt(0)?.toUpperCase() || '⚡';
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  chain: EVMChain | null;
  onSave: (chainData: ChainConfigurationForm) => void;
}

function ChainEditModal({ isOpen, onClose, chain, onSave }: SettingsModalProps) {
  const [formData, setFormData] = useState<ChainConfigurationForm>({
    name: '',
    chainId: 1,
    rpcUrl: '',
    rpcBackup: '',
    explorerUrl: '',
    symbol: '',
    decimals: 18,
    gasPrice: 30,
    gasLimit: 210000,
    batchSize: 100,
    sendInterval: 2000,
    isCustom: false,
  });

  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ latency: number; blockNumber: number } | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  const [isTestingBackup, setIsTestingBackup] = useState(false);
  const [testResultBackup, setTestResultBackup] = useState<{ latency: number; blockNumber: number } | null>(null);
  const [testErrorBackup, setTestErrorBackup] = useState<string | null>(null);

  useEffect(() => {
    if (chain) {
      setFormData({
        id: chain.id,
        name: chain.name,
        chainId: chain.chainId,
        rpcUrl: chain.rpcUrl,
        rpcBackup: chain.rpcBackup || '',
        explorerUrl: chain.explorerUrl,
        symbol: chain.symbol,
        decimals: chain.decimals,
        gasPrice: 30,
        gasLimit: 210000,
        batchSize: 100,
        sendInterval: 2000,
        isCustom: chain.isCustom,
      });
    }
  }, [chain]);

  if (!isOpen) {
    return null;
  }
  if (!chain) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const handleTestRPC = async () => {
    if (isTesting || !formData.rpcUrl) {
      return;
    }

    setIsTesting(true);
    setTestError(null);
    setTestResult(null);

    try {
      if (window.electronAPI?.chain) {
        const result = await window.electronAPI.chain.testEVMLatency(formData.rpcUrl);
        setTestResult(result);
      }
    } catch (error) {
      console.error('测试失败:', error);
      setTestError(error instanceof Error ? error.message : '连接失败');
    } finally {
      setIsTesting(false);
    }
  };

  const handleTestBackupRPC = async () => {
    if (isTestingBackup || !formData.rpcBackup) {
      return;
    }

    setIsTestingBackup(true);
    setTestErrorBackup(null);
    setTestResultBackup(null);

    try {
      if (window.electronAPI?.chain) {
        const result = await window.electronAPI.chain.testEVMLatency(formData.rpcBackup);
        setTestResultBackup(result);
      }
    } catch (error) {
      console.error('备用RPC测试失败:', error);
      setTestErrorBackup(error instanceof Error ? error.message : '连接失败');
    } finally {
      setIsTestingBackup(false);
    }
  };

  const isNewChain = !chain.id || chain.id === 0;

  const modalContent = (
    <div className="modal modal-open">
      <div className="modal-box w-11/12 max-w-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">
            {isNewChain ? '➕ 添加自定义网络' : `⚙️ 编辑 ${chain.name} 配置`}
          </h2>
          <button
            onClick={onClose}
            className="btn btn-sm btn-circle btn-ghost"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Basic Chain Information */}
          <div className="collapse collapse-arrow bg-base-200 mb-4">
            <input type="checkbox" defaultChecked className="min-w-fit" />
            <div className="collapse-title text-lg font-semibold">
              🔗 基础信息
            </div>
            <div className="collapse-content">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-medium">链名称</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="input input-bordered"
                    style={{ border: '1px solid #d1d5db', backgroundColor: '#ffffff' }}
                    required
                  />
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-medium">Chain ID</span>
                  </label>
                  <input
                    type="number"
                    value={formData.chainId}
                    onChange={(e) => setFormData({ ...formData, chainId: parseInt(e.target.value) })}
                    className="input input-bordered"
                    style={{ border: '1px solid #d1d5db', backgroundColor: '#ffffff' }}
                    required
                  />
                </div>
              </div>

              <div className="form-control mt-4">
                <label className="label">
                  <span className="label-text font-medium">RPC 节点 URL</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={formData.rpcUrl}
                    onChange={(e) => {
                      setFormData({ ...formData, rpcUrl: e.target.value });
                      setTestResult(null);
                      setTestError(null);
                    }}
                    className="input input-bordered flex-1"
                    style={{ border: '1px solid #d1d5db', backgroundColor: '#ffffff' }}
                    placeholder="https://polygon.llamarpc.com"
                    required
                  />
                  <button
                    type="button"
                    onClick={handleTestRPC}
                    disabled={isTesting || !formData.rpcUrl}
                    className="btn btn-outline btn-sm"
                  >
                    {isTesting ? (
                      <>
                        <span className="loading loading-spinner loading-xs"></span>
                        测试中
                      </>
                    ) : (
                      '🧪 测试'
                    )}
                  </button>
                </div>
                {testResult && (
                  <div className="alert alert-success mt-2">
                    <div className="text-sm">
                      ✅ 延迟: {testResult.latency}ms | 区块: {testResult.blockNumber}
                    </div>
                  </div>
                )}
                {testError && (
                  <div className="alert alert-error mt-2">
                    <div className="text-sm">
                      ❌ {testError}
                    </div>
                  </div>
                )}
                <label className="label">
                  <span className="label-text-alt">建议配置多个 URL 以实现冗余备份</span>
                </label>
              </div>

              <div className="form-control mt-4">
                <label className="label">
                  <span className="label-text font-medium">备用 RPC URL</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={formData.rpcBackup}
                    onChange={(e) => {
                      setFormData({ ...formData, rpcBackup: e.target.value });
                      setTestResultBackup(null);
                      setTestErrorBackup(null);
                    }}
                    className="input input-bordered flex-1"
                    style={{ border: '1px solid #d1d5db', backgroundColor: '#ffffff' }}
                    placeholder="https://polygon-mainnet.infura.io/v3/YOUR_PROJECT_ID"
                  />
                  <button
                    type="button"
                    onClick={handleTestBackupRPC}
                    disabled={isTestingBackup || !formData.rpcBackup}
                    className="btn btn-outline btn-sm"
                  >
                    {isTestingBackup ? (
                      <>
                        <span className="loading loading-spinner loading-xs"></span>
                        测试中
                      </>
                    ) : (
                      '🧪 测试'
                    )}
                  </button>
                </div>
                {testResultBackup && (
                  <div className="alert alert-success mt-2">
                    <div className="text-sm">
                      ✅ 延迟: {testResultBackup.latency}ms | 区块: {testResultBackup.blockNumber}
                    </div>
                  </div>
                )}
                {testErrorBackup && (
                  <div className="alert alert-error mt-2">
                    <div className="text-sm">
                      ❌ {testErrorBackup}
                    </div>
                  </div>
                )}
              </div>

              <div className="form-control mt-4">
                <label className="label">
                  <span className="label-text font-medium">区块链浏览器 URL</span>
                </label>
                <input
                  type="url"
                  value={formData.explorerUrl}
                  onChange={(e) => setFormData({ ...formData, explorerUrl: e.target.value })}
                  className="input input-bordered"
                  style={{ border: '1px solid #d1d5db', backgroundColor: '#ffffff' }}
                  placeholder="https://polygonscan.com"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-medium">代币符号</span>
                  </label>
                  <input
                    type="text"
                    value={formData.symbol}
                    onChange={(e) => setFormData({ ...formData, symbol: e.target.value })}
                    className="input input-bordered"
                    style={{ border: '1px solid #d1d5db', backgroundColor: '#ffffff' }}
                    placeholder="MATIC"
                    required
                  />
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-medium">代币精度</span>
                  </label>
                  <input
                    type="number"
                    value={formData.decimals}
                    onChange={(e) => setFormData({ ...formData, decimals: parseInt(e.target.value) })}
                    className="input input-bordered"
                    style={{ border: '1px solid #d1d5db', backgroundColor: '#ffffff' }}
                    min="0"
                    max="18"
                    required
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="modal-action">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-ghost"
            >
              取消
            </button>
            <button
              type="submit"
              className="btn btn-primary"
            >
              💾 保存设置
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

interface SolanaEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  chain: SolanaChain | null;
  onSave: (chainData: SolanaChain) => void;
}

function SolanaEditModal({ isOpen, onClose, chain, onSave }: SolanaEditModalProps) {
  const [formData, setFormData] = useState<SolanaChain>({
    type: 'solana',
    name: '',
    rpcUrl: '',
    rpcBackup: '',
    explorerUrl: '',
    symbol: 'SOL',
    decimals: 9,
    isCustom: false,
  });

  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ latency: number; blockNumber: number } | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  useEffect(() => {
    if (chain) {
      setFormData({
        id: chain.id,
        type: 'solana',
        chainId: chain.chainId,
        name: chain.name,
        rpcUrl: chain.rpcUrl,
        rpcBackup: chain.rpcBackup || '',
        explorerUrl: chain.explorerUrl || '',
        symbol: chain.symbol,
        decimals: chain.decimals,
        color: chain.color,
        badgeColor: chain.badgeColor,
        isCustom: chain.isCustom,
      });
    }
  }, [chain]);

  if (!isOpen || !chain) {
    return null;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const handleTestRPC = async () => {
    if (isTesting || !formData.rpcUrl) {
      return;
    }

    setIsTesting(true);
    setTestError(null);
    setTestResult(null);

    try {
      if (window.electronAPI?.chain) {
        const result = await window.electronAPI.chain.testSolanaRPC(formData.rpcUrl);
        if (result.success && result.latency !== undefined && result.blockNumber !== undefined) {
          setTestResult({ latency: result.latency, blockNumber: result.blockNumber });
        } else {
          setTestError(result.error || '连接失败');
        }
      }
    } catch (error) {
      console.error('Solana RPC测试失败:', error);
      setTestError(error instanceof Error ? error.message : '连接失败');
    } finally {
      setIsTesting(false);
    }
  };

  const modalContent = (
    <div className="modal modal-open">
      <div className="modal-box w-11/12 max-w-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">
            ⚙️ 编辑 {chain.name} 配置
          </h2>
          <button
            onClick={onClose}
            className="btn btn-sm btn-circle btn-ghost"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Basic Information */}
          <div className="collapse collapse-arrow bg-base-200 mb-4">
            <input type="checkbox" defaultChecked className="min-w-fit" />
            <div className="collapse-title text-lg font-semibold">
              🔗 基础信息
            </div>
            <div className="collapse-content">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-medium">链名称</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="input input-bordered"
                    style={{ border: '1px solid #d1d5db', backgroundColor: '#ffffff' }}
                    required
                  />
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-medium">Chain ID</span>
                  </label>
                  <input
                    type="number"
                    value={formData.chainId || ''}
                    onChange={(e) => setFormData({ ...formData, chainId: parseInt(e.target.value) || undefined })}
                    className="input input-bordered"
                    style={{ border: '1px solid #d1d5db', backgroundColor: '#ffffff' }}
                    placeholder="501"
                  />
                </div>
              </div>

              <div className="form-control mt-4">
                <label className="label">
                  <span className="label-text font-medium">RPC URL</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={formData.rpcUrl}
                    onChange={(e) => {
                      setFormData({ ...formData, rpcUrl: e.target.value });
                      setTestResult(null);
                      setTestError(null);
                    }}
                    className="input input-bordered flex-1"
                    style={{ border: '1px solid #d1d5db', backgroundColor: '#ffffff' }}
                    placeholder="https://api.mainnet-beta.solana.com"
                    required
                  />
                  <button
                    type="button"
                    onClick={handleTestRPC}
                    disabled={isTesting || !formData.rpcUrl}
                    className="btn btn-outline btn-sm"
                  >
                    {isTesting ? (
                      <>
                        <span className="loading loading-spinner loading-xs"></span>
                        测试中
                      </>
                    ) : (
                      '🧪 测试'
                    )}
                  </button>
                </div>
                {testResult && (
                  <div className="alert alert-success mt-2">
                    <div className="text-sm">
                      ✅ 延迟: {testResult.latency}ms | 槽位: {testResult.blockNumber}
                    </div>
                  </div>
                )}
                {testError && (
                  <div className="alert alert-error mt-2">
                    <div className="text-sm">
                      ❌ {testError}
                    </div>
                  </div>
                )}
                <label className="label">
                  <span className="label-text-alt">主 RPC 节点 URL</span>
                </label>
              </div>

              <div className="form-control mt-4">
                <label className="label">
                  <span className="label-text font-medium">备用 RPC URL</span>
                </label>
                <input
                  type="url"
                  value={formData.rpcBackup}
                  onChange={(e) => setFormData({ ...formData, rpcBackup: e.target.value })}
                  className="input input-bordered"
                  style={{ border: '1px solid #d1d5db', backgroundColor: '#ffffff' }}
                  placeholder="https://api.devnet.solana.com"
                />
              </div>

              <div className="form-control mt-4">
                <label className="label">
                  <span className="label-text font-medium">区块链浏览器 URL</span>
                </label>
                <input
                  type="url"
                  value={formData.explorerUrl}
                  onChange={(e) => setFormData({ ...formData, explorerUrl: e.target.value })}
                  className="input input-bordered"
                  style={{ border: '1px solid #d1d5db', backgroundColor: '#ffffff' }}
                  placeholder="https://solscan.io"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-medium">代币符号</span>
                  </label>
                  <input
                    type="text"
                    value={formData.symbol}
                    onChange={(e) => setFormData({ ...formData, symbol: e.target.value })}
                    className="input input-bordered"
                    style={{ border: '1px solid #d1d5db', backgroundColor: '#ffffff' }}
                    placeholder="SOL"
                    required
                  />
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-medium">代币精度</span>
                  </label>
                  <input
                    type="number"
                    value={formData.decimals}
                    onChange={(e) => setFormData({ ...formData, decimals: parseInt(e.target.value) })}
                    className="input input-bordered"
                    style={{ border: '1px solid #d1d5db', backgroundColor: '#ffffff' }}
                    min="0"
                    max="18"
                    required
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="modal-action">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-ghost"
            >
              取消
            </button>
            <button
              type="submit"
              className="btn btn-primary"
            >
              💾 保存设置
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

export default function Settings() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<AppSettings>({
    chains: [],
    gasSettings: {
      defaultGasPrice: 30,
      defaultGasLimit: 210000,
      autoAdjustGas: true,
      maxGasPrice: 100,
      priorityFee: 2,
    },
    batchSettings: {
      batchSize: 100,
      sendInterval: 2000,
      maxConcurrency: 5,
      retryAttempts: 3,
      retryDelay: 1000,
    },
    securitySettings: {
      autoBackup: true,
      backupInterval: 24,
      sessionTimeout: 30,
    },
    notificationSettings: {
      emailNotifications: false,
      browserNotifications: true,
      campaignComplete: true,
      campaignFailed: true,
      lowBalance: true,
      securityAlerts: true,
    },
  });

  const [activeTab] = useState<'chains'>('chains');
  const [editingChain, setEditingChain] = useState<EVMChain | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [solanaChains, setSolanaChains] = useState<SolanaChain[]>([]);
  const [editingSolanaChain, setEditingSolanaChain] = useState<SolanaChain | null>(null);
  const [isSolanaModalOpen, setIsSolanaModalOpen] = useState(false);

  useEffect(() => {
    loadSettings();
    loadChains();
  }, []);

  const loadSettings = async () => {
    try {
      // Settings service removed, using default state
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const loadChains = async () => {
    try {
      console.log('🔍 [Settings] loadChains: Starting to load chains from electron API');
      if (window.electronAPI?.chain) {
        // Load EVM chains
        const chains = await window.electronAPI.chain.getEVMChains();
        console.log(`🔍 [Settings] loadChains: Received ${chains.length} EVM chains from API`);
        console.log('🔍 [Settings] loadChains: Chain data received:', chains.map(chain => ({
          name: chain.name,
          color: chain.color,
          badgeColor: chain.badgeColor,
          chainId: chain.chainId
        })));
        setSettings(prev => ({ ...prev, chains }));
        console.log('🔍 [Settings] loadChains: Chains set to state');

        // Load Solana chains
        try {
          const solanaChainData = await window.electronAPI.chain.getSolanaRPCs();
          console.log(`🔍 [Settings] loadChains: Received ${solanaChainData.length} Solana chains from API`);
          setSolanaChains(solanaChainData);
          console.log('🔍 [Settings] loadChains: Solana chains set to state');
        } catch (error) {
          console.warn('🔍 [Settings] loadChains: Failed to load Solana chains:', error);
        }
      } else {
        console.log('🔍 [Settings] loadChains: window.electronAPI.chain is not available');
      }
    } catch (error) {
      console.error('🔍 [Settings] loadChains: Failed to load chains:', error);
      // Set empty chains array when database connection fails
      setSettings(prev => ({ ...prev, chains: [] }));
    }
  };

  const handleEditChain = (chain: EVMChain) => {
    setEditingChain(chain);
    setIsModalOpen(true);
  };

  const handleAddChain = () => {
    const newChain = {
      id: 0,
      type: 'evm' as const,
      chainId: 0,
      name: '',
      rpcUrl: '',
      explorerUrl: '',
      symbol: '',
      decimals: 18,
      isCustom: true,
    };
    setEditingChain(newChain);
    setIsModalOpen(true);
  };

  const handleSaveChain = async (chainData: ChainConfigurationForm) => {
    try {
      if (window.electronAPI?.chain) {
        if (chainData.id && chainData.id > 0) {
          // 更新现有链
          await window.electronAPI.chain.updateEVMChain(chainData.id, chainData);
        } else {
          // 添加新链
          const newId = await window.electronAPI.chain.addEVMChain(chainData);
          chainData.id = newId;
        }
      }

      setSettings(prev => {
        const chains = prev.chains || [];
        if (chainData.id && chainData.id > 0 && chains.some(c => c.id === chainData.id)) {
          // 更新现有链
          return {
            ...prev,
            chains: chains.map(chain =>
              chain.id === chainData.id ? { ...chain, ...chainData } : chain
            )
          };
        } else {
          // 添加新链
          const newChain: EVMChain = {
            id: chainData.id || Date.now(),
            type: 'evm',
            chainId: chainData.chainId,
            name: chainData.name,
            rpcUrl: chainData.rpcUrl,
            rpcBackup: chainData.rpcBackup,
            explorerUrl: chainData.explorerUrl,
            symbol: chainData.symbol,
            decimals: chainData.decimals,
            isCustom: true,
          };
          return {
            ...prev,
            chains: [...chains, newChain]
          };
        }
      });

      setIsModalOpen(false);
      setEditingChain(null);
    } catch (error) {
      console.error('Failed to save chain:', error);
      alert('保存链配置失败，请重试');
    }
  };

  const handleEditSolanaChain = (chain: SolanaChain) => {
    setEditingSolanaChain(chain);
    setIsSolanaModalOpen(true);
  };

  const handleSaveSolanaChain = async (chainData: SolanaChain) => {
    try {
      if (window.electronAPI?.chain && chainData.id) {
        // Update Solana chain in database
        await window.electronAPI.chain.updateEVMChain(chainData.id, chainData);
      }

      // Update local state
      setSolanaChains(prev =>
        prev.map(chain =>
          chain.id === chainData.id ? chainData : chain
        )
      );

      setIsSolanaModalOpen(false);
      setEditingSolanaChain(null);
    } catch (error) {
      console.error('Failed to save Solana chain:', error);
      alert('保存 Solana 网络配置失败，请重试');
    }
  };


  return (
    <>
      <div className="p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-3">
            <span className="text-3xl">⚙️</span>
            <h1 className="text-2xl font-bold">区块链网络设置</h1>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAddChain}
              className="btn btn-primary"
            >
              ➕ 添加自定义网络
            </button>
            <button
              onClick={() => navigate('/')}
              className="btn btn-ghost"
            >
              ← 返回仪表盘
            </button>
          </div>
        </div>

        {/* EVM Chain List */}
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span>⛓️</span>
            <span>EVM 链</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {(settings.chains || []).map((chain) => (
              <div
                key={chain.id}
                className="card bg-base-100 shadow-sm hover:shadow-md transition-all border-2 border-transparent hover:border-primary/20"
              >
                {/* Chain Icon & Info */}
                <div className="card-body">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="avatar placeholder">
                      <div
                        className="text-white rounded-full w-12 h-12 flex items-center justify-center text-lg font-bold"
                        style={{ backgroundColor: chain.color }}
                      >
                        {getChainInitial(chain.name, chain.symbol)}
                      </div>
                    </div>
                    <div className="flex-1">
                      <h2 className="card-title text-lg">{chain.name}</h2>
                      <div className="flex items-center gap-2">
                        <div className={`badge ${chain.badgeColor || 'badge-primary'} badge-sm`}>{chain.symbol}</div>
                      </div>
                    </div>
                  </div>

                  {/* Chain Details */}
                  <div className="divider my-2"></div>

                  <div className="space-y-3 mb-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-base-content/60">Chain ID</span>
                      <div className="font-mono text-sm bg-base-200 px-2 py-1 rounded">{chain.chainId}</div>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-sm text-base-content/60">精度</span>
                      <span className="text-sm font-medium">{chain.decimals}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="card-actions justify-end">
                    <button
                      onClick={() => handleEditChain(chain)}
                      className="btn btn-sm btn-outline"
                    >
                      ⚙️ 编辑
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Solana Network List */}
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span>🌐</span>
            <span>Solana 网络</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {solanaChains.map((chain) => {
              return (
                <div
                  key={chain.id}
                  className="card bg-base-100 shadow-sm hover:shadow-md transition-all border-2 border-transparent hover:border-accent/20"
                >
                  <div className="card-body">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="avatar placeholder">
                        <div
                          className="text-white rounded-full w-12 h-12 flex items-center justify-center text-lg font-bold"
                          style={{ backgroundColor: chain.color || '#00FFA3' }}
                        >
                          {getChainInitial(chain.name, chain.symbol)}
                        </div>
                      </div>
                      <div className="flex-1">
                        <h2 className="card-title text-lg">{chain.name}</h2>
                        <div className="flex items-center gap-2">
                          <div className={`badge ${chain.badgeColor || 'badge-accent'} badge-sm`}>{chain.symbol}</div>
                        </div>
                      </div>
                    </div>

                    {/* Divider */}
                    <div className="divider my-2"></div>

                    {/* Chain Details */}
                    <div className="space-y-3 mb-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-base-content/60">Chain ID</span>
                        <div className="font-mono text-sm bg-base-200 px-2 py-1 rounded">{chain.chainId || 'N/A'}</div>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-sm text-base-content/60">精度</span>
                        <span className="text-sm font-medium">{chain.decimals}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="card-actions justify-end">
                      <button
                        onClick={() => handleEditSolanaChain(chain)}
                        className="btn btn-sm btn-outline"
                      >
                        ⚙️ 编辑
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Empty State */}
        {(!settings.chains || settings.chains.length === 0) && solanaChains.length === 0 && (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">🌐</div>
            <div className="text-lg font-medium mb-2">暂无区块链网络</div>
            <div className="text-sm text-base-content/60 mb-6">
              点击上方"添加自定义网络"开始配置
            </div>
            <button
              onClick={handleAddChain}
              className="btn btn-primary"
            >
              ➕ 添加第一个网络
            </button>
          </div>
        )}

        {/* Quick Tips */}
        <div className="alert alert-info mt-8">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <div>
            <h3 className="font-bold">快速提示</h3>
            <div className="text-sm">
              • 建议为每个网络配置多个 RPC URL 以提高连接稳定性<br/>
              • 自定义网络支持测试网和主网配置<br/>
              • 编辑网络前建议先测试连接以确保配置正确
            </div>
          </div>
        </div>
      </div>

      {/* Chain Edit Modal */}
      <ChainEditModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingChain(null);
        }}
        chain={editingChain}
        onSave={handleSaveChain}
      />

      {/* Solana Edit Modal */}
      <SolanaEditModal
        isOpen={isSolanaModalOpen}
        onClose={() => {
          setIsSolanaModalOpen(false);
          setEditingSolanaChain(null);
        }}
        chain={editingSolanaChain}
        onSave={handleSaveSolanaChain}
      />
    </>
  );
}
