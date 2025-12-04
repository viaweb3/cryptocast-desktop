import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { EVMChain, ChainInfo } from '../types';
import BigNumber from 'bignumber.js';
import { isSolanaChain, exportPrivateKey, isNativeToken, NATIVE_TOKEN_ADDRESSES } from '../utils/chainTypeUtils';


interface Campaign {
  id: string;
  name: string;
  chain: string;
  chainId: number;
  tokenAddress: string;
  tokenSymbol: string;
  tokenDecimals?: number;
  status: 'CREATED' | 'FUNDED' | 'READY' | 'SENDING' | 'PAUSED' | 'COMPLETED' | 'FAILED';
  totalRecipients: number;
  completedRecipients: number;
  failedRecipients: number;
  totalAmount?: string;
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
  createdAt?: string;
  updatedAt?: string;
}

export default function CampaignDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [chains, setChains] = useState<ChainInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPaused, setIsPaused] = useState(false);

  // Pagination states
  const [txCurrentPage, setTxCurrentPage] = useState(1);
  const [recipientsCurrentPage, setRecipientsCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [walletBalances, setWalletBalances] = useState({
    native: { current: '0', total: '0' },
    token: { current: '0', total: '0' }
  });
  const [totalAirdropAmount, setTotalAirdropAmount] = useState<string>('0');
  const [isRefreshingBalance, setIsRefreshingBalance] = useState(false);
  const [showPrivateKeyModal, setShowPrivateKeyModal] = useState(false);
  const [exportedWallet, setExportedWallet] = useState<{ address: string; privateKey: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // Withdrawal states
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawType, setWithdrawType] = useState<'tokens' | 'native'>('tokens');
  const [withdrawRecipient, setWithdrawRecipient] = useState('');
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  // Transaction filter states
  const [showFailedOnly, setShowFailedOnly] = useState(false);

  // Contract deployment states
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploymentProgress, setDeploymentProgress] = useState('');
  const [deploymentError, setDeploymentError] = useState<string | null>(null);
  const [showDeploymentModal, setShowDeploymentModal] = useState(false);
  const [deploymentResult, setDeploymentResult] = useState<{ contractAddress: string; transactionHash: string } | null>(null);

  // Utility function to get native token symbol from database
  const getNativeTokenSymbol = (chainId: string): string => {
    // Find the chain from loaded chains data
    const chainIdNum = parseInt(chainId);
    const chain = chains.find(c => c.chainId === chainIdNum);

    // Return symbol from database or fallback to ETH
    return chain?.symbol || "ETH";
  };

  useEffect(() => {
    if (id) {
      loadCampaign();
      loadChains();
    }
  }, [id]);

  // Load chains from database
  const loadChains = async () => {
    try {
      if (window.electronAPI?.chain) {
        const chainsData = await window.electronAPI.chain.getAllChains();
        setChains(chainsData);
      }
    } catch (error) {
      console.error('Failed to load chains:', error);
    }
  };

  // Data consistency validation helper
  const validateDataConsistency = (
    campaignData: Campaign,
    recipientsData: Recipient[]
  ): string[] => {
    const warnings: string[] = [];

    // Count recipients by status
    const recipientCounts = {
      sent: recipientsData.filter(r => r.status === 'success').length,
      failed: recipientsData.filter(r => r.status === 'failed').length,
      pending: recipientsData.filter(r => r.status === 'pending' || r.status === 'sending').length,
    };

    // Safely get campaign values with fallbacks
    const campaignCompleted = campaignData.completedRecipients ?? 0;
    const campaignFailed = campaignData.failedRecipients ?? 0;
    const campaignTotal = campaignData.totalRecipients ?? 0;

    // Validate completed recipients count
    if (recipientCounts.sent !== campaignCompleted) {
      warnings.push(
        `[Data inconsistency] Completed count: Recipients table=${recipientCounts.sent}, Campaign table=${campaignCompleted}, Difference=${Math.abs(recipientCounts.sent - campaignCompleted)}`
      );
    }

    // Validate failed recipients count
    if (recipientCounts.failed !== campaignFailed) {
      warnings.push(
        `[Data inconsistency] Failed count: Recipients table=${recipientCounts.failed}, Campaign table=${campaignFailed}, Difference=${Math.abs(recipientCounts.failed - campaignFailed)}`
      );
    }

    // Validate total recipients
    const totalInRecipients = recipientsData.length;
    if (totalInRecipients !== campaignTotal) {
      warnings.push(
        `[Data inconsistency] Total count: Recipients table=${totalInRecipients}, Campaign table=${campaignTotal}, Difference=${Math.abs(totalInRecipients - campaignTotal)}`
      );
    }

    // Validate progress calculation (avoid division by zero and NaN)
    const calculatedProgress = campaignTotal > 0 && !isNaN(campaignTotal) && !isNaN(campaignCompleted)
      ? Math.round((campaignCompleted / campaignTotal) * 100)
      : 0;
    const actualProgress = totalInRecipients > 0
      ? Math.round((recipientCounts.sent / totalInRecipients) * 100)
      : 0;

    if (Math.abs(calculatedProgress - actualProgress) > 1) { // Allow 1% tolerance for rounding
      warnings.push(
        `[Progress inconsistency] Calculated progress=${calculatedProgress}%, Actual progress=${actualProgress}%, Difference=${Math.abs(calculatedProgress - actualProgress)}%`
      );
    }

    if (warnings.length > 0) {
      console.warn('⚠️ Data consistency check found issues:', warnings);
      console.warn('Campaign data:', {
        totalRecipients: campaignData.totalRecipients,
        completedRecipients: campaignData.completedRecipients,
        failedRecipients: campaignData.failedRecipients,
      });
      console.warn('Recipients statistics:', recipientCounts);
    }

    return warnings;
  };

  const loadCampaign = async (silent = false) => {
    if (!silent) {
      setLoading(true);
    }
    try {
      if (!id || id === 'undefined') {
        throw new Error('Campaign ID is required');
      }

      if (!window.electronAPI?.campaign) {
        throw new Error('Campaign API not available');
      }

      // Load all data in parallel for better performance
      const [detailsResult, txResult, recipientsResult] = await Promise.allSettled([
        window.electronAPI.campaign.getDetails(id),
        window.electronAPI.campaign.getTransactions(id),
        window.electronAPI.campaign.getRecipients(id)
      ]);

      // Process campaign details (critical - must succeed)
      if (detailsResult.status === 'fulfilled' && detailsResult.value) {
        // detailsResult.value contains both campaign and stats
        const campaignData = detailsResult.value.campaign || detailsResult.value;
        setCampaign({
          ...campaignData,
          chainId: parseInt(campaignData.chain),
        });
      } else {
        const error = detailsResult.status === 'rejected' ? detailsResult.reason : 'Campaign not found';
        throw new Error(error instanceof Error ? error.message : String(error));
      }

      // Process transactions (non-critical)
      if (txResult.status === 'fulfilled' && txResult.value && Array.isArray(txResult.value)) {
        const batchTransactions = txResult.value.filter((tx: any) => tx.txType === 'BATCH_SEND');
        setTransactions(batchTransactions.map((tx: any, index: number) => ({
          id: tx.id.toString(),
          batchNumber: index + 1, // Sequential batch number: first transaction = batch 1
          status: tx.status === 'CONFIRMED' ? 'success' : tx.status === 'PENDING' ? 'sending' : 'failed',
          addressCount: tx.recipientCount || 0,
          txHash: tx.txHash,
          gasUsed: tx.gasUsed?.toString(),
          createdAt: tx.createdAt,
        })));
      } else {
        const error = txResult.status === 'rejected' ? txResult.reason : 'Unknown error';
        console.error('Failed to load transactions:', error);
        console.error('Transaction error details:', {
          campaignId: id,
          error: error instanceof Error ? error.message : error,
          stack: error instanceof Error ? error.stack : undefined
        });
        setTransactions([]);
      }

      // Process recipients (non-critical)
      if (recipientsResult.status === 'fulfilled' && recipientsResult.value && Array.isArray(recipientsResult.value)) {
        const mappedRecipients = recipientsResult.value.map((r: any) => ({
          id: r.id,
          campaignId: r.campaignId,
          address: r.address,
          amount: r.amount,
          status: (r.status === 'SENT' ? 'success' : r.status === 'PENDING' ? 'pending' : r.status === 'FAILED' ? 'failed' : 'sending') as 'pending' | 'failed' | 'success' | 'sending',
          transactionHash: r.txHash,
          gasUsed: r.gasUsed,
          error: r.errorMessage,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        }));
        setRecipients(mappedRecipients);

        // Calculate total airdrop amount using BigNumber for precision
        const total = recipientsResult.value.reduce((sum: BigNumber, r: any) => {
          return sum.plus(new BigNumber(r.amount || '0'));
        }, new BigNumber(0));
        setTotalAirdropAmount(total.toString());
      } else {
        const error = recipientsResult.status === 'rejected' ? recipientsResult.reason : 'Unknown error';
        console.error('Failed to load recipients:', error);
        setRecipients([]);
        setTotalAirdropAmount('0');
      }

      // Refresh wallet balances after loading campaign data
      try {
        await refreshBalances();
              } catch (balanceError) {
        console.warn('Failed to refresh balances after loading campaign:', balanceError);
        // Don't block page load, just log the warning
      }

      // Validate data consistency after all data is loaded
      if (detailsResult.status === 'fulfilled' && recipientsResult.status === 'fulfilled') {
        // Extract campaign data from the complex response
        const campaignData = {
          ...(detailsResult.value.campaign || detailsResult.value),
          chainId: parseInt((detailsResult.value.campaign || detailsResult.value).chain),
        };
        const recipientsData = recipientsResult.value.map((r: any) => ({
          id: r.id,
          campaignId: r.campaignId,
          address: r.address,
          amount: r.amount,
          status: (r.status === 'SENT' ? 'success' : r.status === 'PENDING' ? 'pending' : r.status === 'FAILED' ? 'failed' : 'sending') as 'pending' | 'failed' | 'success' | 'sending',
          transactionHash: r.txHash,
          gasUsed: r.gasUsed,
          error: r.errorMessage,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        }));
        validateDataConsistency(campaignData, recipientsData);
      }

    } catch (error) {
      console.error('Failed to load campaign:', error);
      if (!silent) {
        alert(t('campaign.loadCampaignFailed') + ': ' + (error instanceof Error ? error.message : t('campaign.unknownError')));
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  const loadRecipients = async () => {
    try {
      if (!id || !window.electronAPI?.campaign) return;

      const recipientsData = await window.electronAPI.campaign.getRecipients(id);
      if (recipientsData && Array.isArray(recipientsData)) {
        const mappedRecipients = recipientsData.map((r: any) => ({
          id: r.id,
          campaignId: r.campaignId,
          address: r.address,
          amount: r.amount,
          status: (r.status === 'SENT' ? 'success' : r.status === 'PENDING' ? 'pending' : r.status === 'FAILED' ? 'failed' : 'sending') as 'pending' | 'failed' | 'success' | 'sending',
          transactionHash: r.txHash,
          gasUsed: r.gasUsed,
          error: r.errorMessage,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        }));
        setRecipients(mappedRecipients);

        // Recalculate total airdrop amount
        const total = recipientsData.reduce((sum: BigNumber, r: any) => {
          return sum.plus(new BigNumber(r.amount || '0'));
        }, new BigNumber(0));
        setTotalAirdropAmount(total.toString());
      }
    } catch (error) {
      console.error('Failed to load recipients:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <div className="badge badge-success gap-1">✅ {t('common.success')}</div>;
      case 'SENDING':
        return <div className="badge badge-info gap-1">🔄 {t('common.sending')}</div>;
      case 'PAUSED':
        return <div className="badge badge-warning gap-1">⏸️ {t('common.paused')}</div>;
      case 'FAILED':
        return <div className="badge badge-error gap-1">❌ {t('common.failed')}</div>;
      case 'READY':
        return <div className="badge badge-accent gap-1">⚡ {t('common.ready')}</div>;
      case 'FUNDED':
        return <div className="badge badge-info gap-1">💰 {t('history.funded')}</div>;
      default:
        return <div className="badge badge-neutral gap-1">📋 {t('common.created')}</div>;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'bg-green-100 text-green-800';
      case 'SENDING': return 'bg-blue-100 text-blue-800';
      case 'PAUSED': return 'bg-orange-100 text-orange-800';
      case 'FAILED': return 'bg-red-100 text-red-800';
      case 'READY': return 'bg-purple-100 text-purple-800';
      case 'FUNDED': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handlePauseResume = async () => {
    if (!campaign || !id) return;

    try {
      if (window.electronAPI?.campaign) {
        if (campaign.status === 'SENDING') {
          // Pause campaign
          await window.electronAPI.campaign.pause(id);
          alert(t('campaign.campaignPaused'));
          await loadCampaign(true); // Silent refresh after pause
        } else if (campaign.status === 'PAUSED') {
          // Resume campaign
          await window.electronAPI.campaign.resume(id);
          alert(t('campaign.campaignResumed'));
          await loadCampaign(true); // Silent refresh after resume
        }
      }
    } catch (error) {
      console.error('Failed to pause/resume campaign:', error);
      alert(t('campaign.operationFailed') + ': ' + (error instanceof Error ? error.message : t('campaign.unknownError')));
    }
  };

  const handleRetryFailedTransactions = async () => {
    if (!campaign || !id) return;

    try {
      if (window.electronAPI?.campaign) {
        await window.electronAPI.campaign.retryFailedTransactions(id);
        alert(t('campaign.retryingFailedTx'));
        await loadCampaign(true);
      }
    } catch (error) {
      console.error('Failed to retry transactions:', error);
      alert(t('campaign.retryFailed') + ': ' + (error instanceof Error ? error.message : t('campaign.unknownError')));
    }
  };

  const handleStartCampaign = async () => {
    if (!campaign || !id) return;

    // Confirmation dialog
    const confirmed = confirm(`${t('campaign.confirmStart')}\n\n${t('campaign.campaignName')}: ${campaign.name}\n${t('campaign.sendCount')}: ${campaign.totalRecipients - campaign.completedRecipients - campaign.failedRecipients} ${t('campaign.recipients')}\n\n${t('campaign.clickOkToStart')}`);

    if (!confirmed) {
      return; // User cancelled
    }

    try {
      if (window.electronAPI?.campaign) {
                await window.electronAPI.campaign.start(id);

        // Reload campaign status after successful start
        await loadCampaign(true); // Silent refresh after start
        alert(t('campaign.campaignStarted'));
      }
    } catch (error) {
      console.error('Failed to start campaign:', error);
      alert(t('campaign.startFailed') + ': ' + (error instanceof Error ? error.message : t('campaign.unknownError')));
    }
  };

  const handleDeployContract = async () => {
    if (!campaign || !id || !campaign.walletAddress || !campaign.chain) return;

    let nativeBalance = 0;
    let estimatedDeploymentCost = "0.0015"; // Default estimate value
    let minGasRequired = 0.0015; // Default minimum requirement

    // Get latest balance first
    try {
      const freshBalance = await window.electronAPI.wallet.getBalance(
        campaign.walletAddress,
        campaign.chain
      );

      nativeBalance = parseFloat(freshBalance.native || '0');
    } catch (balanceError) {
      console.error('Failed to check balance before deployment:', balanceError);
      setDeploymentError(t('campaign.cannotGetBalance'));
      setShowDeploymentModal(true);
      return;
    }


    const nativeTokenSymbol = getNativeTokenSymbol(campaign.chain);

    // Check if balance is sufficient (using dynamically calculated minimum requirement)
    if (nativeBalance < minGasRequired) {
      setDeploymentError(`${t('campaign.insufficientGas')} ${minGasRequired.toFixed(6)} ${nativeTokenSymbol} ${t('campaign.toPayDeployment')} ${nativeBalance.toFixed(6)} ${nativeTokenSymbol}`);
      setShowDeploymentModal(true);
      return;
    }

    // Show deployment confirmation dialog
    const confirmed = confirm(`${t('campaign.confirmDeploy')}

${t('campaign.deploymentGasDetails')}
• ${t('campaign.currentBalanceLabel')} ${nativeBalance.toFixed(6)} ${nativeTokenSymbol}
• ${t('campaign.estimatedDeploymentCost')} ~${estimatedDeploymentCost} ${nativeTokenSymbol}
• ${t('campaign.minBalanceRequired')} ${minGasRequired.toFixed(6)} ${nativeTokenSymbol} ${t('campaign.safetyBuffer')}

${t('campaign.deploymentWarning')}`);
    if (!confirmed) return;

    // Start deployment process
    setShowDeploymentModal(true);
    setDeploymentProgress(t('campaign.preparingDeployment'));
    setDeploymentError(null);
    setIsDeploying(true);

    try {
      if (window.electronAPI?.campaign) {
        setDeploymentProgress(t('campaign.deploying'));

        const result = await window.electronAPI.campaign.deployContract(id);

        setDeploymentProgress(t('campaign.deploymentSuccess'));
        setDeploymentResult(result);

        // Refresh campaign status
        setTimeout(async () => {
          await loadCampaign(true); // Silent refresh after deployment
          await refreshBalances();
        }, 1000);

      }
    } catch (error) {
      console.error('Failed to deploy contract:', error);
      const errorMessage = getSolanaSpecificErrorMessage(error);
      setDeploymentError(errorMessage);
      setDeploymentProgress(t('campaign.deploymentFailed'));
    } finally {
      setIsDeploying(false);
    }
  };


  const getSolanaSpecificErrorMessage = (error: any): string => {
    const errorMessage = error?.message || error?.toString() || '';

    if (errorMessage.includes('insufficient funds') || errorMessage.includes('insufficient lamports')) {
      return t('campaign.solBalanceInsufficient');
    }
    if (errorMessage.includes('Invalid account') || errorMessage.includes('not found')) {
      return t('campaign.invalidTokenAccount');
    }
    if (errorMessage.includes('Token account not found')) {
      return t('campaign.tokenAccountNotFound');
    }
    if (errorMessage.includes('network') || errorMessage.includes('timeout')) {
      return t('campaign.solanaNetworkTimeout');
    }
    if (errorMessage.includes('blockhash')) {
      return t('campaign.solanaBlockhashExpired');
    }
    if (errorMessage.includes('rate limit')) {
      return t('campaign.solanaRateLimit');
    }

    return errorMessage || t('campaign.solanaOperationFailed');
  };

  // Pagination logic
  const getPaginatedItems = <T,>(items: T[], currentPage: number) => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return items.slice(startIndex, endIndex);
  };

  const getTotalPages = <T,>(items: T[]) => {
    return Math.ceil(items.length / itemsPerPage);
  };

  const filteredTransactions = showFailedOnly ? transactions.filter(tx => tx.status === 'failed') : transactions;
  const paginatedTransactions = getPaginatedItems(filteredTransactions, txCurrentPage);
  const paginatedRecipients = getPaginatedItems(recipients, recipientsCurrentPage);
  const txTotalPages = getTotalPages(filteredTransactions);
  const recipientsTotalPages = getTotalPages(recipients);

  const formatPaginationInfo = <T,>(currentPage: number, items: T[]) => {
    const startIndex = (currentPage - 1) * itemsPerPage + 1;
    const endIndex = Math.min(currentPage * itemsPerPage, items.length);
    return `${t('campaign.showing')} ${startIndex} ${t('campaign.to')} ${endIndex} ${t('campaign.totalRecords')} ${items.length} ${t('campaign.records')}`;
  };

  const renderPagination = (currentPage: number, totalPages: number, setCurrentPage: (page: number) => void) => {
    const getVisiblePages = () => {
      const pages: (number | string)[] = [];

      if (totalPages <= 7) {
        // Show all pages if total is small
        for (let i = 1; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        // Always show first page
        pages.push(1);

        // Show ellipsis if current page is far from start
        if (currentPage > 3) {
          pages.push('...');
        }

        // Show pages around current page
        const start = Math.max(2, currentPage - 1);
        const end = Math.min(totalPages - 1, currentPage + 1);

        for (let i = start; i <= end; i++) {
          if (i !== 1 && i !== totalPages) {
            pages.push(i);
          }
        }

        // Show ellipsis if current page is far from end
        if (currentPage < totalPages - 2) {
          pages.push('...');
        }

        // Always show last page
        if (totalPages > 1) {
          pages.push(totalPages);
        }
      }

      return pages;
    };

    return (
      <div className="join">
        <button
          className="join-item btn btn-sm"
          onClick={() => setCurrentPage(1)}
          disabled={currentPage === 1}
        >
          «
        </button>
        <button
          className="join-item btn btn-sm"
          onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
        >
          ‹
        </button>
        {getVisiblePages().map((page, index) => {
          if (page === '...') {
            return (
              <button key={`ellipsis-${index}`} className="join-item btn btn-sm btn-disabled">
                ...
              </button>
            );
          }

          return (
            <button
              key={page}
              className={`join-item btn btn-sm ${currentPage === page ? 'btn-active' : ''}`}
              onClick={() => setCurrentPage(page as number)}
            >
              {page}
            </button>
          );
        })}
        <button
          className="join-item btn btn-sm"
          onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
        >
          ›
        </button>
        <button
          className="join-item btn btn-sm"
          onClick={() => setCurrentPage(totalPages)}
          disabled={currentPage === totalPages}
        >
          »
        </button>
      </div>
    );
  };

  const handleExportPrivateKey = async () => {
    if (!campaign?.walletPrivateKeyBase64) {
      alert(t('wallet.noPrivateKey'));
      return;
    }

    try {
      // Use unified private key export function
      const privateKeyDisplay = await exportPrivateKey(campaign.walletPrivateKeyBase64 || '', campaign);

      // Show custom private key popup
      setExportedWallet({
        address: campaign.walletAddress || '',
        privateKey: privateKeyDisplay
      });
      setShowPrivateKeyModal(true);
      setCopied(false);
    } catch (error) {
      console.error('Failed to export private key:', error);
      alert(t('wallet.exportFailed') + ': ' + (error instanceof Error ? error.message : t('campaign.unknownError')));
    }
  };

  const handleCopyPrivateKey = () => {
    if (exportedWallet?.privateKey) {
      navigator.clipboard.writeText(exportedWallet.privateKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopyAddress = () => {
    if (exportedWallet?.address) {
      navigator.clipboard.writeText(exportedWallet.address);
    }
  };

  // Withdrawal handlers
  const handleOpenWithdrawModal = (type: 'tokens' | 'native') => {
    if (!campaign?.walletPrivateKeyBase64) {
      alert(t('campaign.noPrivateKey'));
      return;
    }
    setWithdrawType(type);
    setWithdrawRecipient('');
    setShowWithdrawModal(true);
  };

  const handleWithdraw = async () => {
    if (!campaign?.id || !withdrawRecipient) {
      alert(t('campaign.enterRecipientAddress'));
      return;
    }

    setIsWithdrawing(true);
    try {
      let result;
      if (withdrawType === 'tokens') {
        result = await window.electronAPI.campaign.withdrawTokens(campaign.id, withdrawRecipient);
        alert(`${t('campaign.tokensWithdrawn')}\n${t('campaign.txHash')}: ${result.txHash}\n${t('campaign.withdrawnAmount')}: ${result.amount} ${campaign.tokenSymbol}`);
      } else {
        result = await window.electronAPI.campaign.withdrawNative(campaign.id, withdrawRecipient);
        const nativeTokenSymbol = getNativeTokenSymbol(campaign.chain);
        alert(`${nativeTokenSymbol} ${t('campaign.nativeWithdrawn')}\n${t('campaign.txHash')}: ${result.txHash}\n${t('campaign.withdrawnAmount')}: ${result.amount} ${nativeTokenSymbol}`);
      }
      setShowWithdrawModal(false);
      // Refresh balance
      await refreshBalances();
    } catch (error) {
      console.error('Withdrawal failed:', error);
      alert(t('campaign.withdrawalFailed') + ': ' + (error instanceof Error ? error.message : t('campaign.unknownError')));
    } finally {
      setIsWithdrawing(false);
    }
  };

  const handleCloseModal = () => {
    setShowPrivateKeyModal(false);
    setExportedWallet(null);
    setCopied(false);
  };

  // Helper function to get transaction explorer URL
  const getTransactionUrl = (txHash: string): string => {
    if (!campaign?.chain) return '#';

    const chain = getChainByName(campaign.chain);
    if (!chain?.explorerUrl) return '#';

    // Special handling for Solana explorers with cluster parameters
    if (chain.type === 'solana') {
      const url = new URL(chain.explorerUrl);
      const baseUrl = `${url.protocol}//${url.host}`;
      const clusterParam = url.searchParams.get('cluster');

      if (clusterParam) {
        return `${baseUrl}/tx/${txHash}?cluster=${clusterParam}`;
      } else {
        return `${baseUrl}/tx/${txHash}`;
      }
    }

    // Handle other chains (EVM, etc.)
    const baseUrl = chain.explorerUrl.endsWith('/') ? chain.explorerUrl : chain.explorerUrl + '/';
    return `${baseUrl}tx/${txHash}`;
  };

  // Transaction history handlers
  const handleExportTransactions = () => {
    const dataToExport = showFailedOnly ? transactions.filter(tx => tx.status === 'failed') : transactions;

    const csvContent = [
      [t('campaign.batch'), t('campaign.status'), t('campaign.addressCount'), t('campaign.txHash'), t('campaign.gasUsed'), t('campaign.createdAt')].join(','),
      ...dataToExport.map(tx => [
        `#${tx.batchNumber}`,
        tx.status === 'success' ? t('common.success') : tx.status === 'failed' ? t('common.failed') : tx.status === 'sending' ? t('common.sending') : t('campaign.pending'),
        tx.addressCount,
        tx.txHash || '',
        tx.gasUsed || '',
        formatDate(tx.createdAt)
      ].join(','))
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `transactions-${campaign?.name || 'export'}-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const handleRefreshTransactions = async () => {
    if (!id) return;
    try {
      const txData = await window.electronAPI.campaign.getTransactions(id, { limit: 100 });
      if (txData && Array.isArray(txData)) {
        const batchTransactions = txData.filter((tx: any) => tx.txType === 'BATCH_SEND');
        setTransactions(batchTransactions.map((tx: any, index: number) => ({
          id: tx.id.toString(),
          batchNumber: index + 1,
          status: tx.status === 'CONFIRMED' ? 'success' : tx.status === 'PENDING' ? 'sending' : 'failed',
          addressCount: tx.recipientCount || 0,
          txHash: tx.txHash,
          gasUsed: tx.gasUsed?.toString(),
          createdAt: tx.createdAt,
        })));
      }
    } catch (error) {
      console.error('Failed to refresh transactions:', error);
      alert(t('campaign.refreshTxFailed') + ': ' + (error instanceof Error ? error.message : t('campaign.unknownError')));
    }
  };

  const handleToggleFilter = () => {
    setShowFailedOnly(!showFailedOnly);
    setTxCurrentPage(1); // Reset to first page when filtering
  };

  const handleExportRecipients = () => {
    const csvContent = [
      [t('campaign.address'), t('campaign.amount'), t('campaign.status'), t('campaign.txHash'), t('campaign.txTime')].join(','),
      ...recipients.map(recipient => [
        recipient.address,
        recipient.amount,
        recipient.status === 'success' ? t('common.success') : recipient.status === 'failed' ? t('common.failed') : recipient.status === 'sending' ? t('common.sending') : t('campaign.pending'),
        recipient.txHash || '',
        recipient.updatedAt ? formatDate(recipient.updatedAt) : recipient.createdAt ? formatDate(recipient.createdAt) : ''
      ].join(','))
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `recipients-${campaign?.name || 'export'}-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
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

  // Refresh wallet balances
  const refreshBalances = async () => {
    if (!campaign?.walletAddress || !campaign.chain) return;

    setIsRefreshingBalance(true);
    try {
      if (window.electronAPI?.wallet && campaign.walletAddress) {
        let nativeBalance, tokenBalance = null;

        if (isSolanaChain(campaign)) {
          // Solana logic
          if (window.electronAPI?.solana) {
            try {
              // Get SOL balance
              const chainRpcUrl = getChainByName(campaign.chain)?.rpcUrl;
              if (!chainRpcUrl) {
                console.error('No RPC URL found for Solana chain');
                return;
              }
              const solBalance = await window.electronAPI.solana.getBalance(
                chainRpcUrl,
                campaign.walletAddress
              );

              nativeBalance = { native: solBalance.balance || '0' };

              // If it's an SPL token, get token balance
              if (campaign.tokenAddress &&
                  campaign.tokenAddress !== 'So11111111111111111111111111111111111111112') {
                try {
                  const chainRpcUrl = getChainByName(campaign.chain)?.rpcUrl;
                  if (!chainRpcUrl) {
                    console.error('No RPC URL found for Solana chain');
                    return;
                  }
                  const splBalance = await window.electronAPI.solana.getBalance(
                    chainRpcUrl,
                    campaign.walletAddress,
                    campaign.tokenAddress
                  );
                  tokenBalance = { token: splBalance.balance || '0' };
                } catch (tokenError) {
                  console.warn('Failed to get SPL token balance:', tokenError);
                  tokenBalance = null;
                }
              }
            } catch (error) {
              console.error('Failed to get Solana balances:', error);
              // If Solana API fails, try using generic API as fallback
              try {
                nativeBalance = await window.electronAPI.wallet.getBalance(
                  campaign.walletAddress,
                  campaign.chain
                );
                if (campaign.tokenAddress &&
                    campaign.tokenAddress !== 'So11111111111111111111111111111111111111112') {
                  tokenBalance = await window.electronAPI.wallet.getBalance(
                    campaign.walletAddress,
                    campaign.chain,
                    campaign.tokenAddress,
                    campaign.tokenDecimals
                  );
                }
              } catch (fallbackError) {
                console.error('Fallback balance query also failed:', fallbackError);
                nativeBalance = { native: '0' };
                tokenBalance = null;
              }
            }
          } else {
            console.warn('Solana API not available, skipping balance refresh');
            nativeBalance = { native: '0' };
            tokenBalance = null;
          }
        } else {
          // EVM logic
          nativeBalance = await window.electronAPI.wallet.getBalance(
            campaign.walletAddress,
            campaign.chain
          );

          // Get token balance if token address is provided (and not native token)
          if (!isNativeToken(campaign.tokenAddress)) {
            try {
              tokenBalance = await window.electronAPI.wallet.getBalance(
                campaign.walletAddress,
                campaign.chain,
                campaign.tokenAddress,
                campaign.tokenDecimals
              );
            } catch (tokenError) {
              console.warn('Failed to get token balance:', tokenError);
              tokenBalance = null;
            }
          }
        }

        setWalletBalances({
          native: {
            current: nativeBalance?.native || '0',
            total: '∞' // No total limit for native currency
          },
          token: {
            current: tokenBalance?.token || '0',
            total: campaign.totalAmount || '0'
          }
        });

              }
    } catch (error) {
      console.error('Failed to refresh balances:', error);
      // Set fallback values on error
      setWalletBalances({
        native: {
          current: '0',
          total: '∞'
        },
        token: {
          current: '0',
          total: campaign.totalAmount || '0'
        }
      });
    } finally {
      setIsRefreshingBalance(false);
    }
  };

  // Auto-refresh campaign data and balances with optimized intervals
  useEffect(() => {
    if (!campaign?.walletAddress || !id) return;

    // Determine refresh interval based on campaign status
    let refreshInterval: number | null = null;

    if (campaign.status === 'SENDING') {
      // SENDING status: Fast refresh every 3 seconds for real-time progress
      refreshInterval = 3000;
    } else if (['PAUSED', 'READY', 'FUNDED'].includes(campaign.status)) {
      // Active but not sending: Moderate refresh every 10 seconds
      refreshInterval = 10000;
    }
    // COMPLETED/FAILED/CREATED status: No auto-refresh

    if (refreshInterval) {
      const interval = setInterval(() => {
        loadCampaign(true); // Silent refresh - updates data without loading state
      }, refreshInterval);

      return () => clearInterval(interval);
    }
  }, [campaign?.status, campaign?.walletAddress, id]);

  
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading && (!campaign || campaign.status !== 'COMPLETED')) {
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
          <span>{t('campaign.noCampaign')}</span>
        </div>
      </div>
    );
  }

  // Safely calculate progress percentage with fallbacks to avoid NaN
  const progressPercentage = campaign.totalRecipients > 0 && !isNaN(campaign.totalRecipients) && !isNaN(campaign.completedRecipients)
    ? Math.round((campaign.completedRecipients / campaign.totalRecipients) * 100)
    : 0;

  // Safely calculate remaining recipients with fallbacks
  const remainingRecipients = (campaign.totalRecipients || 0) - (campaign.completedRecipients || 0) - (campaign.failedRecipients || 0);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">{campaign.name}</h1>
        </div>
      </div>
        <div className="flex gap-2">
          {campaign && (campaign.status === 'CREATED' || campaign.status === 'FUNDED') && !isSolanaChain(campaign) && (
            <button
              onClick={handleDeployContract}
              className="btn btn-primary"
            >
                🚀 {t('campaign.deployContract')}
            </button>
          )}
          {campaign && campaign.status === 'CREATED' && isSolanaChain(campaign) && (
            <button
              onClick={async () => {
                if (!id) return;
                try {
                  await window.electronAPI.campaign.updateStatus(id, 'READY');
                  await loadCampaign(true); // Silent refresh after status update
                  alert(t('campaign.statusUpdated'));
                } catch (error) {
                  console.error('Failed to update status:', error);
                  alert(t('campaign.updateStatusFailed'));
                }
              }}
              className="btn btn-primary"
            >
              ✅ {t('campaign.markAsFunded')}
            </button>
          )}
          {campaign && campaign.status === 'READY' && (
            <button
              onClick={handleStartCampaign}
              className="btn btn-success"
            >
                🚀 {t('campaign.startSending')}
            </button>
          )}
          {campaign && (campaign.status === 'SENDING' || campaign.status === 'PAUSED') && (
            <>
              <button
                onClick={handlePauseResume}
                className={`btn ${campaign.status === 'PAUSED' ? 'btn-success' : 'btn-warning'}`}
              >
                {campaign.status === 'PAUSED' ? `▶️ ${t('campaign.resume')}` : `⏸️ ${t('campaign.pause')}`}
              </button>
              {campaign.status === 'PAUSED' && campaign.failedRecipients > 0 && (
                <button
                  onClick={handleRetryFailedTransactions}
                  className="btn btn-info"
                >
                  🔄 {t('campaign.retryFailedTx')}
                </button>
              )}
            </>
          )}
          <button
            onClick={() => navigate('/')}
            className="btn btn-ghost"
          >
            ← {t('campaign.backToDashboard')}
          </button>
        </div>

      {/* Progress Section */}
      <div className="card bg-base-100 shadow-sm mb-8">
        <div className="card-body">
          <div className="flex items-center justify-between mb-4">
            <h2 className="card-title">{t('campaign.sendingProgress')}</h2>
            <div className="text-2xl font-bold text-primary">{isNaN(progressPercentage) ? 0 : progressPercentage}%</div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>{t('campaign.completed')} {campaign.completedRecipients} / {campaign.totalRecipients} {t('campaign.addressUnit')}</span>
              <span className="text-success">{t('campaign.successCount')} {campaign.completedRecipients}</span>
              <span className="text-error">{t('campaign.failedCount')} {campaign.failedRecipients}</span>
              <span className="text-warning">{t('campaign.pendingCount')} {remainingRecipients}</span>
            </div>
            <progress
              className="progress progress-success w-full"
              value={isNaN(progressPercentage) ? 0 : progressPercentage}
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
          <div className="stat-title">{t('campaign.totalAddresses')}</div>
          <div className="stat-value text-primary">{campaign.totalRecipients || 0}</div>
          <div className="stat-desc text-info">100% {t('campaign.target')}</div>
        </div>

        <div className="stat bg-base-100 rounded-lg shadow-sm">
          <div className="stat-figure text-success">
            ✅
          </div>
          <div className="stat-title">{t('campaign.successfullySent')}</div>
          <div className="stat-value text-success">{campaign.completedRecipients || 0}</div>
          <div className="stat-desc text-success">↑ {isNaN(progressPercentage) ? 0 : progressPercentage}%</div>
        </div>

        <div className="stat bg-base-100 rounded-lg shadow-sm">
          <div className="stat-figure text-error">
            ❌
          </div>
          <div className="stat-title">{t('campaign.failedAmount')}</div>
          <div className="stat-value text-error">{campaign.failedRecipients || 0}</div>
          <div className="stat-desc text-error">{(campaign.totalRecipients && campaign.failedRecipients) ? Math.round((campaign.failedRecipients / campaign.totalRecipients) * 100) : 0}%</div>
        </div>

        <div className="stat bg-base-100 rounded-lg shadow-sm">
          <div className="stat-figure text-warning">
            ⏳
          </div>
          <div className="stat-title">{t('campaign.pending')}</div>
          <div className="stat-value text-warning">{remainingRecipients || 0}</div>
          <div className="stat-desc text-warning">{100 - (isNaN(progressPercentage) ? 0 : progressPercentage)}%</div>
        </div>
      </div>

      {/* Campaign Info & Wallet */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Campaign Info */}
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body">
            <h2 className="card-title flex items-center gap-2">
              <span>ℹ️</span>
              {t('campaign.campaignInfo')}
            </h2>
            <div className="space-y-4">
              {/* Main information */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-base-content/70">{t('campaign.campaignStatus')}:</span>
                  <div>{getStatusBadge(campaign.status)}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-base-content/70">{t('campaign.blockchainNetwork')}:</span>
                  <div>
                    {(() => {
                      const chain = getChainByName(campaign.chain);
                      if (chain) {
                        return (
                          <div className="badge text-xs font-medium px-2 py-1 gap-1 border-0" style={{
                            backgroundColor: `${chain.color}20`,
                            color: chain.color,
                            border: `1px solid ${chain.color}40`
                          }}>
                            {chain.name}
                          </div>
                        );
                      } else {
                        return (
                          <div className="badge badge-neutral">
                            {campaign.chain || 'Unknown Chain'}
                          </div>
                        );
                      }
                    })()}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-base-content/70">{t('campaign.airdropTotal')}:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-primary">
                      {totalAirdropAmount}
                    </span>
                    <span className="text-sm text-base-content/70">{campaign.tokenSymbol || 'tokens'}</span>
                  </div>
                </div>
              </div>

              {/* Secondary information */}
              <div className="divider"></div>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-base-content/70">{t('campaign.campaignId')}:</span>
                  <div className="text-sm font-mono bg-base-200 px-2 py-1 rounded">
                    {campaign.id && typeof campaign.id === 'string' ? campaign.id : campaign.id && typeof campaign.id === 'number' ? String(campaign.id) : 'N/A'}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-base-content/70">{t('campaign.createdAt')}:</span>
                  <span className="text-sm">{formatDate(campaign.createdAt)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-base-content/70">{t('campaign.tokenContract')}:</span>
                  <span className="text-sm font-mono bg-base-200 px-2 py-1 rounded whitespace-nowrap">
                    {campaign.tokenAddress}
                  </span>
                </div>
                {campaign.contractAddress && (
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-base-content/70">{t('campaign.batchContract')}:</span>
                    <span className="text-sm font-mono bg-base-200 px-2 py-1 rounded whitespace-nowrap">
                      {campaign.contractAddress}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Wallet */}
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body">
            <h2 className="card-title flex items-center gap-2">
              <span>💳</span>
              {t('campaign.campaignWallet')}
            </h2>
            <div className="space-y-4">
              <div>
                <div className="text-sm font-medium mb-2">{t('campaign.walletAddress')}</div>
                <div className="text-sm font-mono bg-base-200 px-2 py-1 rounded">
                  {campaign.walletAddress}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-medium">{t('campaign.currentBalance')}</div>
                  <button
                    onClick={refreshBalances}
                    disabled={isRefreshingBalance}
                    className="btn btn-ghost btn-xs"
                  >
                    {isRefreshingBalance ? (
                      <span className="loading loading-spinner loading-xs"></span>
                    ) : (
                      `🔄 ${t('campaign.refresh')}`
                    )}
                  </button>
                </div>
                <div className="space-y-4">
                  {/* Native Currency Balance (e.g., ETH, BNB, MATIC) */}
                  <div className="p-3 bg-base-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 rounded-full bg-success"></div>
                      <span className="text-sm font-medium">
                        {(() => {
                          const chain = getChainByName(campaign.chain);
                          return chain ? chain.symbol : 'Native';
                        })()}
                      </span>
                    </div>
                    <div className="text-lg font-bold">
                      {parseFloat(walletBalances.native.current).toFixed(4)} {(() => {
                      const chain = getChainByName(campaign.chain);
                      return chain ? chain.symbol : 'ETH';
                    })()}
                    </div>
                  </div>

                  {/* Token Balance - Only show for non-native tokens */}
                  {!isNativeToken(campaign.tokenAddress) && (
                    <div className="p-3 bg-base-200 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-2 h-2 rounded-full bg-primary"></div>
                        <span className="text-sm font-medium">{campaign.tokenSymbol}</span>
                      </div>
                      <div className="text-lg font-bold">
                        {parseFloat(walletBalances.token.current).toFixed(4)} {campaign.tokenSymbol}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="divider"></div>
              <div>
                <div className="text-sm text-base-content/60 mb-2">{t('campaign.privateKeyManagement')}</div>

                {campaign.walletPrivateKeyBase64 ? (
                  <>
                    <div className="alert alert-success">
                      <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div>
                        <div className="text-sm font-medium">{t('campaign.privateKeySaved')}</div>
                        <div className="text-xs">{t('campaign.canExportPrivateKey')}</div>
                      </div>
                    </div>
                    <button
                      onClick={handleExportPrivateKey}
                      className="btn btn-primary btn-sm w-full mt-3"
                    >
                      🔑 {t('campaign.exportPrivateKey')}
                    </button>

                    {/* Withdrawal buttons */}
                    <div className="divider my-3"></div>
                    <div className="text-sm text-base-content/60 mb-2">{t('campaign.fundsWithdrawal')}</div>
                    {/* Check if it's native token */}
                    {!isNativeToken(campaign.tokenAddress) ? (
                      // Non-native token: Show two buttons
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => handleOpenWithdrawModal('tokens')}
                          className="btn btn-warning btn-sm"
                        >
                          💰 {t('campaign.withdrawTokens')}
                        </button>
                        <button
                          onClick={() => handleOpenWithdrawModal('native')}
                          className="btn btn-warning btn-sm"
                        >
                          💎 {t('campaign.withdrawNative')}
                        </button>
                      </div>
                    ) : (
                      // Native token: Only show withdraw native token button
                      <button
                        onClick={() => handleOpenWithdrawModal('native')}
                        className="btn btn-warning btn-sm w-full"
                      >
                        💎 {t('campaign.withdrawNative')}
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <div className="alert alert-error">
                      <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div>
                        <div className="text-sm font-medium">{t('campaign.privateKeyLost')}</div>
                        <div className="text-xs">{t('campaign.privateKeyNotSaved')}</div>
                      </div>
                    </div>
                    <button
                      className="btn btn-disabled btn-sm w-full mt-3"
                      title={t('campaign.privateKeyUnavailable')}
                      disabled
                    >
                      🔑 {t('campaign.privateKeyUnavailable')}
                    </button>
                  </>
                )}
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
              {t('campaign.transactionRecords')}
            </h2>
            <div className="flex gap-2">
              <button onClick={handleExportTransactions} className="btn btn-ghost btn-sm">📥 {t('campaign.export')}</button>
              <button onClick={handleRefreshTransactions} className="btn btn-ghost btn-sm">🔄 {t('campaign.refresh')}</button>
              <button
                onClick={handleToggleFilter}
                className={`btn btn-sm ${showFailedOnly ? 'btn-error' : 'btn-ghost'}`}
              >
                {showFailedOnly ? `✓ ${t('campaign.showFailedOnly')}` : `❌ ${t('campaign.showFailedOnly')}`}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr className="border-b border-base-300">
                  <th className="bg-base-200">{t('campaign.batch')}</th>
                  <th className="bg-base-200">{t('campaign.status')}</th>
                  <th className="bg-base-200">{t('campaign.addressCount')}</th>
                  <th className="bg-base-200">{t('campaign.txHash')}</th>
                  <th className="bg-base-200">{t('campaign.gasUsed')}</th>
                  <th className="bg-base-200">{t('campaign.txTime')}</th>
                  <th className="bg-base-200 text-center">{t('campaign.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {paginatedTransactions.map((tx) => (
                  <tr key={tx.id} className="hover border-b border-base-200">
                    <td className="py-4">
                      <div className="font-bold text-base">#{tx.batchNumber}</div>
                    </td>
                    <td className="py-4">
                      {tx.status === 'success' && <div className="badge badge-success gap-1">✅ {t('common.success')}</div>}
                      {tx.status === 'sending' && <div className="badge badge-info gap-1">🔄 {t('common.sending')}</div>}
                      {tx.status === 'pending' && <div className="badge badge-warning gap-1">⏳ {t('campaign.pending')}</div>}
                      {tx.status === 'failed' && <div className="badge badge-error gap-1">❌ {t('common.failed')}</div>}
                    </td>
                    <td className="py-4">
                      <div className="font-medium">{tx.addressCount}</div>
                    </td>
                    <td className="py-4 max-w-xs">
                      {tx.txHash ? (
                        <a
                          href={getTransactionUrl(tx.txHash)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="link link-primary link-hover text-sm font-mono truncate block"
                        >
                          {tx.txHash.slice(0, 10)}...{tx.txHash.slice(-8)}
                        </a>
                      ) : (
                        <span className="text-base-content/40">-</span>
                      )}
                    </td>
                    <td className="py-4">
                      {tx.gasUsed ? (
                        <span className="text-sm">{tx.gasUsed}</span>
                      ) : (
                        <span className="text-base-content/40">-</span>
                      )}
                    </td>
                    <td className="py-4">
                      <div className="text-sm text-base-content/70 whitespace-nowrap">{formatDate(tx.createdAt)}</div>
                    </td>
                    <td className="py-4 text-center">
                      <div className="flex gap-2 justify-center">
                        {tx.txHash && (
                          <a
                            href={getTransactionUrl(tx.txHash)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-ghost btn-sm"
                            title={t('campaign.viewInExplorer')}
                          >
                            🔍
                          </a>
                        )}
                        {tx.status === 'failed' && (
                          <button
                            className="btn btn-ghost btn-sm"
                            title={t('campaign.resend')}
                            onClick={() => {
                              alert(t('campaign.resendPending'));
                            }}
                          >
                            🔄
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between items-center mt-6">
            <div className="text-sm text-base-content/60">
              {formatPaginationInfo(txCurrentPage, transactions)}
            </div>
            {renderPagination(txCurrentPage, txTotalPages, setTxCurrentPage)}
          </div>
        </div>
      </div>

      {/* Recipients */}
      <div className="card bg-base-100 shadow-sm">
        <div className="card-body">
          <div className="flex justify-between items-center mb-6">
            <h2 className="card-title flex items-center gap-2">
              <span>👥</span>
              {t('campaign.recipientList')}
            </h2>
            <div className="flex gap-2">
              <button onClick={handleExportRecipients} className="btn btn-primary btn-sm">📥 {t('campaign.exportCSV')}</button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr className="border-b border-base-300">
                  <th className="bg-base-200">{t('campaign.address')}</th>
                  <th className="bg-base-200">{t('campaign.amount')}</th>
                  <th className="bg-base-200">{t('campaign.status')}</th>
                  <th className="bg-base-200">{t('campaign.txHash')}</th>
                  <th className="bg-base-200">{t('campaign.txTime')}</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRecipients.map((recipient, index) => (
                  <tr key={`${recipient.address}-${index}`} className="hover border-b border-base-200">
                    <td className="py-4 max-w-md">
                      <div className="font-mono text-sm bg-base-200 px-3 py-2 rounded whitespace-normal break-all">
                        {recipient.address}
                      </div>
                    </td>
                    <td className="py-4">
                      <div className="font-medium">{recipient.amount}</div>
                    </td>
                    <td className="py-4">
                      {recipient.status === 'success' && <div className="badge badge-success gap-1">✅</div>}
                      {recipient.status === 'sending' && <div className="badge badge-info gap-1">🔄</div>}
                      {recipient.status === 'pending' && <div className="badge badge-warning gap-1">⏳</div>}
                      {recipient.status === 'failed' && <div className="badge badge-error gap-1">❌</div>}
                    </td>
                    <td className="py-4 max-w-xs">
                      {recipient.txHash ? (
                        <a
                          href={getTransactionUrl(recipient.txHash)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="link link-primary link-hover text-sm font-mono truncate block"
                        >
                          {recipient.txHash.slice(0, 10)}...{recipient.txHash.slice(-8)}
                        </a>
                      ) : (
                        <span className="text-base-content/40">-</span>
                      )}
                    </td>
                    <td className="py-4">
                      <div className="text-sm text-base-content/70 whitespace-nowrap">
                        {recipient.updatedAt ? formatDate(recipient.updatedAt) :
                         recipient.createdAt ? formatDate(recipient.createdAt) : '-'}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between items-center mt-6">
            <div className="text-sm text-base-content/60">
              {formatPaginationInfo(recipientsCurrentPage, recipients)}
            </div>
            {renderPagination(recipientsCurrentPage, recipientsTotalPages, setRecipientsCurrentPage)}
          </div>
        </div>
      </div>

      {/* Private Key Export Modal */}
      {showPrivateKeyModal && exportedWallet && (
        <div className="modal modal-open">
          <div className="modal-box max-w-2xl">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <span>🔑</span>
              <span>{t('campaign.exportPrivateKey')}</span>
            </h3>

            {/* Warning Alert */}
            <div className="alert alert-warning mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <span className="text-sm">
                <strong>{t('campaign.securityWarning')}</strong>{t('campaign.securityWarningText')}
              </span>
            </div>

            {/* Wallet Address */}
            <div className="mb-4">
              <label className="label">
                <span className="label-text font-semibold">{t('campaign.walletAddress')}</span>
              </label>
              <div className="flex gap-2">
                <div className="flex-1 bg-base-200 px-4 py-3 rounded-lg font-mono text-sm break-all">
                  {exportedWallet.address}
                </div>
                <button
                  onClick={handleCopyAddress}
                  className="btn btn-square btn-outline"
                  title={t('wallet.copyAddress')}
                >
                  📋
                </button>
              </div>
            </div>

            {/* Private Key */}
            <div className="mb-6">
              <label className="label">
                <span className="label-text font-semibold">{t('campaign.privateKeyLabel')}</span>
              </label>
              <div className="flex gap-2">
                <div className="flex-1 bg-error/10 border-2 border-error/30 px-4 py-3 rounded-lg font-mono text-sm break-all">
                  {exportedWallet.privateKey}
                </div>
                <button
                  onClick={handleCopyPrivateKey}
                  className={`btn btn-square ${copied ? 'btn-success' : 'btn-error'}`}
                  title={t('campaign.copyPrivateKey')}
                >
                  {copied ? '✓' : '📋'}
                </button>
              </div>
              {copied && (
                <div className="text-success text-sm mt-2 flex items-center gap-1">
                  <span>✓</span>
                  <span>{t('campaign.privateKeyCopied')}</span>
                </div>
              )}
            </div>

            {/* Security Tips */}
            <div className="bg-base-200 p-4 rounded-lg mb-4">
              <h4 className="font-semibold mb-2 text-sm">{t('campaign.securityTips')}</h4>
              <ul className="text-sm space-y-1 text-base-content/80">
                <li>• {t('campaign.securityTip1')}</li>
                <li>• {t('campaign.securityTip2')}</li>
                <li>• {t('campaign.securityTip3')}</li>
                <li>• {t('campaign.securityTip4')}</li>
                <li>• {t('campaign.securityTip5')}</li>
                <li>• {t('campaign.securityTip6')}</li>
              </ul>
            </div>

            {/* Modal Actions */}
            <div className="modal-action">
              <button onClick={handleCloseModal} className="btn btn-primary">
                {t('campaign.savedSecurely')}
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={handleCloseModal}></div>
        </div>
      )}

      {/* Contract Deployment Modal */}
      {showDeploymentModal && (
        <div className="modal modal-open">
          <div className="modal-box max-w-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <span>🚀</span>
                {t('campaign.deploymentStatus')}
              </h3>
              <button
                onClick={() => setShowDeploymentModal(false)}
                className="btn btn-sm btn-circle btn-ghost"
                disabled={isDeploying}
              >
                ✕
              </button>
            </div>

            {/* Progress Section */}
            <div className="mb-6">
              <div className="flex items-center gap-3">
                {isDeploying && (
                  <div className="loading loading-spinner loading-sm"></div>
                )}
                <div className={`text-sm ${isDeploying ? 'text-info' : deploymentError ? 'text-error' : 'text-success'}`}>
                  {deploymentProgress}
                </div>
              </div>

              {/* Progress Bar */}
              {isDeploying && (
                <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                  <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{ width: '60%' }}></div>
                </div>
              )}
            </div>

            {/* Error Section */}
            {deploymentError && (
              <div className="alert alert-error mb-6">
                <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <h3 className="font-bold">{t('campaign.deploymentFailedTitle')}</h3>
                  <div className="text-sm mt-1">{deploymentError}</div>
                </div>
              </div>
            )}

            {/* Success Section */}
            {deploymentResult && (
              <div className="alert alert-success mb-6">
                <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <h3 className="font-bold">{t('campaign.deploymentSuccessTitle')}</h3>
                  <div className="text-sm mt-1">
                    <div className="mb-1">
                      <strong>{t('campaign.contractAddressLabel')}</strong>
                      <div className="font-mono text-xs bg-success/10 p-1 rounded mt-1 break-all">
                        {deploymentResult.contractAddress}
                      </div>
                    </div>
                    <div>
                      <strong>{t('campaign.txHashLabel')}</strong>
                      <div className="font-mono text-xs bg-success/10 p-1 rounded mt-1 break-all">
                        {deploymentResult.transactionHash}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="modal-action">
              {deploymentError && (
                <button
                  onClick={() => {
                    setShowDeploymentModal(false);
                    setDeploymentError(null);
                  }}
                  className="btn"
                  disabled={isDeploying}
                >
                  {t('common.close')}
                </button>
              )}

              {deploymentResult && (
                <>
                  <button
                    onClick={() => {
                      // Copy contract address to clipboard
                      navigator.clipboard.writeText(deploymentResult.contractAddress);
                    }}
                    className="btn btn-success"
                  >
                    📋 {t('campaign.copyContractAddress')}
                  </button>
                  <button
                    onClick={() => {
                      setShowDeploymentModal(false);
                      setDeploymentResult(null);
                    }}
                    className="btn"
                  >
                    {t('campaign.done')}
                  </button>
                </>
              )}

              {!deploymentError && !deploymentResult && (
                <button
                  onClick={() => setShowDeploymentModal(false)}
                  className="btn"
                  disabled={isDeploying}
                >
                  {t('common.cancel')}
                </button>
              )}
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => !isDeploying && setShowDeploymentModal(false)}></div>
        </div>
      )}

      {/* Withdrawal Modal */}
      {showWithdrawModal && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4">
              {withdrawType === 'tokens' ? `💰 ${t('campaign.withdrawRemainingTokens')}` : `💎 ${t('campaign.withdrawRemainingNative')}`}
            </h3>

            {/* Warning */}
            <div className="alert alert-warning mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="text-sm">
                {withdrawType === 'tokens'
                  ? `${t('campaign.withdrawTokensWarning')} ${campaign?.tokenSymbol} ${t('campaign.tokensSuffix')}`
                  : t('campaign.withdrawNativeWarning')}
              </span>
            </div>

            {/* Current Balance */}
            <div className="bg-base-200 p-3 rounded-lg mb-4">
              <div className="text-sm text-base-content/60">{t('campaign.currentBalance')}</div>
              <div className="text-lg font-bold">
                {withdrawType === 'tokens'
                  ? `${parseFloat(walletBalances.token.current).toFixed(4)} ${campaign?.tokenSymbol}`
                  : `${parseFloat(walletBalances.native.current).toFixed(6)} ${getNativeTokenSymbol(campaign.chain)}`}
              </div>
            </div>

            {/* Recipient Address Input */}
            <div className="form-control w-full mb-4">
              <label className="label">
                <span className="label-text font-medium">{t('campaign.recipientAddress')}</span>
              </label>
              <input
                type="text"
                placeholder={t('campaign.enterRecipient')}
                className="input input-bordered w-full"
                value={withdrawRecipient}
                onChange={(e) => setWithdrawRecipient(e.target.value)}
                disabled={isWithdrawing}
              />
            </div>

            {/* Modal Actions */}
            <div className="modal-action">
              <button
                onClick={() => setShowWithdrawModal(false)}
                className="btn"
                disabled={isWithdrawing}
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleWithdraw}
                className="btn btn-warning"
                disabled={isWithdrawing || !withdrawRecipient}
              >
                {isWithdrawing ? t('campaign.processing') : t('campaign.confirmWithdrawal')}
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => !isWithdrawing && setShowWithdrawModal(false)}></div>
        </div>
      )}
    </div>
  );
}
// End