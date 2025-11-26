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
   * 初始化Solana连接
   */
  private initializeConnection(rpcUrl: string): Connection {
    if (!this.connection) {
      this.connection = new Connection(rpcUrl, 'confirmed');
    }
    return this.connection;
  }

  /**
   * 从base64私钥创建Keypair
   */
  private createKeypairFromBase64(privateKeyBase64: string): Keypair {
    const privateKeyBytes = KeyUtils.decodeToSolanaBytes(privateKeyBase64);
    return Keypair.fromSecretKey(privateKeyBytes);
  }

  /**
   * 检测 Token Program ID (Token Program v1 vs Token-2022)
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
   * 获取代币信息
   */
  async getTokenInfo(rpcUrl: string, tokenAddress: string): Promise<SolanaTokenInfo> {
    try {
      const connection = this.initializeConnection(rpcUrl);

      // 检查是否是原生SOL
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

      // 检测 Token Program
      const programId = await this.detectTokenProgram(connection, tokenMint);
      console.log(`Token Program: ${programId.equals(TOKEN_2022_PROGRAM_ID) ? 'Token-2022' : 'Token Program v1'}`);

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
      console.error('Failed to get token info:', error);
      throw new Error(`获取代币信息失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 获取钱包余额
   */
  async getBalance(rpcUrl: string, walletPublicKey: string, tokenAddress?: string): Promise<string> {
    try {
      const connection = this.initializeConnection(rpcUrl);
      const publicKey = new PublicKey(walletPublicKey);

      if (!tokenAddress || tokenAddress.toLowerCase() === 'sol') {
        // 原生SOL余额
        const balance = await connection.getBalance(publicKey);
        return (balance / LAMPORTS_PER_SOL).toString();
      } else {
        // SPL代币余额
        const tokenMint = new PublicKey(tokenAddress);
        const programId = await this.detectTokenProgram(connection, tokenMint);
        const tokenAccount = await getAssociatedTokenAddress(tokenMint, publicKey, false, programId);

        try {
          const tokenBalance = await connection.getTokenAccountBalance(tokenAccount);
          return tokenBalance.value.uiAmountString || '0';
        } catch (error) {
          // 代币账户不存在
          return '0';
        }
      }
    } catch (error) {
      console.error('Failed to get balance:', error);
      return '0';
    }
  }

  /**
   * 批量SPL代币转账 - 优化版本
   * 流程：
   * 1. 本地计算所有 ATA
   * 2. 批量查询 ATA 是否存在
   * 3. 批量创建缺失的 ATA
   * 4. 批量发送代币
   */
  async batchTransfer(
    rpcUrl: string,
    privateKeyBase64: string,
    recipients: string[],
    amounts: string[],
    tokenAddress: string,
    batchSize: number = DEFAULTS.BATCH_SIZES.solana  // 从配置文件读取默认批量大小
  ): Promise<SolanaBatchTransferResult> {
    try {
      const connection = this.initializeConnection(rpcUrl);
      const wallet = this.createKeypairFromBase64(privateKeyBase64);

      // 获取代币信息
      const tokenInfo = await this.getTokenInfo(rpcUrl, tokenAddress);

      console.log(`开始批量转账: 总计 ${recipients.length} 个地址`);
      console.log(`代币类型: ${tokenInfo.isNativeSOL ? 'SOL' : 'SPL'}`);
      console.log(`Token Program: ${tokenInfo.programId.equals(TOKEN_2022_PROGRAM_ID) ? 'Token-2022' : 'Token v1'}`);

      // ========== Step 1: 本地计算所有 ATA ==========
      const { ataList, skipped } = await this.calculateATAs(
        recipients,
        amounts,
        tokenInfo,
        wallet.publicKey
      );

      // 为跳过的地址添加失败记录
      const skippedDetails = skipped.map(item => ({
        address: item.address,
        amount: item.amount,
        status: 'failed' as const,
        error: `Invalid address: ${item.error}`
      }));

      if (!tokenInfo.isNativeSOL) {
        // ========== Step 2: 批量查询 ATA 是否存在 ==========
        const missingATAs = await this.checkMissingATAs(connection, ataList);

        console.log(`缺失 ATA 数量: ${missingATAs.length}`);

        // ========== Step 3: 批量创建缺失的 ATA ==========
        if (missingATAs.length > 0) {
          await this.batchCreateATAs(connection, wallet, missingATAs, tokenInfo, batchSize);
        }
      }

      // ========== Step 4: 批量发送代币 ==========
      const results = await this.batchTransferTokens(
        connection,
        wallet,
        ataList,
        tokenInfo,
        batchSize
      );

      // 计算总金额
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
      console.error('Solana batch transfer failed:', error);
      const errorMsg = error instanceof Error ? (error.message || error.toString()) : String(error);
      throw new Error(`Solana批量转账失败: ${errorMsg}`);
    }
  }

  /**
   * Step 1: 本地计算所有 ATA（不走 RPC）
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
    console.log('📋 本地计算所有 ATA...');

    const ataList: ATAInfo[] = [];
    const skipped: Array<{ address: string; amount: string; error: string }> = [];

    for (let i = 0; i < recipients.length; i++) {
      console.log(`[ATA ${i + 1}/${recipients.length}] Processing address: ${recipients[i]}`);

      try {
        const owner = new PublicKey(recipients[i]);

        if (tokenInfo.isNativeSOL) {
        // SOL 转账不需要 ATA，直接使用用户地址
        ataList.push({
          owner,
          ata: owner, // SOL 转账时，ATA 就是用户地址
          amount: amounts[i]
        });
      } else {
        // SPL 代币需要计算 ATA
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
        console.warn(`⚠️ Skipping address ${recipients[i]}: ${errorName}`);
        skipped.push({
          address: recipients[i],
          amount: amounts[i],
          error: errorName
        });
      }
    }

    console.log(`✅ 计算完成: ${ataList.length} 个有效地址 (${skipped.length} 个跳过)`);
    return { ataList, skipped };
  }

  /**
   * Step 2: 批量查询 ATA 是否存在（1次 RPC 调用）
   */
  private async checkMissingATAs(
    connection: Connection,
    ataList: ATAInfo[]
  ): Promise<ATAInfo[]> {
    console.log('🔍 批量查询 ATA 是否存在...');

    const ataAddresses = ataList.map(item => item.ata);
    const accountInfos = await connection.getMultipleAccountsInfo(ataAddresses);

    const missing: ATAInfo[] = [];
    ataList.forEach((item, index) => {
      if (accountInfos[index] === null) {
        missing.push(item);
      }
    });

    console.log(`✅ 查询完成: ${missing.length} 个 ATA 需要创建`);
    return missing;
  }

  /**
   * Step 3: 批量创建 ATA
   * 创建ATA指令较大，建议每批不超过15个
   * 但我们使用用户设置的 batchSize，最大不超过15
   */
  private async batchCreateATAs(
    connection: Connection,
    wallet: Keypair,
    missingATAs: ATAInfo[],
    tokenInfo: SolanaTokenInfo,
    userBatchSize: number
  ): Promise<void> {
    console.log('🏗️  批量创建 ATA...');

    const tokenMint = new PublicKey(tokenInfo.address);
    // ATA创建和转账使用统一的批量大小
    // 简化配置：ATA创建和转账都使用用户设置的 batchSize
    const CREATE_BATCH_SIZE = userBatchSize;

    console.log(`创建 ATA 批次大小: ${CREATE_BATCH_SIZE}`);

    // 分批创建
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

        console.log(`✅ 创建 ATA 批次 ${Math.floor(i / CREATE_BATCH_SIZE) + 1}: ${signature}`);
        console.log(`   创建了 ${batch.length} 个 ATA`);
      } catch (error) {
        console.error(`❌ 创建 ATA 批次失败:`, error);
        throw error;
      }

      // 批次之间短暂延迟
      if (i + CREATE_BATCH_SIZE < missingATAs.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.log(`✅ ATA 创建完成: 共创建 ${missingATAs.length} 个`);
  }

  /**
   * Step 4: 批量发送代币（根据用户设置的 batchSize）
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
    console.log(`💸 批量发送代币 (每批 ${batchSize} 个)...`);

    const transactionHashes: string[] = [];
    const details: Array<{ address: string; amount: string; status: 'success' | 'failed'; error?: string }> = [];
    let totalGasUsed = 0;

    // 发送者的 ATA（SPL 代币需要）
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

    // 分批处理
    for (let i = 0; i < ataList.length; i += batchSize) {
      const batch = ataList.slice(i, Math.min(i + batchSize, ataList.length));
      const batchNumber = Math.floor(i / batchSize) + 1;

      console.log(`📦 处理批次 ${batchNumber}: 地址 ${i + 1}-${Math.min(i + batchSize, ataList.length)}`);

      try {
        const tx = new Transaction();

        for (const item of batch) {
          if (tokenInfo.isNativeSOL) {
            // 原生 SOL 转账
            const lamports = Math.floor(parseFloat(item.amount) * LAMPORTS_PER_SOL);
            tx.add(
              SystemProgram.transfer({
                fromPubkey: wallet.publicKey,
                toPubkey: item.owner,
                lamports
              })
            );
          } else {
            // SPL 代币转账
            const tokenMint = new PublicKey(tokenInfo.address);
            const transferAmount = BigInt(Math.floor(parseFloat(item.amount) * Math.pow(10, tokenInfo.decimals)));

            if (tokenInfo.programId.equals(TOKEN_2022_PROGRAM_ID)) {
              // Token-2022 使用 transferChecked
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

        // 发送交易
        const signature = await sendAndConfirmTransaction(connection, tx, [wallet], {
          commitment: 'confirmed',
          maxRetries: 3
        });

        // 获取交易详情计算 gas
        const txDetails = await connection.getTransaction(signature, {
          maxSupportedTransactionVersion: 0
        });
        const gasUsed = txDetails?.meta?.fee || 0;
        totalGasUsed += gasUsed;

        transactionHashes.push(signature);

        // 标记所有地址为成功
        batch.forEach(item => {
          details.push({
            address: item.owner.toBase58(),
            amount: item.amount,
            status: 'success'
          });
        });

        console.log(`✅ 批次 ${batchNumber} 完成: ${signature} (Gas: ${gasUsed} lamports)`);

      } catch (error) {
        console.error(`❌ 批次 ${batchNumber} 失败:`, error);

        // 标记整个批次为失败
        batch.forEach(item => {
          details.push({
            address: item.owner.toBase58(),
            amount: item.amount,
            status: 'failed',
            error: error instanceof Error ? error.message : '批次执行失败'
          });
        });
      }

      // 批次之间延迟
      if (i + batchSize < ataList.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log(`✅ 发送完成: ${transactionHashes.length} 个交易, 总 Gas: ${totalGasUsed} lamports`);

    return {
      transactionHashes,
      totalGasUsed,
      details
    };
  }

  /**
   * 检查交易状态
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

        // 使用更高效的查询方法
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

        // 检查确认状态
        const confirmations = signatureStatuses?.value?.confirmations || 0;

        return {
          status: 'confirmed',
          blockHeight: (transaction as any).blockHeight || undefined,
          confirmations
        };
      } catch (error) {
        console.error(`Failed to get transaction status (attempt ${attempt + 1}/${maxRetries}):`, error);

        if (attempt === maxRetries - 1) {
          // 最后一次尝试失败，返回错误
          return {
            status: 'failed',
            error: `Failed to check transaction status after ${maxRetries} attempts: ${error instanceof Error ? error.message : '未知错误'}`
          };
        }

        // 重试前等待
        await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
      }
    }

    // 这种情况理论上不会到达，但为了类型安全
    return {
      status: 'failed',
      error: 'Unknown error in transaction status check'
    };
  }

  /**
   * 估算批量转账费用
   */
  async estimateBatchTransferFee(
    rpcUrl: string,
    recipientCount: number,
    isSPLToken: boolean
  ): Promise<number> {
    try {
      const connection = this.initializeConnection(rpcUrl);

      // 基础交易费用
      let baseFee = DEFAULTS.SOLANA_FEES.base_fee_per_signature;

      // SPL代币转账需要额外的费用（每个转账可能需要创建关联代币账户）
      if (isSPLToken) {
        baseFee += recipientCount * DEFAULTS.SOLANA_FEES.spl_account_creation_fee;
      }

      // 添加一些缓冲
      const estimatedFee = baseFee * 1.2;

      return Math.ceil(estimatedFee);
    } catch (error) {
      console.error('Failed to estimate fee:', error);
      return DEFAULTS.SOLANA_FEES.spl_account_creation_fee;
    }
  }
}
