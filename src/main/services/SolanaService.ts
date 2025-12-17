import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  LAMPORTS_PER_SOL,
  SystemProgram,
  ComputeBudgetProgram,
  TransactionSignature,
  Commitment,
  TransactionInstruction
} from '@solana/web3.js';
// import { TokenService } from './TokenService';
// import { ChainUtils } from '../utils/chain-utils';
import { DEFAULTS } from '../config/defaults';
import { KeyUtils } from '../utils/keyUtils';
import {
  createTransferInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID
} from '@solana/spl-token';
import BigNumber from 'bignumber.js';
import bs58 from 'bs58';
import { Logger } from '../utils/logger';

const logger = Logger.getInstance().child('SolanaService');

/**
 * Safely convert amount string to lamports/atomic units using BigNumber
 */
function safeAmountToAtomic(amount: string, decimals: number): bigint {
  try {
    // Validate input
    if (!amount || amount.trim() === '') {
      throw new Error('Amount cannot be empty');
    }

    // Use BigNumber for precise decimal calculations
    const amountBN = new BigNumber(amount);

    // Check for negative amounts
    if (amountBN.isNegative()) {
      throw new Error('Amount cannot be negative');
    }

    // Check for invalid number
    if (!amountBN.isFinite()) {
      throw new Error('Amount must be a valid number');
    }

    // Convert to atomic units (lamports for SOL, smallest unit for tokens)
    const multiplier = new BigNumber(10).pow(decimals);
    const atomicAmount = amountBN.multipliedBy(multiplier);

    // Check if it exceeds safe integer range
    if (atomicAmount.isGreaterThan(new BigNumber(Number.MAX_SAFE_INTEGER))) {
      throw new Error('Amount too large');
    }

    // Convert to BigInt and ensure it's an integer
    const atomicBigInt = BigInt(atomicAmount.integerValue().toString());

    return atomicBigInt;
  } catch (error) {
    logger.error('[SolanaService] Failed to convert amount to atomic units', error as Error, {
      amount,
      decimals
    });
    throw new Error(`Invalid amount: ${amount}. ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export interface SolanaBatchTransferResult {
  transactionHash: string;
  totalAmount: string;
  recipientCount: number;
  gasUsed: string;
  status: 'success' | 'partial' | 'failed';
  details?: Array<{
    address: string;
    amount: string;
    status: 'success' | 'failed';
    error?: string;
  }>;
}

export interface SolanaTokenInfo {
  address: string;
  decimals: number;
  symbol?: string;
  isNativeSOL: boolean;
  programId: PublicKey;
}

interface ATAInfo {
  owner: PublicKey;
  ata: PublicKey;
  amount: string;
}

export class SolanaService {
  private connection: Connection | null = null;
  private connectionPromise: Promise<Connection> | null = null;
  private processedSignatures = new Map<string, { timestamp: number; confirmed: boolean }>();
  private readonly SIGNATURE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes TTL

  /**
   * Clean up expired signature cache entries
   */
  private cleanupSignatureCache(): void {
    const now = Date.now();
    for (const [signature, data] of this.processedSignatures.entries()) {
      if (now - data.timestamp > this.SIGNATURE_CACHE_TTL) {
        this.processedSignatures.delete(signature);
      }
    }
  }

  /**
   * Check if a signature has been processed before
   */
  private isSignatureProcessed(signature: string): { processed: boolean; confirmed: boolean } {
    this.cleanupSignatureCache();
    const cached = this.processedSignatures.get(signature);
    if (cached) {
      return { processed: true, confirmed: cached.confirmed };
    }
    return { processed: false, confirmed: false };
  }

  /**
   * Mark a signature as processed
   */
  private markSignatureProcessed(signature: string, confirmed: boolean = false): void {
    this.processedSignatures.set(signature, {
      timestamp: Date.now(),
      confirmed
    });
  }

  /**
   * Initialize Solana connection with race condition protection
   */
  private async initializeConnection(rpcUrl: string): Promise<Connection> {
    // If connection already exists, return it immediately
    if (this.connection) {
      return this.connection;
    }

    // If connection is being created, wait for it
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    // Create connection and store the promise
    this.connectionPromise = (async () => {
      try {
        const newConnection = new Connection(rpcUrl, {
          commitment: 'confirmed',
          confirmTransactionInitialTimeout: 60000, // 60秒超时 - shorter to detect issues faster
          httpHeaders: {
            'Connection': 'keep-alive'
          }
        });

        // Test the connection
        await newConnection.getLatestBlockhash('confirmed');

        this.connection = newConnection;
        return newConnection;
      } catch (error) {
        // If connection fails, reset the promise so it can be retried
        this.connectionPromise = null;
        throw error;
      }
    })();

    return this.connectionPromise;
  }

  /**
   * Create Keypair from base64 private key
   */
  private createKeypairFromBase64(privateKeyBase64: string): Keypair {
    const privateKeyBytes = KeyUtils.decodeToSolanaBytes(privateKeyBase64);
    return Keypair.fromSecretKey(privateKeyBytes);
  }

  /**
   * Detect Token Program ID (Token Program v1 vs Token-2022)
   */
  private async detectTokenProgram(
    connection: Connection,
    mintAddress: PublicKey
  ): Promise<PublicKey> {
    const mintInfo = await connection.getAccountInfo(mintAddress);
    if (!mintInfo) {
      throw new Error('Mint account does not exist');
    }

    const owner = mintInfo.owner.toBase58();

    if (owner === TOKEN_PROGRAM_ID.toBase58()) {
      return TOKEN_PROGRAM_ID;
    }
    if (owner === TOKEN_2022_PROGRAM_ID.toBase58()) {
      return TOKEN_2022_PROGRAM_ID;
    }

    throw new Error(`Unknown Token Program ID: ${owner}`);
  }

  /**
   * Get token information
   */
  async getTokenInfo(rpcUrl: string, tokenAddress: string): Promise<SolanaTokenInfo> {
    try {
      const connection = await this.initializeConnection(rpcUrl);

      // Check if it's native SOL
      if (tokenAddress.toLowerCase() === 'sol' || tokenAddress.toLowerCase() === 'native') {
        return {
          address: 'So11111111111111111111111111111111111111112',
          decimals: 9,
          symbol: 'SOL',
          isNativeSOL: true,
          programId: TOKEN_PROGRAM_ID
        };
      }

      const tokenMint = new PublicKey(tokenAddress);

      // Detect Token Program
      const programId = await this.detectTokenProgram(connection, tokenMint);
      logger.debug(`[SolanaService] Token Program detected`, {
        programType: programId.equals(TOKEN_2022_PROGRAM_ID) ? 'Token-2022' : 'Token Program v1',
        tokenAddress
      });

      const tokenInfo = await connection.getParsedAccountInfo(tokenMint);

      if (!tokenInfo || !tokenInfo.value) {
        throw new Error('Invalid token address');
      }

      const parsedInfo = tokenInfo.value.data as any;
      const decimals = parsedInfo.parsed.info.decimals;

      return {
        address: tokenAddress,
        decimals,
        isNativeSOL: false,
        programId
      };
    } catch (error) {
      logger.error('[SolanaService] Failed to get token info', error as Error, {
        tokenAddress,
        rpcUrl
      });
      throw new Error(
        `Failed to get token info: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get wallet balance
   */
  async getBalance(
    rpcUrl: string,
    walletPublicKey: string,
    tokenAddress?: string
  ): Promise<string> {
    try {
      const connection = await this.initializeConnection(rpcUrl);
      const publicKey = new PublicKey(walletPublicKey);

      if (!tokenAddress || tokenAddress.toLowerCase() === 'sol') {
        // Native SOL balance
        const balance = await connection.getBalance(publicKey);
        return (balance / LAMPORTS_PER_SOL).toString();
      } else {
        // SPL token balance
        const tokenMint = new PublicKey(tokenAddress);
        const programId = await this.detectTokenProgram(connection, tokenMint);
        const tokenAccount = await getAssociatedTokenAddress(
          tokenMint,
          publicKey,
          false,
          programId
        );

        try {
          const tokenBalance = await connection.getTokenAccountBalance(tokenAccount);
          return tokenBalance.value.uiAmountString || '0';
        } catch (error) {
          // Token account does not exist
          return '0';
        }
      }
    } catch (error) {
      logger.error('[SolanaService] Failed to get balance', error as Error, {
        walletPublicKey,
        tokenAddress
      });
      return '0';
    }
  }

  /**
   * Batch SPL token transfer - optimized version
   * Process:
   * 1. Calculate all ATAs locally
   * 2. Batch query ATAs existence
   * 3. Batch create missing ATAs
   * 4. Batch send tokens
   */
  async batchTransfer(
    rpcUrl: string,
    privateKeyBase64: string,
    recipients: string[],
    amounts: string[],
    tokenAddress: string,
    batchSize: number = DEFAULTS.BATCH_SIZES.solana // Read default batch size from config file
  ): Promise<SolanaBatchTransferResult> {
    try {
      const connection = await this.initializeConnection(rpcUrl);
      const wallet = this.createKeypairFromBase64(privateKeyBase64);

      // Get token information
      const tokenInfo = await this.getTokenInfo(rpcUrl, tokenAddress);

      logger.info('[SolanaService] Starting batch transfer', {
        recipientCount: recipients.length,
        tokenType: tokenInfo.isNativeSOL ? 'SOL' : 'SPL',
        programType: tokenInfo.programId.equals(TOKEN_2022_PROGRAM_ID) ? 'Token-2022' : 'Token v1',
        batchSize
      });

      // ========== Step 1: Calculate all ATAs locally ==========
      const { ataList, skipped } = await this.calculateATAs(
        recipients,
        amounts,
        tokenInfo,
        wallet.publicKey
      );

      // Add failure records for skipped addresses
      const skippedDetails = skipped.map(item => ({
        address: item.address,
        amount: item.amount,
        status: 'failed' as const,
        error: `Invalid address: ${item.error}`
      }));

      if (!tokenInfo.isNativeSOL) {
        // ========== Step 2: Batch query ATAs existence ==========
        const missingATAs = await this.checkMissingATAs(connection, ataList);

        logger.debug('[SolanaService] Missing ATAs detected', { missingCount: missingATAs.length });

        // ========== Step 3: Batch create missing ATAs ==========
        if (missingATAs.length > 0) {
          await this.batchCreateATAs(connection, wallet, missingATAs, tokenInfo, batchSize);
        }
      }

      // ========== Step 4: Batch send tokens ==========
      const results = await this.batchTransferTokens(
        connection,
        wallet,
        ataList,
        tokenInfo,
        batchSize
      );

      const allDetails = [...skippedDetails, ...results.details];
      const successCount = allDetails.filter(r => r.status === 'success').length;

      // CRITICAL FIX: Calculate total amount from actually processed recipients, not input amounts
      // This prevents incorrect totals when some recipients are skipped
      const totalAmount = allDetails.reduce((sum: BigNumber, detail) => {
        if (detail.status === 'success') {
          return sum.plus(new BigNumber(detail.amount || '0'));
        }
        return sum;
      }, new BigNumber(0));

      return {
        transactionHash: results.transactionHashes.join(','),
        totalAmount: totalAmount.toString(),
        recipientCount: successCount,
        gasUsed: results.totalGasUsed.toString(),
        status:
          successCount === recipients.length ? 'success' : successCount > 0 ? 'partial' : 'failed',
        details: allDetails
      };
    } catch (error) {
      logger.error('[SolanaService] Solana batch transfer failed', error as Error, {
        recipientCount: recipients.length,
        tokenAddress
      });
      const errorMsg = error instanceof Error ? error.message || error.toString() : String(error);
      throw new Error(`Solana batch transfer failed: ${errorMsg}`);
    }
  }

  /**
   * Build transaction with Helius priority fee estimation (following official pattern)
   */
  private async buildTransactionWithPriorityFee(
    connection: Connection,
    instructions: any[],
    wallet: Keypair,
    operationType: 'ata_creation' | 'transfer',
    extraOptions?: {
      computeUnitLimit?: number;
      priorityMultiplier?: number;
      maxPriorityFee?: number;
    }
  ): Promise<Transaction> {
    // Step 1: Build transaction with all instructions
    const tx = new Transaction();
    tx.add(...instructions);

    // Step 2: Set required fields and serialize for Helius API
    const { blockhash } = await connection.getLatestBlockhash('confirmed');
    tx.recentBlockhash = blockhash;
    tx.feePayer = wallet.publicKey;

    const serializedTransaction = bs58.encode(tx.serialize());

    logger.info(`[SolanaService] Built ${operationType} transaction for Helius API`, {
      instructionCount: instructions.length,
      hasFeePayer: !!wallet.publicKey,
      operationType
    });

    // Step 3: Get priority fee estimate from Helius API
    const priorityFee = await this.getPriorityFeeEstimate(connection, serializedTransaction);

    // Apply operation-specific priority multiplier
    const multiplier = extraOptions?.priorityMultiplier ?? 1.5;
    const maxFee = extraOptions?.maxPriorityFee ?? (operationType === 'ata_creation' ? 2000000 : 1000000);
    const fallbackFee = await this.getRecommendedPriorityFee(connection);

    let computeUnitPrice: number;
    if (priorityFee > 0) {
      computeUnitPrice = Math.min(Math.floor(priorityFee * multiplier), maxFee);
    } else {
      computeUnitPrice = Math.min(Math.floor(fallbackFee * multiplier), operationType === 'ata_creation' ? 1000000 : 500000);
    }

    logger.info(`[SolanaService] ${operationType} priority fee determined`, {
      priorityFee,
      computeUnitPrice,
      source: priorityFee > 0 ? 'Helius API' : 'Recent fees',
      costInSOL: (computeUnitPrice / 1000000).toFixed(6),
      multiplier,
      operationType
    });

    // Step 4: Rebuild transaction with priority fee (following official pattern)
    tx.instructions = [];

    // Add priority fee instruction first
    tx.add(ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: computeUnitPrice
    }));

    // Set compute unit limit
    const computeUnitLimit = extraOptions?.computeUnitLimit ?? this.calculateComputeUnitLimit(
      operationType,
      instructions.length,
      false // We'll calculate based on instruction count if not provided
    );
    tx.add(ComputeBudgetProgram.setComputeUnitLimit({
      units: computeUnitLimit
    }));

    // Re-add all original instructions
    tx.add(...instructions);

    // Step 5: Update blockhash before sending
    const freshBlockhash = await connection.getLatestBlockhash('confirmed');
    tx.recentBlockhash = freshBlockhash.blockhash;

    logger.info(`[SolanaService] Rebuilt ${operationType} transaction with priority fee`, {
      instructionCount: tx.instructions.length,
      computeUnitPrice,
      computeUnitLimit,
      estimatedCost: (computeUnitPrice * computeUnitLimit) / 1000000,
      feeSource: priorityFee > 0 ? 'Helius API' : 'Recent fees',
      operationType
    });

    return tx;
  }

  /**
   * Get priority fee estimate for a transaction (following official Helius pattern)
   */
  private async getPriorityFeeEstimate(connection: Connection, serializedTransaction: string): Promise<number> {
    try {
      logger.info('[SolanaService] Calling Helius API for priority fee estimation', {
        rpcEndpoint: connection.rpcEndpoint.replace(/api-key=[^&]+/, 'api-key=***')
      });

      const response = await fetch(connection.rpcEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "1",
          method: "getPriorityFeeEstimate",
          params: [{
            transaction: serializedTransaction,
            options: {
              priorityLevel: "High",
              recommended: true
            }
          }]
        })
      });

      const result = await response.json();

      if (result.error) {
        throw new Error(`Helius API error: ${result.error.message}`);
      }

      const priorityFee = result.result?.priorityFeeEstimate || 0;
      logger.info('[SolanaService] Helius API response received', {
        priorityFee,
        costInSOL: (priorityFee / 1000000).toFixed(6)
      });

      return priorityFee;
    } catch (error) {
      logger.warn('[SolanaService] Helius API call failed, using fallback', {
        error: error instanceof Error ? error.message : String(error)
      });
      return 0;
    }
  }

  /**
   * Get recommended priority fee using recent network activity (fallback)
   */
  private async getRecommendedPriorityFee(connection: Connection): Promise<number> {
    // Fallback to recent priority fees
    try {
      const recentFees = await connection.getRecentPrioritizationFees();
      if (recentFees && recentFees.length > 0) {
        // Use 95th percentile for good confirmation rate
        const sorted = recentFees
          .map(f => f.prioritizationFee)
          .filter(fee => fee > 0)
          .sort((a, b) => a - b);

        if (sorted.length > 0) {
          const index = Math.floor(sorted.length * 0.95);
          const recommendedFee = sorted[index];
          // Reasonable clamping: min 10k, max 500k
          const clampedFee = Math.min(Math.max(recommendedFee, 10000), 500000);

          logger.info('[SolanaService] Using recent priority fee calculation', {
            recommendedFee,
            clampedFee,
            sampleSize: sorted.length,
            percentile: '95th',
            costInSOL: (clampedFee / 1000000).toFixed(6),
            source: 'Recent fees'
          });

          return clampedFee;
        }
      }
    } catch (error) {
      logger.warn('[SolanaService] Failed to get recent fees, using default', {
        error: error instanceof Error ? error.message : String(error)
      });
    }

    // Conservative fallback
    return 20000;
  }

  
  /**
   * Simulate transaction before broadcasting to catch errors early
   */
  private async simulateTransaction(
    connection: Connection,
    transaction: Transaction,
    signers: Keypair[]
  ): Promise<{ success: boolean; error?: string; logs?: string[] }> {
    try {
      // Use confirmed blockhash for simulation to ensure consistency
      const { blockhash } = await connection.getLatestBlockhash('confirmed');
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = signers[0].publicKey;

      // Simulate transaction (no need to sign for simulation)
      const simulation = await connection.simulateTransaction(transaction);

      logger.debug('[SolanaService] Transaction simulation result', {
        value: simulation.value,
        err: simulation.value.err,
        logs: simulation.value.logs
      });

      if (simulation.value.err) {
        return {
          success: false,
          error: `Simulation failed: ${JSON.stringify(simulation.value.err)}`,
          logs: simulation.value.logs || []
        };
      }

      return { success: true, logs: simulation.value.logs || undefined };
    } catch (error) {
      logger.error('[SolanaService] Transaction simulation error', error as Error);
      return {
        success: false,
        error: `Simulation error: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Send and confirm transaction with retry mechanism
   * This replaces the blocking sendAndConfirmTransaction with better error handling
   */
  private async sendAndConfirmTransactionWithRetry(
    connection: Connection,
    transaction: Transaction,
    signers: Keypair[],
    commitment: Commitment = 'confirmed',
    maxRetries: number = 10 // Increased from 5 to 10 for better success rate
  ): Promise<{ signature: TransactionSignature; gasUsed: number }> {
    // Pre-simulate transaction to catch errors before broadcast
    logger.info('[SolanaService] Pre-simulating transaction to catch errors early', {
      instructionCount: transaction.instructions.length,
      signersCount: signers.length
    });
    const simulationResult = await this.simulateTransaction(connection, transaction, signers);

    if (!simulationResult.success) {
      const errorMsg = `Transaction simulation failed: ${simulationResult.error}`;
      logger.error('[SolanaService] Transaction failed simulation', new Error(errorMsg), {
        logs: simulationResult.logs
      });
      throw new Error(errorMsg);
    }

    logger.info('[SolanaService] Transaction simulation passed, proceeding to broadcast', {
      logCount: simulationResult.logs?.length || 0,
      hasLogs: !!simulationResult.logs
    });

    // Get latest blockhash with 'confirmed' commitment for better performance
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = blockhash;
    transaction.lastValidBlockHeight = lastValidBlockHeight;
    transaction.feePayer = signers[0].publicKey;

    // Sign transaction
    transaction.sign(...signers);

    // Get signature from transaction
    const signature = bs58.encode(transaction.signature!);

    // CRITICAL: Check if this signature has been processed before to prevent double-spending
    const signatureCheck = this.isSignatureProcessed(signature);
    if (signatureCheck.processed) {
      if (signatureCheck.confirmed) {
        logger.warn('[SolanaService] Transaction already confirmed, returning cached result', {
          signature: signature.substring(0, 20) + '...'
        });
        return { signature, gasUsed: 0 };
      } else {
        logger.warn('[SolanaService] Transaction already sent but not confirmed, waiting for confirmation', {
          signature: signature.substring(0, 20) + '...'
        });
        // Continue to confirmation logic below
      }
    } else {
      // Mark as processed immediately after signing to prevent duplicate sends
      this.markSignatureProcessed(signature, false);
    }

    // Serialize transaction once (will be reused for replay)
    const rawTransaction = transaction.serialize();

    // Only send if this signature hasn't been sent before
    let shouldSend = !signatureCheck.processed;
    if (shouldSend) {
      try {
        await connection.sendRawTransaction(rawTransaction, {
          skipPreflight: false,
          maxRetries: 0, // We handle retries ourselves
          preflightCommitment: 'processed'
        });
      } catch (sendError) {
      // Parse and enhance send error
      const errorMsg = sendError instanceof Error ? sendError.message : String(sendError);
      logger.error('[SolanaService] Failed to send transaction', new Error(`Send failed: ${errorMsg}`), {
        transactionSize: rawTransaction.length,
        instructionCount: transaction.instructions.length
      });

      // Check for specific known errors
      if (errorMsg.includes('account not found')) {
        throw new Error(`Account not found: ${errorMsg}. Please ensure all accounts exist and are funded.`);
      } else if (errorMsg.includes('insufficient funds')) {
        throw new Error(`Insufficient funds: ${errorMsg}. Please check wallet balance.`);
      } else if (errorMsg.includes('compute budget')) {
        throw new Error(`Compute budget exceeded: ${errorMsg}. Transaction is too complex.`);
      } else if (errorMsg.includes('blockhash')) {
        throw new Error(`Blockhash error: ${errorMsg}. Please retry with fresh blockhash.`);
      } else {
        throw new Error(`Transaction broadcast failed: ${errorMsg}`);
      }
    }

    if (shouldSend) {
      logger.debug('[SolanaService] Transaction sent', {
        signature: signature.substring(0, 20) + '...',
        blockhash: blockhash.substring(0, 20) + '...',
        lastValidBlockHeight
      });
    } else {
      logger.debug('[SolanaService] Using existing transaction, skipping broadcast', {
        signature: signature.substring(0, 20) + '...'
      });
    }
    }

    // Confirm transaction with retry and replay mechanism
    let confirmed = false;
    let gasUsed = 0;
    let replayCount = 0;

    for (let retry = 0; retry < maxRetries; retry++) {
      try {
        // Replay transaction every 2 seconds to increase confirmation probability
        // This is safe because Solana network deduplicates transactions by signature
        if (retry > 0 && retry % 2 === 0) {
          try {
            await connection.sendRawTransaction(rawTransaction, {
              skipPreflight: true, // Skip preflight on replay to save time
              maxRetries: 0
            });
            replayCount++;
            logger.debug('[SolanaService] Transaction replayed', {
              signature: signature.substring(0, 20) + '...',
              replayCount
            });
          } catch (replayError) {
            // Ignore replay errors (transaction might already be confirmed)
            logger.debug('[SolanaService] Replay failed (likely already confirmed)', {
              signature: signature.substring(0, 20) + '...',
              error: replayError instanceof Error ? replayError.message : String(replayError)
            });
          }
        }

        const confirmation = await connection.confirmTransaction(
          {
            signature,
            blockhash,
            lastValidBlockHeight
          },
          commitment
        );

        if (confirmation.value.err) {
          throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
        }

        confirmed = true;

        // CRITICAL: Mark signature as confirmed in our cache
        this.markSignatureProcessed(signature, true);

        // Get gas used
        try {
          const txDetails = await connection.getTransaction(signature, {
            maxSupportedTransactionVersion: 0,
            commitment: 'confirmed'
          });
          gasUsed = txDetails?.meta?.fee || 0;
        } catch (error) {
          logger.warn('[SolanaService] Failed to get transaction fee', {
            signature,
            error: error instanceof Error ? error.message : String(error)
          });
        }

        logger.debug('[SolanaService] Transaction confirmed', {
          signature: signature.substring(0, 20) + '...',
          retry,
          replayCount,
          gasUsed
        });

        break;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        const isBlockHeightExceeded = errorMsg.includes('block height exceeded') || errorMsg.includes('has expired');
        const isLastRetry = retry === maxRetries - 1;

        // If blockhash has expired, immediately check on-chain status instead of continuing retries
        if (isBlockHeightExceeded) {
          logger.warn('[SolanaService] Blockhash expired, checking on-chain transaction status', {
            signature: signature.substring(0, 20) + '...',
            retry,
            error: errorMsg
          });

          try {
            const status = await connection.getSignatureStatus(signature);
            const confirmationStatus = status?.value?.confirmationStatus;

            if (confirmationStatus === 'confirmed' || confirmationStatus === 'finalized') {
              logger.info('[SolanaService] Transaction succeeded on-chain despite expired blockhash', {
                signature: signature.substring(0, 20) + '...',
                confirmationStatus
              });

              // Get gas used
              try {
                const txDetails = await connection.getTransaction(signature, {
                  maxSupportedTransactionVersion: 0,
                  commitment: 'confirmed'
                });
                gasUsed = txDetails?.meta?.fee || 0;
              } catch (e) {
                // Ignore
              }

              confirmed = true;
              break;
            } else {
              // Transaction did not land on-chain before blockhash expired
              const expiredError = new Error(`Transaction expired: blockhash exceeded before confirmation. Transaction may have been dropped.`);
              logger.error('[SolanaService] Transaction lost - blockhash expired before confirmation', expiredError, {
                signature: signature.substring(0, 20) + '...',
                confirmationStatus: confirmationStatus || 'null'
              });
              throw expiredError;
            }
          } catch (statusError) {
            if (statusError instanceof Error && statusError.message.includes('Transaction expired')) {
              throw statusError;
            }
            logger.error('[SolanaService] Failed to check status of expired transaction', statusError as Error, {
              signature
            });
            throw new Error(`Blockhash expired and status check failed: ${statusError instanceof Error ? statusError.message : String(statusError)}`);
          }
        }

        if (isLastRetry) {
          // Last retry failed, check actual status one more time
          logger.warn('[SolanaService] Confirmation timeout, checking final status', {
            signature,
            retry
          });

          try {
            const status = await connection.getSignatureStatus(signature);
            const confirmationStatus = status?.value?.confirmationStatus;

            if (confirmationStatus === 'confirmed' || confirmationStatus === 'finalized') {
              logger.info('[SolanaService] Transaction actually succeeded despite timeout', {
                signature: signature.substring(0, 20) + '...',
                confirmationStatus
              });

              // CRITICAL: Mark signature as confirmed in our cache
              this.markSignatureProcessed(signature, true);

              // Get gas used
              try {
                const txDetails = await connection.getTransaction(signature, {
                  maxSupportedTransactionVersion: 0,
                  commitment: 'confirmed'
                });
                gasUsed = txDetails?.meta?.fee || 0;
              } catch (e) {
                // Ignore
              }

              confirmed = true;
              break;
            }
          } catch (statusError) {
            logger.error(
              '[SolanaService] Failed to check final transaction status',
              statusError as Error,
              {
                signature
              }
            );
          }

          // Really failed
          throw error;
        }

        // Exponential backoff
        const delay = 2000 * Math.pow(1.5, retry);
        logger.warn('[SolanaService] Confirmation attempt failed, retrying', {
          signature: signature.substring(0, 20) + '...',
          retry: retry + 1,
          maxRetries,
          nextRetryDelay: delay,
          error: errorMsg
        });

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    if (!confirmed) {
      // CRITICAL: Before throwing error, check on-chain status to prevent double-spend
      logger.warn('[SolanaService] Confirmation timeout, performing final on-chain check', {
        signature: signature.substring(0, 20) + '...'
      });

      try {
        const finalStatus = await connection.getSignatureStatus(signature);
        const finalConfirmation = finalStatus?.value?.confirmationStatus;

        if (finalConfirmation === 'confirmed' || finalConfirmation === 'finalized') {
          logger.info('[SolanaService] Transaction confirmed on-chain despite timeout', {
            signature: signature.substring(0, 20) + '...',
            confirmationStatus: finalConfirmation
          });

          // Get gas used
          try {
            const txDetails = await connection.getTransaction(signature, {
              maxSupportedTransactionVersion: 0,
              commitment: 'confirmed'
            });
            gasUsed = txDetails?.meta?.fee || 0;
          } catch (e) {
            // Ignore gas fetch error
          }

          return { signature, gasUsed };
        }
      } catch (statusError) {
        logger.error('[SolanaService] Final status check failed', statusError as Error, {
          signature
        });
      }

      throw new Error('Transaction confirmation failed after all retries');
    }

    return { signature, gasUsed };
  }

  /**
   * Calculate compute unit limit based on operation type and batch size
   * With overflow protection and bounds checking
   */
  private calculateComputeUnitLimit(
    operationType: 'ata_creation' | 'transfer',
    batchSize: number,
    isNativeSOL: boolean
  ): number {
    // Validate and bounds check batchSize to prevent overflow
    if (!Number.isInteger(batchSize) || batchSize < 1) {
      logger.warn('[SolanaService] Invalid batchSize, using default', { batchSize });
      batchSize = 1;
    }

    // Maximum reasonable batch size to prevent overflow
    const MAX_SAFE_BATCH_SIZE = 10000;
    if (batchSize > MAX_SAFE_BATCH_SIZE) {
      logger.warn('[SolanaService] BatchSize too large, capping for safety', {
        originalBatchSize: batchSize,
        cappedBatchSize: MAX_SAFE_BATCH_SIZE
      });
      batchSize = MAX_SAFE_BATCH_SIZE;
    }

    let computeUnits: number;
    if (operationType === 'ata_creation') {
      // ATA creation is more expensive: ~40,000 per ATA
      // Use safe arithmetic to prevent overflow
      const perAtaCost = 45000;
      const baseCost = 50000;
      computeUnits = Math.min(Number(batchSize) * perAtaCost + baseCost, 1400000);
    } else {
      // Transfer operations
      if (isNativeSOL) {
        // Native SOL transfers are cheap: ~300 per transfer
        const perTransferCost = 1000;
        const baseCost = 20000;
        computeUnits = Math.min(Number(batchSize) * perTransferCost + baseCost, 400000);
      } else {
        // SPL token transfers: ~25,000 per transfer
        const perTransferCost = 30000;
        const baseCost = 50000;
        computeUnits = Math.min(Number(batchSize) * perTransferCost + baseCost, 1400000);
      }
    }

    // Final safety check
    if (!Number.isFinite(computeUnits) || computeUnits <= 0) {
      logger.error('[SolanaService] Invalid compute units calculated, using fallback', new Error(`Invalid compute units: ${computeUnits}`), {
        computeUnits,
        batchSize,
        operationType
      });
      return operationType === 'ata_creation' ? 200000 : 100000;
    }

    return computeUnits;
  }

  /**
   * Step 1: Calculate all ATAs locally (without RPC calls)
   */
  private async calculateATAs(
    recipients: string[],
    amounts: string[],
    tokenInfo: SolanaTokenInfo,
    senderPublicKey: PublicKey
  ): Promise<{
    ataList: ATAInfo[];
    skipped: Array<{ address: string; amount: string; error: string }>;
  }> {
    logger.debug('[SolanaService] Calculating all ATAs locally', {
      recipientCount: recipients.length
    });

    const ataList: ATAInfo[] = [];
    const skipped: Array<{ address: string; amount: string; error: string }> = [];

    for (let i = 0; i < recipients.length; i++) {
      logger.debug(`[SolanaService] Processing ATA calculation`, {
        index: i + 1,
        total: recipients.length,
        address: recipients[i]
      });

      try {
        const owner = new PublicKey(recipients[i]);

        if (tokenInfo.isNativeSOL) {
          // SOL transfers don't need ATA, directly use user address
          ataList.push({
            owner,
            ata: owner, // For SOL transfers, ATA is the user address
            amount: amounts[i]
          });
        } else {
          // SPL tokens need ATA calculation
          const tokenMint = new PublicKey(tokenInfo.address);
          const ata = await getAssociatedTokenAddress(
            tokenMint,
            owner,
            false,
            tokenInfo.programId,
            ASSOCIATED_TOKEN_PROGRAM_ID
          );

          ataList.push({
            owner,
            ata,
            amount: amounts[i]
          });
        }
      } catch (error) {
        // Skip addresses that cause errors (e.g., off-curve addresses that cannot have ATAs)
        const errorName = error instanceof Error ? error.name : 'Unknown';
        logger.warn('[SolanaService] Skipping invalid address', {
          address: recipients[i],
          error: errorName
        });
        skipped.push({
          address: recipients[i],
          amount: amounts[i],
          error: errorName
        });
      }
    }

    logger.debug('[SolanaService] ATA calculation completed', {
      validCount: ataList.length,
      skippedCount: skipped.length
    });
    return { ataList, skipped };
  }

  /**
   * Step 2: Batch query ATAs existence (1 RPC call)
   */
  private async checkMissingATAs(connection: Connection, ataList: ATAInfo[]): Promise<ATAInfo[]> {
    logger.debug('[SolanaService] Checking for missing ATAs', { ataCount: ataList.length });

    const ataAddresses = ataList.map(item => item.ata);
    const accountInfos = await connection.getMultipleAccountsInfo(ataAddresses);

    const missing: ATAInfo[] = [];
    ataList.forEach((item, index) => {
      if (accountInfos[index] === null) {
        missing.push(item);
      }
    });

    logger.debug('[SolanaService] ATA check completed', { missingCount: missing.length });
    return missing;
  }

  /**
   * Step 3: Batch create ATAs (single transaction for all missing ATAs in the batch)
   */
  private async batchCreateATAs(
    connection: Connection,
    wallet: Keypair,
    missingATAs: ATAInfo[],
    tokenInfo: SolanaTokenInfo,
    userBatchSize: number
  ): Promise<void> {
    if (missingATAs.length === 0) return;

    logger.info('[SolanaService] Starting batch ATA creation', { ataCount: missingATAs.length });

    const tokenMint = new PublicKey(tokenInfo.address);

    // Build ATA creation instructions array
    const ataInstructions = [];
    for (const item of missingATAs) {
      ataInstructions.push(createAssociatedTokenAccountInstruction(
        wallet.publicKey, // payer
        item.ata, // associatedToken
        item.owner, // owner
        tokenMint, // mint
        tokenInfo.programId, // programId
        ASSOCIATED_TOKEN_PROGRAM_ID
      ));
    }

    // Build transaction with priority fee using unified method
    const tx = await this.buildTransactionWithPriorityFee(
      connection,
      ataInstructions,
      wallet,
      'ata_creation',
      {
        computeUnitLimit: this.calculateComputeUnitLimit(
          'ata_creation',
          missingATAs.length,
          tokenInfo.isNativeSOL
        ),
        priorityMultiplier: 1.5,
        maxPriorityFee: 2000000
      }
    );

    // Send and confirm the single ATA creation transaction (NO RETRY to prevent double spending)
    const { signature, gasUsed } = await this.sendAndConfirmTransactionWithRetry(
      connection,
      tx,
      [wallet],
      'confirmed',
      5 // Only use internal retry mechanism
    );

    logger.info('[SolanaService] All ATAs created successfully in single transaction', {
      signature,
      ataCount: missingATAs.length,
      gasUsed
    });
  }

  /**
   * Step 4: Batch send tokens (according to user-set batchSize)
   */
  private async batchTransferTokens(
    connection: Connection,
    wallet: Keypair,
    ataList: ATAInfo[],
    tokenInfo: SolanaTokenInfo,
    batchSize: number
  ): Promise<{
    transactionHashes: string[];
    totalGasUsed: bigint; // Use bigint to prevent overflow
    details: Array<{
      address: string;
      amount: string;
      status: 'success' | 'failed';
      error?: string;
    }>;
  }> {
    // Input validation
    if (!ataList || ataList.length === 0) {
      throw new Error('No recipients provided for transfer');
    }

    // Validate amounts and addresses
    for (const item of ataList) {
      if (!item.owner || !item.ata || !item.amount) {
        throw new Error('Invalid recipient data: missing required fields');
      }
      // Validate amount using safe conversion
      try {
        const atomicAmount = safeAmountToAtomic(item.amount, tokenInfo.isNativeSOL ? 9 : tokenInfo.decimals);
        if (atomicAmount <= 0n) {
          throw new Error(`Amount must be greater than 0: ${item.amount}`);
        }
      } catch (error) {
        throw new Error(`Invalid transfer amount: ${item.amount}. ${error instanceof Error ? error.message : 'Invalid format'}`);
      }
    }

    logger.info('[SolanaService] Starting batch token transfer', {
      batchSize,
      totalRecipients: ataList.length
    });

    const transactionHashes: string[] = [];
    const details: Array<{
      address: string;
      amount: string;
      status: 'success' | 'failed';
      error?: string;
    }> = [];
    let totalGasUsed = 0n; // Use bigint for overflow protection

    // Sender's ATA (required for SPL tokens)
    let senderATA: PublicKey | undefined;
    if (!tokenInfo.isNativeSOL) {
      const tokenMint = new PublicKey(tokenInfo.address);
      senderATA = await getAssociatedTokenAddress(
        tokenMint,
        wallet.publicKey,
        false,
        tokenInfo.programId,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );
    }

    // Note: We'll get transaction-specific priority fees for each batch

    // Batch process
    for (let i = 0; i < ataList.length; i += batchSize) {
      const batch = ataList.slice(i, Math.min(i + batchSize, ataList.length));
      const batchNumber = Math.floor(i / batchSize) + 1;

      logger.debug('[SolanaService] Processing transfer batch', {
        batchNumber,
        startIndex: i + 1,
        endIndex: Math.min(i + batchSize, ataList.length)
      });

      // Pre-validate addresses to improve success rate
      const validRecipients: ATAInfo[] = [];
      const invalidRecipients: ATAInfo[] = [];

      for (const item of batch) {
        try {
          // Validate address format
          if (!tokenInfo.isNativeSOL) {
            // For SPL tokens, verify ATA is valid
            await connection.getAccountInfo(item.ata);
          }
          validRecipients.push(item);
        } catch (error) {
          logger.warn('[SolanaService] Invalid recipient in batch, skipping', {
            address: item.owner.toBase58(),
            error: error instanceof Error ? error.message : String(error)
          });
          invalidRecipients.push(item);
        }
      }

      // Record invalid recipients as failed
      if (invalidRecipients.length > 0) {
        invalidRecipients.forEach(item => {
          details.push({
            address: item.owner.toBase58(),
            amount: item.amount,
            status: 'failed',
            error: 'Invalid address or account not found'
          });
        });
      }

      // Skip batch if no valid recipients
      if (validRecipients.length === 0) {
        logger.warn('[SolanaService] No valid recipients in batch, skipping', { batchNumber });
        continue;
      }

      try {
        // Step 1: Build transfer instructions
        const transferInstructions: TransactionInstruction[] = [];

        for (const item of validRecipients) {
          if (tokenInfo.isNativeSOL) {
            // Native SOL transfer - use safe amount conversion
            const lamports = Number(safeAmountToAtomic(item.amount, 9));
            const solTransferIx = SystemProgram.transfer({
              fromPubkey: wallet.publicKey,
              toPubkey: item.owner,
              lamports
            });
            transferInstructions.push(solTransferIx);
          } else {
            // SPL token transfer - use safe amount conversion
            const tokenMint = new PublicKey(tokenInfo.address);
            const transferAmount = safeAmountToAtomic(item.amount, tokenInfo.decimals);

            let tokenTransferIx;
            if (tokenInfo.programId.equals(TOKEN_2022_PROGRAM_ID)) {
              // Token-2022 uses transferChecked
              tokenTransferIx = createTransferCheckedInstruction(
                senderATA!,
                tokenMint,
                item.ata,
                wallet.publicKey,
                transferAmount,
                tokenInfo.decimals,
                [],
                tokenInfo.programId
              );
            } else {
              // Token Program v1
              tokenTransferIx = createTransferInstruction(
                senderATA!,
                item.ata,
                wallet.publicKey,
                transferAmount,
                [],
                tokenInfo.programId
              );
            }
            transferInstructions.push(tokenTransferIx);
          }
        }

        logger.info('[SolanaService] Built transfer instructions', {
          instructionCount: transferInstructions.length,
          isNativeSOL: tokenInfo.isNativeSOL
        });

        // Step 2: Use unified method to build transaction with priority fee
        const tx = await this.buildTransactionWithPriorityFee(
          connection,
          transferInstructions,
          wallet,
          'transfer',
          {
            computeUnitLimit: this.calculateComputeUnitLimit(
              'transfer',
              validRecipients.length,
              tokenInfo.isNativeSOL
            )
          }
        );

        // Step 3: Send transaction with retry
        const { signature, gasUsed } = await this.sendAndConfirmTransactionWithRetry(
          connection,
          tx,
          [wallet],
          'confirmed',
          10 // Max 10 retries (increased for better success rate)
        );

        totalGasUsed += BigInt(gasUsed); // Convert to bigint for safe accumulation
        transactionHashes.push(signature);

        // Mark all valid addresses as successful
        validRecipients.forEach(item => {
          details.push({
            address: item.owner.toBase58(),
            amount: item.amount,
            status: 'success'
          });
        });

        logger.info('[SolanaService] Transfer batch completed successfully', {
          batchNumber,
          signature,
          gasUsed,
          successCount: validRecipients.length,
          skippedCount: invalidRecipients.length
        });
      } catch (error) {
        logger.error('[SolanaService] Transfer batch failed', error as Error, { batchNumber });

        // Mark only valid recipients as failed (invalid ones already marked)
        validRecipients.forEach(item => {
          details.push({
            address: item.owner.toBase58(),
            amount: item.amount,
            status: 'failed',
            error: error instanceof Error ? error.message : 'Batch execution failed'
          });
        });
      }

      // Reduced delay between batches (from 4s to 500ms)
      if (i + batchSize < ataList.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    logger.info('[SolanaService] All transfers completed', {
      transactionCount: transactionHashes.length,
      totalGasUsed
    });

    return {
      transactionHashes,
      totalGasUsed, // Return as bigint, caller will convert to string
      details
    };
  }

  /**
   * Check transaction status
   */
  async getTransactionStatus(
    rpcUrl: string,
    transactionHash: string
  ): Promise<{
    status: 'confirmed' | 'pending' | 'failed';
    blockHeight?: number;
    error?: string;
    confirmations?: number;
  }> {
    const maxRetries = 3;
    const retryDelay = 1000; // 1 second

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const connection = await this.initializeConnection(rpcUrl);

        // Use more efficient query method
        const [transaction, signatureStatuses] = await Promise.all([
          connection.getTransaction(transactionHash, {
            maxSupportedTransactionVersion: 0
          }),
          connection.getSignatureStatus(transactionHash, {
            searchTransactionHistory: false
          })
        ]);

        if (!transaction) {
          return { status: 'pending' };
        }

        if (transaction.meta?.err) {
          return {
            status: 'failed',
            error: `Transaction failed: ${JSON.stringify(transaction.meta.err)}`,
            blockHeight: (transaction as any).blockHeight || undefined
          };
        }

        // Check confirmation status
        const confirmations = signatureStatuses?.value?.confirmations || 0;

        return {
          status: 'confirmed',
          blockHeight: (transaction as any).blockHeight || undefined,
          confirmations
        };
      } catch (error) {
        logger.warn('[SolanaService] Failed to get transaction status', {
          attempt: attempt + 1,
          maxRetries,
          transactionHash,
          error: error instanceof Error ? error.message : String(error)
        });

        if (attempt === maxRetries - 1) {
          // Last attempt failed, return error
          return {
            status: 'failed',
            error: `Failed to check transaction status after ${maxRetries} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`
          };
        }

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
      }
    }

    // This case should theoretically never be reached, but for type safety
    return {
      status: 'failed',
      error: 'Unknown error in transaction status check'
    };
  }

  /**
   * Estimate batch transfer fees
   */
  async estimateBatchTransferFee(
    rpcUrl: string,
    recipientCount: number,
    isSPLToken: boolean
  ): Promise<number> {
    try {
      const connection = await this.initializeConnection(rpcUrl);

      // Base transaction fee
      let baseFee = DEFAULTS.SOLANA_FEES.base_fee_per_signature;

      // SPL token transfers require additional fees (each transfer may need to create associated token accounts)
      if (isSPLToken) {
        baseFee += recipientCount * DEFAULTS.SOLANA_FEES.spl_account_creation_fee;
      }

      // Add some buffer
      const estimatedFee = baseFee * 1.2;

      return Math.ceil(estimatedFee);
    } catch (error) {
      logger.error('[SolanaService] Failed to estimate fee', error as Error, {
        recipientCount,
        isSPLToken
      });
      return DEFAULTS.SOLANA_FEES.spl_account_creation_fee;
    }
  }
}
