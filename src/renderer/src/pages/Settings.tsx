import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AppSettings,
  EVMChain,
  ChainConfigurationForm,
  NetworkTestResult,
  GasSettings,
  BatchSettings,
  SecuritySettings,
  NotificationSettings
} from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  chain: EVMChain | null;
  onSave: (chainData: ChainConfigurationForm) => void;
  onTest: (chainId: number) => void;
  testResults: Record<number, NetworkTestResult>;
}

function ChainEditModal({ isOpen, onClose, chain, onSave, onTest, testResults }: SettingsModalProps) {
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
    enabled: true,
    isCustom: false,
  });

  const [isTesting, setIsTesting] = useState(false);

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
        enabled: chain.enabled,
        isCustom: chain.isCustom,
      });
    }
  }, [chain]);

  if (!isOpen || !chain) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const handleTest = async () => {
    setIsTesting(true);
    await onTest(chain.chainId);
    setTimeout(() => setIsTesting(false), 2000);
  };

  const testResult = testResults[chain.chainId];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-2xl mx-4">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-semibold text-dark">编辑 {chain.name} 链参数</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {/* Basic Chain Information */}
          <div className="space-y-4 mb-6">
            <h3 className="text-lg font-medium text-dark mb-4">基础信息</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-dark mb-2">链名称</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-dark mb-2">Chain ID</label>
                <input
                  type="number"
                  value={formData.chainId}
                  onChange={(e) => setFormData({ ...formData, chainId: parseInt(e.target.value) })}
                  className="w-full px-4 py-3 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-dark mb-2">RPC 节点 URL</label>
              <input
                type="url"
                value={formData.rpcUrl}
                onChange={(e) => setFormData({ ...formData, rpcUrl: e.target.value })}
                className="w-full px-4 py-3 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="https://polygon.llamarpc.com"
                required
              />
              <p className="text-sm text-gray-500 mt-1">建议配置多个 URL 以实现冗余备份</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-dark mb-2">备用 RPC URL</label>
              <input
                type="url"
                value={formData.rpcBackup}
                onChange={(e) => setFormData({ ...formData, rpcBackup: e.target.value })}
                className="w-full px-4 py-3 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="https://polygon-mainnet.infura.io/v3/YOUR_PROJECT_ID"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-dark mb-2">区块链浏览器 URL</label>
              <input
                type="url"
                value={formData.explorerUrl}
                onChange={(e) => setFormData({ ...formData, explorerUrl: e.target.value })}
                className="w-full px-4 py-3 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="https://polygonscan.com"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-dark mb-2">代币符号</label>
                <input
                  type="text"
                  value={formData.symbol}
                  onChange={(e) => setFormData({ ...formData, symbol: e.target.value })}
                  className="w-full px-4 py-3 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="MATIC"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-dark mb-2">代币精度</label>
                <input
                  type="number"
                  value={formData.decimals}
                  onChange={(e) => setFormData({ ...formData, decimals: parseInt(e.target.value) })}
                  className="w-full px-4 py-3 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  min="0"
                  max="18"
                  required
                />
              </div>
            </div>
          </div>

          {/* Gas Parameter Settings */}
          <div className="space-y-4 mb-6">
            <h3 className="text-lg font-medium text-dark mb-4">Gas 参数设置</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-dark mb-2">默认 Gas 价格 (Gwei)</label>
                <input
                  type="number"
                  value={formData.gasPrice}
                  onChange={(e) => setFormData({ ...formData, gasPrice: parseInt(e.target.value) })}
                  className="w-full px-4 py-3 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  min="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-dark mb-2">默认 Gas 限制</label>
                <input
                  type="number"
                  value={formData.gasLimit}
                  onChange={(e) => setFormData({ ...formData, gasLimit: parseInt(e.target.value) })}
                  className="w-full px-4 py-3 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  min="21000"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-dark mb-2">批量发送数量</label>
                <input
                  type="number"
                  value={formData.batchSize}
                  onChange={(e) => setFormData({ ...formData, batchSize: parseInt(e.target.value) })}
                  className="w-full px-4 py-3 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  min="1"
                  max="200"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-dark mb-2">发送间隔 (ms)</label>
                <input
                  type="number"
                  value={formData.sendInterval}
                  onChange={(e) => setFormData({ ...formData, sendInterval: parseInt(e.target.value) })}
                  className="w-full px-4 py-3 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  min="500"
                  step="100"
                />
              </div>
            </div>
          </div>

          {/* Test Connection */}
          <div className="mb-6">
            <button
              type="button"
              onClick={handleTest}
              disabled={isTesting}
              className="btn btn-ghost"
            >
              {isTesting ? '测试中...' : '测试连接'}
            </button>

            {testResult && (
              <div className={`mt-2 p-3 rounded-lg ${
                testResult.status === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
              }`}>
                <div className="flex items-center justify-between">
                  <span>
                    延迟: {testResult.latency}ms | 区块: {testResult.blockNumber} | Gas: {testResult.gasPrice} Gwei
                  </span>
                  <span className={`font-medium ${
                    testResult.status === 'success' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {testResult.status === 'success' ? '✓ 连接成功' : '✗ 连接失败'}
                  </span>
                </div>
                {testResult.error && (
                  <div className="text-sm mt-1">{testResult.error}</div>
                )}
              </div>
            )}
          </div>

          {/* Enable/Disable */}
          <div className="mb-6">
            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={formData.enabled}
                onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                className="w-4 h-4 text-primary border-border rounded focus:ring-primary"
              />
              <span className="text-sm font-medium text-dark">启用该区块链网络</span>
            </label>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-4">
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
              保存设置
            </button>
          </div>
        </form>
      </div>
    </div>
  );
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
      encryptPrivateKeys: true,
      sessionTimeout: 30,
      requirePassword: false,
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

  const [activeTab, setActiveTab] = useState<'chains' | 'gas' | 'batch' | 'security' | 'notifications'>('chains');
  const [editingChain, setEditingChain] = useState<EVMChain | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [testResults, setTestResults] = useState<Record<number, NetworkTestResult>>({});

  useEffect(() => {
    loadSettings();
    loadChains();
  }, []);

  const loadSettings = async () => {
    try {
      if (window.electronAPI?.settings) {
        const loadedSettings = await window.electronAPI.settings.get();
        if (loadedSettings) {
          setSettings(loadedSettings);
        }
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const loadChains = async () => {
    try {
      if (window.electronAPI?.chain) {
        const chains = await window.electronAPI.chain.getEVMChains();
        setSettings(prev => ({ ...prev, chains }));
      }
    } catch (error) {
      console.error('Failed to load chains:', error);
      // Mock data for demonstration
      const mockChains: EVMChain[] = [
        {
          id: 1,
          type: 'evm',
          chainId: 1,
          name: 'Ethereum',
          rpcUrl: 'https://eth.llamarpc.com',
          explorerUrl: 'https://etherscan.io',
          symbol: 'ETH',
          decimals: 18,
          enabled: true,
          isCustom: false,
        },
        {
          id: 2,
          type: 'evm',
          chainId: 137,
          name: 'Polygon',
          rpcUrl: 'https://polygon.llamarpc.com',
          explorerUrl: 'https://polygonscan.com',
          symbol: 'MATIC',
          decimals: 18,
          enabled: true,
          isCustom: false,
        },
        {
          id: 3,
          type: 'evm',
          chainId: 8453,
          name: 'Base',
          rpcUrl: 'https://mainnet.base.org',
          explorerUrl: 'https://basescan.org',
          symbol: 'ETH',
          decimals: 18,
          enabled: true,
          isCustom: false,
        },
        {
          id: 4,
          type: 'evm',
          chainId: 42161,
          name: 'Arbitrum',
          rpcUrl: 'https://arb1.arbitrum.io/rpc',
          explorerUrl: 'https://arbiscan.io',
          symbol: 'ETH',
          decimals: 18,
          enabled: false,
          isCustom: false,
        },
        {
          id: 5,
          type: 'evm',
          chainId: 10,
          name: 'Optimism',
          rpcUrl: 'https://mainnet.optimism.io',
          explorerUrl: 'https://optimistic.etherscan.io',
          symbol: 'ETH',
          decimals: 18,
          enabled: false,
          isCustom: false,
        },
      ];
      setSettings(prev => ({ ...prev, chains: mockChains }));
    }
  };

  const handleEditChain = (chain: EVMChain) => {
    setEditingChain(chain);
    setIsModalOpen(true);
  };

  const handleSaveChain = async (chainData: ChainConfigurationForm) => {
    try {
      if (window.electronAPI?.chain) {
        if (chainData.id) {
          await window.electronAPI.chain.updateEVMChain(chainData.id, chainData);
        } else {
          const newId = await window.electronAPI.chain.addEVMChain(chainData);
          chainData.id = newId;
        }
      }

      setSettings(prev => ({
        ...prev,
        chains: (prev.chains || []).map(chain =>
          chain.id === chainData.id ? { ...chain, ...chainData } : chain
        )
      }));

      setIsModalOpen(false);
      setEditingChain(null);
    } catch (error) {
      console.error('Failed to save chain:', error);
      alert('保存链配置失败，请重试');
    }
  };

  const handleTestChain = async (chainId: number) => {
    try {
      if (window.electronAPI?.chain) {
        const result = await window.electronAPI.chain.testEVMLatency(chainId);
        setTestResults(prev => ({
          ...prev,
          [chainId]: {
            chainId,
            latency: result.latency,
            blockNumber: result.blockNumber,
            gasPrice: 30,
            status: 'success',
            timestamp: new Date().toISOString(),
          }
        }));
      }
    } catch (error) {
      setTestResults(prev => ({
        ...prev,
        [chainId]: {
          chainId,
          latency: 0,
          blockNumber: 0,
          gasPrice: 0,
          status: 'failed',
          error: error instanceof Error ? error.message : '连接失败',
          timestamp: new Date().toISOString(),
        }
      }));
    }
  };

  const handleToggleChain = async (chainId: number) => {
    setSettings(prev => ({
      ...prev,
      chains: (prev.chains || []).map(chain =>
        chain.chainId === chainId ? { ...chain, enabled: !chain.enabled } : chain
      )
    }));
  };

  const handleSaveSettings = async () => {
    try {
      if (window.electronAPI?.settings) {
        await window.electronAPI.settings.update(settings);
        alert('设置保存成功！');
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert('保存设置失败，请重试');
    }
  };

  const updateGasSettings = (gasSettings: Partial<GasSettings>) => {
    setSettings(prev => ({ ...prev, gasSettings: { ...prev.gasSettings, ...gasSettings } }));
  };

  const updateBatchSettings = (batchSettings: Partial<BatchSettings>) => {
    setSettings(prev => ({ ...prev, batchSettings: { ...prev.batchSettings, ...batchSettings } }));
  };

  const updateSecuritySettings = (securitySettings: Partial<SecuritySettings>) => {
    setSettings(prev => ({ ...prev, securitySettings: { ...prev.securitySettings, ...securitySettings } }));
  };

  const updateNotificationSettings = (notificationSettings: Partial<NotificationSettings>) => {
    setSettings(prev => ({ ...prev, notificationSettings: { ...prev.notificationSettings, ...notificationSettings } }));
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-dark">系统设置</h1>
        <button
          onClick={() => navigate('/')}
          className="btn btn-ghost"
        >
          返回仪表盘
        </button>
      </div>

      {/* Settings Navigation */}
      <div className="flex space-x-1 mb-6 bg-gray-100 p-1 rounded-lg">
        <button
          onClick={() => setActiveTab('chains')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'chains'
              ? 'bg-white text-dark shadow-sm'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          区块链网络
        </button>
        <button
          onClick={() => setActiveTab('gas')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'gas'
              ? 'bg-white text-dark shadow-sm'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          Gas 设置
        </button>
        <button
          onClick={() => setActiveTab('batch')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'batch'
              ? 'bg-white text-dark shadow-sm'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          批量设置
        </button>
        <button
          onClick={() => setActiveTab('security')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'security'
              ? 'bg-white text-dark shadow-sm'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          安全设置
        </button>
        <button
          onClick={() => setActiveTab('notifications')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'notifications'
              ? 'bg-white text-dark shadow-sm'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          通知设置
        </button>
      </div>

      {/* Settings Content */}
      <div className="bg-white rounded-lg border border-border">
        {/* Chain Settings */}
        {activeTab === 'chains' && (
          <div className="p-6">
            <div className="mb-6">
              <h2 className="text-lg font-medium text-dark mb-4">已配置的区块链</h2>
              <div className="space-y-3">
                {(settings.chains || []).map((chain) => (
                  <div key={chain.id} className="flex items-center justify-between p-4 border border-border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-border-light rounded-lg flex items-center justify-center">
                        <span className="text-lg">{chain.symbol.slice(0, 2).toUpperCase()}</span>
                      </div>
                      <div>
                        <div className="font-medium text-dark">{chain.name}</div>
                        <div className="text-sm text-gray-500">主网 | Chain ID: {chain.chainId}</div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-4">
                      <button
                        onClick={() => handleToggleChain(chain.chainId)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          chain.enabled ? 'bg-primary' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            chain.enabled ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>

                      <button
                        onClick={() => handleEditChain(chain)}
                        className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                      >
                        编辑
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Help Section */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-lg font-medium text-blue-800 mb-3">如何管理区块链网络?</h3>
              <ol className="space-y-2 text-sm text-blue-700">
                <li>
                  <strong>1. 添加区块链:</strong> 支持添加所有 EVM 兼容的区块链网络，包括主网和测试网。
                </li>
                <li>
                  <strong>2. 配置参数:</strong> 为每条链设置合适的 Gas 价格、Gas 限制、批量发送数量等参数。
                </li>
                <li>
                  <strong>3. 启用/禁用:</strong> 禁用的网络不会出现在活动流程中，但会保留相关数据。
                </li>
                <li>
                  <strong>4. 维护与监控:</strong> 定期检查 RPC 节点的可用性和 Gas 价格变化。
                </li>
              </ol>
            </div>
          </div>
        )}

        {/* Gas Settings */}
        {activeTab === 'gas' && (
          <div className="p-6">
            <h2 className="text-lg font-medium text-dark mb-4">Gas 参数配置</h2>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-dark mb-2">默认 Gas 价格 (Gwei)</label>
                <input
                  type="number"
                  value={settings.gasSettings?.defaultGasPrice || 30}
                  onChange={(e) => updateGasSettings({ defaultGasPrice: parseInt(e.target.value) })}
                  className="w-full px-4 py-3 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  min="0"
                />
                <p className="text-sm text-gray-500 mt-1">所有交易的默认 Gas 价格</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-dark mb-2">默认 Gas 限制</label>
                <input
                  type="number"
                  value={settings.gasSettings?.defaultGasLimit || 210000}
                  onChange={(e) => updateGasSettings({ defaultGasLimit: parseInt(e.target.value) })}
                  className="w-full px-4 py-3 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  min="21000"
                />
                <p className="text-sm text-gray-500 mt-1">标准转账交易的 Gas 限制</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-dark mb-2">最大 Gas 价格 (Gwei)</label>
                <input
                  type="number"
                  value={settings.gasSettings?.maxGasPrice || 100}
                  onChange={(e) => updateGasSettings({ maxGasPrice: parseInt(e.target.value) })}
                  className="w-full px-4 py-3 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  min="0"
                />
                <p className="text-sm text-gray-500 mt-1">防止 Gas 价格过高时的保护机制</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-dark mb-2">优先费用 (Gwei)</label>
                <input
                  type="number"
                  value={settings.gasSettings?.priorityFee || 2}
                  onChange={(e) => updateGasSettings({ priorityFee: parseInt(e.target.value) })}
                  className="w-full px-4 py-3 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  min="0"
                />
                <p className="text-sm text-gray-500 mt-1">矿工优先处理的额外费用</p>
              </div>

              <div className="col-span-2">
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={settings.gasSettings?.autoAdjustGas || true}
                    onChange={(e) => updateGasSettings({ autoAdjustGas: e.target.checked })}
                    className="w-4 h-4 text-primary border-border rounded focus:ring-primary"
                  />
                  <span className="text-sm font-medium text-dark">自动调整 Gas 价格</span>
                </label>
                <p className="text-sm text-gray-500 mt-1">根据网络拥堵情况自动调整 Gas 价格</p>
              </div>
            </div>
          </div>
        )}

        {/* Batch Settings */}
        {activeTab === 'batch' && (
          <div className="p-6">
            <h2 className="text-lg font-medium text-dark mb-4">批量发送配置</h2>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-dark mb-2">批量大小</label>
                <input
                  type="number"
                  value={settings.batchSettings?.batchSize || 100}
                  onChange={(e) => updateBatchSettings({ batchSize: parseInt(e.target.value) })}
                  className="w-full px-4 py-3 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  min="1"
                  max="200"
                />
                <p className="text-sm text-gray-500 mt-1">每个批次中包含的交易数量</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-dark mb-2">发送间隔 (毫秒)</label>
                <input
                  type="number"
                  value={settings.batchSettings?.sendInterval || 2000}
                  onChange={(e) => updateBatchSettings({ sendInterval: parseInt(e.target.value) })}
                  className="w-full px-4 py-3 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  min="500"
                  step="100"
                />
                <p className="text-sm text-gray-500 mt-1">批次之间的等待时间</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-dark mb-2">最大并发数</label>
                <input
                  type="number"
                  value={settings.batchSettings?.maxConcurrency || 5}
                  onChange={(e) => updateBatchSettings({ maxConcurrency: parseInt(e.target.value) })}
                  className="w-full px-4 py-3 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  min="1"
                  max="10"
                />
                <p className="text-sm text-gray-500 mt-1">同时处理的最大批次数量</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-dark mb-2">重试次数</label>
                <input
                  type="number"
                  value={settings.batchSettings?.retryAttempts || 3}
                  onChange={(e) => updateBatchSettings({ retryAttempts: parseInt(e.target.value) })}
                  className="w-full px-4 py-3 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  min="0"
                  max="10"
                />
                <p className="text-sm text-gray-500 mt-1">失败交易的最大重试次数</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-dark mb-2">重试延迟 (毫秒)</label>
                <input
                  type="number"
                  value={settings.batchSettings?.retryDelay || 1000}
                  onChange={(e) => updateBatchSettings({ retryDelay: parseInt(e.target.value) })}
                  className="w-full px-4 py-3 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  min="1000"
                  step="1000"
                />
                <p className="text-sm text-gray-500 mt-1">重试失败交易的等待时间</p>
              </div>
            </div>
          </div>
        )}

        {/* Security Settings */}
        {activeTab === 'security' && (
          <div className="p-6">
            <h2 className="text-lg font-medium text-dark mb-4">安全配置</h2>
            <div className="space-y-6">
              <div>
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={settings.securitySettings?.autoBackup || false}
                    onChange={(e) => updateSecuritySettings({ autoBackup: e.target.checked })}
                    className="w-4 h-4 text-primary border-border rounded focus:ring-primary"
                  />
                  <span className="text-sm font-medium text-dark">自动备份数据</span>
                </label>
                <p className="text-sm text-gray-500 mt-1">定期自动备份钱包和活动数据</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-dark mb-2">备份间隔 (小时)</label>
                <input
                  type="number"
                  value={settings.securitySettings?.backupInterval || 24}
                  onChange={(e) => updateSecuritySettings({ backupInterval: parseInt(e.target.value) })}
                  className="w-full px-4 py-3 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  min="1"
                  max="168"
                  disabled={!settings.securitySettings?.autoBackup}
                />
              </div>

              <div>
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={settings.securitySettings?.encryptPrivateKeys || true}
                    onChange={(e) => updateSecuritySettings({ encryptPrivateKeys: e.target.checked })}
                    className="w-4 h-4 text-primary border-border rounded focus:ring-primary"
                  />
                  <span className="text-sm font-medium text-dark">加密私钥存储</span>
                </label>
                <p className="text-sm text-gray-500 mt-1">使用强加密算法保护私钥安全</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-dark mb-2">会话超时 (分钟)</label>
                <input
                  type="number"
                  value={settings.securitySettings?.sessionTimeout || 60}
                  onChange={(e) => updateSecuritySettings({ sessionTimeout: parseInt(e.target.value) })}
                  className="w-full px-4 py-3 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  min="5"
                  max="480"
                />
                <p className="text-sm text-gray-500 mt-1">用户无操作后自动登出的时间</p>
              </div>

              <div>
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={settings.securitySettings?.requirePassword || false}
                    onChange={(e) => updateSecuritySettings({ requirePassword: e.target.checked })}
                    className="w-4 h-4 text-primary border-border rounded focus:ring-primary"
                  />
                  <span className="text-sm font-medium text-dark">敏感操作需要密码确认</span>
                </label>
                <p className="text-sm text-gray-500 mt-1">导出私钥、发送交易等操作需要输入密码</p>
              </div>
            </div>
          </div>
        )}

        {/* Notification Settings */}
        {activeTab === 'notifications' && (
          <div className="p-6">
            <h2 className="text-lg font-medium text-dark mb-4">通知配置</h2>
            <div className="space-y-4">
              <div>
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={settings.notificationSettings?.emailNotifications || false}
                    onChange={(e) => updateNotificationSettings({ emailNotifications: e.target.checked })}
                    className="w-4 h-4 text-primary border-border rounded focus:ring-primary"
                  />
                  <span className="text-sm font-medium text-dark">邮件通知</span>
                </label>
                <p className="text-sm text-gray-500 mt-1">通过邮件接收重要通知</p>
              </div>

              <div>
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={settings.notificationSettings?.browserNotifications || true}
                    onChange={(e) => updateNotificationSettings({ browserNotifications: e.target.checked })}
                    className="w-4 h-4 text-primary border-border rounded focus:ring-primary"
                  />
                  <span className="text-sm font-medium text-dark">浏览器通知</span>
                </label>
                <p className="text-sm text-gray-500 mt-1">在浏览器中接收推送通知</p>
              </div>

              <div>
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={settings.notificationSettings?.campaignComplete || true}
                    onChange={(e) => updateNotificationSettings({ campaignComplete: e.target.checked })}
                    className="w-4 h-4 text-primary border-border rounded focus:ring-primary"
                  />
                  <span className="text-sm font-medium text-dark">活动完成通知</span>
                </label>
              </div>

              <div>
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={settings.notificationSettings?.campaignFailed || true}
                    onChange={(e) => updateNotificationSettings({ campaignFailed: e.target.checked })}
                    className="w-4 h-4 text-primary border-border rounded focus:ring-primary"
                  />
                  <span className="text-sm font-medium text-dark">活动失败通知</span>
                </label>
              </div>

              <div>
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={settings.notificationSettings?.lowBalance || true}
                    onChange={(e) => updateNotificationSettings({ lowBalance: e.target.checked })}
                    className="w-4 h-4 text-primary border-border rounded focus:ring-primary"
                  />
                  <span className="text-sm font-medium text-dark">余额不足通知</span>
                </label>
              </div>

              <div>
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={settings.notificationSettings?.securityAlerts || true}
                    onChange={(e) => updateNotificationSettings({ securityAlerts: e.target.checked })}
                    className="w-4 h-4 text-primary border-border rounded focus:ring-primary"
                  />
                  <span className="text-sm font-medium text-dark">安全警报通知</span>
                </label>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Save Button */}
      <div className="flex justify-end mt-6">
        <button
          onClick={handleSaveSettings}
          className="btn btn-primary"
        >
          保存设置
        </button>
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
        onTest={handleTestChain}
        testResults={testResults}
      />
    </div>
  );
}
