import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCampaign } from '../contexts/CampaignContext';

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
  const { state, actions } = useCampaign();

  // Calculate stats from real campaign data
  const stats: DashboardStats = {
    totalActivities: state.campaigns.length,
    successfulActivities: state.campaigns.filter(c => c.status === 'COMPLETED').length,
    ongoingActivities: state.campaigns.filter(c => ['SENDING', 'READY'].includes(c.status)).length,
    totalRecipients: state.campaigns.reduce((sum, c) => sum + c.totalRecipients, 0),
    completedRecipients: state.campaigns.reduce((sum, c) => sum + c.completedRecipients, 0),
    weeklyActivities: Math.floor(state.campaigns.length * 0.3) // Mock weekly data
  };

  const activeCampaigns = state.campaigns.filter(c =>
    ['READY', 'SENDING', 'PAUSED'].includes(c.status)
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <div className="badge badge-success gap-1">✅ 成功</div>;
      case 'SENDING':
        return <div className="badge badge-info gap-1">🔄 发送中</div>;
      case 'FAILED':
        return <div className="badge badge-error gap-1">❌ 失败</div>;
      case 'PAUSED':
        return <div className="badge badge-warning gap-1">⏸️ 暂停</div>;
      case 'READY':
        return <div className="badge badge-warning gap-1">⚡ 就绪</div>;
      default:
        return <div className="badge badge-neutral gap-1">📋 创建</div>;
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
            <h2 className="text-lg font-bold">数据概览</h2>
          </div>
          <button
            onClick={() => navigate('/campaign/create')}
            className="btn btn-primary"
          >
            ➕ 新建活动
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="stat bg-base-100 rounded-lg shadow-sm">
            <div className="stat-figure text-primary">
              📋
            </div>
            <div className="stat-title">总活动数</div>
            <div className="stat-value text-primary">{stats.totalActivities}</div>
            <div className="stat-desc">
              <div className="flex items-center gap-1">
                <span className="text-success">↑</span>
                <span className="text-success">+12% 较上月</span>
              </div>
            </div>
          </div>

          <div className="stat bg-base-100 rounded-lg shadow-sm">
            <div className="stat-figure text-success">
              ✅
            </div>
            <div className="stat-title">成功发送</div>
            <div className="stat-value text-success">{stats.successfulActivities}</div>
            <div className="stat-desc">
              <div className="flex items-center gap-1">
                <span className="text-success">↑</span>
                <span className="text-success">+8% 较上月</span>
              </div>
            </div>
          </div>

          <div className="stat bg-base-100 rounded-lg shadow-sm">
            <div className="stat-figure text-info">
              🔄
            </div>
            <div className="stat-title">进行中活动</div>
            <div className="stat-value text-info">{stats.ongoingActivities}</div>
            <div className="stat-desc">
              <div className="flex items-center gap-1">
                <span className="text-info">→</span>
                <span className="text-info">稳定</span>
              </div>
            </div>
          </div>

          <div className="stat bg-base-100 rounded-lg shadow-sm">
            <div className="stat-figure text-warning">
              📅
            </div>
            <div className="stat-title">本周活动数</div>
            <div className="stat-value text-warning">{stats.weeklyActivities}</div>
            <div className="stat-desc">
              <div className="flex items-center gap-1">
                <span className="text-success">↑</span>
                <span className="text-success">+5% 较上周</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-xl">⚡</span>
          <h2 className="text-lg font-bold">快速操作</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div
            onClick={() => navigate('/campaign/create')}
            className="card bg-base-100 shadow-sm hover:shadow-md transition-all cursor-pointer border-2 border-transparent hover:border-primary/20"
          >
            <div className="card-body p-4">
              <div className="card-actions justify-start">
                <div className="avatar placeholder">
                  <div className="bg-primary/10 text-neutral-content rounded-full w-12 h-12">
                    <span className="text-lg">➕</span>
                  </div>
                </div>
              </div>
              <h3 className="card-title text-base mb-2">新建活动</h3>
              <p className="text-sm text-base-content/60">创建新的批量发奖任务</p>
            </div>
          </div>

          <div
            onClick={() => navigate('/history')}
            className="card bg-base-100 shadow-sm hover:shadow-md transition-all cursor-pointer border-2 border-transparent hover:border-primary/20"
          >
            <div className="card-body p-4">
              <div className="card-actions justify-start">
                <div className="avatar placeholder">
                  <div className="bg-secondary/10 text-neutral-content rounded-full w-12 h-12">
                    <span className="text-lg">📊</span>
                  </div>
                </div>
              </div>
              <h3 className="card-title text-base mb-2">查看历史</h3>
              <p className="text-sm text-base-content/60">查看历史活动和统计</p>
            </div>
          </div>

          <div
            onClick={() => navigate('/wallets')}
            className="card bg-base-100 shadow-sm hover:shadow-md transition-all cursor-pointer border-2 border-transparent hover:border-primary/20"
          >
            <div className="card-body p-4">
              <div className="card-actions justify-start">
                <div className="avatar placeholder">
                  <div className="bg-accent/10 text-neutral-content rounded-full w-12 h-12">
                    <span className="text-lg">💳</span>
                  </div>
                </div>
              </div>
              <h3 className="card-title text-base mb-2">钱包管理</h3>
              <p className="text-sm text-base-content/60">管理活动钱包和私钥</p>
            </div>
          </div>
        </div>
      </div>

      {/* Chain Activity Distribution */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-xl">🔗</span>
          <h2 className="text-lg font-bold">链活动分布</h2>
        </div>
        <div className="flex flex-wrap gap-4">
          <div className="stat bg-base-100 rounded-lg shadow-sm px-4 py-3 min-w-[120px]">
            <div className="stat-title text-xs">Polygon</div>
            <div className="stat-value text-lg">🟣 15</div>
            <div className="stat-desc text-xs">30% 活动量</div>
          </div>

          <div className="stat bg-base-100 rounded-lg shadow-sm px-4 py-3 min-w-[120px]">
            <div className="stat-title text-xs">Arbitrum</div>
            <div className="stat-value text-lg">🔵 8</div>
            <div className="stat-desc text-xs">16% 活动量</div>
          </div>

          <div className="stat bg-base-100 rounded-lg shadow-sm px-4 py-3 min-w-[120px]">
            <div className="stat-title text-xs">Base</div>
            <div className="stat-value text-lg">🟢 6</div>
            <div className="stat-desc text-xs">12% 活动量</div>
          </div>

          <div className="stat bg-base-100 rounded-lg shadow-sm px-4 py-3 min-w-[120px]">
            <div className="stat-title text-xs">Optimism</div>
            <div className="stat-value text-lg">🔴 4</div>
            <div className="stat-desc text-xs">8% 活动量</div>
          </div>

          <div className="stat bg-base-100 rounded-lg shadow-sm px-4 py-3 min-w-[120px]">
            <div className="stat-title text-xs">Solana</div>
            <div className="stat-value text-lg">🟡 3</div>
            <div className="stat-desc text-xs">6% 活动量</div>
          </div>
        </div>
      </div>
    </div>
  );
}