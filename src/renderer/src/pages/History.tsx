import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCampaign } from '../contexts/CampaignContext';
import { Campaign, CampaignStatus } from '../types';
import GasTrendChart from '../components/GasTrendChart';

interface HistoryFilters {
  timeRange: 'all' | 'today' | 'week' | 'month' | 'custom';
  chain: string;
  status: CampaignStatus;
  search: string;
  dateRange?: {
    start: string;
    end: string;
  };
}

interface ChainInfo {
  id: string;
  name: string;
  symbol: string;
  icon: string;
  color: string;
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

  const chains: Record<string, ChainInfo> = {
    ethereum: { id: 'ethereum', name: 'Ethereum', symbol: 'ETH', icon: '🔷', color: '#627eea' },
    polygon: { id: 'polygon', name: 'Polygon', symbol: 'MATIC', icon: '🟣', color: '#8247e5' },
    arbitrum: { id: 'arbitrum', name: 'Arbitrum', symbol: 'ETH', icon: '🔵', color: '#28a0f0' },
    bsc: { id: 'bsc', name: 'BSC', symbol: 'BNB', icon: '🟡', color: '#f3ba2f' },
    optimism: { id: 'optimism', name: 'Optimism', symbol: 'ETH', icon: '🔴', color: '#ff0420' },
  };

  const filteredCampaigns = useMemo(() => {
    let filtered = [...state.campaigns];

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

    // Chain filter
    if (filters.chain !== 'all') {
      filtered = filtered.filter(campaign => campaign.chain === filters.chain);
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
    const statusConfig = {
      'COMPLETED': { className: 'status-badge status-success', text: '已完成', icon: '✅' },
      'FAILED': { className: 'status-badge status-danger', text: '已失败', icon: '⚠️' },
      'SENDING': { className: 'status-badge status-info', text: '发送中', icon: '⏳' },
      'PAUSED': { className: 'status-badge status-warning', text: '暂停', icon: '⏸️' },
      'CANCELLED': { className: 'status-badge status-info', text: '已取消', icon: '❌' },
      'READY': { className: 'status-badge status-success', text: '就绪', icon: '⚡' },
      'FUNDED': { className: 'status-badge status-info', text: '已充值', icon: '💰' },
      'CREATED': { className: 'status-badge status-info', text: '已创建', icon: '📝' },
    };

    const config = statusConfig[status] || statusConfig['CREATED'];
    return (
      <span className={`flex items-center gap-1 ${config.className}`}>
        <span>{config.icon}</span>
        <span>{config.text}</span>
      </span>
    );
  };

  const getChainBadge = (chainId: string) => {
    const chain = chains[chainId];
    if (!chain) return <span className="text-xs text-medium">Unknown</span>;
    return (
      <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-border-light">
        <span>{chain.icon}</span>
        <span className="text-sm font-medium">{chain.name}</span>
      </div>
    );
  };

  const handleExportAll = async () => {
    try {
      // Create CSV content
      const headers = ['活动名称', '区块链', '状态', '地址数', 'Gas消耗', '完成时间'];
      const rows = filteredCampaigns.map(campaign => [
        campaign.name,
        chains[campaign.chain]?.name || campaign.chain,
        campaign.status === 'COMPLETED' ? '已完成' : campaign.status,
        campaign.totalRecipients.toString(),
        campaign.gasUsed || '0',
        campaign.completedAt ? new Date(campaign.completedAt).toLocaleDateString() : new Date(campaign.updatedAt).toLocaleDateString(),
      ]);

      const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');

      // Create blob and download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `cryptocast_history_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      alert('报告导出成功！');
    } catch (error) {
      alert('导出失败，请重试');
    }
  };

  const handleExportSingle = async (campaign: Campaign) => {
    try {
      const result = await actions.exportReport(campaign.id);
      if (result.success) {
        alert(`活动 "${campaign.name}" 报告导出成功！`);
      } else {
        alert('导出失败，请重试');
      }
    } catch (error) {
      alert(`导出活动 "${campaign.name}" 失败：${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString('zh-CN');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-CN');
  };

  const formatAmount = (amount: string, decimals = 4) => {
    const num = parseFloat(amount);
    if (isNaN(num)) return '0';
    return num.toFixed(decimals);
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-dark">历史记录</h1>
        <button
          onClick={() => navigate('/')}
          className="btn btn-ghost"
        >
          返回仪表盘
        </button>
      </div>

      {/* Statistical Overview */}
      <div className="grid grid-cols-3 gap-6 mb-6">
        <div className="bg-white border border-border rounded-lg p-6 text-center">
          <div className="text-3xl font-bold text-dark mb-1">
            {state.campaigns.length}
          </div>
          <div className="text-sm text-medium">历史总活动</div>
        </div>
        <div className="bg-white border border-border rounded-lg p-6 text-center">
          <div className="text-3xl font-bold text-dark mb-1">
            {state.campaigns.reduce((sum, c) => sum + c.totalRecipients, 0).toLocaleString()}
          </div>
          <div className="text-sm text-medium">总发送地址</div>
        </div>
        <div className="bg-white border border-border rounded-lg p-6 text-center">
          <div className="text-3xl font-bold text-success mb-1">98.5%</div>
          <div className="text-sm text-medium">平均成功率</div>
          <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
            <div className="bg-success h-2 rounded-full" style={{width: '98.5%'}}></div>
          </div>
        </div>
      </div>

      {/* Gas Trend Chart */}
      <div className="mb-6">
        <GasTrendChart />
      </div>

      {/* Filters */}
      <div className="card bg-white border border-border rounded-lg p-6 mb-6">
        <div className="grid grid-cols-4 gap-4">
          {/* Time Range Filter */}
          <div>
            <label className="block text-sm font-medium text-dark mb-2">时间范围</label>
            <select
              value={filters.timeRange}
              onChange={(e) => setFilters({ ...filters, timeRange: e.target.value as any })}
              className="w-full px-4 py-3 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              <option value="all">全部时间</option>
              <option value="today">今天</option>
              <option value="week">本周</option>
              <option value="month">本月</option>
              <option value="custom">自定义</option>
            </select>
          </div>

          {/* Chain Filter */}
          <div>
            <label className="block text-sm font-medium text-dark mb-2">所有链</label>
            <select
              value={filters.chain}
              onChange={(e) => setFilters({ ...filters, chain: e.target.value })}
              className="w-full px-4 py-3 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              <option value="all">所有链</option>
              {Object.values(chains).map(chain => (
                <option key={chain.id} value={chain.id}>
                  {chain.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium text-dark mb-2">所有状态</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value as any })}
              className="w-full px-4 py-3 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              <option value="all">全部状态</option>
              <option value="COMPLETED">已完成</option>
              <option value="FAILED">已失败</option>
              <option value="SENDING">发送中</option>
              <option value="PAUSED">已暂停</option>
            </select>
          </div>

          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-dark mb-2">搜索活动名称</label>
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              placeholder="输入活动名称搜索..."
              className="w-full px-4 py-3 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
        </div>

        {/* Custom Date Range */}
        {filters.timeRange === 'custom' && (
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-dark mb-2">开始日期</label>
              <input
                type="date"
                value={filters.dateRange?.start || ''}
                onChange={(e) => setFilters({
                  ...filters,
                  dateRange: { ...filters.dateRange!, start: e.target.value }
                })}
                className="w-full px-4 py-3 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark mb-2">结束日期</label>
              <input
                type="date"
                value={filters.dateRange?.end || ''}
                min={filters.dateRange?.start}
                onChange={(e) => setFilters({
                  ...filters,
                  dateRange: { ...filters.dateRange!, end: e.target.value }
                })}
                className="w-full px-4 py-3 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
          </div>
        )}

        {/* Export Button */}
        <div className="flex justify-end mt-4">
          <button
            onClick={handleExportAll}
            className="btn btn-primary"
          >
            导出全部报告
          </button>
        </div>
      </div>

      {/* Results Count */}
      <div className="text-sm text-light mb-4">
        显示 {formatNumber(paginatedCampaigns.length)} / {formatNumber(filteredCampaigns.length)} 条记录
      </div>

      {/* Campaigns Table */}
      <div className="card bg-white border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-border-light">
                <th className="text-left py-4 px-6 font-medium text-dark">名称</th>
                <th className="text-left py-4 px-6 font-medium text-dark">链</th>
                <th className="text-left py-4 px-6 font-medium text-dark">状态</th>
                <th className="text-right py-4 px-6 font-medium text-dark">地址数</th>
                <th className="text-right py-4 px-6 font-medium text-dark">Gas消耗</th>
                <th className="text-left py-4 px-6 font-medium text-dark">完成时间</th>
                <th className="text-center py-4 px-6 font-medium text-dark">操作</th>
              </tr>
            </thead>
            <tbody>
              {paginatedCampaigns.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12">
                    <div className="text-6xl mb-4">📭</div>
                    <div className="text-lg font-medium text-dark mb-2">暂无活动记录</div>
                    <div className="text-light">创建活动后将在此处显示</div>
                  </td>
                </tr>
              ) : (
                paginatedCampaigns.map((campaign) => (
                  <tr key={campaign.id} className="border-b border-border hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-6">
                      <div className="font-medium text-dark">{campaign.name}</div>
                    </td>
                    <td className="py-4 px-6">
                      {getChainBadge(campaign.chain)}
                    </td>
                    <td className="py-4 px-6">
                      {getStatusBadge(campaign.status)}
                    </td>
                    <td className="py-4 px-6 text-right">
                      {formatNumber(campaign.totalRecipients)}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="text-sm">
                        <div>{formatAmount(campaign.gasUsed)} ETH</div>
                        <div className="text-light text-xs">
                          ≈ ${(parseFloat(campaign.gasUsed || '0') * 2000).toFixed(2)}
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-sm text-light">
                      {campaign.completedAt
                        ? formatDate(campaign.completedAt)
                        : formatDate(campaign.updatedAt)
                      }
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => navigate(`/campaign/${campaign.id}`)}
                          className="btn btn-ghost text-sm px-4 py-2"
                        >
                          详情
                        </button>
                        <button
                          onClick={() => handleExportSingle(campaign)}
                          className="btn btn-ghost text-sm px-4 py-2"
                        >
                          导出
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
        <div className="flex justify-center items-center gap-4 mt-6">
          <button
            onClick={() => setPagination({ ...pagination, page: Math.max(1, pagination.page - 1) })}
            disabled={pagination.page === 1}
            className="btn btn-ghost"
          >
            上一页
          </button>

          <div className="flex items-center gap-2">
            <span className="text-sm text-light">
              第 {pagination.page} 页，共 {totalPages} 页
            </span>
          </div>

          <button
            onClick={() => setPagination({ ...pagination, page: Math.min(totalPages, pagination.page + 1) })}
            disabled={pagination.page === totalPages}
            className="btn btn-ghost"
          >
            下一页
          </button>
        </div>
      )}
    </div>
  );
}