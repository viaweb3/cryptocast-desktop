import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ActivityWallet,
  WalletDetail,
  WalletTransaction,
  FundingRecord,
  BalanceHistory,
  WalletBalance
} from '../types';

interface WalletDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  wallet: ActivityWallet | null;
}

function WalletDetailModal({ isOpen, onClose, wallet }: WalletDetailModalProps) {
  if (!isOpen || !wallet) return null;

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      'active': { className: 'status-badge status-info', text: '进行中', icon: '🔴' },
      'pending': { className: 'status-badge status-warning', text: '待充值', icon: '🟠' },
      'completed': { className: 'status-badge status-success', text: '已完成', icon: '🟢' },
      'failed': { className: 'status-badge status-danger', text: '已失败', icon: '🔴' },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig['active'];
    return (
      <span className={`flex items-center gap-1 ${config.className}`}>
        <span>{config.icon}</span>
        <span>{config.text}</span>
      </span>
    );
  };

  const getTransactionTypeIcon = (type: string) => {
    const typeIcons = {
      'incoming': '📥',
      'outgoing': '📤',
      'self': '🔄'
    };
    return typeIcons[type as keyof typeof typeIcons] || '❓';
  };

  const formatNumber = (num: string, decimals = 4) => {
    const number = parseFloat(num);
    if (isNaN(number)) return '0';
    return number.toFixed(decimals);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-CN');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-semibold text-dark">钱包详情 - {wallet.campaignName}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>

        <div className="p-6">
          {/* Wallet Info */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-medium text-dark mb-2">钱包信息</h3>
                <div className="text-sm text-gray-500 mb-1">活动名称: {wallet.campaignName}</div>
                <div className="text-sm text-gray-500 mb-1">状态: {getStatusBadge(wallet.status)}</div>
                <div className="text-sm text-gray-500">创建时间: {formatDate(wallet.createdAt)}</div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-500 mb-1">总余额 / 总容量</div>
                <div className="text-lg font-medium text-dark">
                  {formatNumber(wallet.totalBalance)} / {formatNumber(wallet.totalCapacity)} ETH
                </div>
              </div>
            </div>

            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="text-sm font-mono break-all text-gray-700">
                钱包地址: {wallet.address}
              </div>
            </div>
          </div>

          {/* Token Balances */}
          <div className="mb-6">
            <h3 className="text-lg font-medium text-dark mb-4">代币余额</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {wallet.balances.map((balance, index) => (
                <div key={index} className="border border-border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-dark">{balance.tokenSymbol}</span>
                    <span className="text-sm text-gray-500">
                      {parseFloat(balance.balance) > 0 ? '可用' : '已清空'}
                    </span>
                  </div>
                  <div className="text-lg font-semibold text-dark mb-1">
                    {formatNumber(balance.balance)}
                  </div>
                  {balance.usdValue && (
                    <div className="text-sm text-gray-500">
                      ≈ ${parseFloat(balance.usdValue).toFixed(2)}
                    </div>
                  )}
                  {parseFloat(balance.balance) > 0 && (
                    <div className="mt-2">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-primary h-2 rounded-full"
                          style={{
                            width: `${Math.min((parseFloat(balance.balance) / parseFloat(wallet.totalCapacity)) * 100, 100)}%`
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Recent Transactions */}
          <div className="mb-6">
            <h3 className="text-lg font-medium text-dark mb-4">最近交易</h3>
            <div className="space-y-3">
              {[1, 2, 3].map((index) => (
                <div key={index} className="flex items-center justify-between p-3 border border-border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <span className="text-lg">{getTransactionTypeIcon('incoming')}</span>
                    <div>
                      <div className="font-medium text-dark">接收代币</div>
                      <div className="text-sm text-gray-500">来自: 0x1234...5678</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium text-dark">+{formatNumber('100')} USDC</div>
                    <div className="text-sm text-gray-500">{formatDate(new Date().toISOString())}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-4">
            <button
              onClick={() => {
                navigator.clipboard.writeText(wallet.address);
                alert('钱包地址已复制到剪贴板');
              }}
              className="btn btn-ghost"
            >
              复制地址
            </button>
            <button
              onClick={onClose}
              className="btn btn-primary"
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function WalletManagement() {
  const navigate = useNavigate();
  const [wallets, setWallets] = useState<ActivityWallet[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState<ActivityWallet | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  useEffect(() => {
    loadWallets();
  }, []);

  const loadWallets = async () => {
    setLoading(true);
    try {
      // Mock data for demonstration
      const mockWallets: ActivityWallet[] = [
        {
          id: '1',
          campaignId: 'campaign-1',
          campaignName: '2025-01 营销活动',
          address: '0x1234567890123456789012345678901234567890',
          balances: [
            {
              tokenAddress: '0x0000000000000000000000000000000000000000',
              tokenSymbol: 'WETH',
              tokenDecimals: 18,
              balance: '450.5',
              usdValue: '900000'
            },
            {
              tokenAddress: '0x0000000000000000000000000000000000000001',
              tokenSymbol: 'MATIC',
              tokenDecimals: 18,
              balance: '10000',
              usdValue: '8000'
            },
            {
              tokenAddress: '0x0000000000000000000000000000000000000002',
              tokenSymbol: 'USDC',
              tokenDecimals: 6,
              balance: '0',
            },
            {
              tokenAddress: '0x0000000000000000000000000000000000000003',
              tokenSymbol: 'ETH',
              tokenDecimals: 18,
              balance: '0',
            }
          ],
          status: 'active',
          totalBalance: '450.5',
          totalCapacity: '500',
          createdAt: '2025-01-15T10:00:00Z',
          updatedAt: '2025-01-20T15:30:00Z',
          lastBalanceUpdate: '2025-01-20T15:30:00Z'
        },
        {
          id: '2',
          campaignId: 'campaign-2',
          campaignName: '2024-12 新年奖励',
          address: '0x2345678901234567890123456789012345678901',
          balances: [
            {
              tokenAddress: '0x0000000000000000000000000000000000000001',
              tokenSymbol: 'MATIC',
              tokenDecimals: 18,
              balance: '5000',
              usdValue: '4000'
            },
            {
              tokenAddress: '0x0000000000000000000000000000000000000002',
              tokenSymbol: 'USDC',
              tokenDecimals: 6,
              balance: '25000',
              usdValue: '25000'
            }
          ],
          status: 'pending',
          totalBalance: '29000',
          totalCapacity: '50000',
          createdAt: '2024-12-20T09:00:00Z',
          updatedAt: '2025-01-19T12:00:00Z',
          lastBalanceUpdate: '2025-01-19T12:00:00Z'
        },
        {
          id: '3',
          campaignId: 'campaign-3',
          campaignName: '2024-11 社区空投',
          address: '0x3456789012345678901234567890123456789012',
          balances: [
            {
              tokenAddress: '0x0000000000000000000000000000000000000000',
              tokenSymbol: 'WETH',
              tokenDecimals: 18,
              balance: '0',
            },
            {
              tokenAddress: '0x0000000000000000000000000000000000000003',
              tokenSymbol: 'ETH',
              tokenDecimals: 18,
              balance: '0',
            }
          ],
          status: 'completed',
          totalBalance: '0',
          totalCapacity: '200',
          createdAt: '2024-11-10T14:00:00Z',
          updatedAt: '2024-11-25T18:00:00Z',
          lastBalanceUpdate: '2024-11-25T18:00:00Z'
        },
        {
          id: '4',
          campaignId: 'campaign-4',
          campaignName: '2024-10 测试活动',
          address: '0x4567890123456789012345678901234567890123',
          balances: [
            {
              tokenAddress: '0x0000000000000000000000000000000000000000',
              tokenSymbol: 'WETH',
              tokenDecimals: 18,
              balance: '25',
              usdValue: '50000'
            }
          ],
          status: 'failed',
          totalBalance: '25',
          totalCapacity: '100',
          createdAt: '2024-10-05T11:00:00Z',
          updatedAt: '2024-10-08T16:00:00Z',
          lastBalanceUpdate: '2024-10-08T16:00:00Z'
        },
        {
          id: '5',
          campaignId: 'campaign-5',
          campaignName: '2024-09 Beta测试',
          address: '0x5678901234567890123456789012345678901234',
          balances: [
            {
              tokenAddress: '0x0000000000000000000000000000000000000001',
              tokenSymbol: 'MATIC',
              tokenDecimals: 18,
              balance: '500',
              usdValue: '400'
            },
            {
              tokenAddress: '0x0000000000000000000000000000000000000002',
              tokenSymbol: 'USDC',
              tokenDecimals: 6,
              balance: '1000',
              usdValue: '1000'
            }
          ],
          status: 'completed',
          totalBalance: '1500',
          totalCapacity: '1500',
          createdAt: '2024-09-15T13:00:00Z',
          updatedAt: '2024-09-28T10:00:00Z',
          lastBalanceUpdate: '2024-09-28T10:00:00Z'
        }
      ];

      setWallets(mockWallets);
    } catch (error) {
      console.error('Failed to load wallets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshBalances = async () => {
    setLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      await loadWallets();
      alert('余额刷新成功！');
    } catch (error) {
      console.error('Failed to refresh balances:', error);
      alert('刷新余额失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = (wallet: ActivityWallet) => {
    setSelectedWallet(wallet);
    setIsDetailModalOpen(true);
  };

  const handleExportWallet = async (wallet: ActivityWallet) => {
    if (!confirm('确定要导出钱包私钥吗？请确保您在安全的环境中进行此操作。')) {
      return;
    }

    try {
      if (window.electronAPI?.wallet) {
        const privateKey = await window.electronAPI.wallet.exportPrivateKey(wallet.privateKeyBase64 || '');

        // Create download
        const blob = new Blob([privateKey], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${wallet.campaignName}_private_key.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        alert('私钥导出成功！请妥善保管。');
      }
    } catch (error) {
      console.error('Failed to export wallet:', error);
      alert('导出失败，请重试');
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      'active': { className: 'status-badge status-danger', text: '进行中', icon: '🔴' },
      'pending': { className: 'status-badge status-warning', text: '待充值', icon: '🟠' },
      'completed': { className: 'status-badge status-success', text: '已完成', icon: '🟢' },
      'failed': { className: 'status-badge status-danger', text: '已失败', icon: '🔴' },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig['active'];
    return (
      <span className={`flex items-center gap-1 ${config.className}`}>
        <span>{config.icon}</span>
        <span>{config.text}</span>
      </span>
    );
  };

  const formatNumber = (num: string, decimals = 2) => {
    const number = parseFloat(num);
    if (isNaN(number)) return '0';
    return number.toLocaleString('zh-CN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('zh-CN');
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-dark">钱包管理</h1>
        <button
          onClick={() => navigate('/')}
          className="btn btn-ghost"
        >
          返回仪表盘
        </button>
      </div>

      {/* Activity Wallet Management Explanation */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex items-start space-x-3">
          <div className="text-blue-600 text-xl">ℹ️</div>
          <div>
            <h3 className="text-lg font-medium text-blue-800 mb-2">活动钱包管理</h3>
            <p className="text-sm text-blue-700 leading-relaxed">
              系统为每个活动创建独立的钱包，确保隐私和安全性。使用外部钱包（如 MetaMask）为活动钱包充值。
              活动完成后，可以手动导出私钥以恢复剩余资金。每个钱包都有独立的状态跟踪和余额管理。
            </p>
          </div>
        </div>
      </div>

      {/* Refresh Button */}
      <div className="flex justify-end mb-4">
        <button
          onClick={handleRefreshBalances}
          disabled={loading}
          className="btn btn-ghost flex items-center gap-2"
        >
          <span className={loading ? 'animate-spin' : ''}>🔄</span>
          {loading ? '刷新中...' : '刷新余额'}
        </button>
      </div>

      {/* Activity Wallet List */}
      <div className="bg-white rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-gray-50">
                <th className="text-left py-4 px-6 font-medium text-dark">活动名称</th>
                <th className="text-left py-4 px-6 font-medium text-dark">钱包地址</th>
                <th className="text-left py-4 px-6 font-medium text-dark">余额</th>
                <th className="text-center py-4 px-6 font-medium text-dark">操作</th>
              </tr>
            </thead>
            <tbody>
              {wallets.map((wallet) => (
                <tr key={wallet.id} className="border-b border-border hover:bg-gray-50">
                  <td className="py-4 px-6">
                    <div className="flex items-center space-x-2">
                      {getStatusBadge(wallet.status)}
                      <span className="font-medium text-dark">{wallet.campaignName}</span>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="font-mono text-sm text-gray-600">
                      {wallet.address}
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="space-y-1">
                      {wallet.balances.map((balance, index) => (
                        parseFloat(balance.balance) > 0 && (
                          <div key={index} className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <span className="text-sm font-medium text-dark">{balance.tokenSymbol}:</span>
                              <span className="text-sm">{formatNumber(balance.balance, 4)}</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <div className="w-16 bg-gray-200 rounded-full h-2">
                                <div
                                  className={`h-2 rounded-full ${
                                    balance.tokenSymbol === 'WETH' ? 'bg-blue-500' :
                                    balance.tokenSymbol === 'MATIC' ? 'bg-purple-500' :
                                    'bg-gray-400'
                                  }`}
                                  style={{
                                    width: `${Math.min((parseFloat(balance.balance) / parseFloat(wallet.totalCapacity)) * 100, 100)}%`
                                  }}
                                />
                              </div>
                              <span className="text-xs text-gray-500">
                                /{formatNumber(wallet.totalCapacity, 0)}
                              </span>
                            </div>
                          </div>
                        )
                      ))}
                      {wallet.balances.every(b => parseFloat(b.balance) === 0) && (
                        <div className="text-sm text-gray-500">已清空</div>
                      )}
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex justify-center gap-2">
                      <button
                        onClick={() => handleViewDetails(wallet)}
                        className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                      >
                        详情
                      </button>
                      <button
                        onClick={() => handleExportWallet(wallet)}
                        className="text-purple-600 hover:text-purple-700 text-sm font-medium"
                      >
                        导出
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Security Tips */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mt-6">
        <h3 className="text-lg font-medium text-yellow-800 mb-4 flex items-center gap-2">
          <span className="text-xl">🔐</span>
          安全提示
        </h3>
        <div className="space-y-3 text-sm text-yellow-700">
          <div className="flex items-start gap-3">
            <span className="text-yellow-600 mt-0.5 text-lg">1️⃣</span>
            <div>
              <strong>使用独立钱包：</strong>每个活动使用独立钱包，防止地址关联分析。
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-yellow-600 mt-0.5 text-lg">2️⃣</span>
            <div>
              <strong>加密存储：</strong>私钥已加密存储在本地，请妥善保管主密钥。
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-yellow-600 mt-0.5 text-lg">3️⃣</span>
            <div>
              <strong>定期备份：</strong>定期备份数据库文件，防止数据丢失。
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-yellow-600 mt-0.5 text-lg">4️⃣</span>
            <div>
              <strong>安全环境：</strong>不要在公共电脑上使用本应用。
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-yellow-600 mt-0.5 text-lg">5️⃣</span>
            <div>
              <strong>及时回收：</strong>活动结束后建议及时回收剩余资金。
            </div>
          </div>
        </div>
      </div>

      {/* Wallet Detail Modal */}
      <WalletDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedWallet(null);
        }}
        wallet={selectedWallet}
      />
    </div>
  );
}