import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import {
  AppSettings,
  EVMChain,
  SolanaChain,
  ChainConfigurationForm,
  NetworkTestResult
} from '../types';

// Get chain display initial
function getChainInitial(name: string, symbol?: string): string {
  const lowerName = name.toLowerCase();

  // Special chain display initials
  if (lowerName.includes('ethereum') && lowerName.includes('sepolia')) return 'S'; // Sepolia
  if (lowerName.includes('ethereum')) return 'E'; // Ethereum Mainnet
  if (lowerName.includes('polygon')) return 'P'; // Polygon
  if (lowerName.includes('arbitrum')) return 'A'; // Arbitrum
  if (lowerName.includes('base')) return 'B'; // Base
  if (lowerName.includes('optimism')) return 'O'; // Optimism
  if (lowerName.includes('bsc') || lowerName.includes('binance')) return 'B'; // BSC
  if (lowerName.includes('avalanche')) return 'A'; // Avalanche
  if (lowerName.includes('solana')) return 'S'; // Solana

  // Default to first letter of symbol
  return symbol?.charAt(0)?.toUpperCase() || name.charAt(0)?.toUpperCase() || '⚡';
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  chain: EVMChain | null;
  onSave: (chainData: ChainConfigurationForm) => void;
}

function ChainEditModal({ isOpen, onClose, chain, onSave }: SettingsModalProps) {
  const { t } = useTranslation();
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
    isCustom: false
  });

  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ latency: number; blockNumber: number } | null>(
    null
  );
  const [testError, setTestError] = useState<string | null>(null);

  const [isTestingBackup, setIsTestingBackup] = useState(false);
  const [testResultBackup, setTestResultBackup] = useState<{
    latency: number;
    blockNumber: number;
  } | null>(null);
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
        isCustom: chain.isCustom
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
      // Debug statement removed
      setTestError(error instanceof Error ? error.message : t('settings.connectionFailed'));
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
      // Debug statement removed
      setTestErrorBackup(error instanceof Error ? error.message : t('settings.connectionFailed'));
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
            {isNewChain
              ? `➕ ${t('settings.addCustomNetworkTitle')}`
              : `⚙️ ${t('settings.editChainConfig')} ${chain.name}`}
          </h2>
          <button onClick={onClose} className="btn btn-sm btn-circle btn-ghost">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Basic Chain Information */}
          <div className="collapse collapse-arrow bg-base-200 mb-4">
            <input type="checkbox" defaultChecked className="min-w-fit" />
            <div className="collapse-title text-lg font-semibold">🔗 {t('settings.basicInfo')}</div>
            <div className="collapse-content">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-medium">{t('settings.chainName')}</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
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
                    onChange={e => setFormData({ ...formData, chainId: parseInt(e.target.value) })}
                    className="input input-bordered"
                    style={{ border: '1px solid #d1d5db', backgroundColor: '#ffffff' }}
                    required
                  />
                </div>
              </div>

              <div className="form-control mt-4">
                <label className="label">
                  <span className="label-text font-medium">{t('settings.rpcNodeUrl')}</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={formData.rpcUrl}
                    onChange={e => {
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
                        {t('settings.testing')}
                      </>
                    ) : (
                      `🧪 ${t('settings.test')}`
                    )}
                  </button>
                </div>
                {testResult && (
                  <div className="alert alert-success mt-2">
                    <div className="text-sm">
                      ✅ {t('settings.latency')}: {testResult.latency}ms | {t('settings.block')}:{' '}
                      {testResult.blockNumber}
                    </div>
                  </div>
                )}
                {testError && (
                  <div className="alert alert-error mt-2">
                    <div className="text-sm">❌ {testError}</div>
                  </div>
                )}
                <label className="label">
                  <span className="label-text-alt">{t('settings.rpcRedundancyTip')}</span>
                </label>
              </div>

              <div className="form-control mt-4">
                <label className="label">
                  <span className="label-text font-medium">{t('settings.backupRpcUrl')}</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={formData.rpcBackup}
                    onChange={e => {
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
                        {t('settings.testing')}
                      </>
                    ) : (
                      `🧪 ${t('settings.test')}`
                    )}
                  </button>
                </div>
                {testResultBackup && (
                  <div className="alert alert-success mt-2">
                    <div className="text-sm">
                      ✅ {t('settings.latency')}: {testResultBackup.latency}ms |{' '}
                      {t('settings.block')}: {testResultBackup.blockNumber}
                    </div>
                  </div>
                )}
                {testErrorBackup && (
                  <div className="alert alert-error mt-2">
                    <div className="text-sm">❌ {testErrorBackup}</div>
                  </div>
                )}
              </div>

              <div className="form-control mt-4">
                <label className="label">
                  <span className="label-text font-medium">{t('settings.explorerUrl')}</span>
                </label>
                <input
                  type="url"
                  value={formData.explorerUrl}
                  onChange={e => setFormData({ ...formData, explorerUrl: e.target.value })}
                  className="input input-bordered"
                  style={{ border: '1px solid #d1d5db', backgroundColor: '#ffffff' }}
                  placeholder="https://polygonscan.com"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-medium">{t('settings.tokenSymbol')}</span>
                  </label>
                  <input
                    type="text"
                    value={formData.symbol}
                    onChange={e => setFormData({ ...formData, symbol: e.target.value })}
                    className="input input-bordered"
                    style={{ border: '1px solid #d1d5db', backgroundColor: '#ffffff' }}
                    placeholder="MATIC"
                    required
                  />
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-medium">{t('settings.tokenDecimals')}</span>
                  </label>
                  <input
                    type="number"
                    value={formData.decimals}
                    onChange={e => setFormData({ ...formData, decimals: parseInt(e.target.value) })}
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
            <button type="button" onClick={onClose} className="btn btn-ghost">
              {t('common.cancel')}
            </button>
            <button type="submit" className="btn btn-primary">
              💾 {t('settings.saveSettings')}
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
  const { t } = useTranslation();
  const [formData, setFormData] = useState<SolanaChain>({
    type: 'solana',
    name: '',
    rpcUrl: '',
    rpcBackup: '',
    explorerUrl: '',
    symbol: 'SOL',
    decimals: 9,
    isCustom: false
  });

  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ latency: number; blockNumber: number } | null>(
    null
  );
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
        isCustom: chain.isCustom
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
        if (result.success && result.latency !== undefined) {
          setTestResult({ latency: result.latency, blockNumber: 0 });
        } else {
          setTestError(t('settings.connectionFailed'));
        }
      }
    } catch (error) {
      // Debug statement removed
      setTestError(error instanceof Error ? error.message : t('settings.connectionFailed'));
    } finally {
      setIsTesting(false);
    }
  };

  const modalContent = (
    <div className="modal modal-open">
      <div className="modal-box w-11/12 max-w-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">
            ⚙️ {t('settings.editChainConfig')} {chain.name}
          </h2>
          <button onClick={onClose} className="btn btn-sm btn-circle btn-ghost">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Basic Information */}
          <div className="collapse collapse-arrow bg-base-200 mb-4">
            <input type="checkbox" defaultChecked className="min-w-fit" />
            <div className="collapse-title text-lg font-semibold">🔗 {t('settings.basicInfo')}</div>
            <div className="collapse-content">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-medium">{t('settings.chainName')}</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
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
                    onChange={e =>
                      setFormData({ ...formData, chainId: parseInt(e.target.value) || undefined })
                    }
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
                    onChange={e => {
                      setFormData({ ...formData, rpcUrl: e.target.value });
                      setTestResult(null);
                      setTestError(null);
                    }}
                    className="input input-bordered flex-1"
                    style={{ border: '1px solid #d1d5db', backgroundColor: '#ffffff' }}
                    placeholder="https://solana-rpc.publicnode.com"
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
                        {t('settings.testing')}
                      </>
                    ) : (
                      `🧪 ${t('settings.test')}`
                    )}
                  </button>
                </div>
                {testResult && (
                  <div className="alert alert-success mt-2">
                    <div className="text-sm">
                      ✅ {t('settings.latency')}: {testResult.latency}ms | {t('settings.slot')}:{' '}
                      {testResult.blockNumber}
                    </div>
                  </div>
                )}
                {testError && (
                  <div className="alert alert-error mt-2">
                    <div className="text-sm">❌ {testError}</div>
                  </div>
                )}
                <label className="label">
                  <span className="label-text-alt">{t('settings.mainRpcNode')}</span>
                </label>
              </div>

              <div className="form-control mt-4">
                <label className="label">
                  <span className="label-text font-medium">{t('settings.backupRpcUrl')}</span>
                </label>
                <input
                  type="url"
                  value={formData.rpcBackup}
                  onChange={e => setFormData({ ...formData, rpcBackup: e.target.value })}
                  className="input input-bordered"
                  style={{ border: '1px solid #d1d5db', backgroundColor: '#ffffff' }}
                  placeholder="https://api.devnet.solana.com"
                />
              </div>

              <div className="form-control mt-4">
                <label className="label">
                  <span className="label-text font-medium">{t('settings.explorerUrl')}</span>
                </label>
                <input
                  type="url"
                  value={formData.explorerUrl}
                  onChange={e => setFormData({ ...formData, explorerUrl: e.target.value })}
                  className="input input-bordered"
                  style={{ border: '1px solid #d1d5db', backgroundColor: '#ffffff' }}
                  placeholder="https://solscan.io"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-medium">{t('settings.tokenSymbol')}</span>
                  </label>
                  <input
                    type="text"
                    value={formData.symbol}
                    onChange={e => setFormData({ ...formData, symbol: e.target.value })}
                    className="input input-bordered"
                    style={{ border: '1px solid #d1d5db', backgroundColor: '#ffffff' }}
                    placeholder="SOL"
                    required
                  />
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-medium">{t('settings.tokenDecimals')}</span>
                  </label>
                  <input
                    type="number"
                    value={formData.decimals}
                    onChange={e => setFormData({ ...formData, decimals: parseInt(e.target.value) })}
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
            <button type="button" onClick={onClose} className="btn btn-ghost">
              {t('common.cancel')}
            </button>
            <button type="submit" className="btn btn-primary">
              💾 {t('settings.saveSettings')}
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
  const { t, i18n } = useTranslation();
  const [settings, setSettings] = useState<AppSettings>({
    chains: [],
    solanaChains: []
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
      // Debug statement removed
    }
  };

  const loadChains = async () => {
    try {
      if (window.electronAPI?.chain) {
        // Load EVM chains
        const chains = await window.electronAPI.chain.getEVMChains();
        setSettings((prev: AppSettings) => ({ ...prev, chains }));

        // Load Solana chains
        try {
          const solanaChainData = await window.electronAPI.chain.getSolanaRPCs();
          setSolanaChains(
            solanaChainData.map(rpc => ({
              ...rpc,
              type: 'solana' as const,
              symbol: 'SOL',
              decimals: 9,
              isCustom: true
            }))
          );
        } catch (error) {
          // Debug statement removed
        }
      } else {
      }
    } catch (error) {
      // Debug statement removed
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
      isCustom: true
    };
    setEditingChain(newChain);
    setIsModalOpen(true);
  };

  const handleSaveChain = async (chainData: ChainConfigurationForm) => {
    try {
      if (window.electronAPI?.chain) {
        if (chainData.id && chainData.id > 0) {
          // Update existing chain
          await window.electronAPI.chain.updateEVMChain(chainData.id, chainData);
        } else {
          // Add new chain
          const newId = await window.electronAPI.chain.addEVMChain(chainData);
          chainData.id = newId;
        }
      }

      setSettings((prev: AppSettings) => {
        const chains = prev.chains || [];
        if (chainData.id && chainData.id > 0 && chains.some(c => c.id === chainData.id)) {
          // Update existing chain
          return {
            ...prev,
            chains: chains.map(chain =>
              chain.id === chainData.id ? { ...chain, ...chainData } : chain
            )
          };
        } else {
          // Add new chain
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
            isCustom: true
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
      // Debug statement removed
      alert(t('settings.saveChainFailed'));
    }
  };

  const handleEditSolanaChain = (chain: SolanaChain) => {
    setEditingSolanaChain(chain);
    setIsSolanaModalOpen(true);
  };

  const handleSaveSolanaChain = async (chainData: SolanaChain) => {
    try {
      if (window.electronAPI?.chain && chainData.id) {
        // Update Solana chain in database using the generic updateChain method
        await window.electronAPI.chain.updateChain(chainData.id, chainData);
      }

      // Update local state
      setSolanaChains(prev => prev.map(chain => (chain.id === chainData.id ? chainData : chain)));

      setIsSolanaModalOpen(false);
      setEditingSolanaChain(null);
    } catch (error) {
      // Debug statement removed
      alert(t('settings.saveSolanaFailed'));
    }
  };

  const handleLanguageChange = (lang: string) => {
    i18n.changeLanguage(lang);
  };

  return (
    <>
      <div className="p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-3">
            <span className="text-3xl">⚙️</span>
            <h1 className="text-2xl font-bold">{t('settings.title')}</h1>
          </div>
          <div className="flex gap-2">
            <button onClick={handleAddChain} className="btn btn-primary">
              ➕ {t('settings.addCustomNetwork')}
            </button>
            <button onClick={() => navigate('/')} className="btn btn-ghost">
              ← {t('settings.backToDashboard')}
            </button>
          </div>
        </div>

        {/* Language Settings Section */}
        <div className="mb-8">
          <div className="card bg-base-100 shadow-sm">
            <div className="card-body">
              <h2 className="card-title flex items-center gap-2">
                <span>🌍</span>
                <span>{t('settings.language')}</span>
              </h2>
              <p className="text-sm text-base-content/60 mb-4">
                {t('settings.languageDescription')}
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => handleLanguageChange('en')}
                  className={`btn ${i18n.language === 'en' ? 'btn-primary' : 'btn-outline'}`}
                >
                  🇺🇸 English
                </button>
                <button
                  onClick={() => handleLanguageChange('zh')}
                  className={`btn ${i18n.language === 'zh' ? 'btn-primary' : 'btn-outline'}`}
                >
                  🇨🇳 中文
                </button>
                <button
                  onClick={() => handleLanguageChange('es')}
                  className={`btn ${i18n.language === 'es' ? 'btn-primary' : 'btn-outline'}`}
                >
                  🇪🇸 Español
                </button>
                <button
                  onClick={() => handleLanguageChange('fr')}
                  className={`btn ${i18n.language === 'fr' ? 'btn-primary' : 'btn-outline'}`}
                >
                  🇫🇷 Français
                </button>
                <button
                  onClick={() => handleLanguageChange('de')}
                  className={`btn ${i18n.language === 'de' ? 'btn-primary' : 'btn-outline'}`}
                >
                  🇩🇪 Deutsch
                </button>
                <button
                  onClick={() => handleLanguageChange('pt')}
                  className={`btn ${i18n.language === 'pt' ? 'btn-primary' : 'btn-outline'}`}
                >
                  🇵🇹 Português
                </button>
                <button
                  onClick={() => handleLanguageChange('ru')}
                  className={`btn ${i18n.language === 'ru' ? 'btn-primary' : 'btn-outline'}`}
                >
                  🇷🇺 Русский
                </button>
                <button
                  onClick={() => handleLanguageChange('ar')}
                  className={`btn ${i18n.language === 'ar' ? 'btn-primary' : 'btn-outline'}`}
                >
                  🇸🇦 العربية
                </button>
                <button
                  onClick={() => handleLanguageChange('ko')}
                  className={`btn ${i18n.language === 'ko' ? 'btn-primary' : 'btn-outline'}`}
                >
                  🇰🇷 한국어
                </button>
                <button
                  onClick={() => handleLanguageChange('ja')}
                  className={`btn ${i18n.language === 'ja' ? 'btn-primary' : 'btn-outline'}`}
                >
                  🇯🇵 日本語
                </button>
                <button
                  onClick={() => handleLanguageChange('vi')}
                  className={`btn ${i18n.language === 'vi' ? 'btn-primary' : 'btn-outline'}`}
                >
                  🇻🇳 Tiếng Việt
                </button>
                <button
                  onClick={() => handleLanguageChange('tr')}
                  className={`btn ${i18n.language === 'tr' ? 'btn-primary' : 'btn-outline'}`}
                >
                  🇹🇷 Türkçe
                </button>
              </div>
              <div className="text-xs text-base-content/50 mt-2">
                {i18n.language === 'en' && 'Current language: English'}
                {i18n.language === 'zh' && 'Current language: Chinese'}
                {i18n.language === 'es' && 'Idioma actual: Español'}
                {i18n.language === 'fr' && 'Langue actuelle : Français'}
                {i18n.language === 'de' && 'Aktuelle Sprache: Deutsch'}
                {i18n.language === 'pt' && 'Idioma atual: Português'}
                {i18n.language === 'ru' && 'Текущий язык: Русский'}
                {i18n.language === 'ar' && 'اللغة الحالية: العربية'}
                {i18n.language === 'ko' && '현재 언어: 한국어'}
                {i18n.language === 'ja' && 'Current language: Japanese'}
                {i18n.language === 'vi' && 'Ngôn ngữ hiện tại: Tiếng Việt'}
                {i18n.language === 'tr' && 'Mevcut dil: Türkçe'}
              </div>
            </div>
          </div>
        </div>

        {/* EVM Chain List */}
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span>⛓️</span>
            <span>{t('settings.evmChains')}</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {(settings.chains || []).map(chain => (
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
                        <div className={`badge ${chain.badgeColor || 'badge-primary'} badge-sm`}>
                          {chain.symbol}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Chain Details */}
                  <div className="divider my-2"></div>

                  <div className="space-y-3 mb-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-base-content/60">{t('settings.chainId')}</span>
                      <div className="font-mono text-sm bg-base-200 px-2 py-1 rounded">
                        {chain.chainId}
                      </div>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-sm text-base-content/60">{t('settings.decimals')}</span>
                      <span className="text-sm font-medium">{chain.decimals}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="card-actions justify-end">
                    <button
                      onClick={() => handleEditChain(chain)}
                      className="btn btn-sm btn-outline"
                    >
                      ⚙️ {t('settings.editConfig')}
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
            <span>{t('settings.solanaNetworks')}</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {solanaChains.map(chain => {
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
                          <div className={`badge ${chain.badgeColor || 'badge-accent'} badge-sm`}>
                            {chain.symbol}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Divider */}
                    <div className="divider my-2"></div>

                    {/* Chain Details */}
                    <div className="space-y-3 mb-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-base-content/60">
                          {t('settings.chainId')}
                        </span>
                        <div className="font-mono text-sm bg-base-200 px-2 py-1 rounded">
                          {chain.chainId || 'N/A'}
                        </div>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-sm text-base-content/60">
                          {t('settings.decimals')}
                        </span>
                        <span className="text-sm font-medium">{chain.decimals}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="card-actions justify-end">
                      <button
                        onClick={() => handleEditSolanaChain(chain)}
                        className="btn btn-sm btn-outline"
                      >
                        ⚙️ {t('settings.editConfig')}
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
            <div className="text-lg font-medium mb-2">{t('settings.noNetworks')}</div>
            <div className="text-sm text-base-content/60 mb-6">{t('settings.noNetworksDesc')}</div>
            <button onClick={handleAddChain} className="btn btn-primary">
              ➕ {t('settings.addFirstNetwork')}
            </button>
          </div>
        )}

        {/* Quick Tips */}
        <div className="alert alert-info mt-8">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            className="stroke-current shrink-0 w-6 h-6"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            ></path>
          </svg>
          <div>
            <h3 className="font-bold">{t('settings.quickTips')}</h3>
            <div className="text-sm">
              • {t('settings.tip1')}
              <br />• {t('settings.tip2')}
              <br />• {t('settings.tip3')}
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
