import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCampaign } from '../contexts/CampaignContext';

interface Campaign {
  id: string;
  name: string;
  chain: string;
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
  totalCampaigns: number;
  completedCampaigns: number;
  totalRecipients: number;
  completedRecipients: number;
  totalGasUsed: number;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { state, actions } = useCampaign();
  const [isCreatingDemo, setIsCreatingDemo] = useState(false);

  // Calculate stats from real campaign data
  const stats: DashboardStats = {
    totalCampaigns: state.campaigns.length,
    completedCampaigns: state.campaigns.filter(c => c.status === 'COMPLETED').length,
    totalRecipients: state.campaigns.reduce((sum, c) => sum + c.totalRecipients, 0),
    completedRecipients: state.campaigns.reduce((sum, c) => sum + c.completedRecipients, 0),
    totalGasUsed: state.campaigns.reduce((sum, c) => sum + (c.gasUsed || 0), 0)
  };

  const activeCampaigns = state.campaigns.filter(c =>
    ['READY', 'SENDING', 'PAUSED'].includes(c.status)
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'status-success';
      case 'SENDING': return 'status-info';
      case 'FAILED': return 'status-danger';
      case 'PAUSED': return 'status-warning';
      case 'READY': return 'status-success';
      default: return 'status-info';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'CREATED': return '创建';
      case 'READY': return '就绪';
      case 'SENDING': return '发送中';
      case 'PAUSED': return '暂停';
      case 'COMPLETED': return '成功';
      case 'FAILED': return '失败';
      default: return '未知';
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards Grid */}
      <div className="grid grid-cols-2 gap-6">
        {/* Total Campaigns */}
        <div className="card bg-white border border-border rounded-lg p-6 relative">
          <div className="flex justify-between items-start mb-4">
            <div>
              <div className="text-4xl font-bold text-dark mb-1">{stats.totalCampaigns}</div>
              <div className="text-sm text-medium">总活动数</div>
            </div>
            <div className="icon-md text-primary">🔔</div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-success font-semibold">+12% 较上月</span>
          </div>
        </div>

        {/* Completed Campaigns */}
        <div className="card bg-white border border-border rounded-lg p-6 relative">
          <div className="flex justify-between items-start mb-4">
            <div>
              <div className="text-4xl font-bold text-dark mb-1">{stats.completedCampaigns}</div>
              <div className="text-sm text-medium">已完成</div>
            </div>
            <div className="icon-md text-success">✓</div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-success font-semibold">+8% 较上月</span>
          </div>
        </div>

        {/* In Progress Activities */}
        <div className="card bg-white border border-border rounded-lg p-6 relative col-span-2">
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1">
              <div className="text-4xl font-bold text-dark mb-1">10</div>
              <div className="text-sm text-medium mb-3">进行中的活动</div>
              <div className="w-full bg-border rounded-full h-2">
                <div className="bg-info h-2 rounded-full" style={{width: '30%'}}></div>
              </div>
            </div>
            <div className="icon-md text-info">⏰</div>
          </div>
        </div>

        {/* Weekly Stats */}
        <div className="card bg-white border border-border rounded-lg p-6 relative">
          <div className="flex justify-between items-start mb-4">
            <div>
              <div className="text-4xl font-bold text-dark mb-1">156</div>
              <div className="text-sm text-medium">本周新增</div>
            </div>
            <div className="icon-md" style={{color: 'var(--color-pink)'}}>📅</div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-success font-semibold">+24% 较上周</span>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-3 gap-6">
        {/* Left Column - Active Campaigns */}
        <div className="col-span-2 space-y-6">
          {/* Quick Actions */}
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-dark">🚀 进行中的活动</h3>
            <button
              onClick={() => navigate('/history')}
              className="text-sm text-primary hover:text-primary-hover cursor-pointer"
            >
              查看全部 →
            </button>
          </div>

          {/* Chain Activity Distribution */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-dark mb-4">📊 链上活动分布</h3>
            <div className="grid grid-cols-5 gap-4">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-2 rounded-full bg-primary/20 flex items-center justify-center">
                  <div className="w-8 h-8 rounded-full bg-primary"></div>
                </div>
                <div className="text-lg font-bold text-dark">42</div>
                <div className="text-xs text-medium">Ethereum</div>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-2 rounded-full bg-purple/20 flex items-center justify-center">
                  <div className="w-8 h-8 rounded-full" style={{backgroundColor: 'var(--color-chain-polygon)'}}></div>
                </div>
                <div className="text-lg font-bold text-dark">15</div>
                <div className="text-xs text-medium">Polygon</div>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-2 rounded-full bg-info/20 flex items-center justify-center">
                  <div className="w-8 h-8 rounded-full bg-info"></div>
                </div>
                <div className="text-lg font-bold text-dark">8</div>
                <div className="text-xs text-medium">Arbitrum</div>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-2 rounded-full bg-danger/20 flex items-center justify-center">
                  <div className="w-8 h-8 rounded-full bg-danger"></div>
                </div>
                <div className="text-lg font-bold text-dark">3</div>
                <div className="text-xs text-medium">Optimism</div>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-2 rounded-full bg-warning/20 flex items-center justify-center">
                  <div className="w-8 h-8 rounded-full bg-warning"></div>
                </div>
                <div className="text-lg font-bold text-dark">12</div>
                <div className="text-xs text-medium">BSC</div>
              </div>
            </div>
          </div>

          {/* Recent Activities */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-dark">📋 最近活动</h3>
            </div>
            <div className="space-y-3">
              {/* Sample Activity Items */}
              <div className="flex items-center gap-4 p-4 bg-white rounded-lg border border-border">
                <div className="w-3 h-3 rounded-full bg-success"></div>
                <div className="flex-1">
                  <div className="font-medium text-dark">Polygon DeFi Airdrop</div>
                  <div className="text-xs text-light">2分钟前 • 1,250 recipients • $12,500</div>
                </div>
                <span className="status-badge status-success">成功</span>
              </div>
              <div className="flex items-center gap-4 p-4 bg-white rounded-lg border border-border">
                <div className="w-3 h-3 rounded-full bg-info"></div>
                <div className="flex-1">
                  <div className="font-medium text-dark">Ethereum NFT Campaign</div>
                  <div className="text-xs text-light">15分钟前 • 850 recipients • In Progress</div>
                </div>
                <span className="status-badge status-info">发送中</span>
              </div>
              <div className="flex items-center gap-4 p-4 bg-white rounded-lg border border-border">
                <div className="w-3 h-3 rounded-full bg-success"></div>
                <div className="flex-1">
                  <div className="font-medium text-dark">BSC Token Distribution</div>
                  <div className="text-xs text-light">1小时前 • 2,100 recipients • $8,400</div>
                </div>
                <span className="status-badge status-success">成功</span>
              </div>
              <div className="flex items-center gap-4 p-4 bg-white rounded-lg border border-border">
                <div className="w-3 h-3 rounded-full bg-warning"></div>
                <div className="flex-1">
                  <div className="font-medium text-dark">Arbitrum Community Reward</div>
                  <div className="text-xs text-light">2小时前 • 500 recipients • Paused</div>
                </div>
                <span className="status-badge status-warning">暂停</span>
              </div>
              <div className="flex items-center gap-4 p-4 bg-white rounded-lg border border-border">
                <div className="w-3 h-3 rounded-full bg-success"></div>
                <div className="flex-1">
                  <div className="font-medium text-dark">Optimism Liquidity Mining</div>
                  <div className="text-xs text-light">3小时前 • 3,000 recipients • $15,000</div>
                </div>
                <span className="status-badge status-success">成功</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Quick Actions */}
        <div className="space-y-6">
          {/* Quick Actions Title */}
          <div>
            <h3 className="text-lg font-semibold text-dark mb-4">快速操作</h3>
          </div>

          {/* Action Cards */}
          <div className="space-y-4">
            {/* Create Demo Campaign */}
            <button
              onClick={() => createDemoCampaign()}
              disabled={isCreatingDemo}
              className="w-full card bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/30 rounded-lg p-6 text-left hover:shadow-md transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="icon-xl text-primary">🚀</div>
                <div>
                  <div className="font-semibold text-dark mb-1">
                    {isCreatingDemo ? '正在创建演示...' : '创建演示活动'}
                  </div>
                  <div className="text-xs text-light">一键创建完整的批量分发演示</div>
                </div>
              </div>
            </button>

            {/* Create New Campaign */}
            <button
              onClick={() => navigate('/campaign/create')}
              className="w-full card bg-white border border-border rounded-lg p-6 text-left hover:shadow-md transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="icon-xl text-primary">🔔</div>
                <div>
                  <div className="font-semibold text-dark mb-1">创建新活动</div>
                  <div className="text-xs text-light">部署智能合约并开始新的空投活动</div>
                </div>
              </div>
            </button>

            {/* View Reports */}
            <button
              onClick={() => navigate('/history')}
              className="w-full card bg-white border border-border rounded-lg p-6 text-left hover:shadow-md transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="icon-xl text-info">📊</div>
                <div>
                  <div className="font-semibold text-dark mb-1">查看报告</div>
                  <div className="text-xs text-light">分析活动表现和用户参与度</div>
                </div>
              </div>
            </button>

            {/* Recharge Wallet */}
            <button
              onClick={() => navigate('/settings')}
              className="w-full card bg-white border border-border rounded-lg p-6 text-left hover:shadow-md transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="icon-xl text-success">💳</div>
                <div>
                  <div className="font-semibold text-dark mb-1">充值钱包</div>
                  <div className="text-xs text-light">为新的空投活动添加资金</div>
                </div>
              </div>
            </button>
          </div>

          {/* Help Section */}
          <div className="card bg-gradient-to-br from-primary/5 to-info/5 border border-primary/20 rounded-lg p-6">
            <h4 className="font-semibold text-dark mb-3 flex items-center gap-2">
              <span>💡</span>
              需要帮助？
            </h4>
            <p className="text-sm text-light mb-4">
              查看我们的文档了解如何使用 CryptoCast 进行高效的空投活动管理。
            </p>
            <button className="w-full btn btn-primary text-sm">
              查看使用指南
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}