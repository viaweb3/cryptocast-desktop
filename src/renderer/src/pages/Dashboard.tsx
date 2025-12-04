import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCampaign } from '../contexts/CampaignContext';

const { electronAPI } = window as any;

// Get chain display initial letter
function getChainInitial(name: string): string {
  const lowerName = name.toLowerCase();

  // Display letters for special chains
  if (lowerName.includes('ethereum') && lowerName.includes('sepolia')) return 'S'; // Sepolia
  if (lowerName.includes('ethereum')) return 'E'; // Ethereum Mainnet
  if (lowerName.includes('polygon')) return 'P'; // Polygon
  if (lowerName.includes('arbitrum')) return 'A'; // Arbitrum
  if (lowerName.includes('base')) return 'B'; // Base
  if (lowerName.includes('optimism')) return 'O'; // Optimism
  if (lowerName.includes('bsc') || lowerName.includes('binance')) return 'B'; // BSC
  if (lowerName.includes('avalanche')) return 'A'; // Avalanche
  if (lowerName.includes('solana')) return 'S'; // Solana

  // Default to first letter of the name
  return name.charAt(0)?.toUpperCase() || '⚡';
}

interface Campaign {
  id: string;
  name: string;
  chain: string;
  chainName?: string;
  tokenAddress: string;
  status: 'CREATED' | 'READY' | 'SENDING' | 'PAUSED' | 'COMPLETED' | 'FAILED';
  totalRecipients: number;
  completedRecipients: number;
  walletAddress?: string;
  contractAddress?: string;
  createdAt: string;
  updatedAt: string;
}

interface DashboardStats {
  totalActivities: number;
  successfulActivities: number;
  ongoingActivities: number;
  totalRecipients: number;
  completedRecipients: number;
  weeklyActivities: number;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { state, actions } = useCampaign();
  const [chains, setChains] = useState<any[]>([]);

  // Fetch chains from database on component mount
  useEffect(() => {
    const fetchChains = async () => {
      try {
        const allChains: any[] = [];

        if (electronAPI?.chain) {
          // Load EVM chains
          const evmChains = await electronAPI.chain.getEVMChains();
          allChains.push(...evmChains);

          // Load Solana chains
          try {
            const solanaChains = await electronAPI.chain.getSolanaRPCs();
              allChains.push(...solanaChains);
          } catch (error) {
            console.warn('🔍 [Dashboard] fetchChains: Failed to load Solana chains:', error);
          }

  
          setChains(allChains);
        } else {
                  }
      } catch (error) {
        console.error('🔍 [Dashboard] fetchChains: Failed to load chains:', error);
      }
    };

    fetchChains();
  }, []);

  // Calculate stats from real campaign data
  const stats: DashboardStats = {
    totalActivities: state.campaigns.length,
    successfulActivities: state.campaigns.filter(c => c.status === 'COMPLETED').length,
    ongoingActivities: state.campaigns.filter(c => ['SENDING', 'PAUSED'].includes(c.status)).length,
    totalRecipients: state.campaigns.reduce((sum, c) => sum + c.totalRecipients, 0),
    completedRecipients: state.campaigns.reduce((sum, c) => sum + c.completedRecipients, 0),
    weeklyActivities: state.campaigns.filter(c => {
      const createdAt = new Date(c.createdAt);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return createdAt >= weekAgo;
    }).length
  };

  const activeCampaigns = state.campaigns.filter(c =>
    ['READY', 'SENDING', 'PAUSED'].includes(c.status)
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <div className="badge badge-success gap-1">✅ {t('status.success')}</div>;
      case 'SENDING':
        return <div className="badge badge-info gap-1">🔄 {t('status.sending')}</div>;
      case 'FAILED':
        return <div className="badge badge-error gap-1">❌ {t('status.failed')}</div>;
      case 'PAUSED':
        return <div className="badge badge-warning gap-1">⏸️ {t('status.paused')}</div>;
      case 'READY':
        return <div className="badge badge-warning gap-1">⚡ {t('status.ready')}</div>;
      default:
        return <div className="badge badge-neutral gap-1">📋 {t('status.created')}</div>;
    }
  };

  const getChainBadge = (chain: string, chainName?: string) => {
    const chainConfig = {
      '1': { badge: 'badge-info', name: 'Ethereum' },
      '137': { badge: 'badge-secondary', name: 'Polygon' },
      '42161': { badge: 'badge-info', name: 'Arbitrum' },
      '10': { badge: 'badge-error', name: 'Optimism' },
      '8453': { badge: 'badge-success', name: 'Base' },
      '56': { badge: 'badge-warning', name: 'BSC' },
      'solana': { badge: 'badge-accent', name: 'Solana' }
    };

    const config = chainConfig[chain as keyof typeof chainConfig] || { badge: 'badge-neutral', name: chainName || chain };
    return <div className={`badge ${config.badge} badge-sm`}>{config.name}</div>;
  };

  return (
    <div className="p-6">
      {/* Header with Stats Cards and New Campaign Button */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📊</span>
            <h2 className="text-lg font-bold">{t('dashboard.title')}</h2>
          </div>
          <button
            onClick={() => navigate('/campaign/create')}
            className="btn btn-primary"
          >
            ➕ {t('dashboard.newCampaign')}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="stat bg-base-100 rounded-lg shadow-sm">
            <div className="stat-figure text-primary">
              📋
            </div>
            <div className="stat-title">{t('dashboard.totalActivities')}</div>
            <div className="stat-value text-primary">{stats.totalActivities}</div>
            <div className="stat-desc">
              <div className="flex items-center gap-1">
                <span className="text-success">📈</span>
                <span className="text-success">{t('dashboard.basedOnRealData')}</span>
              </div>
            </div>
          </div>

          <div className="stat bg-base-100 rounded-lg shadow-sm">
            <div className="stat-figure text-success">
              ✅
            </div>
            <div className="stat-title">{t('dashboard.successfulActivities')}</div>
            <div className="stat-value text-success">{stats.successfulActivities}</div>
            <div className="stat-desc">
              <div className="flex items-center gap-1">
                <span className="text-success">✅</span>
                <span className="text-success">{t('dashboard.completedTasks')}</span>
              </div>
            </div>
          </div>

          <div className="stat bg-base-100 rounded-lg shadow-sm">
            <div className="stat-figure text-info">
              🔄
            </div>
            <div className="stat-title">{t('dashboard.ongoingActivities')}</div>
            <div className="stat-value text-info">{stats.ongoingActivities}</div>
            <div className="stat-desc">
              <div className="flex items-center gap-1">
                <span className="text-info">🔄</span>
                <span className="text-info">{t('dashboard.inProgress')}</span>
              </div>
            </div>
          </div>

          <div className="stat bg-base-100 rounded-lg shadow-sm">
            <div className="stat-figure text-warning">
              📅
            </div>
            <div className="stat-title">{t('dashboard.weeklyActivities')}</div>
            <div className="stat-value text-warning">{stats.weeklyActivities}</div>
            <div className="stat-desc">
              <div className="flex items-center gap-1">
                <span className="text-warning">📅</span>
                <span className="text-warning">{t('dashboard.createdThisWeek')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-xl">⚡</span>
          <h2 className="text-lg font-bold">{t('dashboard.quickActions')}</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div
            onClick={() => navigate('/campaign/create')}
            className="card bg-base-100 shadow-sm hover:shadow-md transition-all cursor-pointer border-2 border-transparent hover:border-primary/20"
          >
            <div className="card-body p-4">
              <div className="card-actions justify-start">
                <div className="avatar placeholder">
                  <div className="bg-primary/10 text-primary rounded-full w-12 h-12">
                    <span className="text-lg">➕</span>
                  </div>
                </div>
              </div>
              <h3 className="card-title text-base mb-2">{t('dashboard.createNewCampaign')}</h3>
            </div>
          </div>

          <div
            onClick={() => navigate('/history')}
            className="card bg-base-100 shadow-sm hover:shadow-md transition-all cursor-pointer border-2 border-transparent hover:border-primary/20"
          >
            <div className="card-body p-4">
              <div className="card-actions justify-start">
                <div className="avatar placeholder">
                  <div className="bg-secondary/10 text-secondary rounded-full w-12 h-12">
                    <span className="text-lg">📊</span>
                  </div>
                </div>
              </div>
              <h3 className="card-title text-base mb-2">{t('dashboard.viewHistory')}</h3>
            </div>
          </div>

          <div
            onClick={() => navigate('/wallets')}
            className="card bg-base-100 shadow-sm hover:shadow-md transition-all cursor-pointer border-2 border-transparent hover:border-primary/20"
          >
            <div className="card-body p-4">
              <div className="card-actions justify-start">
                <div className="avatar placeholder">
                  <div className="bg-accent/10 text-accent rounded-full w-12 h-12">
                    <span className="text-lg">💳</span>
                  </div>
                </div>
              </div>
              <h3 className="card-title text-base mb-2">{t('dashboard.manageWallets')}</h3>
            </div>
          </div>
        </div>
      </div>

      {/* Chain Activity Distribution */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-xl">🔗</span>
          <h2 className="text-lg font-bold">{t('dashboard.chainActivity')}</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {(() => {
            // Calculate chain activity distribution from real campaign data
            const chainActivity = state.campaigns.reduce((acc, campaign) => {
              const chainId = campaign.chain;
              acc[chainId] = (acc[chainId] || 0) + 1;
              return acc;
            }, {} as Record<string, number>);

            const totalActivities = state.campaigns.length;

            // Use real chain data from database
            return chains.map(chain => {
              // Match campaigns by chainId (EVM) or network identifier (Solana)
              let activityCount = 0;

              // For EVM chains, match by chainId
              if (chain.type === 'evm' && chain.chainId) {
                activityCount = chainActivity[chain.chainId.toString()] || 0;
              }
                // Fallback: try matching by the chainId string representation
              else if (chain.chainId) {
                activityCount = chainActivity[chain.chainId.toString()] || 0;
              }

              const percentage = totalActivities > 0 ? (activityCount / totalActivities * 100).toFixed(1) : '0.0';

              return (
                <div key={chain.id || chain.chainId} className="card bg-base-100 shadow-sm hover:shadow-md transition-all border-2 border-transparent hover:border-primary/20">
                  <div className="card-body p-3 text-center">
                    <div
                      className="text-white rounded-full w-12 h-12 flex items-center justify-center text-xl font-bold mx-auto mb-2"
                      style={{ backgroundColor: chain.color || '#3B82F6' }}
                    >
                      {getChainInitial(chain.name)}
                    </div>
                    <h3 className="card-title text-sm justify-center mb-1">{chain.name}</h3>
                    <div className={`badge ${chain.badgeColor || 'badge-primary'} badge-sm mb-1`}>{activityCount}</div>
                    <p className="text-xs text-base-content/60">{percentage}% {t('dashboard.activityVolume')}</p>
                  </div>
                </div>
              );
            });
          })()}
        </div>
      </div>
    </div>
  );
}