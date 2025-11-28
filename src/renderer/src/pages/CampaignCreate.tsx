import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCampaign } from '../contexts/CampaignContext';
import { Campaign, CSVValidationResult, TokenInfo } from '../types';
import { parseCSV } from '../utils/csvValidator';
import BigNumber from 'bignumber.js';
import { DEFAULTS } from '../config/defaults';
import { isSolanaChain, validateAddressForChain, NATIVE_TOKEN_ADDRESSES } from '../utils/chainTypeUtils';

interface CampaignFormData {
  name: string;
  description: string;
  chain: string;
  tokenAddress: string;
  batchSize: number;
  sendInterval: string;
}

interface ChainOption {
  id: string;
  name: string;
  symbol: string;
  type: 'evm' | 'solana';
  network?: string;
}

export default function CampaignCreate() {
  const navigate = useNavigate();
  const { state, actions } = useCampaign();
  const [formData, setFormData] = useState<CampaignFormData>({
    name: '',
    description: '',
    chain: DEFAULTS.CAMPAIGN_FORM.chain,
    tokenAddress: '',
    batchSize: DEFAULTS.CAMPAIGN_FORM.batchSize.evm,
    sendInterval: DEFAULTS.CAMPAIGN_FORM.sendInterval.evm
  });
  const [csvContent, setCsvContent] = useState<string>('');
  const [csvValidation, setCsvValidation] = useState<CSVValidationResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [csvData, setCsvData] = useState<any[]>([]);

    const [tokenAddressError, setTokenAddressError] = useState<string>('');
  const [estimation, setEstimation] = useState<any>(null);
  const [isEstimating, setIsEstimating] = useState(false);
  const [availableChains, setAvailableChains] = useState<ChainOption[]>([]);
  const [chainsLoading, setChainsLoading] = useState(true);
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [isFetchingToken, setIsFetchingToken] = useState(false);
  const [tokenInfoError, setTokenInfoError] = useState<string>('');

  useEffect(() => {
    loadChains();
  }, []);

  // 获取代币信息的函数
  const fetchTokenInfo = async (tokenAddress: string, chainId?: string) => {
    const targetChainId = chainId || formData.chain;
    if (!targetChainId) {
      return; // 需要先选择链
    }

    setIsFetchingToken(true);
    setTokenInfoError('');

    try {
      if (window.electronAPI?.token) {
        const tokenData = await window.electronAPI.token.getInfo(tokenAddress, targetChainId);

        if (tokenData) {
          setTokenInfo(tokenData);
        } else {
          setTokenInfoError('无法获取代币信息，请检查合约地址是否正确');
          setTokenInfo(null);
        }
      } else {
        setTokenInfoError('Token API不可用');
        setTokenInfo(null);
      }
    } catch (error) {
      console.error('获取代币信息失败:', error);
      setTokenInfoError(`获取代币信息失败: ${error instanceof Error ? error.message : '未知错误'}`);
      setTokenInfo(null);
    } finally {
      setIsFetchingToken(false);
    }
  };

  const loadChains = async () => {
    try {
      setChainsLoading(true);
      const chains: ChainOption[] = [];

      // Load EVM chains
      if (window.electronAPI?.chain) {
        const evmChains = await window.electronAPI.chain.getEVMChains();
        evmChains.forEach((chain: any) => {
          chains.push({
            id: chain.chainId.toString(),
            name: chain.name,
            symbol: chain.symbol,
            type: 'evm'
          });
        });

        // Load Solana networks
        try {
          const solanaRPCs = await window.electronAPI.chain.getSolanaRPCs();

          // Add Solana networks to chains
          solanaRPCs.forEach((rpc: any) => {
                        chains.push({
              id: rpc.chainId.toString(),
              name: rpc.name,
              symbol: rpc.symbol,
              type: rpc.type
            });
          });
        } catch (error) {
                    // Fallback: add default Solana networks using database chain IDs
          chains.push({
            id: '501',
            name: 'Solana Mainnet',
            symbol: 'SOL',
            type: 'solana',
            network: 'mainnet-beta'
          });
          chains.push({
            id: '502',
            name: 'Solana Devnet',
            symbol: 'SOL',
            type: 'solana',
            network: 'devnet'
          });
        }

        }

      // 按类型和名称排序：EVM链在前，然后是Solana，同类按名称排序
      chains.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'evm' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });

      setAvailableChains(chains);
    } catch (error) {
      console.error('Failed to load chains:', error);
      // 如果加载失败，使用默认链列表作为备选
      setAvailableChains([
        { id: '1', name: 'Ethereum', symbol: 'ETH', type: 'evm' },
        { id: '137', name: 'Polygon', symbol: 'POL', type: 'evm' },
        { id: '42161', name: 'Arbitrum One', symbol: 'ETH', type: 'evm' },
        { id: '10', name: 'Optimism', symbol: 'ETH', type: 'evm' },
        { id: '8453', name: 'Base', symbol: 'ETH', type: 'evm' },
        { id: '56', name: 'BSC', symbol: 'BNB', type: 'evm' },
        { id: '43114', name: 'Avalanche C-Chain', symbol: 'AVAX', type: 'evm' },
        { id: '501', name: 'Solana Mainnet', symbol: 'SOL', type: 'solana', network: 'mainnet-beta' },
      ]);
    } finally {
      setChainsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;

    // 如果链发生变化，调整批量参数
    if (name === 'chain') {
      const selectedChain = availableChains.find(c => c.id === value);
      const isSolana = selectedChain?.type === 'solana';

      setFormData(prev => ({
        ...prev,
        chain: value,
        // 根据链类型自动调整批量参数
        batchSize: isSolana ? DEFAULTS.CAMPAIGN_FORM.batchSize.solana : DEFAULTS.CAMPAIGN_FORM.batchSize.evm,
        sendInterval: isSolana ? DEFAULTS.CAMPAIGN_FORM.sendInterval.solana : DEFAULTS.CAMPAIGN_FORM.sendInterval.evm
      }));

      // 重新获取代币信息
      if (formData.tokenAddress && !tokenAddressError) {
        setTokenInfo(null);
        setTokenInfoError('');
        if (value) {
          // 传递新的 chainId，避免使用旧的 formData.chain
          setTimeout(() => fetchTokenInfo(formData.tokenAddress, value), 100);
        }
      }
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: type === 'number' ? (value === '' ? '' : Number(value)) : value
      }));
    }

    // 实时校验代币合约地址
    if (name === 'tokenAddress') {
      if (value.trim()) {
        // 使用统一的地址验证函数
        const selectedChain = availableChains.find(c => c.id === formData.chain);
        const isValidAddress = validateAddressForChain(value, (selectedChain || {}) as any);

        if (!isValidAddress) {
          setTokenAddressError('请输入有效的代币合约地址');
          setTokenInfo(null);
          setTokenInfoError('');
        } else {
          setTokenAddressError('');
          // 地址格式正确，获取代币信息
          fetchTokenInfo(value);
        }
      } else {
        setTokenAddressError('');
        setTokenInfo(null);
        setTokenInfoError('');
      }
    }
  };

  const handleCSVContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const content = e.target.value;
    setCsvContent(content);

    if (content.trim()) {
      try {
        // Use unified CSV validator (no headers expected for textarea input)
        const validation = parseCSV(content, { hasHeaders: false });

        setCsvData(validation.data);  // 使用所有数据而不是 sampleData
        setCsvValidation(validation);
      } catch (error) {
        console.error('Failed to parse CSV:', error);
        setCsvValidation({
          isValid: false,
          totalRecords: 0,
          validRecords: 0,
          invalidRecords: 0,
          errors: [{ row: 0, field: 'address', value: '', error: 'CSV内容解析失败' }],
          sampleData: []
        });
      }
    } else {
      setCsvValidation(null);
      setCsvData([]);
    }
  };

  const validateForm = () => {
    if (!formData.name.trim()) {
      alert('请输入活动名称');
      return false;
    }
    if (!formData.chain) {
      alert('请选择区块链网络');
      return false;
    }
    if (!formData.tokenAddress.trim()) {
      alert('请输入代币合约地址');
      return false;
    }
    if (tokenAddressError) {
      alert(tokenAddressError);
      return false;
    }
    if (!csvContent.trim()) {
      alert('请输入CSV内容');
      return false;
    }
    if (!csvValidation?.isValid) {
      alert('CSV内容格式不正确');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      const campaignData = {
        name: formData.name,
        description: formData.description,
        chain: formData.chain,
        tokenAddress: formData.tokenAddress,
        tokenSymbol: tokenInfo?.symbol,
        tokenName: tokenInfo?.name,
        tokenDecimals: tokenInfo?.decimals,
        batchSize: formData.batchSize,
        sendInterval: Number(formData.sendInterval),
        recipients: csvData  // 使用解析后的数据数组
      };

      if (window.electronAPI?.campaign) {
        const newCampaign = await window.electronAPI.campaign.create(campaignData);
        alert('活动创建成功！');
        navigate(`/campaign/${newCampaign.id}`);
      }
    } catch (error) {
      console.error('Failed to create campaign:', error);
      alert(`创建失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEstimate = async () => {
    if (!formData.chain || !formData.tokenAddress || !csvValidation?.isValid) {
      alert('请先填写完整的表单信息并确保CSV数据有效');
      return;
    }

    setIsEstimating(true);
    try {
      const estimateRequest = {
        chain: formData.chain,
        tokenAddress: formData.tokenAddress,
        recipientCount: csvValidation.validRecords,
        batchSize: formData.batchSize,
      };

      if (window.electronAPI?.campaign) {
        const result = await window.electronAPI.campaign.estimate(estimateRequest);
        setEstimation(result);
      }
    } catch (error) {
      console.error('Failed to estimate campaign:', error);
      alert(`估算失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsEstimating(false);
    }
  };

  const getChainInfo = (chainId: string) => {
    return availableChains.find(c => c.id === chainId) || { name: 'Unknown', symbol: '', type: 'evm' };
  };

  const getSelectedChainType = () => {
    const selectedChain = availableChains.find(c => c.id === formData.chain);
    return selectedChain?.type || 'evm';
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-3">
          <span className="text-3xl">📋</span>
          <h1 className="text-2xl font-bold">创建新活动</h1>
        </div>
        <button
          onClick={() => navigate('/')}
          className="btn btn-ghost btn-sm"
        >
          ← 返回仪表盘
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Basic Information */}
        <div className="collapse collapse-arrow bg-base-100 shadow-sm">
          <input type="checkbox" defaultChecked className="min-w-fit" />
          <div className="collapse-title text-lg font-semibold flex items-center gap-3">
            <span className="text-xl">📋</span>
            基本信息
          </div>
          <div className="collapse-content">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
              <div>
                <div className="mb-2">
                  <span className="text-sm font-medium">活动名称 *</span>
                </div>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="例如：2025年营销活动"
                  className="input input-bordered w-full"
                  style={{ border: '1px solid #d1d5db', backgroundColor: '#ffffff' }}
                  required
                />
              </div>

              <div>
                <div className="mb-2">
                  <span className="text-sm font-medium">区块链网络 *</span>
                </div>
                <select
                  name="chain"
                  value={formData.chain}
                  onChange={handleInputChange}
                  className="select select-bordered w-full"
                  style={{ border: '1px solid #d1d5db', backgroundColor: '#ffffff' }}
                  required
                  disabled={chainsLoading}
                >
                  {chainsLoading ? (
                    <option value="">加载链配置中...</option>
                  ) : (
                    <>
                      <option value="">请选择区块链网络</option>
                      {availableChains.map(chain => (
                        <option key={chain.id} value={chain.id}>
                          {chain.name} ({chain.symbol})
                          {chain.type === 'solana' && ' 🔥'}
                        </option>
                      ))}
                    </>
                  )}
                </select>
                {getSelectedChainType() === 'solana' && (
                  <div className="mt-2">
                    <span className="text-xs text-info">
                      <strong>Solana网络提示：</strong>请确保使用Solana格式的地址和代币合约地址
                    </span>
                  </div>
                )}
              </div>

              <div className="md:col-span-2">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium">代币合约地址 *</span>
                  {!isSolanaChain(formData.chain) && (
                    <button
                      type="button"
                      onClick={() => {
                        const selectedChain = availableChains.find(c => c.id === formData.chain);
                        const nativeAddress = NATIVE_TOKEN_ADDRESSES.EVM;
                        setFormData({ ...formData, tokenAddress: nativeAddress });
                        setTokenAddressError('');
                        setTokenInfo({
                          name: selectedChain?.name || 'Native Token',
                          symbol: selectedChain?.symbol || 'ETH',
                          decimals: 18,
                          address: nativeAddress,
                          chainType: 'evm'
                        });
                      }}
                      className="btn btn-xs btn-outline gap-1"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      使用原生代币
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  name="tokenAddress"
                  value={formData.tokenAddress}
                  onChange={handleInputChange}
                  placeholder="EVM: 0xA0b86a33E6447b4C4A0b2F9D6d2eEa6d1b7d94a2 或 Solana: 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"
                  className={`input input-bordered w-full font-mono ${tokenAddressError ? 'input-error' : ''}`}
                  style={{ border: '1px solid #d1d5db', backgroundColor: '#ffffff' }}
                  required
                />
                {tokenAddressError && (
                  <div className="mt-1">
                    <span className="text-xs text-error">{tokenAddressError}</span>
                  </div>
                )}

                {/* 代币信息显示 */}
                {isFetchingToken && (
                  <div className="mt-2">
                    <div className="flex items-center gap-2">
                      <span className="loading loading-spinner loading-xs"></span>
                      <span className="text-xs text-info">正在获取代币信息...</span>
                    </div>
                  </div>
                )}

                {tokenInfo && !isFetchingToken && (
                  <div className="mt-2">
                    <div className="bg-base-200 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                            <span className="text-xs text-primary-content font-bold">
                              {tokenInfo.symbol?.substring(0, 2).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <div className="text-sm font-semibold">{tokenInfo.name}</div>
                            <div className="text-xs opacity-70">{tokenInfo.symbol}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs opacity-70">精度</div>
                          <div className="text-sm font-mono">{tokenInfo.decimals}</div>
                        </div>
                      </div>
                      <div className="mt-2 text-xs opacity-60">
                        <div className="flex items-center gap-1">
                          <span>链类型: {tokenInfo.chainType === 'evm' ? 'EVM' : 'Solana'}</span>
                          <span>•</span>
                          <span className="font-mono">{tokenInfo.address.substring(0, 8)}...{tokenInfo.address.substring(tokenInfo.address.length - 6)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {tokenInfoError && !isFetchingToken && (
                  <div className="mt-2">
                    <div className="alert alert-warning">
                      <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                      <span className="text-xs">{tokenInfoError}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="md:col-span-2">
                <div className="mb-2">
                  <span className="text-sm font-medium">活动描述</span>
                </div>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  className="textarea textarea-bordered h-24 w-full"
                  style={{ border: '1px solid #d1d5db', backgroundColor: '#ffffff' }}
                  placeholder="描述此活动的目的和详情..."
                />
              </div>
            </div>
          </div>
        </div>

        {/* Batch Settings */}
        <div className="collapse collapse-arrow bg-base-100 shadow-sm">
          <input type="checkbox" defaultChecked className="min-w-fit" />
          <div className="collapse-title text-lg font-semibold flex items-center gap-3">
            <span className="text-xl">⚙️</span>
            批量设置
          </div>
          <div className="collapse-content">
            <div className="space-y-6 mt-4">
              <div>
                <div className="mb-3">
                  <span className="text-sm font-medium">每批处理地址数量</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(() => {
                    // 根据链类型调整推荐设置
                    const selectedChain = availableChains.find(c => c.id === formData.chain);
                    const isSolana = selectedChain?.type === 'solana';
                    if (isSolana) {
                      // Solana网络 - 简化配置
      // 统一批量大小：ATA创建和转账使用相同的批量设置
                      return [5, 10].map(size => (
                        <button
                          key={size}
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, batchSize: size }))}
                          className={`btn ${formData.batchSize === size ? 'btn-primary' : 'btn-outline'}`}
                        >
                          {size}
                        </button>
                      ));
                    } else {
                      // EVM网络 - 智能合约可以支持更大的批量
                      return [50, 100, 200, 500].map(size => (
                        <button
                          key={size}
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, batchSize: size }))}
                          className={`btn ${formData.batchSize === size ? 'btn-primary' : 'btn-outline'}`}
                        >
                          {size}
                        </button>
                      ));
                    }
                  })()}
                </div>
              </div>

              <div>
                <div className="mb-3">
                  <span className="text-sm font-medium">批次发送间隔</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(() => {
                    // 根据链类型调整推荐设置
                    const selectedChain = availableChains.find(c => c.id === formData.chain);
                    const isSolana = selectedChain?.type === 'solana';
                    if (isSolana) {
                      // Solana网络 - 考虑到批量变小，总体需要更快频率来补偿
                      return [
                        { value: '3000', label: '3秒' },
                        { value: '5000', label: '5秒' },
                        { value: '8000', label: '8秒' },
                        { value: '10000', label: '10秒' },
                        { value: '15000', label: '15秒' }
                      ].map(interval => (
                        <button
                          key={interval.value}
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, sendInterval: interval.value }))}
                          className={`btn ${formData.sendInterval === interval.value ? 'btn-primary' : 'btn-outline'}`}
                        >
                          {interval.label}
                        </button>
                      ));
                    } else {
                      // EVM网络 - 保持原有设置
                      return [
                        { value: '15000', label: '15秒' },
                        { value: '20000', label: '20秒' },
                        { value: '30000', label: '30秒' },
                        { value: '45000', label: '45秒' },
                        { value: '60000', label: '60秒' }
                      ].map(interval => (
                        <button
                          key={interval.value}
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, sendInterval: interval.value }))}
                          className={`btn ${formData.sendInterval === interval.value ? 'btn-primary' : 'btn-outline'}`}
                        >
                          {interval.label}
                        </button>
                      ));
                    }
                  })()}
                </div>
                {/* Solana优化提示 */}
                {availableChains.find(c => c.id === formData.chain)?.type === 'solana' && (
                  <div className="mt-2">
                    <span className="text-xs text-warning">
                      <strong>⚡ Solana限制：</strong>每批支持5-10个地址（ATA创建和转账使用相同配置）
                    </span>
                  </div>
                )}
            </div>
          </div>
        </div>

        {/* CSV Input */}
        <div className="collapse collapse-arrow bg-base-100 shadow-sm">
          <input type="checkbox" defaultChecked className="min-w-fit" />
          <div className="collapse-title text-lg font-semibold flex items-center gap-3">
            <span className="text-xl">📁</span>
            输入地址列表
          </div>
          <div className="collapse-content">
            <div className="space-y-6">
              <div>
                <div className="mb-2">
                  <span className="text-sm font-medium">CSV 内容 *</span>
                </div>
                <textarea
                  value={csvContent}
                  onChange={handleCSVContentChange}
                  className="textarea textarea-bordered font-mono text-sm h-96 resize-none w-full"
                  style={{ border: '1px solid #d1d5db', backgroundColor: '#ffffff' }}
                  placeholder="请粘贴CSV内容，格式：地址,金额&#10;&#10;示例（EVM地址）：&#10;0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb,100.5&#10;0xdAC17F958D2ee523a2206206994597C13D831ec7,200&#10;&#10;示例（Solana地址）：&#10;7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU,50.25&#10;DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK,150"
                  required
                />
              </div>

              {csvValidation && (
                <div>
                  <div className="mb-2">
                    <span className="text-sm font-medium">数据预览</span>
                  </div>
                  {csvValidation && csvValidation.isValid ? (
                    <div className="bg-base-200 rounded-lg p-4 h-96 overflow-auto">
                      {/* 错误警告（如果有） */}
                      {csvValidation.errors.length > 0 && (
                        <div className="alert alert-warning mb-4">
                          <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                          </svg>
                          <div>
                            <div className="font-bold text-sm">{csvValidation.invalidRecords} 行数据有误</div>
                            <div className="text-xs">将只处理 {csvValidation.validRecords} 条有效记录</div>
                          </div>
                        </div>
                      )}

                      {/* 统计信息 */}
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        <div className="stat bg-base-200 rounded-lg p-4">
                          <div className="stat-title text-xs">有效地址数</div>
                          <div className="stat-value text-2xl">{csvValidation.validRecords}</div>
                        </div>

                        <div className="stat bg-base-200 rounded-lg p-4">
                          <div className="stat-title text-xs">总代币数</div>
                          <div className="stat-value text-2xl">
                            {csvData.reduce((sum, item) => {
                              return sum.plus(new BigNumber(item.amount || 0));
                            }, new BigNumber(0)).toString()}
                          </div>
                        </div>

                        <div className="stat bg-base-200 rounded-lg p-4">
                          <div className="stat-title text-xs">批次数量</div>
                          <div className="stat-value text-2xl">
                            {Math.ceil(csvValidation.validRecords / formData.batchSize)}
                          </div>
                        </div>

                        <div className="stat bg-base-200 rounded-lg p-4">
                          <div className="stat-title text-xs">预估总时长</div>
                          <div className="stat-value text-2xl">
                            {(() => {
                              const batches = Math.ceil(csvValidation.validRecords / formData.batchSize);
                              const totalSeconds = (batches * parseInt(formData.sendInterval)) / 1000;
                              const minutes = Math.floor(totalSeconds / 60);
                              const seconds = Math.floor(totalSeconds % 60);
                              return `${minutes}分${seconds}秒`;
                            })()}
                          </div>
                        </div>
                      </div>

                      {/* 状态提示 */}
                      <div className="alert alert-success mt-4">
                        <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-sm font-medium">
                          {csvValidation.errors.length === 0 ? '数据验证通过' : '部分数据有效'}
                        </span>
                      </div>

                      {/* 错误详情（如果有） */}
                      {csvValidation.errors.length > 0 && (
                        <div className="mt-4">
                          <div className="text-xs font-bold mb-2">错误详情：</div>
                          <div className="space-y-1 max-h-32 overflow-auto">
                            {csvValidation.errors.slice(0, 10).map((error, index) => (
                              <div key={index} className="text-xs bg-error/10 text-error p-2 rounded">
                                第{error.row}行 {error.field}: {error.error}
                              </div>
                            ))}
                            {csvValidation.errors.length > 10 && (
                              <div className="text-xs opacity-70 mt-1">
                                ... 还有 {csvValidation.errors.length - 10} 个错误
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-error/5 border border-error/20 rounded-lg p-4 h-96">
                      <div className="alert alert-error">
                        <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div>
                          <div className="font-bold text-sm">没有有效数据</div>
                          <div className="text-xs">请检查CSV格式是否正确</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Campaign Estimation */}
        {csvValidation?.isValid && (
          <div className="bg-base-100 shadow-sm rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="text-xl">💰</span>
                <h2 className="text-lg font-semibold">活动成本估算</h2>
              </div>
              <button
                type="button"
                onClick={handleEstimate}
                disabled={isEstimating || !formData.chain || !formData.tokenAddress}
                className="btn btn-sm btn-primary"
              >
                {isEstimating ? (
                  <>
                    <span className="loading loading-spinner loading-xs"></span>
                    估算中...
                  </>
                ) : (
                  '开始估算'
                )}
              </button>
            </div>

            {estimation ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="stat bg-base-200 rounded-lg p-4">
                    <div className="stat-title text-xs">总接收者</div>
                    <div className="stat-value text-2xl">{estimation.totalRecipients}</div>
                    <div className="stat-desc">{estimation.estimatedBatches} 批次</div>
                  </div>

                  <div className="stat bg-base-200 rounded-lg p-4">
                    <div className="stat-title text-xs">Gas 成本 ({estimation.tokenSymbol})</div>
                    <div className="stat-value text-2xl">{estimation.estimatedGasCost}</div>
                    <div className="stat-desc">本位币成本</div>
                  </div>

                  <div className="stat bg-base-200 rounded-lg p-4">
                    <div className="stat-title text-xs">GasPrice {estimation.isEIP1559 && '(EIP-1559)'}</div>
                    <div className="stat-value text-2xl">{estimation.gasPrice}</div>
                    <div className="stat-desc">
                      {estimation.isEIP1559 ? (
                        <div className="text-xs">
                          <div>Max: {estimation.maxFeePerGas} Gwei</div>
                          <div>Priority: {estimation.maxPriorityFeePerGas} Gwei</div>
                        </div>
                      ) : (
                        'Gwei (Legacy)'
                      )}
                    </div>
                  </div>

                  <div className="stat bg-base-200 rounded-lg p-4">
                    <div className="stat-title text-xs">预计耗时</div>
                    <div className="stat-value text-2xl">{estimation.estimatedDuration}</div>
                    <div className="stat-desc">分钟</div>
                  </div>
                </div>

                <div className="alert alert-info">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  <div className="text-sm">
                    <div className="font-bold">优化建议</div>
                    <div>✓ 最优批次大小: {estimation.recommendations.optimalBatchSize} 地址/批次</div>
                    <div>✓ 每批耗时: {estimation.recommendations.estimatedTimePerBatch} 秒</div>
                    <div>✓ 总预计时间: {estimation.recommendations.totalEstimatedTime} 分钟</div>
                    <div className="mt-2 text-xs opacity-70">
                      {estimation.isEIP1559
                        ? '💡 使用EIP-1559动态GasPrice定价，已包含10%的maxFee和50%的priority安全缓冲'
                        : '💡 使用传统GasPrice定价，已包含10%安全缓冲'
                      }
                    </div>
                  </div>
                </div>

                <div className="alert alert-warning">
                  <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <div className="text-sm">
                    <div className="font-bold">重要提醒</div>
                    <div>⚠️  GasPrice从RPC实时获取，但网络拥堵时可能会有波动</div>
                    <div>⚠️  估算已包含安全缓冲，确保交易能够快速确认</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-base-content/60">
                <p>点击"开始估算"按钮获取活动成本预估</p>
              </div>
            )}
          </div>
        )}
        </div>

        {/* Submit Buttons */}
        <div className="flex justify-end gap-4">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="btn btn-ghost"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn btn-primary"
          >
            {isSubmitting ? (
              <>
                <span className="loading loading-spinner loading-sm"></span>
                创建中...
              </>
            ) : (
              '创建活动'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}