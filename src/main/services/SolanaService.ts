import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
  SystemProgram
} from '@solana/web3.js';
import { TokenService } from './TokenService';
import { ChainUtils } from '../utils/chain-utils';
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
import { Logger } from '../utils/logger';

const logger = Logger.getInstance().child('SolanaService');

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

  /**
   * Initialize Solana connection
   */
  private initializeConnection(rpcUrl: string): Connection {
    if (!this.connection) {
      this.connection = new Connection(rpcUrl, 'confirmed');
    }
    return this.connection;
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
  private async detectTokenProgram(connection: Connection, mintAddress: PublicKey): Promise<PublicKey> {
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
      const connection = this.initializeConnection(rpcUrl);

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
      logger.error('[SolanaService] Failed to get token info', error as Error, { tokenAddress, rpcUrl });
      throw new Error(`Failed to get token info: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get wallet balance
   */
  async getBalance(rpcUrl: string, walletPublicKey: string, tokenAddress?: string): Promise<string> {
    try {
      const connection = this.initializeConnection(rpcUrl);
      const publicKey = new PublicKey(walletPublicKey);

      if (!tokenAddress || tokenAddress.toLowerCase() === 'sol') {
        // Native SOL balance
        const balance = await connection.getBalance(publicKey);
        return (balance / LAMPORTS_PER_SOL).toString();
      } else {
        // SPL token balance
        const tokenMint = new PublicKey(tokenAddress);
        const programId = await this.detectTokenProgram(connection, tokenMint);
        const tokenAccount = await getAssociatedTokenAddress(tokenMint, publicKey, false, programId);

        try {
          const tokenBalance = await connection.getTokenAccountBalance(tokenAccount);
          return tokenBalance.value.uiAmountString || '0';
        } catch (error) {
          // Token account does not exist
          return '0';
        }
      }
    } catch (error) {
      logger.error('[SolanaService] Failed to get balance', error as Error, { walletPublicKey, tokenAddress });
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
    batchSize: number = DEFAULTS.BATCH_SIZES.solana  // Read default batch size from config file
  ): Promise<SolanaBatchTransferResult> {
    try {
      const connection = this.initializeConnection(rpcUrl);
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

      // Calculate total amount
      const totalAmount = amounts.reduce((sum: BigNumber, amount: string) => {
        return sum.plus(new BigNumber(amount || '0'));
      }, new BigNumber(0));

      const allDetails = [...skippedDetails, ...results.details];
      const successCount = allDetails.filter(r => r.status === 'success').length;

      return {
        transactionHash: results.transactionHashes.join(','),
        totalAmount: totalAmount.toString(),
        recipientCount: successCount,
        gasUsed: results.totalGasUsed.toString(),
        status: successCount === recipients.length ? 'success' : successCount > 0 ? 'partial' : 'failed',
        details: allDetails
      };
    } catch (error) {
      logger.error('[SolanaService] Solana batch transfer failed', error as Error, {
        recipientCount: recipients.length,
        tokenAddress
      });
      const errorMsg = error instanceof Error ? (error.message || error.toString()) : String(error);
      throw new Error(`Solana batch transfer failed: ${errorMsg}`);
    }
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
    logger.debug('[SolanaService] Calculating all ATAs locally', { recipientCount: recipients.length });

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
  private async checkMissingATAs(
    connection: Connection,
    ataList: ATAInfo[]
  ): Promise<ATAInfo[]> {
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
   * Step 3: Batch create ATAs
   * ATA creation instructions are large, recommended not to exceed 15 per batch
   * But we use user-set batchSize, maximum not exceeding 15
   */
  private async batchCreateATAs(
    connection: Connection,
    wallet: Keypair,
    missingATAs: ATAInfo[],
    tokenInfo: SolanaTokenInfo,
    userBatchSize: number
  ): Promise<void> {
    logger.info('[SolanaService] Starting batch ATA creation', { ataCount: missingATAs.length });

    const tokenMint = new PublicKey(tokenInfo.address);
    // ATA creation and transfers use unified batch size
    // Simplified configuration: both ATA creation and transfers use user-set batchSize
    const CREATE_BATCH_SIZE = userBatchSize;

    logger.debug('[SolanaService] ATA creation batch size', { batchSize: CREATE_BATCH_SIZE });

    // Batch create
    for (let i = 0; i < missingATAs.length; i += CREATE_BATCH_SIZE) {
      const batch = missingATAs.slice(i, Math.min(i + CREATE_BATCH_SIZE, missingATAs.length));
      const tx = new Transaction();

      for (const item of batch) {
        const ix = createAssociatedTokenAccountInstruction(
          wallet.publicKey,      // payer
          item.ata,              // associatedToken
          item.owner,            // owner
          tokenMint,             // mint
          tokenInfo.programId,   // programId
          ASSOCIATED_TOKEN_PROGRAM_ID
        );
        tx.add(ix);
      }

      try {
        const signature = await sendAndConfirmTransaction(connection, tx, [wallet], {
          commitment: 'confirmed',
          maxRetries: 3
        });

        logger.info('[SolanaService] ATA batch created successfully', {
          batchNumber: Math.floor(i / CREATE_BATCH_SIZE) + 1,
          signature,
          ataCount: batch.length
        });
      } catch (error) {
        logger.error('[SolanaService] ATA batch creation failed', error as Error, {
          batchNumber: Math.floor(i / CREATE_BATCH_SIZE) + 1,
          ataCount: batch.length
        });
        throw error;
      }

      // Brief delay between batches
      if (i + CREATE_BATCH_SIZE < missingATAs.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    logger.info('[SolanaService] All ATAs created successfully', { totalCreated: missingATAs.length });
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
    totalGasUsed: number;
    details: Array<{ address: string; amount: string; status: 'success' | 'failed'; error?: string }>;
  }> {
    logger.info('[SolanaService] Starting batch token transfer', {
      batchSize,
      totalRecipients: ataList.length
    });

    const transactionHashes: string[] = [];
    const details: Array<{ address: string; amount: string; status: 'success' | 'failed'; error?: string }> = [];
    let totalGasUsed = 0;

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

    // Batch process
    for (let i = 0; i < ataList.length; i += batchSize) {
      const batch = ataList.slice(i, Math.min(i + batchSize, ataList.length));
      const batchNumber = Math.floor(i / batchSize) + 1;

      logger.debug('[SolanaService] Processing transfer batch', {
        batchNumber,
        startIndex: i + 1,
        endIndex: Math.min(i + batchSize, ataList.length)
      });

      try {
        const tx = new Transaction();

        for (const item of batch) {
          if (tokenInfo.isNativeSOL) {
            // Native SOL transfer
            const lamports = Math.floor(parseFloat(item.amount) * LAMPORTS_PER_SOL);
            tx.add(
              SystemProgram.transfer({
                fromPubkey: wallet.publicKey,
                toPubkey: item.owner,
                lamports
              })
            );
          } else {
            // SPL token transfer
            const tokenMint = new PublicKey(tokenInfo.address);
            const transferAmount = BigInt(Math.floor(parseFloat(item.amount) * Math.pow(10, tokenInfo.decimals)));

            if (tokenInfo.programId.equals(TOKEN_2022_PROGRAM_ID)) {
              // Token-2022 uses transferChecked
              tx.add(
                createTransferCheckedInstruction(
                  senderATA!,
                  tokenMint,
                  item.ata,
                  wallet.publicKey,
                  transferAmount,
                  tokenInfo.decimals,
                  [],
                  tokenInfo.programId
                )
              );
            } else {
              // Token Program v1
              tx.add(
                createTransferInstruction(
                  senderATA!,
                  item.ata,
                  wallet.publicKey,
                  transferAmount,
                  [],
                  tokenInfo.programId
                )
              );
            }
          }
        }

        // Send transaction
        const signature = await sendAndConfirmTransaction(connection, tx, [wallet], {
          commitment: 'confirmed',
          maxRetries: 3
        });

        // Get transaction details to calculate gas
        const txDetails = await connection.getTransaction(signature, {
          maxSupportedTransactionVersion: 0
        });
        const gasUsed = txDetails?.meta?.fee || 0;
        totalGasUsed += gasUsed;

        transactionHashes.push(signature);

        // Mark all addresses as successful
        batch.forEach(item => {
          details.push({
            address: item.owner.toBase58(),
            amount: item.amount,
            status: 'success'
          });
        });

        logger.info('[SolanaService] Transfer batch completed successfully', {
          batchNumber,
          signature,
          gasUsed
        });

      } catch (error) {
        logger.error('[SolanaService] Transfer batch failed', error as Error, { batchNumber });

        // Mark entire batch as failed
        batch.forEach(item => {
          details.push({
            address: item.owner.toBase58(),
            amount: item.amount,
            status: 'failed',
            error: error instanceof Error ? error.message : 'Batch execution failed'
          });
        });
      }

      // Delay between batches
      if (i + batchSize < ataList.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    logger.info('[SolanaService] All transfers completed', {
      transactionCount: transactionHashes.length,
      totalGasUsed
    });

    return {
      transactionHashes,
      totalGasUsed,
      details
    };
  }

  /**
   * Check transaction status
   */
  async getTransactionStatus(rpcUrl: string, transactionHash: string): Promise<{
    status: 'confirmed' | 'pending' | 'failed';
    blockHeight?: number;
    error?: string;
    confirmations?: number;
  }> {
    const maxRetries = 3;
    const retryDelay = 1000; // 1 second

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const connection = this.initializeConnection(rpcUrl);

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
      const connection = this.initializeConnection(rpcUrl);

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
      logger.error('[SolanaService] Failed to estimate fee', error as Error, { recipientCount, isSPLToken });
      return DEFAULTS.SOLANA_FEES.spl_account_creation_fee;
    }
  }
}
