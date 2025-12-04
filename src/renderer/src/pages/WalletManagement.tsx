import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ActivityWallet,
  WalletBalance,
  EVMChain,
  ChainInfo
} from '../types';
import { isSolanaChain, exportPrivateKey, getChainDisplayName, getChainDisplayBadge } from '../utils/chainTypeUtils';

export default function WalletManagement() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [wallets, setWallets] = useState<ActivityWallet[]>([]);
  const [totalWallets, setTotalWallets] = useState(0);
  const [chains, setChains] = useState<ChainInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [showPrivateKeyModal, setShowPrivateKeyModal] = useState(false);
  const [exportedWallet, setExportedWallet] = useState<{ address: string; privateKey: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadWallets();
    loadChains();
  }, [currentPage]); // Reload when page changes

  const loadWallets = async () => {
    setLoading(true);
    try {
      // Load real wallet data from backend
      if (window.electronAPI?.wallet) {
        const response = await window.electronAPI.wallet.list({
          limit: pageSize,
          offset: (currentPage - 1) * pageSize,
        });
        
        // Handle both old array format (for backward compatibility) and new object format
        if (Array.isArray(response)) {
           setWallets(response);
           setTotalWallets(response.length); // Fallback if no total returned
        } else {
           setWallets(response.wallets);
           setTotalWallets(response.total);
        }
      }
    } catch (error) {
      console.error('Failed to load wallets:', error);
      // Fallback to empty array
      setWallets([]);
      setTotalWallets(0);
    } finally {
      setLoading(false);
    }
  };

  const loadChains = async () => {
    try {
      if (window.electronAPI?.chain) {
        const chainsData = await window.electronAPI.chain.getAllChains();
        setChains(chainsData);
      }
    } catch (error) {
      console.error('Failed to load chains:', error);
    }
  };


  // Calculate pagination data
  const totalPages = Math.ceil(totalWallets / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalWallets);
  // Data is already paginated from backend, so we display all loaded wallets
  const displayWallets = wallets;

  
  const handleViewDetails = (wallet: ActivityWallet) => {
    // Navigate directly to the corresponding campaign details page
    navigate(`/campaign/${wallet.campaignId}`);
  };

  const handleExportWallet = async (wallet: ActivityWallet) => {
    if (!wallet.privateKeyBase64) {
      alert(t('wallet.noPrivateKey'));
      return;
    }

    try {
      // Use unified private key export function
      const privateKeyDisplay = await exportPrivateKey(wallet.privateKeyBase64 || '', wallet as any);

      // Show custom private key popup
      setExportedWallet({
        address: wallet.address,
        privateKey: privateKeyDisplay
      });
      setShowPrivateKeyModal(true);
      setCopied(false);
    } catch (error) {
      console.error('Failed to export wallet:', error);
      alert(t('wallet.exportFailed'));
    }
  };

  const handleCopyPrivateKey = () => {
    if (exportedWallet?.privateKey) {
      navigator.clipboard.writeText(exportedWallet.privateKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopyAddress = () => {
    if (exportedWallet?.address) {
      navigator.clipboard.writeText(exportedWallet.address);
    }
  };

  const handleCloseModal = () => {
    setShowPrivateKeyModal(false);
    setExportedWallet(null);
    setCopied(false);
  };

  const getStatusBadge = (status: string) => {
    const upperStatus = status.toUpperCase();
    switch (upperStatus) {
      case 'CREATED':
        return <div className="badge badge-warning gap-1">📝 {t('status.created')}</div>;
      case 'FUNDED':
        return <div className="badge badge-info gap-1">💰 {t('history.funded')}</div>;
      case 'READY':
        return <div className="badge badge-primary gap-1">✅ {t('wallet.statusReady')}</div>;
      case 'SENDING':
        return <div className="badge badge-info gap-1">🔄 {t('status.sending')}</div>;
      case 'PAUSED':
        return <div className="badge badge-warning gap-1">⏸️ {t('history.paused')}</div>;
      case 'COMPLETED':
        return <div className="badge badge-success gap-1">✅ {t('status.success')}</div>;
      case 'FAILED':
        return <div className="badge badge-error gap-1">❌ {t('status.failed')}</div>;
      // Fallback for lowercase values
      case 'ACTIVE':
        return <div className="badge badge-info gap-1">🔄 {t('wallet.statusActive')}</div>;
      case 'PENDING':
        return <div className="badge badge-warning gap-1">⏳ {t('wallet.statusPending')}</div>;
      default:
        return <div className="badge badge-neutral gap-1">📋 {status}</div>;
    }
  };

  const formatNumber = (num: string, decimals = 2) => {
    const number = parseFloat(num);
    if (isNaN(number)) return '0';
    return number.toLocaleString('zh-CN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('zh-CN');
  };

  const getChainName = (chainValue: string) => {
    // Use unified chain display utility, directly pass chainValue
    return getChainDisplayName(chainValue, chains);
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-3">
          <span className="text-3xl">👛</span>
          <h1 className="text-2xl font-bold">{t('wallet.management')}</h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate('/')}
            className="btn btn-ghost"
          >
            ← {t('wallet.backToDashboard')}
          </button>
        </div>
      </div>

      {/* Activity Wallet Management Explanation */}
      <div className="alert alert-info mb-8">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <div>
          <h3 className="font-bold">{t('wallet.activityWalletManagement')}</h3>
          <div className="text-sm">
            {t('wallet.activityWalletDesc')}
          </div>
        </div>
      </div>

      {/* Wallet Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="stat bg-base-100 rounded-lg shadow-sm">
          <div className="stat-figure text-primary">
            👛
          </div>
          <div className="stat-title">{t('wallet.totalWallets')}</div>
          <div className="stat-value text-primary">{totalWallets}</div>
          <div className="stat-desc text-info">{t('wallet.allActivityWallets')}</div>
        </div>

        <div className="stat bg-base-100 rounded-lg shadow-sm">
          <div className="stat-figure text-success">
            ✅
          </div>
          <div className="stat-title">{t('wallet.activeWallets')}</div>
          <div className="stat-value text-success">
            {wallets.filter(w => {
              const status = w.status.toUpperCase();
              return status === 'SENDING' || status === 'FUNDED' || status === 'READY' || status === 'ACTIVE';
            }).length}
          </div>
          <div className="stat-desc text-success">{t('wallet.inProgressCurrentPage')}</div>
        </div>
      </div>

      {/* Activity Wallet List */}
      <div className="card bg-base-100 shadow-sm">
        <div className="overflow-x-auto">
          <table className="table table-zebra">
            <thead>
              <tr>
                <th className="bg-base-200">{t('wallet.campaignName')}</th>
                <th className="bg-base-200">{t('wallet.walletAddress')}</th>
                <th className="bg-base-200">{t('wallet.blockchainNetwork')}</th>
                <th className="bg-base-200 text-center">{t('wallet.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {displayWallets.map((wallet) => (
                <tr key={wallet.id} className="hover">
                  <td>
                    <div>
                      <div className="font-medium">{wallet.campaignName}</div>
                      <div className="text-sm text-base-content/60">{getStatusBadge(wallet.status)}</div>
                    </div>
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="bg-base-200 px-2 py-1 rounded text-xs font-mono break-all max-w-xs">
                        {wallet.address}
                      </div>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(wallet.address);
                          // Use toast instead of alert
                        }}
                        className="btn btn-ghost btn-xs"
                        title={t('wallet.copyAddress')}
                      >
                        📋
                      </button>
                    </div>
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="badge badge-primary badge-sm">
                        {getChainName(wallet.chain)}
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="flex justify-center gap-1">
                      <button
                        onClick={() => handleViewDetails(wallet)}
                        className="btn btn-ghost btn-xs"
                      >
                        👁️ {t('wallet.details')}
                      </button>
                      <button
                        onClick={() => handleExportWallet(wallet)}
                        className="btn btn-ghost btn-xs"
                      >
                        🔑 {t('wallet.export')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center mt-6">
          <div className="join">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="join-item btn btn-sm"
            >
              «
            </button>

            {/* Page numbers */}
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const pageNumber = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
              return (
                <button
                  key={pageNumber}
                  onClick={() => setCurrentPage(pageNumber)}
                  className={`join-item btn btn-sm ${currentPage === pageNumber ? 'btn-active' : ''}`}
                >
                  {pageNumber}
                </button>
              );
            })}

            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="join-item btn btn-sm"
            >
              »
            </button>
          </div>

          <div className="ml-4 text-sm text-base-content/60">
            {t('wallet.showing')} {startIndex + 1}-{endIndex} / {t('wallet.total')} {totalWallets} {t('wallet.wallets')}
          </div>
        </div>
      )}

      {/* Security Tips */}
      <div className="alert alert-warning mt-8">
        <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
        <div>
          <h3 className="font-bold">{t('wallet.securityTips')}</h3>
          <div className="text-sm">
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>{t('wallet.securityTip1')}</li>
              <li>{t('wallet.securityTip2')}</li>
              <li>{t('wallet.securityTip3')}</li>
              <li>{t('wallet.securityTip4')}</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Private Key Export Modal */}
      {showPrivateKeyModal && exportedWallet && (
        <div className="modal modal-open">
          <div className="modal-box max-w-2xl">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <span>🔑</span>
              <span>{t('wallet.exportPrivateKey')}</span>
            </h3>

            {/* Warning Alert */}
            <div className="alert alert-warning mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <span className="text-sm">
                <strong>{t('wallet.securityWarning')}</strong>{t('wallet.securityWarningText')}
              </span>
            </div>

            {/* Wallet Address */}
            <div className="mb-4">
              <label className="label">
                <span className="label-text font-semibold">{t('wallet.walletAddress')}</span>
              </label>
              <div className="flex gap-2">
                <div className="flex-1 bg-base-200 px-4 py-3 rounded-lg font-mono text-sm break-all">
                  {exportedWallet.address}
                </div>
                <button
                  onClick={handleCopyAddress}
                  className="btn btn-square btn-outline"
                  title={t('wallet.copyAddress')}
                >
                  📋
                </button>
              </div>
            </div>

            {/* Private Key */}
            <div className="mb-6">
              <label className="label">
                <span className="label-text font-semibold">{t('wallet.privateKey')}</span>
              </label>
              <div className="flex gap-2">
                <div className="flex-1 bg-error/10 border-2 border-error/30 px-4 py-3 rounded-lg font-mono text-sm break-all">
                  {exportedWallet.privateKey}
                </div>
                <button
                  onClick={handleCopyPrivateKey}
                  className={`btn btn-square ${copied ? 'btn-success' : 'btn-error'}`}
                  title={t('wallet.copyPrivateKey')}
                >
                  {copied ? '✓' : '📋'}
                </button>
              </div>
              {copied && (
                <div className="text-success text-sm mt-2 flex items-center gap-1">
                  <span>✓</span>
                  <span>{t('wallet.privateKeyCopied')}</span>
                </div>
              )}
            </div>

            {/* Security Tips */}
            <div className="bg-base-200 p-4 rounded-lg mb-4">
              <h4 className="font-semibold mb-2 text-sm">{t('wallet.securityTipsTitle')}</h4>
              <ul className="text-sm space-y-1 text-base-content/80">
                <li>• {t('wallet.securityTipEVM')}</li>
                <li>• {t('wallet.securityTipSolana')}</li>
                <li>• {t('wallet.securityTipFormat')}</li>
                <li>• {t('wallet.securityTipSave')}</li>
                <li>• {t('wallet.securityTipNoScreenshot')}</li>
                <li>• {t('wallet.securityTipControl')}</li>
              </ul>
            </div>

            {/* Modal Actions */}
            <div className="modal-action">
              <button onClick={handleCloseModal} className="btn btn-primary">
                {t('wallet.savedSecurely')}
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={handleCloseModal}></div>
        </div>
      )}
    </div>
  );
}