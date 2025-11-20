import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBulkReward } from '../contexts/BulkRewardContext';

export default function BulkRewardDashboard() {
  const navigate = useNavigate();
  const { state, actions } = useBulkReward();

  useEffect(() => {
    actions.loadDashboardData();
  }, []);

  const formatNumber = (num: number) => {
    return num.toLocaleString('zh-CN');
  };

  const formatCurrency = (amount: number) => {
    return `$${amount.toLocaleString('zh-CN')}`;
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      'SENDING': { className: 'status-badge status-info', text: '进行中', icon: '⏳' },
      'COMPLETED': { className: 'status-badge status-success', text: '已完成', icon: '✅' },
      'FAILED': { className: 'status-badge status-danger', text: '已失败', icon: '❌' },
      'READY': { className: 'status-badge status-warning', text: '就绪', icon: '⚡' },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig['READY'];
    return (
      <span className={`flex items-center gap-1 ${config.className}`}>
        <span>{config.icon}</span>
        <span>{config.text}</span>
      </span>
    );
  };

  const getChainBadge = (chain: string, chainName: string) => {
    const chainColors = {
      polygon: 'bg-purple-100 text-purple-800',
      arbitrum: 'bg-blue-100 text-blue-800',
      base: 'bg-green-100 text-green-800',
      optimism: 'bg-red-100 text-red-800',
    };

    const colorClass = chainColors[chain as keyof typeof chainColors] || 'bg-gray-100 text-gray-800';
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colorClass}`}>
        {chainName}
      </span>
    );
  };

  const getProgressPercentage = (activity: any) => {
    return Math.round((activity.completedRecipients / activity.totalRecipients) * 100);
  };

  const handleCreateActivity = () => {
    navigate('/bulk-reward/create');
  };

  const handleViewReports = () => {
    navigate('/bulk-reward/reports');
  };

  const handleRechargeWallet = () => {
    navigate('/bulk-reward/wallet');
  };

  if (state.isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-500">加载中...</div>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-600">错误: {state.error}</div>
      </div>
    );
  }

  const stats = state.dashboardData?.statistics;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-dark">批量发奖工具</h1>
        <div className="flex items-center gap-4">
          <button className="btn btn-ghost">
            📊 查看报告
          </button>
          <button className="btn btn-primary" onClick={handleCreateActivity}>
            ➕ 新建活动
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="mb-8">
        <h2 className="text-lg font-medium text-dark mb-4">📊 仪表盘</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-white border border-border rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-500 mb-1">总活动数</div>
                <div className="text-2xl font-bold text-dark">{formatNumber(stats?.totalActivities || 0)}</div>
              </div>
              <div className="text-3xl">📋</div>
            </div>
          </div>

          <div className="bg-white border border-border rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-500 mb-1">成功发送</div>
                <div className="text-2xl font-bold text-success">{formatNumber(stats?.completedRecipients || 0)}</div>
                <div className="text-sm text-success flex items-center gap-1">
                  ↑ {stats?.successRate || 0}%
                </div>
              </div>
              <div className="text-3xl">✅</div>
            </div>
          </div>

          <div className="bg-white border border-border rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-500 mb-1">Gas消耗总计</div>
                <div className="text-2xl font-bold text-warning">{stats?.totalGasUsed || 0} ETH</div>
                <div className="text-sm text-gray-500">≈ {formatCurrency(stats?.totalGasCostUSD || 0)}</div>
              </div>
              <div className="text-3xl">⛽</div>
            </div>
          </div>

          <div className="bg-white border border-border rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-500 mb-1">进行中活动</div>
                <div className="text-2xl font-bold text-info">{formatNumber(stats?.ongoingActivities || 0)}</div>
              </div>
              <div className="text-3xl">🔄</div>
            </div>
          </div>

          <div className="bg-white border border-border rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-500 mb-1">本周活动数</div>
                <div className="text-2xl font-bold text-primary">{formatNumber(stats?.weeklyActivities || 0)}</div>
              </div>
              <div className="text-3xl">📅</div>
            </div>
          </div>

          <div className="bg-white border border-border rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-500 mb-1">本周花费</div>
                <div className="text-2xl font-bold text-danger">{formatCurrency(stats?.weeklyGasCostUSD || 0)}</div>
              </div>
              <div className="text-3xl">💰</div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <h2 className="text-lg font-medium text-dark mb-4">⚡ 快速操作</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={handleCreateActivity}
            className="bg-primary text-white p-6 rounded-lg hover:bg-primary-dark transition-colors flex flex-col items-center gap-3"
          >
            <div className="text-3xl">➕</div>
            <div className="font-medium">新建活动</div>
            <div className="text-sm opacity-90">创建新的批量奖励活动</div>
          </button>

          <button
            onClick={handleViewReports}
            className="bg-info text-white p-6 rounded-lg hover:bg-info-dark transition-colors flex flex-col items-center gap-3"
          >
            <div className="text-3xl">📊</div>
            <div className="font-medium">查看报告</div>
            <div className="text-sm opacity-90">分析活动效果和统计</div>
          </button>

          <button
            onClick={handleRechargeWallet}
            className="bg-success text-white p-6 rounded-lg hover:bg-success-dark transition-colors flex flex-col items-center gap-3"
          >
            <div className="text-3xl">💳</div>
            <div className="font-medium">充值钱包</div>
            <div className="text-sm opacity-90">为活动钱包充值Gas费</div>
          </button>
        </div>
      </div>

      {/* Ongoing Activities */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-medium text-dark">🔄 进行中的活动</h2>
          <button
            onClick={() => navigate('/bulk-reward/activities')}
            className="text-primary hover:text-primary-dark text-sm font-medium"
          >
            查看全部 →
          </button>
        </div>

        <div className="space-y-4">
          {state.dashboardData?.ongoingActivities.map((activity) => (
            <div key={activity.id} className="bg-white border border-border rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  {getStatusBadge(activity.status)}
                  <h3 className="font-medium text-dark">{activity.name}</h3>
                  {getChainBadge(activity.chain, activity.chainName)}
                </div>
                <div className="text-sm text-gray-500">
                  剩余时间: 约 {Math.ceil((activity.pendingRecipients / activity.batchSize) * (activity.sendInterval / 1000) / 60)} 分钟
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mb-4">
                <div className="flex justify-between text-sm text-gray-600 mb-2">
                  <span>{activity.completedRecipients}/{activity.totalRecipients} 地址已发送</span>
                  <span>{getProgressPercentage(activity)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all"
                    style={{ width: `${getProgressPercentage(activity)}%` }}
                  />
                </div>
              </div>

              <div className="flex justify-between items-center">
                <div className="text-sm text-gray-500">
                  开始时间: {new Date(activity.startedAt || activity.createdAt).toLocaleString('zh-CN')}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => navigate(`/bulk-reward/activity/${activity.id}`)}
                    className="btn btn-ghost text-sm"
                  >
                    查看详情
                  </button>
                  <button className="btn btn-warning text-sm">
                    暂停
                  </button>
                </div>
              </div>
            </div>
          ))}

          {(!state.dashboardData?.ongoingActivities || state.dashboardData?.ongoingActivities.length === 0) && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
              <div className="text-4xl mb-2">📭</div>
              <div className="text-lg font-medium text-gray-700 mb-1">暂无进行中的活动</div>
              <div className="text-gray-500">创建新活动后将在此处显示</div>
            </div>
          )}
        </div>
      </div>

      {/* Recently Completed Activities */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-medium text-dark">✅ 最近完成的活动</h2>
          <button
            onClick={() => navigate('/bulk-reward/history')}
            className="text-primary hover:text-primary-dark text-sm font-medium"
          >
            查看全部 →
          </button>
        </div>

        <div className="bg-white border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-gray-50">
                  <th className="text-left py-3 px-4 font-medium text-dark">名称</th>
                  <th className="text-left py-3 px-4 font-medium text-dark">链</th>
                  <th className="text-right py-3 px-4 font-medium text-dark">地址数</th>
                  <th className="text-right py-3 px-4 font-medium text-dark">Gas消耗</th>
                  <th className="text-left py-3 px-4 font-medium text-dark">完成时间</th>
                  <th className="text-center py-3 px-4 font-medium text-dark">操作</th>
                </tr>
              </thead>
              <tbody>
                {state.dashboardData?.recentActivities.map((activity) => (
                  <tr key={activity.id} className="border-b border-border hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div className="font-medium text-dark">{activity.name}</div>
                    </td>
                    <td className="py-3 px-4">
                      {getChainBadge(activity.chain, activity.chainName)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {formatNumber(activity.totalRecipients)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="text-sm">
                        <div>{activity.gasUsed} ETH</div>
                        <div className="text-gray-500 text-xs">
                          ≈ {formatCurrency(activity.gasCostUSD)}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {new Date(activity.completedAt || activity.updatedAt).toLocaleDateString('zh-CN')}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex justify-center">
                        <button
                          onClick={() => navigate(`/bulk-reward/activity/${activity.id}`)}
                          className="text-primary hover:text-primary-dark text-sm font-medium"
                        >
                          详情
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {(!state.dashboardData?.recentActivities || state.dashboardData?.recentActivities.length === 0) && (
                  <tr>
                    <td colSpan={6} className="text-center py-8">
                      <div className="text-gray-500">暂无已完成的活动</div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}