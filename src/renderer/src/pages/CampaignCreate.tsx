import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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

  // Function to get token information
  const fetchTokenInfo = async (tokenAddress: string, chainId?: string) => {
    const targetChainId = chainId || formData.chain;
    if (!targetChainId) {
      return; // Need to select chain first
    }

    setIsFetchingToken(true);
    setTokenInfoError('');

    try {
      if (window.electronAPI?.token) {
        const tokenData = await window.electronAPI.token.getInfo(tokenAddress, targetChainId);

        if (tokenData) {
          setTokenInfo(tokenData);
        } else {
          setTokenInfoError(t('campaign.cannotGetTokenInfo'));
          setTokenInfo(null);
        }
      } else {
        setTokenInfoError(t('campaign.tokenAPINotAvailable'));
        setTokenInfo(null);
      }
    } catch (error) {
      console.error('Failed to get token information:', error);
      setTokenInfoError(`${t('campaign.getTokenInfoFailed')}: ${error instanceof Error ? error.message : t('campaign.unknownError')}`);
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

      // Sort by type and name: EVM chains first, then Solana, same type sorted by name
      chains.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'evm' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });

      setAvailableChains(chains);
    } catch (error) {
      console.error('Failed to load chains:', error);
      // If loading fails, use default chain list as fallback
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

    // If chain changes, adjust batch parameters
    if (name === 'chain') {
      const selectedChain = availableChains.find(c => c.id === value);
      const isSolana = selectedChain?.type === 'solana';

      setFormData(prev => ({
        ...prev,
        chain: value,
        // Automatically adjust batch parameters based on chain type
        batchSize: isSolana ? DEFAULTS.CAMPAIGN_FORM.batchSize.solana : DEFAULTS.CAMPAIGN_FORM.batchSize.evm,
        sendInterval: isSolana ? DEFAULTS.CAMPAIGN_FORM.sendInterval.solana : DEFAULTS.CAMPAIGN_FORM.sendInterval.evm
      }));

      // Refetch token information
      if (formData.tokenAddress && !tokenAddressError) {
        setTokenInfo(null);
        setTokenInfoError('');
        if (value) {
          // Pass new chainId to avoid using old formData.chain
          setTimeout(() => fetchTokenInfo(formData.tokenAddress, value), 100);
        }
      }
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: type === 'number' ? (value === '' ? '' : Number(value)) : value
      }));
    }

    // Real-time validation of token contract address
    if (name === 'tokenAddress') {
      if (value.trim()) {
        // Use unified address validation function
        const selectedChain = availableChains.find(c => c.id === formData.chain);
        const isValidAddress = validateAddressForChain(value, (selectedChain || {}) as any);

        if (!isValidAddress) {
          setTokenAddressError(t('campaign.pleaseInputValidAddress'));
          setTokenInfo(null);
          setTokenInfoError('');
        } else {
          setTokenAddressError('');
          // Address format is correct, get token information
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

        setCsvData(validation.data);  // Use all data instead of sampleData
        setCsvValidation(validation);
      } catch (error) {
        console.error('Failed to parse CSV:', error);
        setCsvValidation({
          isValid: false,
          totalRecords: 0,
          validRecords: 0,
          invalidRecords: 0,
          errors: [{ row: 0, field: 'address', value: '', error: t('campaign.csvParseFailed') }],
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
      alert(t('campaign.pleaseInputCampaignName'));
      return false;
    }
    if (!formData.chain) {
      alert(t('campaign.pleaseSelectBlockchain'));
      return false;
    }
    if (!formData.tokenAddress.trim()) {
      alert(t('campaign.pleaseInputTokenAddress'));
      return false;
    }
    if (tokenAddressError) {
      alert(tokenAddressError);
      return false;
    }
    if (!csvContent.trim()) {
      alert(t('campaign.pleaseInputCSV'));
      return false;
    }
    if (!csvValidation?.isValid) {
      alert(t('campaign.csvFormatIncorrect'));
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
        recipients: csvData  // Use parsed data array
      };

      if (window.electronAPI?.campaign) {
        const newCampaign = await window.electronAPI.campaign.create(campaignData);
        alert(t('campaign.createSuccess'));
        navigate(`/campaign/${newCampaign.id}`);
      }
    } catch (error) {
      console.error('Failed to create campaign:', error);
      alert(`${t('campaign.createFailed')}: ${error instanceof Error ? error.message : t('campaign.unknownError')}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEstimate = async () => {
    if (!formData.chain || !formData.tokenAddress || !csvValidation?.isValid) {
      alert(t('campaign.pleaseCompleteForm'));
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
      alert(`${t('campaign.estimateFailed')}: ${error instanceof Error ? error.message : t('campaign.unknownError')}`);
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
          <h1 className="text-2xl font-bold">{t('campaign.createNew')}</h1>
        </div>
        <button
          onClick={() => navigate('/')}
          className="btn btn-ghost btn-sm"
        >
          ← {t('campaign.backToDashboard')}
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Basic Information */}
        <div className="collapse collapse-arrow bg-base-100 shadow-sm">
          <input type="checkbox" defaultChecked className="min-w-fit" />
          <div className="collapse-title text-lg font-semibold flex items-center gap-3">
            <span className="text-xl">📋</span>
            {t('campaign.basicInfo')}
          </div>
          <div className="collapse-content">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
              <div>
                <div className="mb-2">
                  <span className="text-sm font-medium">{t('campaign.campaignNameLabel')}</span>
                </div>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder={t('campaign.campaignNamePlaceholder')}
                  className="input input-bordered w-full"
                  style={{ border: '1px solid #d1d5db', backgroundColor: '#ffffff' }}
                  required
                />
              </div>

              <div>
                <div className="mb-2">
                  <span className="text-sm font-medium">{t('campaign.blockchainNetwork')}</span>
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
                    <option value="">{t('campaign.loadingChains')}</option>
                  ) : (
                    <>
                      <option value="">{t('campaign.selectBlockchain')}</option>
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
                      <strong>{t('campaign.solanaNetworkTip')}</strong>{t('campaign.solanaAddressTip')}
                    </span>
                  </div>
                )}
              </div>

              <div className="md:col-span-2">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium">{t('campaign.tokenContractAddress')}</span>
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
                      {t('campaign.useNativeToken')}
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  name="tokenAddress"
                  value={formData.tokenAddress}
                  onChange={handleInputChange}
                  placeholder={t('campaign.tokenAddressPlaceholder')}
                  className={`input input-bordered w-full font-mono ${tokenAddressError ? 'input-error' : ''}`}
                  style={{ border: '1px solid #d1d5db', backgroundColor: '#ffffff' }}
                  required
                />
                {tokenAddressError && (
                  <div className="mt-1">
                    <span className="text-xs text-error">{tokenAddressError}</span>
                  </div>
                )}

                {/* Token information display */}
                {isFetchingToken && (
                  <div className="mt-2">
                    <div className="flex items-center gap-2">
                      <span className="loading loading-spinner loading-xs"></span>
                      <span className="text-xs text-info">{t('campaign.fetchingTokenInfo')}</span>
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
                          <div className="text-xs opacity-70">{t('campaign.tokenInfoPrecision')}</div>
                          <div className="text-sm font-mono">{tokenInfo.decimals}</div>
                        </div>
                      </div>
                      <div className="mt-2 text-xs opacity-60">
                        <div className="flex items-center gap-1">
                          <span>{t('campaign.chainType')}: {tokenInfo.chainType === 'evm' ? 'EVM' : 'Solana'}</span>
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
                  <span className="text-sm font-medium">{t('campaign.campaignDescription')}</span>
                </div>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  className="textarea textarea-bordered h-24 w-full"
                  style={{ border: '1px solid #d1d5db', backgroundColor: '#ffffff' }}
                  placeholder={t('campaign.descriptionPlaceholder')}
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
            {t('campaign.batchSettings')}
          </div>
          <div className="collapse-content">
            <div className="space-y-6 mt-4">
              <div>
                <div className="mb-3">
                  <span className="text-sm font-medium">{t('campaign.addressesPerBatch')}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(() => {
                    // Adjust recommended settings based on chain type
                    const selectedChain = availableChains.find(c => c.id === formData.chain);
                    const isSolana = selectedChain?.type === 'solana';
                    if (isSolana) {
                      // Solana network - simplified configuration
      // Unified batch size: ATA creation and transfers use the same batch settings
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
                      // EVM network - smart contracts can support larger batches
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
                  <span className="text-sm font-medium">{t('campaign.batchSendInterval')}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(() => {
                    // Adjust recommended settings based on chain type
                    const selectedChain = availableChains.find(c => c.id === formData.chain);
                    const isSolana = selectedChain?.type === 'solana';
                    if (isSolana) {
                      // Solana network - considering smaller batches, overall needs faster frequency to compensate
                      return [
                        { value: '3000', label: `3${t('campaign.seconds')}` },
                        { value: '5000', label: `5${t('campaign.seconds')}` },
                        { value: '8000', label: `8${t('campaign.seconds')}` },
                        { value: '10000', label: `10${t('campaign.seconds')}` },
                        { value: '15000', label: `15${t('campaign.seconds')}` }
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
                      // EVM network - maintain original settings
                      return [
                        { value: '15000', label: `15${t('campaign.seconds')}` },
                        { value: '20000', label: `20${t('campaign.seconds')}` },
                        { value: '30000', label: `30${t('campaign.seconds')}` },
                        { value: '45000', label: `45${t('campaign.seconds')}` },
                        { value: '60000', label: `60${t('campaign.seconds')}` }
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
                {/* Solana optimization tips */}
                {availableChains.find(c => c.id === formData.chain)?.type === 'solana' && (
                  <div className="mt-2">
                    <span className="text-xs text-warning">
                      <strong>⚡ {t('campaign.solanaLimit')}</strong>{t('campaign.solanaLimitDesc')}
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
            {t('campaign.inputAddressList')}
          </div>
          <div className="collapse-content">
            <div className="space-y-6">
              <div>
                <div className="mb-2">
                  <span className="text-sm font-medium">{t('campaign.csvContent')}</span>
                </div>
                <textarea
                  value={csvContent}
                  onChange={handleCSVContentChange}
                  className="textarea textarea-bordered font-mono text-sm h-96 resize-none w-full"
                  style={{ border: '1px solid #d1d5db', backgroundColor: '#ffffff' }}
                  placeholder={t('campaign.csvPlaceholder')}
                  required
                />
              </div>

              {csvValidation && (
                <div>
                  <div className="mb-2">
                    <span className="text-sm font-medium">{t('campaign.dataPreview')}</span>
                  </div>
                  {csvValidation && csvValidation.isValid ? (
                    <div className="bg-base-200 rounded-lg p-4 h-96 overflow-auto">
                      {/* Error warning (if any) */}
                      {csvValidation.errors.length > 0 && (
                        <div className="alert alert-warning mb-4">
                          <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                          </svg>
                          <div>
                            <div className="font-bold text-sm">{csvValidation.invalidRecords} {t('campaign.rowsWithErrors')}</div>
                            <div className="text-xs">{t('campaign.willProcess')} {csvValidation.validRecords} {t('campaign.validRecords')}</div>
                          </div>
                        </div>
                      )}

                      {/* Statistics information */}
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        <div className="stat bg-base-200 rounded-lg p-4">
                          <div className="stat-title text-xs">{t('campaign.validAddresses')}</div>
                          <div className="stat-value text-2xl">{csvValidation.validRecords}</div>
                        </div>

                        <div className="stat bg-base-200 rounded-lg p-4">
                          <div className="stat-title text-xs">{t('campaign.totalTokens')}</div>
                          <div className="stat-value text-2xl">
                            {csvData.reduce((sum, item) => {
                              return sum.plus(new BigNumber(item.amount || 0));
                            }, new BigNumber(0)).toString()}
                          </div>
                        </div>

                        <div className="stat bg-base-200 rounded-lg p-4">
                          <div className="stat-title text-xs">{t('campaign.batchCount')}</div>
                          <div className="stat-value text-2xl">
                            {Math.ceil(csvValidation.validRecords / formData.batchSize)}
                          </div>
                        </div>

                        <div className="stat bg-base-200 rounded-lg p-4">
                          <div className="stat-title text-xs">{t('campaign.estimatedDuration')}</div>
                          <div className="stat-value text-2xl">
                            {(() => {
                              const batches = Math.ceil(csvValidation.validRecords / formData.batchSize);
                              const totalSeconds = (batches * parseInt(formData.sendInterval)) / 1000;
                              const minutes = Math.floor(totalSeconds / 60);
                              const seconds = Math.floor(totalSeconds % 60);
                              return `${minutes}${t('campaign.minutes')}${seconds}${t('campaign.seconds')}`;
                            })()}
                          </div>
                        </div>
                      </div>

                      {/* Status notification */}
                      <div className="alert alert-success mt-4">
                        <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-sm font-medium">
                          {csvValidation.errors.length === 0 ? t('campaign.dataValidationPassed') : t('campaign.partialDataValid')}
                        </span>
                      </div>

                      {/* Error details (if any) */}
                      {csvValidation.errors.length > 0 && (
                        <div className="mt-4">
                          <div className="text-xs font-bold mb-2">{t('campaign.errorDetails')}</div>
                          <div className="space-y-1 max-h-32 overflow-auto">
                            {csvValidation.errors.slice(0, 10).map((error, index) => (
                              <div key={index} className="text-xs bg-error/10 text-error p-2 rounded">
                                {t('campaign.row')}{error.row}{t('campaign.line')} {error.field}: {error.error}
                              </div>
                            ))}
                            {csvValidation.errors.length > 10 && (
                              <div className="text-xs opacity-70 mt-1">
                                ... {t('campaign.moreErrors')} {csvValidation.errors.length - 10} {t('campaign.errors')}
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
                          <div className="font-bold text-sm">{t('campaign.noValidData')}</div>
                          <div className="text-xs">{t('campaign.checkCSVFormat')}</div>
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
                <h2 className="text-lg font-semibold">{t('campaign.costEstimation')}</h2>
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
                    {t('campaign.estimating')}
                  </>
                ) : (
                  t('campaign.startEstimate')
                )}
              </button>
            </div>

            {estimation ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="stat bg-base-200 rounded-lg p-4">
                    <div className="stat-title text-xs">Total Recipients</div>
                    <div className="stat-value text-2xl">{estimation.totalRecipients}</div>
                    <div className="stat-desc">{estimation.estimatedBatches} Batches</div>
                  </div>

                  <div className="stat bg-base-200 rounded-lg p-4">
                    <div className="stat-title text-xs">Gas Cost ({estimation.tokenSymbol})</div>
                    <div className="stat-value text-2xl">{estimation.estimatedGasCost}</div>
                    <div className="stat-desc">Native token cost</div>
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
                    <div className="stat-title text-xs">Estimated Duration</div>
                    <div className="stat-value text-2xl">{estimation.estimatedDuration}</div>
                    <div className="stat-desc">Minutes</div>
                  </div>
                </div>

                <div className="alert alert-info">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  <div className="text-sm">
                    <div className="font-bold">Optimization Recommendations</div>
                    <div>✓ Optimal batch size: {estimation.recommendations.optimalBatchSize} addresses/batch</div>
                    <div>✓ Time per batch: {estimation.recommendations.estimatedTimePerBatch} seconds</div>
                    <div>✓ Total estimated time: {estimation.recommendations.totalEstimatedTime} minutes</div>
                    <div className="mt-2 text-xs opacity-70">
                      {estimation.isEIP1559
                        ? '💡 Using EIP-1559 dynamic GasPrice pricing, includes 10% maxFee and 50% priority safety buffer'
                        : '💡 Using traditional GasPrice pricing, includes 10% safety buffer'
                      }
                    </div>
                  </div>
                </div>

                <div className="alert alert-warning">
                  <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <div className="text-sm">
                    <div className="font-bold">Important Reminders</div>
                    <div>⚠️  GasPrice is fetched in real-time from RPC, but may fluctuate during network congestion</div>
                    <div>⚠️  Estimation includes safety buffer to ensure fast transaction confirmation</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-base-content/60">
                <p>{t('campaign.clickToEstimate')}</p>
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
            {t('campaign.cancel')}
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn btn-primary"
          >
            {isSubmitting ? (
              <>
                <span className="loading loading-spinner loading-sm"></span>
                {t('campaign.creating')}
              </>
            ) : (
              t('campaign.createCampaign')
            )}
          </button>
        </div>
      </form>
    </div>
  );
}