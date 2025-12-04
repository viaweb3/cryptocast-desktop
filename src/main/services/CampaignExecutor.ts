import { ContractService } from './ContractService';
import { WalletService } from './WalletService';
import { GasService } from './GasService';
import { BlockchainService } from './BlockchainService';
import { SolanaService } from './SolanaService';
import { ChainUtils } from '../utils/chain-utils';
import { RetryUtils } from '../utils/retry-utils';
import { TransactionUtils } from '../utils/transaction-utils';
import { Logger } from '../utils/logger';
import { isNativeToken } from '../config/constants';
import type { DatabaseManager } from '../database/sqlite-schema';
import type { DatabaseAdapter } from '../database/db-adapter';
import BigNumber from 'bignumber.js';
import { ethers } from 'ethers';

const logger = Logger.getInstance().child('CampaignExecutor');


export interface ExecutionProgress {
  campaignId: string;
  totalRecipients: number;
  completedRecipients: number;
  failedRecipients: number;
  status: 'EXECUTING' | 'PAUSED' | 'COMPLETED' | 'FAILED';
  currentBatch: number;
  totalBatches: number;
}

export interface Recipient {
  address: string;
  amount: string;
  status: string;
}

export class CampaignExecutor {
  private db: DatabaseAdapter;
  private contractService: ContractService;
  private walletService: WalletService;
  private gasService: GasService;
  private blockchainService: BlockchainService;
  private solanaService: SolanaService;
  private executionMap: Map<string, boolean> = new Map(); // Track active executions
  private pauseMap: Map<string, boolean> = new Map(); // Track pause requests

  constructor(databaseManager: DatabaseManager) {
    this.db = databaseManager.getDatabase();
    this.contractService = new ContractService();
    this.walletService = new WalletService();
    this.gasService = new GasService();
    this.blockchainService = new BlockchainService();
    this.solanaService = new SolanaService();
    logger.info('CampaignExecutor initialized');
  }

  /**
   * Execute campaign batch transfers
   */
  async executeCampaign(
    campaignId: string,
    onProgress?: (progress: ExecutionProgress) => void
  ): Promise<void> {
    logger.info('Starting campaign execution', { campaignId });

    // Check if already executing
    if (this.executionMap.get(campaignId)) {
      throw new Error('Campaign is already executing');
    }

    try {
      this.executionMap.set(campaignId, true);
      this.pauseMap.set(campaignId, false);

      // Get campaign details
      const campaign = await this.getCampaign(campaignId);
      if (!campaign) {
        throw new Error('Campaign not found');
      }

      // Validate campaign status
      if (campaign.status !== 'READY' && campaign.status !== 'PAUSED') {
        throw new Error(`Campaign must be in READY or PAUSED status to execute (current: ${campaign.status})`);
      }

      // Prepare wallet with private key
      if (!campaign.walletPrivateKeyBase64) {
        throw new Error('Campaign wallet private key missing');
      }

      // For Solana, keep base64 format; for EVM, export to hex format
      const isSolana = ChainUtils.isSolanaChain(campaign.chain);
      const privateKey = isSolana
        ? campaign.walletPrivateKeyBase64 // Keep base64 for Solana
        : this.walletService.exportEVMPrivateKey(campaign.walletPrivateKeyBase64); // Export to hex for EVM
      const wallet = { privateKey };

      // Get pending recipients
      const recipients = await this.getPendingRecipients(campaignId);
      if (recipients.length === 0) {
        await this.updateCampaignStatus(campaignId, 'COMPLETED');
        return;
      }

      // Calculate batches
      const totalBatches = Math.ceil(recipients.length / campaign.batchSize);

      // Update campaign status
      await this.updateCampaignStatus(campaignId, 'SENDING');

      // Ensure unlimited approval for EVM chains before starting batches
      // Skip approval for native tokens (ETH/BNB/MATIC/etc)
      if (!ChainUtils.isSolanaChain(campaign.chain) && !isNativeToken(campaign.tokenAddress)) {
        await this.ensureUnlimitedApproval(campaign, wallet);
      }

      // Process batches using pre-allocated batches
      let batchNumber = 1;
      while (true) {
        // Check for pause request
        if (this.pauseMap.get(campaignId)) {
          await this.updateCampaignStatus(campaignId, 'PAUSED');
          logger.info(`Campaign paused at batch ${batchNumber}`);
          break;
        }

        // Get next batch
        const batchData = await this.getNextBatchRecipients(campaignId);
        if (!batchData) {
          logger.info('No more batches to process. Completed all batches.');
          break;
        }

        const { recipients: batch } = batchData;

        // Pre-batch balance check for EVM chains
        if (!ChainUtils.isSolanaChain(campaign.chain)) {
          try {
            const rpcUrl = await this.getRpcUrlForChain(campaign.chain);
            const provider = new ethers.JsonRpcProvider(rpcUrl);
            const walletInstance = new ethers.Wallet(wallet.privateKey, provider);

            // Check native balance for gas
            const nativeBalance = await provider.getBalance(walletInstance.address);
            logger.debug(`[Batch ${batchNumber}] Native balance: ${ethers.formatEther(nativeBalance)} ETH`);

            // Early warning if balance is running low
            if (nativeBalance < ethers.parseEther("0.001")) { // Less than 0.001 ETH
              console.warn(`[Batch ${batchNumber}] ⚠️ Low native balance warning: ${ethers.formatEther(nativeBalance)} ETH remaining`);
            }
          } catch (balanceError) {
            console.warn(`[Batch ${batchNumber}] Balance check failed:`, balanceError);
          }
        }

        try {
          // Execute batch transfer directly without retry to avoid duplicate transactions
          // For financial operations, we prefer safety over automatic retry
          logger.info(`[Batch ${batchNumber}] Executing pre-allocated batch of ${batch.length} recipients`);

          const result = await this.executeBatch(
            campaignId,
            campaign,
            batch,
            wallet,
            batchNumber,
            totalBatches
          );

          // Batch update recipient status to SENT and set transaction hash
          await this.updateRecipientStatusesTransaction(
            campaignId,
            batch.map(r => ({ address: r.address, status: 'SENT', txHash: result.txHash }))
          );

          // Update progress
          const completedCount = await this.getCompletedRecipientCount(campaignId);
          const failedCount = await this.getFailedRecipientCount(campaignId);

          if (onProgress) {
            onProgress({
              campaignId,
              totalRecipients: recipients.length,
              completedRecipients: completedCount,
              failedRecipients: failedCount,
              status: 'EXECUTING',
              currentBatch: batchNumber,
              totalBatches,
            });
          }

          batchNumber++; // Increment for next iteration

          // Small delay between batches to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          const errorStack = error instanceof Error ? error.stack : undefined;

          console.error(`❌ [Batch ${batchNumber}] Failed permanently:`, {
            error: errorMessage,
            stack: errorStack,
            batchSize: batch.length,
            campaignId,
            chain: campaign.chain
          });

          // Batch update recipient status to FAILED
          await this.updateRecipientStatusesTransaction(
            campaignId,
            batch.map(r => ({ address: r.address, status: 'FAILED', txHash: undefined }))
          );

          // Enhanced error categorization for financial operations
          let errorCategory = 'UNKNOWN_ERROR';
          let isRetryableManually = false;
          let suggestedAction = '';

          if (errorMessage.includes('insufficient funds')) {
            errorCategory = 'INSUFFICIENT_BALANCE';
            suggestedAction = 'STOP_CAMPAIGN'; // Stop immediately to prevent fund loss
          } else if (errorMessage.includes('gas')) {
            errorCategory = 'GAS_ERROR';
            isRetryableManually = true;
            suggestedAction = 'ADJUST_GAS';
          } else if (errorMessage.includes('nonce')) {
            errorCategory = 'NONCE_ERROR';
            isRetryableManually = true;
            suggestedAction = 'CHECK_NONCE';
          } else if (errorMessage.includes('network') || errorMessage.includes('timeout')) {
            errorCategory = 'NETWORK_ERROR';
            isRetryableManually = true;
            suggestedAction = 'WAIT_AND_RETRY';
          } else if (errorMessage.includes('revert')) {
            errorCategory = 'CONTRACT_REVERT';
            suggestedAction = 'CHECK_CONTRACT'; // Might need contract investigation
          }

          // Batch update of recipient status has been completed in the transaction above

          // Increment batch number even on error
          batchNumber++;

          // Provide specific guidance based on error type
          console.error(`❌ [Batch ${batchNumber - 1}] Failed with ${errorCategory}: ${errorMessage}`);

          switch (suggestedAction) {
            case 'STOP_CAMPAIGN':
              console.error(`🛑 [Batch ${batchNumber - 1}] CRITICAL: Insufficient funds detected.`);
              console.error(`💡 Recommendation: Add more funds to wallet before retrying failed batches`);
              console.error(`💡 Use the "Retry Failed Transactions" feature after adding funds`);
              break;
            case 'ADJUST_GAS':
              console.error(`⚙️ [Batch ${batchNumber - 1}] Gas-related error detected.`);
              console.error(`💡 Recommendation: Wait for gas prices to decrease or manually retry with higher gas`);
              break;
            case 'CHECK_NONCE':
              console.error(`🔢 [Batch ${batchNumber - 1}] Nonce issue detected.`);
              console.error(`💡 Recommendation: Wait a few minutes and manually retry this batch`);
              break;
            case 'WAIT_AND_RETRY':
              console.error(`🌐 [Batch ${batchNumber - 1}] Network issue detected.`);
              console.error(`💡 Recommendation: Wait for network stability and manually retry this batch`);
              break;
            case 'CHECK_CONTRACT':
              console.error(`📋 [Batch ${batchNumber - 1}] Contract execution failed.`);
              console.error(`💡 Recommendation: Verify contract state and token balances`);
              break;
            default:
              console.error(`❓ [Batch ${batchNumber - 1}] Unknown error. Manual investigation required`);
          }

          // For critical errors, consider stopping the campaign
          if (suggestedAction === 'STOP_CAMPAIGN') {
            console.error(`🚨 [Batch ${batchNumber - 1}] Campaign execution stopped due to critical error`);
            await this.updateCampaignStatus(campaignId, 'PAUSED');
            logger.info('Campaign has been paused. Fix the issue and use "Resume Campaign" to continue');
            break; // Exit the batch processing loop
          }

          // For other errors, continue to next batch
          logger.warn(`[Batch ${batchNumber - 1}] Continuing to next batch. Manual retry recommended for failed batch.`);
        }
      }

      // Final status update
      const finalCompleted = await this.getCompletedRecipientCount(campaignId);
      const finalFailed = await this.getFailedRecipientCount(campaignId);
      const finalPending = await this.getPendingRecipientCount(campaignId);

      if (finalPending === 0) {
        if (finalFailed === 0) {
          await this.updateCampaignStatus(campaignId, 'COMPLETED');
          // Campaign completed successfully
          logger.info(`Campaign completed successfully. ${finalCompleted} recipients processed.`);
        } else {
          await this.updateCampaignStatus(campaignId, 'COMPLETED');
          // Campaign completed with errors
          logger.warn(`Campaign completed with errors. ${finalCompleted} succeeded, ${finalFailed} failed.`);
        }
      }

    } catch (error) {
      console.error('[CampaignExecutor] ❌ Campaign execution failed:', {
        campaignId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      await this.updateCampaignStatus(campaignId, 'FAILED');

      // Re-throw with more context
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Campaign execution failed: ${errorMessage}`);
    } finally {
      this.executionMap.delete(campaignId);
      this.pauseMap.delete(campaignId);
    }
  }

  /**
   * Execute a single batch of transfers
   */
  private async executeBatch(
    campaignId: string,
    campaign: any,
    recipients: Recipient[],
    wallet: any,
    batchNumber: number,
    totalBatches: number
  ): Promise<{ txHash: string; gasUsed: number }> {
    // Normalize addresses based on chain type
    const isSolana = ChainUtils.isSolanaChain(campaign.chain);
    const addresses = isSolana
      ? recipients.map(r => r.address) // Solana addresses don't need normalization
      : recipients.map(r => ethers.getAddress(r.address.toLowerCase())); // EVM addresses need checksum
    const amounts = recipients.map(r => r.amount);

    try {
      // Get RPC URL based on chain
      const rpcUrl = await this.getRpcUrlForChain(campaign.chain);

      let result;

      if (isSolana) {
        // Solana batch transfer - direct transfer, no approval and contract needed
        result = await this.solanaService.batchTransfer(
          rpcUrl,
          wallet.privateKey,
          addresses,
          amounts,
          campaign.tokenAddress,
          campaign.batchSize  // Pass user-set batch size
        );
      } else {
        // EVM batch transfer process
        result = await this.contractService.batchTransfer(
          campaign.contractAddress,
          rpcUrl,
          wallet.privateKey,
          addresses,
          amounts,
          campaign.tokenAddress
        );
      }

      // Record batch transfer transaction
      // Calculate total amount using BigNumber to avoid precision loss
      const totalAmount = amounts.reduce((sum, amt) => {
        return sum.plus(new BigNumber(amt || '0'));
      }, new BigNumber(0)).toString();

      await this.recordTransaction(campaignId, {
        txHash: result.transactionHash,
        txType: 'BATCH_SEND',
        fromAddress: campaign.walletAddress || '',
        toAddress: campaign.contractAddress,
        amount: totalAmount,
        gasUsed: parseFloat(result.gasUsed || '0'),
        status: 'PENDING'
      });

      // Batch sent
      logger.info(`Batch ${batchNumber}/${totalBatches} sent. Tx: ${result.transactionHash}`);

      // Wait for transaction confirmation with adaptive timeout
      const confirmationOptions = {
        adaptiveTimeout: true,
        networkCongestionMultiplier: 1.2,
        maxWaitTime: ChainUtils.isSolanaChain(campaign.chain) ? 60000 : 300000
      };

      const getStatus = ChainUtils.isSolanaChain(campaign.chain)
        ? (txHash: string) => this.solanaService.getTransactionStatus(rpcUrl, txHash)
        : (txHash: string) => this.blockchainService.getTransactionStatus(txHash, campaign.chain, rpcUrl);

      const confirmationResult = await TransactionUtils.waitForTransactionConfirmation(
        campaign.chain,
        result.transactionHash,
        getStatus,
        confirmationOptions
      );

      // Update batch transfer transaction status
      await this.updateTransactionStatus(
        result.transactionHash,
        confirmationResult.confirmed ? 'CONFIRMED' : 'FAILED',
        confirmationResult.transactionData?.blockNumber,
        confirmationResult.transactionData?.blockHash
      );

      if (confirmationResult.confirmed) {
        // Batch confirmed - recipient status will be updated in the main execution loop
        logger.info(`Batch ${batchNumber}/${totalBatches} confirmed. Attempts: ${confirmationResult.attempts}, Time: ${confirmationResult.totalTime}ms`);
      } else {
        // Transaction failed or timeout - recipient status will be updated in the main execution loop
        const errorMessage = confirmationResult.finalStatus === 'failed'
          ? 'Transaction failed'
          : 'Transaction confirmation timeout';
        console.error(`Batch ${batchNumber}/${totalBatches} failed: ${errorMessage}`);
      }

      // Update campaign gas costs
      if (ChainUtils.isSolanaChain(campaign.chain)) {
        // Solana gas fees are in lamports, convert to SOL
        this.updateCampaignGasCost(campaignId, result.gasUsed.toString());
      } else {
        // EVM gas fees
        this.updateCampaignGasCost(campaignId, result.gasUsed.toString());
      }

      // Batch confirmed
      logger.info(`Batch ${batchNumber}/${totalBatches} confirmed. Gas used: ${result.gasUsed}`);

      // Return transaction information for batch status tracking
      return {
        txHash: result.transactionHash,
        gasUsed: parseFloat(result.gasUsed || '0')
      };

    } catch (error) {
      console.error('Batch execution failed:', error);
      throw error;
    }
  }

  /**
   * Request pause for campaign execution
   */
  pauseExecution(campaignId: string): void {
    this.pauseMap.set(campaignId, true);
    logger.info(`Pause requested for campaign ${campaignId}`);
  }

  /**
   * Resume paused campaign execution
   */
  async resumeExecution(campaignId: string): Promise<void> {
    this.pauseMap.set(campaignId, false);
    logger.info(`Resume requested for campaign ${campaignId}`);

    // Check if campaign is actually paused and has pending recipients
    const campaign = await this.getCampaign(campaignId);
    if (!campaign) {
      console.error(`Campaign ${campaignId} not found for resume`);
      return;
    }

    if (campaign.status !== 'PAUSED') {
      console.warn(`Campaign ${campaignId} is not paused (status: ${campaign.status}), cannot resume`);
      return;
    }

    const pendingRecipients = await this.getPendingRecipients(campaignId);
    if (pendingRecipients.length === 0) {
      logger.info(`Campaign ${campaignId} has no pending recipients, marking as completed`);
      await this.updateCampaignStatus(campaignId, 'COMPLETED');
      return;
    }

    logger.info(`Resuming campaign ${campaignId} with ${pendingRecipients.length} pending recipients`);

    // Re-execute the campaign with remaining recipients
    // This will continue from where it left off since we only get pending recipients
    await this.executeCampaign(campaignId);
  }

  
  /**
   * Check if campaign is currently executing
   */
  isExecuting(campaignId: string): boolean {
    return this.executionMap.get(campaignId) || false;
  }

  /**
   * Ensure unlimited token approval for the campaign contract.
   */
  private async ensureUnlimitedApproval(campaign: any, wallet: any): Promise<void> {
    const rpcUrl = await this.getRpcUrlForChain(campaign.chain);

    // Check for a near-unlimited allowance
    const sufficientAllowance = await this.contractService.checkApproval(
      rpcUrl,
      wallet.privateKey,
      campaign.tokenAddress,
      campaign.contractAddress,
      (ethers.MaxUint256 / 2n).toString() // Check for at least half of max
    );

    if (sufficientAllowance) {
      return;
    }

    // Approve MaxUint256
    const approveTxHash = await this.contractService.approveTokens(
      rpcUrl,
      wallet.privateKey,
      campaign.tokenAddress,
      campaign.contractAddress,
      ethers.MaxUint256.toString()
    );

    // If approval already exists, skip transaction recording and confirmation
    if (approveTxHash === 'already-approved') {
      return;
    }

    // Record approval transaction
    await this.recordTransaction(campaign.id, {
      txHash: approveTxHash,
      txType: 'APPROVE_TOKENS',
      fromAddress: campaign.walletAddress || '',
      toAddress: campaign.contractAddress,
      amount: ethers.MaxUint256.toString(),
      status: 'PENDING'
    });

    // Wait for approval confirmation
    await this.waitForConfirmation(campaign.chain, approveTxHash, rpcUrl);

    // Update approval transaction status
    await this.updateTransactionStatus(approveTxHash, 'CONFIRMED');
  }

  // Helper methods
  private async getCampaign(campaignId: string): Promise<any> {
    const row = await this.db.prepare('SELECT * FROM campaigns WHERE id = ?').get(campaignId);

    if (!row) {
      return null;
    }

    // Map database fields (snake_case) to application fields (camelCase)
    const mapped = {
      id: row.id,
      name: row.name,
      status: row.status,
      chain: row.chain_id?.toString() || '',
      chainType: row.chain_type,
      tokenAddress: row.token_address,
      tokenDecimals: row.token_decimals || 18,
      walletAddress: row.wallet_address,
      walletPrivateKeyBase64: row.wallet_private_key_base64,
      contractAddress: row.contract_address,
      batchSize: row.batch_size || 100,
      sendInterval: row.send_interval || 2000,
      gasUsed: row.total_gas_used || 0
    };

    return mapped;
  }

  private async getPendingRecipients(campaignId: string): Promise<Recipient[]> {
    // Only query PENDING records, do not lock them
    // Locking operations should be done in getNextBatchRecipients
    const pendingRecipients = await this.db.prepare(`
      SELECT id, address, amount, created_at
      FROM recipients
      WHERE campaign_id = ? AND status = 'PENDING'
      ORDER BY batch_number, id
    `).all(campaignId) as Recipient[];

    return pendingRecipients;
  }

  /**
   * Get next batch of recipients
   */
  private async getNextBatchRecipients(campaignId: string): Promise<{
    batchNumber: number;
    recipients: Recipient[];
  } | null> {
    return await this.db.transaction(async (tx) => {
      // Recover stuck PROCESSING records (older than 5 minutes)
      await tx.prepare(`
        UPDATE recipients
        SET status = 'PENDING', updated_at = datetime('now')
        WHERE campaign_id = ? AND status = 'PROCESSING'
        AND datetime(updated_at) < datetime('now', '-5 minutes')
      `).run(campaignId);

      // Get the minimum batch number
      const batchInfo = await tx.prepare(`
        SELECT MIN(batch_number) as next_batch_number
        FROM recipients
        WHERE campaign_id = ? AND status = 'PENDING'
      `).get(campaignId) as any;

      if (!batchInfo || !batchInfo.next_batch_number) {
        return null;
      }

      const nextBatchNumber = batchInfo.next_batch_number;

      // Atomically retrieve and lock all PENDING records for this batch
      const lockedRecipients = await tx.prepare(`
        UPDATE recipients
        SET status = 'PROCESSING', updated_at = datetime('now')
        WHERE campaign_id = ? AND batch_number = ? AND status = 'PENDING'
        RETURNING id, address, amount, created_at
      `).all(campaignId, nextBatchNumber) as Recipient[];

      if (lockedRecipients.length === 0) {
        return null;
      }

      logger.debug(`Retrieved batch ${nextBatchNumber} with ${lockedRecipients.length} recipients`);

      return {
        batchNumber: nextBatchNumber,
        recipients: lockedRecipients
      };
    });
  }

  private async getCompletedRecipientCount(campaignId: string): Promise<number> {
    const result = await this.db.prepare(
      'SELECT COUNT(*) as count FROM recipients WHERE campaign_id = ? AND status = ?'
    ).get(campaignId, 'SENT') as { count: number };
    return result.count;
  }

  private async getFailedRecipientCount(campaignId: string): Promise<number> {
    const result = await this.db.prepare(
      'SELECT COUNT(*) as count FROM recipients WHERE campaign_id = ? AND status = ?'
    ).get(campaignId, 'FAILED') as { count: number };
    return result.count;
  }

  private async getPendingRecipientCount(campaignId: string): Promise<number> {
    const result = await this.db.prepare(
      'SELECT COUNT(*) as count FROM recipients WHERE campaign_id = ? AND status = ?'
    ).get(campaignId, 'PENDING') as { count: number };
    return result.count;
  }

  private async updateCampaignStatus(campaignId: string, status: string): Promise<void> {
    const now = new Date().toISOString();
    await this.db.prepare(
      'UPDATE campaigns SET status = ?, updated_at = ? WHERE id = ?'
    ).run(status, now, campaignId);
  }

  private async updateRecipientStatus(
    campaignId: string,
    address: string,
    status: string,
    txHash?: string
  ): Promise<void> {
    await this.db.prepare(
      'UPDATE recipients SET status = ?, tx_hash = ? WHERE campaign_id = ? AND address = ?'
    ).run(status, txHash || null, campaignId, address);
  }

  private async updateRecipientStatusesTransaction(
    campaignId: string,
    updates: Array<{ address: string; status: string; txHash?: string }>
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      for (const update of updates) {
        await tx.prepare(
          'UPDATE recipients SET status = ?, tx_hash = ?, updated_at = datetime("now") WHERE campaign_id = ? AND address = ? AND status = "PROCESSING"'
        ).run(update.status, update.txHash || null, campaignId, update.address);
      }

      // Update campaigns table with real-time counts
      const counts = await tx.prepare(`
        SELECT
          COUNT(CASE WHEN status = 'SENT' THEN 1 END) as completed,
          COUNT(CASE WHEN status = 'FAILED' THEN 1 END) as failed
        FROM recipients
        WHERE campaign_id = ?
      `).get(campaignId) as any;

      if (counts) {
        await tx.prepare(
          'UPDATE campaigns SET completed_recipients = ?, failed_recipients = ?, updated_at = datetime("now") WHERE id = ?'
        ).run(counts.completed || 0, counts.failed || 0, campaignId);
      }
    });
  }

  private async recoverStuckProcessingRecords(campaignId: string): Promise<void> {
    // Recover stuck PROCESSING records
    await this.db.prepare(`
      UPDATE recipients
      SET status = 'PENDING', updated_at = datetime('now')
      WHERE campaign_id = ? AND status = 'PROCESSING'
      AND datetime(updated_at) < datetime('now', '-10 minutes')
    `).run(campaignId);
  }

  private async updateCampaignGasCost(campaignId: string, gasUsed: string): Promise<void> {
    const campaign = await this.getCampaign(campaignId);
    const newGasUsed = Number(campaign.gasUsed || 0) + Number(gasUsed);

    await this.db.prepare(
      'UPDATE campaigns SET total_gas_used = ? WHERE id = ?'
    ).run(newGasUsed, campaignId);
  }

  private async getRpcUrlForChain(chain: string): Promise<string> {
    if (ChainUtils.isSolanaChain(chain)) {
      const rpc = await this.db.prepare(
        'SELECT rpc_url FROM chains WHERE type = ? ORDER BY name ASC LIMIT 1'
      ).get('solana') as { rpc_url: string } | undefined;
      return rpc?.rpc_url || 'https://api.mainnet-beta.solana.com';
    } else {
      // Try to find chain by chain_id first (most reliable)
      const chainId = parseInt(chain);
      let evmChain;

      if (!isNaN(chainId)) {
        evmChain = await this.db.prepare(
          'SELECT rpc_url FROM chains WHERE type = ? AND chain_id = ?'
        ).get('evm', chainId) as { rpc_url: string } | undefined;
      }

      // Fallback to name-based search
      if (!evmChain) {
        evmChain = await this.db.prepare(
          'SELECT rpc_url FROM chains WHERE type = ? AND name LIKE ?'
        ).get('evm', `%${chain}%`) as { rpc_url: string } | undefined;
      }

      if (!evmChain || !evmChain.rpc_url) {
        throw new Error(`RPC URL not found for chain: ${chain}. Please check chain configuration.`);
      }

      return evmChain.rpc_url;
    }
  }

  private async waitForConfirmation(
    chain: string,
    txHash: string,
    rpcUrl: string,
    maxAttempts: number = 60
  ): Promise<void> {
    if (ChainUtils.isSolanaChain(chain)) {
      return await this.waitForSolanaConfirmation(txHash, rpcUrl);
    } else {
      return await this.waitForEVMConfirmation(txHash, rpcUrl, maxAttempts);
    }
  }

  private async waitForSolanaConfirmation(
    txHash: string,
    rpcUrl: string
  ): Promise<void> {
    const maxWaitTime = 30000; // 30 second timeout
    const checkInterval = 1000; // Check every 1 second
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      try {
        if (this.solanaService) {
          const status = await this.solanaService.getTransactionStatus(rpcUrl, txHash);

          if (status.status === 'confirmed') {
            logger.info(`Solana transaction confirmed: ${txHash}`);
            return;
          } else if (status.status === 'failed') {
            throw new Error(`Solana transaction failed: ${status.error}`);
          }
        }

        // Dynamically adjust check interval - more frequent at start, then reduce
        const elapsed = Date.now() - startTime;
        let nextWaitTime = checkInterval;

        if (elapsed < 5000) {
          nextWaitTime = 500; // Check every 0.5 seconds for first 5 seconds
        } else if (elapsed < 15000) {
          nextWaitTime = 1000; // Check every 1 second for 5-15 seconds
        } else {
          nextWaitTime = 2000; // Check every 2 seconds after 15 seconds
        }

        await new Promise(resolve => setTimeout(resolve, nextWaitTime));
      } catch (error) {
        console.error(`Failed to check Solana transaction status:`, error);

        // Wait briefly before retrying on network errors
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    throw new Error(`Solana transaction confirmation timeout after ${maxWaitTime}ms`);
  }

  private async waitForEVMConfirmation(
    txHash: string,
    rpcUrl: string,
    maxAttempts: number = 60
  ): Promise<void> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const status = await this.blockchainService.getTransactionStatus(txHash, 'ethereum', rpcUrl);

        if (status.status === 'confirmed') {
          return;
        }

        // EVM transaction confirmation is slower, use longer intervals
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.error(`Failed to check EVM transaction status (attempt ${attempt + 1}):`, error);

        if (attempt === maxAttempts - 1) {
          throw new Error('EVM transaction confirmation timeout');
        }
      }
    }

    throw new Error('EVM transaction confirmation timeout');
  }

  /**
   * Record transaction
   */
  private async recordTransaction(campaignId: string, transactionData: {
    txHash: string;
    txType: 'DEPLOY_CONTRACT' | 'TRANSFER_TO_CONTRACT' | 'APPROVE_TOKENS' | 'BATCH_SEND' | 'WITHDRAW_REMAINING';
    fromAddress: string;
    toAddress?: string;
    amount?: string;
    gasUsed?: number;
    status?: 'PENDING' | 'CONFIRMED' | 'FAILED';
  }): Promise<void> {
    try {
      await this.db.prepare(`
        INSERT OR REPLACE INTO transactions (
          campaign_id, tx_hash, tx_type, from_address, to_address, amount,
          gas_used, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        campaignId,
        transactionData.txHash,
        transactionData.txType,
        transactionData.fromAddress,
        transactionData.toAddress || null,
        transactionData.amount || null,
        transactionData.gasUsed || 0,
        transactionData.status || 'PENDING',
        new Date().toISOString()
      );

      logger.debug(`Transaction recorded: ${transactionData.txType} - ${transactionData.txHash}`);
    } catch (error) {
      console.error('Failed to record transaction:', error);
      // Don't throw error - recording transaction failure shouldn't break the main flow
    }
  }

  /**
   * Update transaction status
   */
  private async updateTransactionStatus(
    txHash: string,
    status: 'PENDING' | 'CONFIRMED' | 'FAILED',
    blockNumber?: number,
    blockHash?: string
  ): Promise<void> {
    try {
      const updates: any[] = [status, new Date().toISOString(), txHash];
      let query = `
        UPDATE transactions
        SET status = ?, confirmed_at = ?
      `;

      if (blockNumber) {
        query += `, block_number = ?`;
        updates.splice(-1, 0, blockNumber); // Insert before txHash
      }

      if (blockHash) {
        query += `, block_hash = ?`;
        updates.splice(-1, 0, blockHash); // Insert before txHash
      }

      query += ` WHERE tx_hash = ?`;

      await this.db.prepare(query).run(...updates);
      logger.debug(`Transaction status updated: ${txHash} -> ${status}`);
    } catch (error) {
      console.error('Failed to update transaction status:', error);
    }
  }
}
