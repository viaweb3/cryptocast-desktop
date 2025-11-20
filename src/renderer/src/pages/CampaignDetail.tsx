import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

interface Campaign {
  id: string;
  name: string;
  chain: string;
  chainId: number;
  tokenAddress: string;
  tokenSymbol: string;
  status: 'CREATED' | 'READY' | 'SENDING' | 'PAUSED' | 'COMPLETED' | 'FAILED';
  totalRecipients: number;
  completedRecipients: number;
  failedRecipients: number;
  walletAddress?: string;
  contractAddress?: string;
  createdAt: string;
  updatedAt: string;
  walletPrivateKeyBase64?: string;
}

interface TransactionRecord {
  id: string;
  batchNumber: number;
  status: 'success' | 'sending' | 'pending' | 'failed';
  addressCount: number;
  txHash?: string;
  gasUsed?: string;
  error?: string;
  createdAt: string;
}

interface Recipient {
  address: string;
  amount: string;
  status: 'success' | 'sending' | 'pending' | 'failed';
  txHash?: string;
  error?: string;
}

export default function CampaignDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPaused, setIsPaused] = useState(false);

  const [walletBalances, setWalletBalances] = useState({
    token: { current: '450.5', total: '500' },
    gas: { current: '0.12', total: '0.15' }
  });

  useEffect(() => {
    if (id) {
      loadCampaign();
    }
  }, [id]);

  const loadCampaign = async () => {
    setLoading(true);
    try {
      // Mock data for demonstration
      const mockCampaign: Campaign = {
        id: id || 'a1b2cd3d-e5f6-4266-14174000',
        name: '2025-01 营销活动',
        chain: 'polygon',
        chainId: 137,
        tokenAddress: '0x7ceB23fd6bC0adD59E62ac25578270cFf1b9f619',
        tokenSymbol: 'WETH',
        status: 'SENDING',
        totalRecipients: 1000,
        completedRecipients: 750,
        failedRecipients: 0,
        walletAddress: '0x1234567890123456789012345678901234567890',
        contractAddress: '0xaB1234567890abcdef1234567890abcdef1234',
        createdAt: '2025-11-19T14:30:00Z',
        updatedAt: '2025-11-19T14:35:00Z'
      };

      const mockTransactions: TransactionRecord[] = [
        { id: '1', batchNumber: 1, status: 'success', addressCount: 100, txHash: '0xabc123...', gasUsed: '21000', createdAt: new Date(Date.now() - 3600000).toISOString() },
        { id: '2', batchNumber: 2, status: 'success', addressCount: 100, txHash: '0xdef456...', gasUsed: '21000', createdAt: new Date(Date.now() - 3000000).toISOString() },
        { id: '3', batchNumber: 3, status: 'success', addressCount: 100, txHash: '0xghi789...', gasUsed: '21000', createdAt: new Date(Date.now() - 2400000).toISOString() },
        { id: '4', batchNumber: 4, status: 'success', addressCount: 100, txHash: '0xjkl012...', gasUsed: '21000', createdAt: new Date(Date.now() - 1800000).toISOString() },
        { id: '5', batchNumber: 5, status: 'success', addressCount: 100, txHash: '0xmno345...', gasUsed: '21000', createdAt: new Date(Date.now() - 1200000).toISOString() },
        { id: '6', batchNumber: 6, status: 'success', addressCount: 100, txHash: '0xpqr678...', gasUsed: '21000', createdAt: new Date(Date.now() - 600000).toISOString() },
        { id: '7', batchNumber: 7, status: 'success', addressCount: 100, txHash: '0xstu901...', gasUsed: '21000', createdAt: new Date(Date.now() - 300000).toISOString() },
        { id: '8', batchNumber: 8, status: 'sending', addressCount: 50, createdAt: new Date().toISOString() },
      ];

      const mockRecipients: Recipient[] = [
        { address: '0x1111111111111111111111111111111111111111', amount: '100 WETH', status: 'success', txHash: '0xabc123...' },
        { address: '0x2222222222222222222222222222222222222222', amount: '200 WETH', status: 'success', txHash: '0xdef456...' },
        { address: '0x3333333333333333333333333333333333333333', amount: '150 WETH', status: 'pending' },
        { address: '0x4444444444444444444444444444444444444444', amount: '50 WETH', status: 'sending' },
        { address: '0x5555555555555555555555555555555555555555', amount: '75 WETH', status: 'success', txHash: '0xghi789...' },
      ];

      setCampaign(mockCampaign);
      setTransactions(mockTransactions);
      setRecipients(mockRecipients);
    } catch (error) {
      console.error('Failed to load campaign:', error);
      alert('加载活动详情失败');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <div className="badge badge-success gap-1">✅ 成功</div>;
      case 'SENDING':
        return <div className="badge badge-info gap-1">🔄 发送中</div>;
      case 'PAUSED':
        return <div className="badge badge-warning gap-1">⏸️ 暂停</div>;
      case 'FAILED':
        return <div className="badge badge-error gap-1">❌ 失败</div>;
      default:
        return <div className="badge badge-neutral gap-1">📋 创建</div>;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'bg-green-100 text-green-800';
      case 'SENDING': return 'bg-blue-100 text-blue-800';
      case 'PAUSED': return 'bg-orange-100 text-orange-800';
      case 'FAILED': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handlePauseResume = () => {
    setIsPaused(!isPaused);
    // Implementation would go here
  };

  const handleExportPrivateKey = async () => {
    if (!campaign?.walletPrivateKeyBase64) {
      alert('该活动没有可导出的私钥');
      return;
    }

    try {
      if (window.electronAPI?.wallet) {
        const privateKey = await window.electronAPI.wallet.exportPrivateKey(campaign.walletPrivateKeyBase64);
        alert(`钱包地址: ${campaign.walletAddress}\n私钥: ${privateKey}\n\n请妥善保管此私钥！`);
      }
    } catch (error) {
      console.error('Failed to export private key:', error);
      alert('获取私钥失败，请重试');
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 8)}...${address.slice(-6)}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-CN');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="alert alert-error max-w-md">
          <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>活动未找到</span>
        </div>
      </div>
    );
  }

  const progressPercentage = Math.round((campaign.completedRecipients / campaign.totalRecipients) * 100);
  const remainingRecipients = campaign.totalRecipients - campaign.completedRecipients - campaign.failedRecipients;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-3">
          <div className="avatar placeholder">
            <div className="bg-neutral text-neutral-content rounded-full w-12 h-12">
              <span className="text-lg">📋</span>
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold">{campaign.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              {getStatusBadge(campaign.status)}
              <div className="text-sm text-base-content/60">
                创建于 {formatDate(campaign.createdAt)}
              </div>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handlePauseResume}
            className={`btn ${isPaused ? 'btn-success' : 'btn-warning'}`}
          >
            {isPaused ? '▶️ 继续' : '⏸️ 暂停'}
          </button>
          <button
            onClick={() => navigate('/')}
            className="btn btn-ghost"
          >
            ← 返回活动列表
          </button>
        </div>
      </div>

      {/* Progress Section */}
      <div className="card bg-base-100 shadow-sm mb-8">
        <div className="card-body">
          <div className="flex items-center justify-between mb-4">
            <h2 className="card-title">发送进度</h2>
            <div className="text-2xl font-bold text-primary">{progressPercentage}%</div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>已完成 {campaign.completedRecipients} / {campaign.totalRecipients} 个地址</span>
              <span className="text-success">成功 {campaign.completedRecipients}</span>
              <span className="text-error">失败 {campaign.failedRecipients}</span>
              <span className="text-warning">待发送 {remainingRecipients}</span>
            </div>
            <progress
              className="progress progress-success w-full"
              value={progressPercentage}
              max="100"
            ></progress>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="stat bg-base-100 rounded-lg shadow-sm">
          <div className="stat-figure text-primary">
            📋
          </div>
          <div className="stat-title">总地址数</div>
          <div className="stat-value text-primary">{campaign.totalRecipients}</div>
          <div className="stat-desc text-info">100% 目标</div>
        </div>

        <div className="stat bg-base-100 rounded-lg shadow-sm">
          <div className="stat-figure text-success">
            ✅
          </div>
          <div className="stat-title">成功发送</div>
          <div className="stat-value text-success">{campaign.completedRecipients}</div>
          <div className="stat-desc text-success">↑ {progressPercentage}%</div>
        </div>

        <div className="stat bg-base-100 rounded-lg shadow-sm">
          <div className="stat-figure text-error">
            ❌
          </div>
          <div className="stat-title">失败数量</div>
          <div className="stat-value text-error">{campaign.failedRecipients}</div>
          <div className="stat-desc text-error">{Math.round((campaign.failedRecipients / campaign.totalRecipients) * 100)}%</div>
        </div>

        <div className="stat bg-base-100 rounded-lg shadow-sm">
          <div className="stat-figure text-warning">
            ⏳
          </div>
          <div className="stat-title">待发送</div>
          <div className="stat-value text-warning">{remainingRecipients}</div>
          <div className="stat-desc text-warning">{100 - progressPercentage}%</div>
        </div>
      </div>

      {/* Campaign Info & Wallet */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Campaign Info */}
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body">
            <h2 className="card-title flex items-center gap-2">
              <span>ℹ️</span>
              活动信息
            </h2>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">活动状态</span>
                {getStatusBadge(campaign.status)}
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">活动ID</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono bg-base-200 px-2 py-1 rounded">{campaign.id.slice(0, 8)}...</span>
                  <button className="btn btn-ghost btn-xs">📋</button>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">创建时间</span>
                <span className="text-sm">{formatDate(campaign.createdAt)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">区块链网络</span>
                <div className="badge badge-info">{campaign.chain.toUpperCase()}</div>
              </div>
              <div className="flex justify-between items-start">
                <span className="text-sm font-medium">代币合约</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono bg-base-200 px-2 py-1 rounded max-w-[120px] truncate">
                    {formatAddress(campaign.tokenAddress)}
                  </span>
                  <div className="dropdown dropdown-left">
                    <button tabIndex={0} className="btn btn-ghost btn-xs">⋮</button>
                    <ul tabIndex={0} className="dropdown-content menu p-2 shadow bg-base-100 rounded-box w-32 z-[1]">
                      <li><a>复制地址</a></li>
                      <li><a>在区块浏览器查看</a></li>
                    </ul>
                  </div>
                </div>
              </div>
              {campaign.contractAddress && (
                <div className="flex justify-between items-start">
                  <span className="text-sm font-medium">批量合约</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono bg-base-200 px-2 py-1 rounded max-w-[120px] truncate">
                      {formatAddress(campaign.contractAddress)}
                    </span>
                    <div className="dropdown dropdown-left">
                      <button tabIndex={0} className="btn btn-ghost btn-xs">⋮</button>
                      <ul tabIndex={0} className="dropdown-content menu p-2 shadow bg-base-100 rounded-box w-32 z-[1]">
                        <li><a>复制地址</a></li>
                        <li><a>在区块浏览器查看</a></li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Wallet */}
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body">
            <h2 className="card-title flex items-center gap-2">
              <span>💳</span>
              活动钱包
            </h2>
            <div className="space-y-4">
              <div>
                <div className="text-sm font-medium mb-2">钱包地址</div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono bg-base-200 px-2 py-1 rounded flex-1">
                    {campaign.walletAddress}
                  </span>
                  <button className="btn btn-ghost btn-xs">📋</button>
                </div>
              </div>

              <div>
                <div className="text-sm font-medium mb-3">当前余额</div>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-primary"></div>
                        {campaign.tokenSymbol}
                      </span>
                      <span className="text-sm font-bold">
                        {walletBalances.token.current} / {walletBalances.token.total}
                      </span>
                    </div>
                    <progress
                      className="progress progress-primary w-full h-2"
                      value={(parseFloat(walletBalances.token.current) / parseFloat(walletBalances.token.total)) * 100}
                      max="100"
                    ></progress>
                    <div className="text-xs text-base-content/60 mt-1">
                      {((parseFloat(walletBalances.token.current) / parseFloat(walletBalances.token.total)) * 100).toFixed(1)}% 已使用
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-warning"></div>
                        MATIC (Gas)
                      </span>
                      <span className="text-sm font-bold">
                        {walletBalances.gas.current} / {walletBalances.gas.total}
                      </span>
                    </div>
                    <progress
                      className="progress progress-warning w-full h-2"
                      value={(parseFloat(walletBalances.gas.current) / parseFloat(walletBalances.gas.total)) * 100}
                      max="100"
                    ></progress>
                    <div className="text-xs text-base-content/60 mt-1">
                      {((parseFloat(walletBalances.gas.current) / parseFloat(walletBalances.gas.total)) * 100).toFixed(1)}% 已使用
                    </div>
                  </div>
                </div>
              </div>

              <div className="divider"></div>
              <div>
                <div className="text-sm text-base-content/60 mb-2">安全提示</div>
                <div className="alert alert-warning">
                  <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <div>
                    <div className="text-sm font-medium">活动结束后可导出私钥回收剩余资金</div>
                    <div className="text-xs">请妥善保管私钥，丢失将无法找回</div>
                  </div>
                </div>
                <button
                  onClick={handleExportPrivateKey}
                  className="btn btn-primary btn-sm w-full mt-3"
                >
                  🔑 导出私钥
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Transaction Records */}
      <div className="card bg-base-100 shadow-sm mb-8">
        <div className="card-body">
          <div className="flex justify-between items-center mb-6">
            <h2 className="card-title flex items-center gap-2">
              <span>📊</span>
              交易记录
            </h2>
            <div className="flex gap-2">
              <button className="btn btn-ghost btn-sm">📥 导出</button>
              <button className="btn btn-ghost btn-sm">🔄 刷新</button>
              <button className="btn btn-ghost btn-sm">❌ 仅失败</button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="table table-zebra">
              <thead>
                <tr>
                  <th>批次</th>
                  <th>状态</th>
                  <th>地址数</th>
                  <th>交易哈希</th>
                  <th>Gas消耗</th>
                  <th className="text-center">操作</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id} className="hover">
                    <td>
                      <div className="font-bold">#{tx.batchNumber}</div>
                      <div className="text-xs text-base-content/60">{formatDate(tx.createdAt)}</div>
                    </td>
                    <td>
                      {tx.status === 'success' && <div className="badge badge-success gap-1">✅ 成功</div>}
                      {tx.status === 'sending' && <div className="badge badge-info gap-1">🔄 发送中</div>}
                      {tx.status === 'pending' && <div className="badge badge-warning gap-1">⏳ 待发送</div>}
                      {tx.status === 'failed' && <div className="badge badge-error gap-1">❌ 失败</div>}
                    </td>
                    <td>
                      <div className="font-medium">{tx.addressCount}</div>
                    </td>
                    <td>
                      {tx.txHash ? (
                        <a
                          href={`https://polygonscan.com/tx/${tx.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="link link-primary link-hover text-sm font-mono"
                        >
                          {formatAddress(tx.txHash)}
                        </a>
                      ) : (
                        <span className="text-base-content/40">-</span>
                      )}
                    </td>
                    <td>
                      {tx.gasUsed ? (
                        <span className="text-sm">{tx.gasUsed}</span>
                      ) : (
                        <span className="text-base-content/40">-</span>
                      )}
                    </td>
                    <td className="text-center">
                      <div className="dropdown dropdown-end">
                        <button tabIndex={0} className="btn btn-ghost btn-xs">⋮</button>
                        <ul tabIndex={0} className="dropdown-content menu p-2 shadow bg-base-100 rounded-box w-32 z-[1]">
                          <li><a>查看详情</a></li>
                          <li><a>重新发送</a></li>
                          {tx.status === 'failed' && <li><a>查看错误</a></li>}
                        </ul>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between items-center mt-6">
            <div className="text-sm text-base-content/60">
              显示 1 到 {transactions.length} 条，共 10 条记录
            </div>
            <div className="join">
              <button className="join-item btn btn-sm">1</button>
              <button className="join-item btn btn-sm">2</button>
              <button className="join-item btn btn-sm btn-disabled">...</button>
              <button className="join-item btn btn-sm">»</button>
            </div>
          </div>
        </div>
      </div>

      {/* Recipients */}
      <div className="card bg-base-100 shadow-sm">
        <div className="card-body">
          <div className="flex justify-between items-center mb-6">
            <h2 className="card-title flex items-center gap-2">
              <span>👥</span>
              接收地址列表
            </h2>
            <div className="flex gap-2">
              <button className="btn btn-primary btn-sm">📥 导出CSV</button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="table table-zebra">
              <thead>
                <tr>
                  <th>地址</th>
                  <th>金额</th>
                  <th>状态</th>
                  <th>交易哈希</th>
                  <th className="text-center">操作</th>
                </tr>
              </thead>
              <tbody>
                {recipients.map((recipient, index) => (
                  <tr key={index} className="hover">
                    <td>
                      <div className="font-mono text-sm bg-base-200 px-2 py-1 rounded max-w-[200px] truncate">
                        {recipient.address}
                      </div>
                    </td>
                    <td>
                      <div className="font-medium">{recipient.amount}</div>
                    </td>
                    <td>
                      {recipient.status === 'success' && <div className="badge badge-success gap-1">✅</div>}
                      {recipient.status === 'sending' && <div className="badge badge-info gap-1">🔄</div>}
                      {recipient.status === 'pending' && <div className="badge badge-warning gap-1">⏳</div>}
                      {recipient.status === 'failed' && <div className="badge badge-error gap-1">❌</div>}
                    </td>
                    <td>
                      {recipient.txHash ? (
                        <a
                          href={`https://polygonscan.com/tx/${recipient.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="link link-primary link-hover text-sm font-mono"
                        >
                          {formatAddress(recipient.txHash)}
                        </a>
                      ) : (
                        <span className="text-base-content/40">-</span>
                      )}
                    </td>
                    <td className="text-center">
                      <div className="dropdown dropdown-end">
                        <button tabIndex={0} className="btn btn-ghost btn-xs">⋮</button>
                        <ul tabIndex={0} className="dropdown-content menu p-2 shadow bg-base-100 rounded-box w-32 z-[1]">
                          <li><a>查看详情</a></li>
                          <li><a>重新发送</a></li>
                          {recipient.status === 'failed' && <li><a>查看错误</a></li>}
                        </ul>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between items-center mt-6">
            <div className="text-sm text-base-content/60">
              显示 1 到 {recipients.length} 条，共 1000 条记录
            </div>
            <div className="join">
              <button className="join-item btn btn-sm">1</button>
              <button className="join-item btn btn-sm">2</button>
              <button className="join-item btn btn-sm btn-disabled">...</button>
              <button className="join-item btn btn-sm">200</button>
              <button className="join-item btn btn-sm">»</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}