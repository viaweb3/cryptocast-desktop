/**
 * Smart transaction confirmation utility
 * Dynamically adjust wait time and retry strategy based on network conditions
 */

import { ChainUtils } from './chain-utils';
import { RetryUtils } from './retry-utils';

export interface TransactionConfirmationOptions {
  maxWaitTime?: number;
  checkInterval?: number;
  maxAttempts?: number;
  networkCongestionMultiplier?: number;
  adaptiveTimeout?: boolean;
}

export interface NetworkStatus {
  isCongested: boolean;
  averageBlockTime: number;
  gasPriceLevel: 'low' | 'medium' | 'high';
  recommendedTimeout: number;
}

export interface ConfirmationResult {
  confirmed: boolean;
  finalStatus: 'confirmed' | 'failed' | 'timeout';
  transactionData?: any;
  attempts: number;
  totalTime: number;
  networkStatus?: NetworkStatus;
}

export class TransactionUtils {
  // Network configuration
  private static readonly NETWORK_CONFIGS = {
    // EVM network configuration
    ethereum: { averageBlockTime: 12000, baseTimeout: 300000 }, // 12s block time, 5min base timeout
    polygon: { averageBlockTime: 2000, baseTimeout: 120000 },   // 2s block time, 2min base timeout
    arbitrum: { averageBlockTime: 250, baseTimeout: 60000 },     // 0.25s block time, 1min base timeout
    optimism: { averageBlockTime: 2000, baseTimeout: 120000 },    // 2s block time, 2min base timeout
    base: { averageBlockTime: 2000, baseTimeout: 120000 },       // 2s block time, 2min base timeout
    bsc: { averageBlockTime: 3000, baseTimeout: 180000 },       // 3s block time, 3min base timeout
    avalanche: { averageBlockTime: 2000, baseTimeout: 120000 },  // 2s block time, 2min base timeout

    // Solana network configuration
    'solana-mainnet-beta': { averageBlockTime: 400, baseTimeout: 30000 }, // 0.4s slot time, 30s base timeout
    'solana-devnet': { averageBlockTime: 400, baseTimeout: 15000 },        // 0.4s slot time, 15s base timeout
    'solana-testnet': { averageBlockTime: 400, baseTimeout: 15000 },       // 0.4s slot time, 15s base timeout
  };

  /**
   * Smart wait for transaction confirmation
   */
  static async waitForTransactionConfirmation(
    chain: string,
    txHash: string,
    getTransactionStatus: (txHash: string) => Promise<any>,
    options: TransactionConfirmationOptions = {}
  ): Promise<ConfirmationResult> {
    const startTime = Date.now();
    const networkStatus = this.assessNetworkStatus(chain);
    const config = this.getNetworkConfig(chain);

    // Adaptive timeout
    const maxWaitTime = options.adaptiveTimeout
      ? networkStatus.recommendedTimeout * (options.networkCongestionMultiplier || 1)
      : options.maxWaitTime || config.baseTimeout;

    const checkInterval = options.checkInterval || this.calculateCheckInterval(chain, networkStatus);

    let attempts = 0;
    let finalStatus: 'confirmed' | 'failed' | 'timeout' = 'timeout';

    while (Date.now() - startTime < maxWaitTime) {
      attempts++;

      try {
        const status = await getTransactionStatus(txHash);

        if (status.status === 'confirmed') {
          finalStatus = 'confirmed';
          return {
            confirmed: true,
            finalStatus,
            transactionData: status,
            attempts,
            totalTime: Date.now() - startTime,
            networkStatus
          };
        }

        if (status.status === 'failed') {
          finalStatus = 'failed';
          return {
            confirmed: false,
            finalStatus,
            transactionData: status,
            attempts,
            totalTime: Date.now() - startTime,
            networkStatus
          };
        }

        // Dynamically adjust check interval
        const elapsed = Date.now() - startTime;
        const dynamicInterval = this.calculateDynamicCheckInterval(
          elapsed,
          maxWaitTime,
          checkInterval,
          networkStatus
        );

        await this.sleep(dynamicInterval);

      } catch (error) {
        console.warn(`[Transaction Confirmation] Check ${attempts} failed:`, error);

        // Use retry mechanism to handle network errors
        const retryResult = await RetryUtils.executeWithRetry(
          async () => {
            // Wait and retry
            await this.sleep(checkInterval);
            return await getTransactionStatus(txHash);
          },
          {
            ...RetryUtils.NETWORK_RETRY_OPTIONS,
            maxAttempts: 2,
            onRetry: (attempt, error, delay) => {
              console.warn(`[Transaction Confirmation] Network retry ${attempt}:`, error.message);
            }
          }
        );

        if (retryResult.success && retryResult.result?.status === 'confirmed') {
          finalStatus = 'confirmed';
          return {
            confirmed: true,
            finalStatus,
            transactionData: retryResult.result,
            attempts,
            totalTime: Date.now() - startTime,
            networkStatus
          };
        }
      }
    }

    return {
      confirmed: false,
      finalStatus,
      attempts,
      totalTime: Date.now() - startTime,
      networkStatus
    };
  }

  /**
   * Assess network status
   */
  private static assessNetworkStatus(chain: string): NetworkStatus {
    const config = this.getNetworkConfig(chain);

    // Simplified network status assessment
    // In real projects, can integrate network monitoring API for real-time status
    const isSolana = ChainUtils.isSolanaChain(chain);

    // Simulate network congestion detection (based on time, etc.)
    const currentHour = new Date().getHours();
    const isPeakHours = (currentHour >= 9 && currentHour <= 17) || (currentHour >= 20 && currentHour <= 23);

    const isCongested = isPeakHours;
    const gasPriceLevel = isCongested ? 'high' : isSolana ? 'low' : 'medium';

    // Adjust recommended timeout based on network congestion
    const congestionMultiplier = isCongested ? 1.5 : 1.0;
    const recommendedTimeout = Math.round(config.baseTimeout * congestionMultiplier);

    return {
      isCongested,
      averageBlockTime: config.averageBlockTime,
      gasPriceLevel: gasPriceLevel as 'low' | 'medium' | 'high',
      recommendedTimeout
    };
  }

  /**
   * Get network configuration
   */
  private static getNetworkConfig(chain: string) {
    const normalizedChain = ChainUtils.normalizeChainIdentifier(chain);

    if (ChainUtils.isSolanaChain(chain)) {
      return this.NETWORK_CONFIGS[normalizedChain as keyof typeof this.NETWORK_CONFIGS] || this.NETWORK_CONFIGS['solana-mainnet-beta'];
    }

    // EVM chain configuration mapping
    const evmChainMap: Record<string, keyof typeof this.NETWORK_CONFIGS> = {
      '1': 'ethereum',
      '11155111': 'ethereum', // Sepolia uses same configuration
      '137': 'polygon',
      '80001': 'polygon',     // Mumbai
      '42161': 'arbitrum',
      '421614': 'arbitrum',  // Arbitrum Sepolia
      '10': 'optimism',
      '11155420': 'optimism', // OP Sepolia
      '8453': 'base',
      '84532': 'base',      // Base Sepolia
      '56': 'bsc',
      '97': 'bsc',         // BSC Testnet
      '43114': 'avalanche',
      '43113': 'avalanche' // Avalanche Fuji
    };

    const chainKey = evmChainMap[normalizedChain] || 'ethereum';
    return this.NETWORK_CONFIGS[chainKey];
  }

  /**
   * Calculate check interval
   */
  private static calculateCheckInterval(chain: string, networkStatus: NetworkStatus): number {
    const baseInterval = networkStatus.averageBlockTime;

    // Adjust check interval based on network congestion
    if (ChainUtils.isSolanaChain(chain)) {
      // Solana confirms faster but needs more checks
      return networkStatus.isCongested ? 1000 : 500;
    }

    // EVM chains adjust based on congestion
    return networkStatus.isCongested
      ? baseInterval * 1.5  // Reduce check frequency during congestion
      : baseInterval * 0.8; // Increase check frequency normally
  }

  /**
   * Calculate dynamic check interval
   */
  private static calculateDynamicCheckInterval(
    elapsed: number,
    maxWaitTime: number,
    baseInterval: number,
    networkStatus: NetworkStatus
  ): number {
    const progress = elapsed / maxWaitTime;

    // Gradually increase check interval over time
    let intervalMultiplier = 1.0;

    if (progress > 0.8) {
      // Last 20% of time, reduce check frequency
      intervalMultiplier = 2.0;
    } else if (progress > 0.5) {
      // Middle time period, slightly increase interval
      intervalMultiplier = 1.5;
    }

    // Further adjust when network is congested
    if (networkStatus.isCongested) {
      intervalMultiplier *= 1.2;
    }

    return Math.round(baseInterval * intervalMultiplier);
  }

  /**
   * Async sleep
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Batch wait for transaction confirmation
   */
  static async waitForBatchTransactions(
    chain: string,
    txHashes: string[],
    getTransactionStatus: (txHash: string) => Promise<any>,
    options: TransactionConfirmationOptions = {}
  ): Promise<ConfirmationResult[]> {
    const results: ConfirmationResult[] = [];

    // Parallel waiting, but limit concurrency to avoid overload
    const concurrencyLimit = ChainUtils.isSolanaChain(chain) ? 5 : 3;

    for (let i = 0; i < txHashes.length; i += concurrencyLimit) {
      const batch = txHashes.slice(i, i + concurrencyLimit);

      const batchPromises = batch.map(async (txHash) => {
        return await this.waitForTransactionConfirmation(chain, txHash, getTransactionStatus, options);
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Brief pause between batches
      if (i + concurrencyLimit < txHashes.length) {
        await this.sleep(1000);
      }
    }

    return results;
  }
}