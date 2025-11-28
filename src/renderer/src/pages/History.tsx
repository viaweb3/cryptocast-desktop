import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCampaign } from '../contexts/CampaignContext';
import { Campaign, CampaignStatus, EVMChain, ChainInfo } from '../types';
import { isSolanaChain, getChainType, getChainDisplayName, getChainDisplayBadge } from '../utils/chainTypeUtils';

interface HistoryFilters {
  timeRange: 'all' | 'today' | 'week' | 'month' | 'custom';
  chain: string;
  status: CampaignStatus | 'all';
  search: string;
  dateRange?: {
    start: string;
    end: string;
  };
}


export default function History() {
  const navigate = useNavigate();
  const { state, actions } = useCampaign();
  const [filters, setFilters] = useState<HistoryFilters>({
    timeRange: 'all',
    chain: 'all',
    status: 'all',
    search: '',
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
  });
    const [chains, setChains] = useState<ChainInfo[]>([]);

  // Load campaigns and chains on mount and set up auto-refresh
  useEffect(() => {
    loadData();
    loadChains();

    }, []);

  // Load chains from database
  const loadChains = async () => {
    try {
          if (window.electronAPI?.chain) {
        const chainsData = await window.electronAPI.chain.getAllChains();
        setChains(chainsData);
      } else {
              }
    } catch (error) {
      console.error('🔍 [History] loadChains: Failed to load chains:', error);
    }
  };

  const loadData = async () => {
    try {
      await actions.loadCampaigns();
    } catch (error) {
      console.error('Failed to load campaigns:', error);
    }
  };

  // Use real data from state
  const displayCampaigns = state.campaigns;

  
  // Helper function to get chain icon based on chain name (dynamically generated)
  const getChainIcon = (chainName: string): string => {
    // Solana特殊图标
    if (chainName.toLowerCase().includes('solana')) return '🔥';

    // Generate consistent icons based on chain name hash for dynamic chains
    const icons = ['🔷', '🟣', '🔵', '🟡', '🔴', '🟢', '🟠', '⚡', '🌟', '🚀'];

    // Use a simple hash to get consistent icon for the same chain name
    let hash = 0;
    for (let i = 0; i < chainName.length; i++) {
      hash = ((hash << 5) - hash + chainName.charCodeAt(i)) & 0xffffffff;
    }

    const iconIndex = Math.abs(hash) % icons.length;
    return icons[iconIndex];
  };

  // Helper function to get chain by name or chainId using only database data
  const getChainByName = (chainValue: string | number | undefined) => {
    if (!chainValue) return undefined;

    const chainStr = String(chainValue);
    const chainIdAsNumber = parseInt(chainStr);

    // 1. Try exact name match first
    let chain = chains.find(c => c.name === chainStr);
    if (chain) return chain;

    // 2. Try matching by chainId (common scenario)
    if (!isNaN(chainIdAsNumber)) {
      chain = chains.find(c => c.chainId === chainIdAsNumber);
      if (chain) return chain;
    }

    // 3. Try case-insensitive name match
    chain = chains.find(c => c.name.toLowerCase() === chainStr.toLowerCase());
    if (chain) return chain;

    // 4. Try partial match based on actual database chain names
    for (const dbChain of chains) {
      const dbChainNameLower = dbChain.name.toLowerCase();
      const inputLower = chainStr.toLowerCase();

      // Check if input contains part of db chain name or vice versa
      if (dbChainNameLower.includes(inputLower) || inputLower.includes(dbChainNameLower)) {
        return dbChain;
      }
    }

    return undefined;
  };

  const filteredCampaigns = useMemo(() => {
    let filtered = [...displayCampaigns];

    
    // Time range filter
    if (filters.timeRange !== 'all') {
      const now = new Date();
      let startDate: Date;

      switch (filters.timeRange) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        default:
          startDate = new Date(0);
      }

      filtered = filtered.filter(campaign => {
        const campaignDate = new Date(campaign.createdAt);
        return campaignDate >= startDate;
      });
    }

    // Custom date range filter
    if (filters.dateRange) {
      const { start, end } = filters.dateRange;
      filtered = filtered.filter(campaign => {
        const campaignDate = new Date(campaign.createdAt);
        return campaignDate >= new Date(start) && campaignDate <= new Date(end);
      });
    }

    // Chain filter - use simplified matching
    if (filters.chain !== 'all') {
      
      // Get the selected chain from database
      const selectedChain = getChainByName(filters.chain);
      
      filtered = filtered.filter(campaign => {
        // Try to match campaign using our enhanced chain resolution
        const campaignChain = getChainByName(campaign.chain);

        // Match by exact name
        if (campaign.chain === filters.chain) return true;

        // Match by resolved chain name
        if (campaignChain && campaignChain.name === filters.chain) return true;

        // Match by chainId if we have a selected chain
        if (selectedChain) {
          const campaignChainId = parseInt(campaign.chain);
          if (!isNaN(campaignChainId) && campaignChainId === selectedChain.chainId) {
            return true;
          }
        }

        return false;
      });
    }

    // Status filter
    if (filters.status !== 'all') {
      filtered = filtered.filter(campaign => campaign.status === filters.status);
    }

    // Search filter
    if (filters.search.trim()) {
      const searchTerm = filters.search.toLowerCase();
      filtered = filtered.filter(campaign =>
        campaign.name.toLowerCase().includes(searchTerm)
      );
    }

    return filtered;
  }, [state.campaigns, filters]);

  const paginatedCampaigns = useMemo(() => {
    const startIndex = (pagination.page - 1) * pagination.limit;
    const endIndex = startIndex + pagination.limit;
    return filteredCampaigns.slice(startIndex, endIndex);
  }, [filteredCampaigns, pagination]);

  const totalPages = Math.ceil(filteredCampaigns.length / pagination.limit);

  const getStatusBadge = (status: CampaignStatus) => {
    const baseClasses = "badge gap-1 text-xs font-medium px-3 py-2";
    switch (status) {
      case 'COMPLETED':
        return <div className={`${baseClasses} bg-green-100 text-green-800 border-green-200`}>✅ 已完成</div>;
      case 'FAILED':
        return <div className={`${baseClasses} bg-red-100 text-red-800 border-red-200`}>❌ 已失败</div>;
      case 'SENDING':
        return <div className={`${baseClasses} bg-blue-100 text-blue-800 border-blue-200`}>🔄 发送中</div>;
      case 'PAUSED':
        return <div className={`${baseClasses} bg-yellow-100 text-yellow-800 border-yellow-200`}>⏸️ 暂停</div>;
      case 'READY':
        return <div className={`${baseClasses} bg-orange-100 text-orange-800 border-orange-200`}>⚡ 就绪</div>;
      case 'FUNDED':
        return <div className={`${baseClasses} bg-blue-100 text-blue-800 border-blue-200`}>💰 已充值</div>;
      default:
        return <div className={`${baseClasses} bg-gray-100 text-gray-600 border-gray-200`}>📝 已创建</div>;
    }
  };

  const getChainBadge = (chainValue: string | number | undefined, chainId?: number) => {
    // 通过多种方式查找链信息
    const foundChain = chains.find(c => {
      // 1. 通过 chainId 精确匹配
      if (chainId && c.chainId === chainId) return true;

      // 2. 通过 chainValue 匹配 chainId
      if (chainValue && c.chainId?.toString() === chainValue?.toString()) return true;

      // 3. 通过名称匹配
      if (chainValue && c.name === chainValue) return true;

      return false;
    });

    // 如果找到了链信息，直接使用
    if (foundChain) {
      return (
        <div
          className="badge text-xs font-medium px-2 py-1 border-0"
          style={{
            backgroundColor: `${foundChain.color}20`,
            color: foundChain.color,
            border: `1px solid ${foundChain.color}40`
          }}
        >
          {foundChain.name}
        </div>
      );
    }

    // 如果没找到，使用简单的显示名称
    const displayName = getChainDisplayName(chainValue, chains);
    return (
      <div className="badge badge-neutral text-xs font-medium px-2 py-1">
        {displayName}
      </div>
    );
  };

  const formatNumber = (num: number | undefined | null) => {
    if (num === undefined || num === null || isNaN(num)) return '0';
    return num.toLocaleString('zh-CN');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatAmount = (amount: string | undefined | null, decimals = 4) => {
    if (!amount) return '0';
    const num = parseFloat(amount);
    if (isNaN(num)) return '0';
    return num.toFixed(decimals);
  };

  // Calculate average success rate
  const averageSuccessRate = useMemo(() => {
    const totalRecipients = displayCampaigns.reduce((sum, c) => sum + (c.totalRecipients || 0), 0);
    const completedRecipients = displayCampaigns.reduce((sum, c) => sum + (c.completedRecipients || 0), 0);

    if (totalRecipients === 0) return 0;
    return (completedRecipients / totalRecipients) * 100;
  }, [displayCampaigns]);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-3">
          <span className="text-3xl">📜</span>
          <h1 className="text-2xl font-bold">历史记录</h1>
          {state.isLoading && (
            <span className="loading loading-spinner loading-sm"></span>
          )}
        </div>
        <button
            onClick={() => navigate('/')}
            className="btn btn-sm btn-ghost"
          >
            ← 返回仪表盘
          </button>
      </div>

      {/* Statistical Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="stat bg-base-100 rounded-lg shadow-sm">
          <div className="stat-figure text-primary">
            📋
          </div>
          <div className="stat-title">历史总活动</div>
          <div className="stat-value text-primary">{displayCampaigns.length}</div>
          <div className="stat-desc text-info">累计创建</div>
        </div>

        <div className="stat bg-base-100 rounded-lg shadow-sm">
          <div className="stat-figure text-secondary">
            👥
          </div>
          <div className="stat-title">总发送地址</div>
          <div className="stat-value text-secondary">
            {formatNumber(displayCampaigns.reduce((sum, c) => sum + (c.totalRecipients || 0), 0))}
          </div>
          <div className="stat-desc text-secondary">所有活动</div>
        </div>

        <div className="stat bg-base-100 rounded-lg shadow-sm">
          <div className="stat-figure text-success">
            ✅
          </div>
          <div className="stat-title">平均成功率</div>
          <div className="stat-value text-success">{averageSuccessRate.toFixed(1)}%</div>
          <div className="stat-desc">
            <div className="flex items-center gap-2">
              <progress className="progress progress-success w-20" value={averageSuccessRate} max="100"></progress>
              <span className="text-xs text-success">
                {averageSuccessRate >= 95 ? '优秀' : averageSuccessRate >= 80 ? '良好' : averageSuccessRate >= 60 ? '一般' : '待改进'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card bg-base-100 shadow-sm mb-6">
        <div className="card-body">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg">🔍</span>
            <h2 className="text-lg font-semibold">筛选条件</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Time Range Filter */}
            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">时间范围</span>
              </label>
              <select
                value={filters.timeRange}
                onChange={(e) => setFilters({ ...filters, timeRange: e.target.value as any })}
                className="select select-bordered"
              >
                <option value="all">全部时间</option>
                <option value="today">今天</option>
                <option value="week">本周</option>
                <option value="month">本月</option>
                <option value="custom">自定义</option>
              </select>
            </div>

            {/* Chain Filter */}
            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">区块链</span>
              </label>
              <select
                value={filters.chain}
                onChange={(e) => setFilters({ ...filters, chain: e.target.value })}
                className="select select-bordered"
              >
                <option value="all">所有链</option>
                {chains.map((chain) => (
                  <option key={chain.name} value={chain.name}>
                    {getChainIcon(chain.name)} {chain.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">状态</span>
              </label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value as any })}
                className="select select-bordered"
              >
                <option value="all">全部状态</option>
                <option value="COMPLETED">✅ 已完成</option>
                <option value="FAILED">❌ 已失败</option>
                <option value="SENDING">🔄 发送中</option>
                <option value="PAUSED">⏸️ 已暂停</option>
              </select>
            </div>

            {/* Search */}
            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">搜索</span>
              </label>
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                placeholder="输入活动名称..."
                className="input input-bordered"
              />
            </div>
          </div>

        {/* Custom Date Range */}
        {filters.timeRange === 'custom' && (
          <div className="collapse collapse-arrow bg-base-200 mt-4">
            <input type="checkbox" defaultChecked />
            <div className="collapse-title text-sm font-medium">
              自定义日期范围
            </div>
            <div className="collapse-content">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">开始日期</span>
                  </label>
                  <input
                    type="date"
                    value={filters.dateRange?.start || ''}
                    onChange={(e) => setFilters({
                      ...filters,
                      dateRange: { ...filters.dateRange!, start: e.target.value }
                    })}
                    className="input input-bordered"
                  />
                </div>
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">结束日期</span>
                  </label>
                  <input
                    type="date"
                    value={filters.dateRange?.end || ''}
                    min={filters.dateRange?.start}
                    onChange={(e) => setFilters({
                      ...filters,
                      dateRange: { ...filters.dateRange!, end: e.target.value }
                    })}
                    className="input input-bordered"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>

      {/* Results Summary */}
      <div className="flex justify-start items-center mb-4">
        <div className="text-sm text-base-content/60">
          显示 <span className="font-medium">{formatNumber(paginatedCampaigns.length)}</span> /{' '}
          <span className="font-medium">{formatNumber(filteredCampaigns.length)}</span> 条记录
        </div>
      </div>

      {/* Campaigns Table */}
      <div className="card bg-base-100 shadow-sm">
        <div className="overflow-x-auto">
          <table className="table-zebra table-hover">
            <thead>
              <tr>
                <th className="bg-base-200 font-semibold text-sm w-2/5 px-4 py-3">名称</th>
                <th className="bg-base-200 font-semibold text-sm w-1/6 px-3 py-3">链</th>
                <th className="bg-base-200 font-semibold text-sm w-1/6 px-3 py-3">状态</th>
                <th className="bg-base-200 font-semibold text-sm text-right w-1/6 px-3 py-3">地址数</th>
                <th className="bg-base-200 font-semibold text-sm w-1/5 px-3 py-3">创建时间</th>
                <th className="bg-base-200 font-semibold text-sm text-center w-1/12 px-2 py-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {paginatedCampaigns.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-16">
                    <div className="text-6xl mb-4">📭</div>
                    <div className="text-lg font-medium mb-2">暂无活动记录</div>
                    <div className="text-sm text-base-content/60">创建活动后将在此处显示</div>
                  </td>
                </tr>
              ) : (
                paginatedCampaigns.map((campaign) => (
                  <tr key={campaign.id} className="border-b border-base-200/50 hover:bg-base-50 transition-colors">
                    <td className="px-4 py-4">
                      <div className="font-medium text-base-content">{campaign.name}</div>
                    </td>
                    <td className="px-3 py-4">
                      {getChainBadge(campaign.chain, campaign.chainId)}
                    </td>
                    <td className="px-3 py-4">
                      {getStatusBadge(campaign.status)}
                    </td>
                    <td className="px-3 py-4 text-right">
                      <div className="font-medium text-base-content">{formatNumber(campaign.totalRecipients)}</div>
                      <div className="text-xs text-success mt-1">
                        +{formatNumber(campaign.completedRecipients)} 成功
                      </div>
                    </td>
                    <td className="px-3 py-4">
                      <div className="text-sm text-base-content/80">{formatDate(campaign.createdAt)}</div>
                    </td>
                    <td className="px-2 py-4">
                      <div className="flex justify-center">
                        <button
                          onClick={() => navigate(`/campaign/${campaign.id}`)}
                          className="btn btn-ghost btn-xs text-xs hover:bg-blue-50 hover:text-blue-600 transition-colors"
                        >
                          👁️ 详情
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center mt-6">
          <div className="join">
            <button
              onClick={() => setPagination({ ...pagination, page: Math.max(1, pagination.page - 1) })}
              disabled={pagination.page === 1}
              className="join-item btn btn-sm"
            >
              «
            </button>

            {/* Page numbers */}
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const pageNumber = Math.max(1, Math.min(totalPages - 4, pagination.page - 2)) + i;
              return (
                <button
                  key={pageNumber}
                  onClick={() => setPagination({ ...pagination, page: pageNumber })}
                  className={`join-item btn btn-sm ${pagination.page === pageNumber ? 'btn-active' : ''}`}
                >
                  {pageNumber}
                </button>
              );
            })}

            <button
              onClick={() => setPagination({ ...pagination, page: Math.min(totalPages, pagination.page + 1) })}
              disabled={pagination.page === totalPages}
              className="join-item btn btn-sm"
            >
              »
            </button>
          </div>

          <div className="ml-4 text-sm text-base-content/60">
            第 {pagination.page} 页，共 {totalPages} 页
          </div>
        </div>
      )}
    </div>
  );
}