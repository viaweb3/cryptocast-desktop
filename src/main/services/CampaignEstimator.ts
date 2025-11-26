import { GasService } from './GasService';
import { ChainService } from './ChainService';
import { ChainUtils } from '../utils/chain-utils';
import type { DatabaseManager } from '../database/sqlite-schema';

export interface EstimateRequest {
  chain: string;
  chainType?: 'evm' | 'solana';
  tokenAddress: string;
  recipientCount: number;
  batchSize?: number;
}

export interface EstimateResult {
  totalRecipients: number;
  estimatedBatches: number;
  estimatedGasPerBatch: string;
  estimatedTotalGas: string;
  estimatedGasCost: string; // Native token cost (ETH, BNB, etc.)
  estimatedDuration: string; // in minutes
  gasPrice: string; // Gas price in Gwei
  maxFeePerGas?: string; // EIP-1559
  maxPriorityFeePerGas?: string; // EIP-1559
  isEIP1559?: boolean;
  tokenSymbol?: string; // Native token symbol (ETH, BNB, MATIC, etc.)
  recommendations: {
    optimalBatchSize: number;
    estimatedTimePerBatch: string; // in seconds
    totalEstimatedTime: string; // in minutes
  };
}

export class CampaignEstimator {
  private gasService: GasService;
  private chainService: ChainService;

  // Updated gas constants based on actual usage data
  private readonly GAS_PER_TRANSFER = 21000; // Standard ETH transfer
  private readonly GAS_PER_ERC20_TRANSFER = 50000; // Updated: Based on actual usage (~47K)
  private readonly GAS_OVERHEAD_PER_BATCH = 80000; // Updated: Based on actual contract deployment (~80K)
  private readonly DEFAULT_BATCH_SIZE = 100;
  private readonly SECONDS_PER_BATCH = 15; // Default sending interval

  // Chain-specific gas multipliers for better accuracy
  private readonly CHAIN_GAS_MULTIPLIERS: Record<string, number> = {
    '1': 1.0,      // Ethereum - use actual gas
    '56': 0.3,     // BSC - much lower gas costs
    '137': 0.5,    // Polygon - lower gas costs
    '42161': 0.2,  // Arbitrum - much lower gas costs
    '10': 0.2,     // Optimism - much lower gas costs
    '8453': 0.2,   // Base - much lower gas costs
    '43114': 0.8,  // Avalanche - moderately lower gas costs
    '11155111': 0.1, // Sepolia testnet - very low gas costs
  };

  constructor(databaseManager: DatabaseManager) {
    this.gasService = new GasService();
    this.chainService = new ChainService(databaseManager);
  }

  /**
   * Estimate campaign costs and duration
   */
  async estimate(request: EstimateRequest): Promise<EstimateResult> {
    try {
      // 使用统一的链类型判断工具
      const chainType = request.chainType || ChainUtils.getChainType(request.chain);

      if (chainType === 'solana') {
        return this.estimateSolana(request);
      }

      return this.estimateEVM(request);
    } catch (error) {
      console.error('Failed to estimate campaign:', error);
      throw new Error('Campaign estimation failed');
    }
  }

  /**
   * Estimate EVM campaign costs and duration
   */
  private async estimateEVM(request: EstimateRequest): Promise<EstimateResult> {
    try {
      const batchSize = request.batchSize || this.DEFAULT_BATCH_SIZE;
      const totalBatches = Math.ceil(request.recipientCount / batchSize);

      // Get chain configuration
      const chains = await this.chainService.getEVMChains();
      const chainConfig = chains.find(c => c.chainId.toString() === request.chain);

      if (!chainConfig) {
        throw new Error(`Chain configuration not found for chain ${request.chain}`);
      }

      
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

              } catch (error) {
        console.warn(`⚠️  [CampaignEstimator] Failed to get RPC gas price, using fallback:`, error);
        const fallbackGasPrice = await this.gasService.getGasPrice(request.chain);
        gasPriceGwei = parseFloat(fallbackGasPrice);
              }

      // Determine if it's ERC20 or native token
      const isNativeToken = !request.tokenAddress ||
        request.tokenAddress === '0x0000000000000000000000000000000000000000';

      // Get chain-specific gas multiplier
      const chainMultiplier = this.CHAIN_GAS_MULTIPLIERS[request.chain] || 1.0;

      // Calculate gas estimates with chain-specific adjustments
      const gasPerTransfer = isNativeToken
        ? this.GAS_PER_TRANSFER
        : this.GAS_PER_ERC20_TRANSFER;

      // Apply chain-specific multiplier for more accurate estimates
      const adjustedGasPerTransfer = Math.floor(gasPerTransfer * chainMultiplier);
      const adjustedOverhead = Math.floor(this.GAS_OVERHEAD_PER_BATCH * chainMultiplier);
      const gasPerBatch = (adjustedGasPerTransfer * batchSize) + adjustedOverhead;
      const totalGas = gasPerBatch * totalBatches;

      
      // Calculate gas cost in native token
      const gasCostWei = BigInt(totalGas) * BigInt(Math.floor(gasPriceGwei * 1e9));
      const gasCostNative = Number(gasCostWei) / 1e18;

      const nativeTokenSymbol = chainConfig.symbol || 'ETH';
      
      // Calculate duration
      const totalTimeSeconds = totalBatches * this.SECONDS_PER_BATCH;
      const totalTimeMinutes = totalTimeSeconds / 60;

      // Calculate optimal batch size (balance between gas efficiency and speed)
      const optimalBatchSize = this.calculateOptimalBatchSize(
        request.recipientCount,
        adjustedGasPerTransfer,
        request.chain
      );

      const result: EstimateResult = {
        totalRecipients: request.recipientCount,
        estimatedBatches: totalBatches,
        estimatedGasPerBatch: gasPerBatch.toString(),
        estimatedTotalGas: totalGas.toString(),
        estimatedGasCost: gasCostNative.toFixed(6),
        estimatedDuration: totalTimeMinutes.toFixed(1),
        gasPrice: gasPriceGwei.toFixed(2),
        maxFeePerGas,
        maxPriorityFeePerGas,
        isEIP1559,
        tokenSymbol: nativeTokenSymbol,
        recommendations: {
          optimalBatchSize,
          estimatedTimePerBatch: this.SECONDS_PER_BATCH.toString(),
          totalEstimatedTime: totalTimeMinutes.toFixed(1),
        },
      };

      
      return result;
    } catch (error) {
      console.error('Failed to estimate campaign:', error);
      throw new Error('Campaign estimation failed');
    }
  }

  /**
   * Estimate Solana campaign costs and duration
   */
  private async estimateSolana(request: EstimateRequest): Promise<EstimateResult> {
    try {
      const batchSize = request.batchSize || 10; // Default Solana batch size is 10
      const totalBatches = Math.ceil(request.recipientCount / batchSize);

      // Get Solana chain configuration
      const solanaChains = await this.chainService.getSolanaChains();
      const chainConfig = solanaChains.find(c => c.chainId?.toString() === request.chain);

      if (!chainConfig) {
        throw new Error(`Solana chain configuration not found for chain ${request.chain}`);
      }

      // Solana transaction fee estimation
      // Base fee: ~0.000005 SOL per signature
      // For token transfers: 1 signature for sender
      // For ATA creation: Additional ~0.00203928 SOL rent-exempt minimum
      const BASE_FEE_PER_TX = 0.000005; // SOL per transaction
      const ATA_CREATION_FEE = 0.00203928; // SOL for ATA creation (rent-exempt minimum)

      // Assume 20% of recipients might need ATA creation
      const estimatedATACreations = Math.ceil(request.recipientCount * 0.2);

      // Calculate total fees
      const totalTransferFees = request.recipientCount * BASE_FEE_PER_TX;
      const totalATAFees = estimatedATACreations * ATA_CREATION_FEE;
      const totalFeesSOL = totalTransferFees + totalATAFees;

      // Duration estimation
      // Solana is much faster than EVM chains
      const SECONDS_PER_SOLANA_BATCH = 5; // Conservative estimate
      const totalTimeSeconds = totalBatches * SECONDS_PER_SOLANA_BATCH;
      const totalTimeMinutes = totalTimeSeconds / 60;

      // Calculate optimal batch size for Solana
      const optimalBatchSize = this.calculateOptimalSolanaBatchSize(request.recipientCount);

      const result: EstimateResult = {
        totalRecipients: request.recipientCount,
        estimatedBatches: totalBatches,
        estimatedGasPerBatch: (totalFeesSOL / totalBatches).toFixed(9),
        estimatedTotalGas: totalFeesSOL.toFixed(9),
        estimatedGasCost: totalFeesSOL.toFixed(6),
        estimatedDuration: totalTimeMinutes.toFixed(1),
        gasPrice: BASE_FEE_PER_TX.toFixed(9), // Not really "gas price" but transaction fee
        isEIP1559: false,
        tokenSymbol: 'SOL',
        recommendations: {
          optimalBatchSize,
          estimatedTimePerBatch: SECONDS_PER_SOLANA_BATCH.toString(),
          totalEstimatedTime: totalTimeMinutes.toFixed(1),
        },
      };

      return result;
    } catch (error) {
      console.error('Failed to estimate Solana campaign:', error);
      throw new Error('Solana campaign estimation failed');
    }
  }

  /**
   * Calculate optimal batch size for Solana campaigns
   */
  private calculateOptimalSolanaBatchSize(recipientCount: number): number {
    // Solana has different constraints than EVM
    // Recommended batch sizes: 5, 10, 15, 20

    if (recipientCount < 50) {
      return 5;
    }

    if (recipientCount < 200) {
      return 10;
    }

    if (recipientCount < 500) {
      return 15;
    }

    return 20;
  }

  /**
   * Calculate optimal batch size based on recipient count, gas costs, and chain characteristics
   */
  private calculateOptimalBatchSize(recipientCount: number, gasPerTransfer: number, chainId: string): number {
    // Chain-specific maximum batch sizes (considering gas limits and block constraints)
    const chainMaxBatchSize: Record<string, number> = {
      '1': 200,       // Ethereum - conservative due to high gas
      '56': 500,      // BSC - can handle larger batches
      '137': 300,     // Polygon - moderate batch sizes
      '42161': 400,   // Arbitrum - good for larger batches
      '10': 400,      // Optimism - good for larger batches
      '8453': 400,    // Base - good for larger batches
      '43114': 200,   // Avalanche - moderate batches
      '11155111': 100, // Sepolia testnet - smaller batches
    };

    const maxBatchSize = chainMaxBatchSize[chainId] || 200;

    // For small campaigns, use smaller batches
    if (recipientCount < 50) {
      return Math.min(25, recipientCount, maxBatchSize);
    }

    // For medium campaigns, scale with chain capabilities
    if (recipientCount < 500) {
      const mediumBatchSize = chainId === '56' ? 100 : 50; // BSC can handle larger batches
      return Math.min(mediumBatchSize, recipientCount, maxBatchSize);
    }

    // For large campaigns, use larger batches within chain limits
    if (recipientCount < 2000) {
      return Math.min(100, recipientCount, maxBatchSize);
    }

    // For very large campaigns, use maximum efficient size for the chain
    return Math.min(maxBatchSize, recipientCount);
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
