import { GasService } from './GasService';
import { PriceService } from './PriceService';
import { ChainService } from './ChainService';
import type { DatabaseManager } from '../database/sqlite-schema';

export interface EstimateRequest {
  chain: string;
  tokenAddress: string;
  recipientCount: number;
  batchSize?: number;
}

export interface EstimateResult {
  totalRecipients: number;
  estimatedBatches: number;
  estimatedGasPerBatch: string;
  estimatedTotalGas: string;
  estimatedGasCostETH: string;
  estimatedGasCostUSD: string;
  estimatedDuration: string; // in minutes
  gasPrice: string;
  maxFeePerGas?: string; // EIP-1559
  maxPriorityFeePerGas?: string; // EIP-1559
  isEIP1559?: boolean;
  tokenSymbol?: string;
  recommendations: {
    optimalBatchSize: number;
    estimatedTimePerBatch: string; // in seconds
    totalEstimatedTime: string; // in minutes
  };
}

export class CampaignEstimator {
  private gasService: GasService;
  private priceService: PriceService;
  private chainService: ChainService;

  // Gas constants for different operations
  private readonly GAS_PER_TRANSFER = 21000; // Standard ETH transfer
  private readonly GAS_PER_ERC20_TRANSFER = 65000; // ERC20 transfer
  private readonly GAS_OVERHEAD_PER_BATCH = 50000; // Contract batch overhead
  private readonly DEFAULT_BATCH_SIZE = 100;
  private readonly SECONDS_PER_BATCH = 15; // Default sending interval

  constructor(databaseManager: DatabaseManager) {
    this.gasService = new GasService();
    this.priceService = new PriceService(databaseManager);
    this.chainService = new ChainService(databaseManager);
  }

  /**
   * Estimate campaign costs and duration
   */
  async estimate(request: EstimateRequest): Promise<EstimateResult> {
    try {
      const batchSize = request.batchSize || this.DEFAULT_BATCH_SIZE;
      const totalBatches = Math.ceil(request.recipientCount / batchSize);

      // Get chain configuration
      const chains = await this.chainService.getEVMChains();
      const chainConfig = chains.find(c => c.chainId.toString() === request.chain);

      if (!chainConfig) {
        throw new Error(`Chain configuration not found for chain ${request.chain}`);
      }

      console.log(`🔍 [CampaignEstimator] Estimating for chain ${request.chain} (${chainConfig.name})`);
      console.log(`🔍 [CampaignEstimator] RPC URL: ${chainConfig.rpcUrl}`);

      // Get real-time gas price from RPC with EIP-1559 support
      let gasPriceGwei: number;
      let maxFeePerGas: string | undefined;
      let maxPriorityFeePerGas: string | undefined;
      let isEIP1559 = false;

      try {
        const gasData = await this.gasService.getGasPriceFromRPC(chainConfig.rpcUrl, request.chain);
        gasPriceGwei = parseFloat(gasData.gasPrice);
        maxFeePerGas = gasData.maxFeePerGas;
        maxPriorityFeePerGas = gasData.maxPriorityFeePerGas;
        isEIP1559 = gasData.isEIP1559;

        console.log(`✓ [CampaignEstimator] Got real-time gas price: ${gasPriceGwei} Gwei`);
        if (isEIP1559) {
          console.log(`✓ [CampaignEstimator] EIP-1559: maxFee=${maxFeePerGas} Gwei, priority=${maxPriorityFeePerGas} Gwei`);
        }
      } catch (error) {
        console.warn(`⚠️  [CampaignEstimator] Failed to get RPC gas price, using fallback:`, error);
        const fallbackGasPrice = await this.gasService.getGasPrice(request.chain);
        gasPriceGwei = parseFloat(fallbackGasPrice);
        console.log(`📌 [CampaignEstimator] Using fallback gas price: ${gasPriceGwei} Gwei`);
      }

      // Determine if it's ERC20 or native token
      const isNativeToken = !request.tokenAddress ||
        request.tokenAddress === '0x0000000000000000000000000000000000000000';

      // Calculate gas estimates
      const gasPerTransfer = isNativeToken
        ? this.GAS_PER_TRANSFER
        : this.GAS_PER_ERC20_TRANSFER;

      const gasPerBatch = (gasPerTransfer * batchSize) + this.GAS_OVERHEAD_PER_BATCH;
      const totalGas = gasPerBatch * totalBatches;

      // Calculate gas cost in ETH
      const gasCostWei = BigInt(totalGas) * BigInt(Math.floor(gasPriceGwei * 1e9));
      const gasCostETH = Number(gasCostWei) / 1e18;

      // Get ETH price in USD
      const ethPrice = await this.priceService.getPrice('ETH');
      const gasCostUSD = gasCostETH * ethPrice;

      // Calculate duration
      const totalTimeSeconds = totalBatches * this.SECONDS_PER_BATCH;
      const totalTimeMinutes = totalTimeSeconds / 60;

      // Calculate optimal batch size (balance between gas efficiency and speed)
      const optimalBatchSize = this.calculateOptimalBatchSize(
        request.recipientCount,
        gasPerTransfer
      );

      const result: EstimateResult = {
        totalRecipients: request.recipientCount,
        estimatedBatches: totalBatches,
        estimatedGasPerBatch: gasPerBatch.toString(),
        estimatedTotalGas: totalGas.toString(),
        estimatedGasCostETH: gasCostETH.toFixed(6),
        estimatedGasCostUSD: gasCostUSD.toFixed(2),
        estimatedDuration: totalTimeMinutes.toFixed(1),
        gasPrice: gasPriceGwei.toFixed(2),
        maxFeePerGas,
        maxPriorityFeePerGas,
        isEIP1559,
        tokenSymbol: chainConfig.symbol,
        recommendations: {
          optimalBatchSize,
          estimatedTimePerBatch: this.SECONDS_PER_BATCH.toString(),
          totalEstimatedTime: totalTimeMinutes.toFixed(1),
        },
      };

      console.log(`✓ [CampaignEstimator] Estimation complete:`, {
        batches: totalBatches,
        totalGas: totalGas.toLocaleString(),
        costETH: gasCostETH.toFixed(6),
        costUSD: gasCostUSD.toFixed(2),
      });

      return result;
    } catch (error) {
      console.error('Failed to estimate campaign:', error);
      throw new Error('Campaign estimation failed');
    }
  }

  /**
   * Calculate optimal batch size based on recipient count and gas costs
   */
  private calculateOptimalBatchSize(recipientCount: number, gasPerTransfer: number): number {
    // For small campaigns, use smaller batches
    if (recipientCount < 50) {
      return Math.min(25, recipientCount);
    }

    // For medium campaigns
    if (recipientCount < 500) {
      return 50;
    }

    // For large campaigns, larger batches are more efficient
    if (recipientCount < 2000) {
      return 100;
    }

    // For very large campaigns
    return 200;
  }

  /**
   * Estimate token amount needed including buffer
   */
  async estimateTokenAmount(
    totalAmount: string,
    bufferPercentage: number = 5
  ): Promise<{
    requiredAmount: string;
    bufferAmount: string;
    totalWithBuffer: string;
  }> {
    try {
      const amount = parseFloat(totalAmount);
      const buffer = amount * (bufferPercentage / 100);
      const total = amount + buffer;

      return {
        requiredAmount: amount.toFixed(6),
        bufferAmount: buffer.toFixed(6),
        totalWithBuffer: total.toFixed(6),
      };
    } catch (error) {
      console.error('Failed to estimate token amount:', error);
      throw new Error('Token amount estimation failed');
    }
  }
}
