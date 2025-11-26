import { ethers } from 'ethers';

export interface GasInfo {
  network: string;
  gasPrice: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  estimatedGasLimit: string;
  estimatedCost: string;
  estimatedCostUsd: string;
  timestamp: string;
}

export class GasService {
  private readonly GAS_MULTIPLIER = 1.1; // 10% buffer for safety
  private readonly PRIORITY_FEE_MULTIPLIER = 1.5; // 50% buffer for priority fee

  /**
   * Get gas information from RPC directly
   */
  async getGasInfo(rpcUrl: string, network: string, tokenPrice: number = 0): Promise<GasInfo> {
    try {
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const feeData = await provider.getFeeData();

      let gasPrice = '0';
      let maxFeePerGas: string | undefined;
      let maxPriorityFeePerGas: string | undefined;

      // Check if network supports EIP-1559
      if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
        // EIP-1559 transaction (Ethereum, Polygon, etc.)
        // Calculate adjusted fees with multipliers
        const adjustedMaxFee = (feeData.maxFeePerGas * BigInt(Math.floor(this.GAS_MULTIPLIER * 100))) / 100n;
        const adjustedPriorityFee = (feeData.maxPriorityFeePerGas * BigInt(Math.floor(this.PRIORITY_FEE_MULTIPLIER * 100))) / 100n;

        // Ensure maxPriorityFeePerGas never exceeds maxFeePerGas (EIP-1559 requirement)
        const finalPriorityFee = adjustedPriorityFee > adjustedMaxFee ? adjustedMaxFee : adjustedPriorityFee;

        maxFeePerGas = ethers.formatUnits(adjustedMaxFee, 'gwei');
        maxPriorityFeePerGas = ethers.formatUnits(finalPriorityFee, 'gwei');
        gasPrice = maxFeePerGas;
      } else if (feeData.gasPrice) {
        // Legacy transaction
        const adjustedGasPrice = (feeData.gasPrice * BigInt(Math.floor(this.GAS_MULTIPLIER * 100))) / 100n;
        gasPrice = ethers.formatUnits(adjustedGasPrice, 'gwei');
      }

      // Estimate gas for a standard transfer (as baseline)
      const estimatedGasLimit = await this.estimateGasLimit(provider, network);

      // Calculate estimated costs (fix BigInt type mixing)
      const gasPriceWei = ethers.parseUnits(gasPrice, 'gwei');
      const estimatedGasLimitBigInt = BigInt(estimatedGasLimit);
      const estimatedCostWei = gasPriceWei * estimatedGasLimitBigInt;
      const estimatedCost = ethers.formatEther(estimatedCostWei);
      const estimatedCostUsd = tokenPrice > 0
        ? (parseFloat(estimatedCost) * tokenPrice).toFixed(2)
        : '0.00';

      return {
        network,
        gasPrice,
        maxFeePerGas,
        maxPriorityFeePerGas,
        estimatedGasLimit,
        estimatedCost,
        estimatedCostUsd,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Failed to get gas info:', error);
      return this.getFallbackGasInfo(network, tokenPrice);
    }
  }

  /**
   * Estimate gas limit for different transaction types
   */
  private async estimateGasLimit(provider: ethers.JsonRpcProvider, network: string): Promise<string> {
    try {
      // Standard ERC20 transfer
      const erc20TransferGas = 65000;

      // Batch transfer estimate (base + recipients * per-recipient)
      const baseBatchGas = 80000;
      const perRecipientGas = 12000;

      // Contract interaction estimate
      const contractInteractionGas = 150000;

      // Return highest estimate as safe default
      return Math.max(erc20TransferGas, contractInteractionGas, baseBatchGas).toString();
    } catch (error) {
      // Fallback to safe defaults
      return '200000'; // Conservative estimate
    }
  }

  /**
   * Get fallback gas info for when RPC calls fail
   */
  private getFallbackGasInfo(network: string, tokenPrice: number = 0): GasInfo {
    const fallbackGasPrices: Record<string, number> = {
      'ethereum': 30,      // 30 Gwei
      'sepolia': 10,       // 10 Gwei base + 20% buffer = 12 Gwei (Sepolia Testnet)
      'polygon': 30,       // 30 Gwei
      'arbitrum': 0.5,    // 0.5 Gwei
      'optimism': 0.5,    // 0.5 Gwei
      'bsc': 5,           // 5 Gwei
      'avalanche': 25,    // 25 Gwei
      'fantom': 20,       // 20 Gwei
      'default': 20       // 20 Gwei default
    };

    const gasPrice = (fallbackGasPrices[network.toLowerCase()] || fallbackGasPrices['default'])
      * this.GAS_MULTIPLIER;

    const estimatedGasLimit = '200000';
    const gasPriceWei = ethers.parseUnits(gasPrice.toString(), 'gwei');
    const estimatedCostWei = gasPriceWei * BigInt(estimatedGasLimit);
    const estimatedCost = ethers.formatEther(estimatedCostWei);
    const estimatedCostUsd = tokenPrice > 0
      ? (parseFloat(estimatedCost) * tokenPrice).toFixed(2)
      : '0.00';

    return {
      network,
      gasPrice: gasPrice.toFixed(2),
      maxFeePerGas: gasPrice.toFixed(2),
      maxPriorityFeePerGas: (gasPrice * 0.1).toFixed(2), // 10% of base fee
      estimatedGasLimit,
      estimatedCost,
      estimatedCostUsd,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get detailed gas estimate for batch transfer
   */
  async getBatchGasEstimate(
    rpcUrl: string,
    network: string,
    recipientCount: number,
    tokenPrice: number = 0
  ): Promise<GasInfo & { estimatedGasLimit: string; totalRecipients: number }> {
    try {
      console.log(`[GasService] 🔍 Getting batch gas estimate for ${recipientCount} recipients on ${network}`);
      console.log(`[GasService] 🌐 RPC URL: ${rpcUrl}`);

      const provider = new ethers.JsonRpcProvider(rpcUrl);

      console.log(`[GasService] ⏳ Fetching fee data...`);
      const feeData = await provider.getFeeData();

      console.log(`[GasService] 📊 Raw fee data received:`);
      console.log(`  - maxFeePerGas: ${feeData.maxFeePerGas ? ethers.formatUnits(feeData.maxFeePerGas, 'gwei') : 'null'} Gwei`);
      console.log(`  - maxPriorityFeePerGas: ${feeData.maxPriorityFeePerGas ? ethers.formatUnits(feeData.maxPriorityFeePerGas, 'gwei') : 'null'} Gwei`);
      console.log(`  - gasPrice: ${feeData.gasPrice ? ethers.formatUnits(feeData.gasPrice, 'gwei') : 'null'} Gwei`);

      // Calculate gas limit for batch transfer
      // Industry best practice: Use RPC's eth_estimateGas when possible,
      // fall back to conservative estimates for compatibility
      //
      // Standard ERC20 batch transfer gas breakdown:
      // - Base transaction: 21,000 gas
      // - Contract call overhead (including ReentrancyGuard): ~50,000 gas
      // - Per recipient ERC20 transferFrom: ~65,000 gas (worst case with storage writes)
      //
      // Note: Actual usage varies by token implementation:
      // - Standard ERC20 with storage updates: ~65,000 per recipient
      // - Optimized tokens (cached storage): ~25,000 per recipient
      // - Test tokens (minimal logic): ~15,000 per recipient
      const baseGas = 80000;       // Base: 21k transaction + 50k contract overhead + buffer
      const perRecipientGas = 65000; // Conservative: Standard ERC20 transferFrom (worst case)
      const totalGasLimit = (baseGas + (perRecipientGas * recipientCount)).toString();

      console.log(`[GasService] 🧮 Gas Limit Calculation:`);
      console.log(`  - Base Gas: ${baseGas.toLocaleString()}`);
      console.log(`  - Per Recipient Gas: ${perRecipientGas.toLocaleString()}`);
      console.log(`  - Recipient Count: ${recipientCount}`);
      console.log(`  - Total Gas Limit: ${totalGasLimit}`);

      let gasPrice = '0';
      let maxFeePerGas: string | undefined;
      let maxPriorityFeePerGas: string | undefined;

      if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
        // EIP-1559 - use same logic as getGasInfo to ensure consistency
        const adjustedMaxFee = (feeData.maxFeePerGas * BigInt(Math.floor(this.GAS_MULTIPLIER * 100))) / 100n;
        const adjustedPriorityFee = (feeData.maxPriorityFeePerGas * BigInt(Math.floor(this.PRIORITY_FEE_MULTIPLIER * 100))) / 100n;

        // Ensure maxPriorityFeePerGas never exceeds maxFeePerGas (EIP-1559 requirement)
        const finalPriorityFee = adjustedPriorityFee > adjustedMaxFee ? adjustedMaxFee : adjustedPriorityFee;

        maxFeePerGas = ethers.formatUnits(adjustedMaxFee, 'gwei');
        maxPriorityFeePerGas = ethers.formatUnits(finalPriorityFee, 'gwei');
        gasPrice = maxFeePerGas;
      } else if (feeData.gasPrice) {
        // Legacy transaction
        const adjustedGasPrice = (feeData.gasPrice * BigInt(Math.floor(this.GAS_MULTIPLIER * 100))) / 100n;
        gasPrice = ethers.formatUnits(adjustedGasPrice, 'gwei');
      }

      // Calculate costs (fix BigInt type mixing)
      const gasPriceWei = ethers.parseUnits(gasPrice, 'gwei');
      const totalGasLimitBigInt = BigInt(totalGasLimit);
      const estimatedCostWei = gasPriceWei * totalGasLimitBigInt;
      const estimatedCost = ethers.formatEther(estimatedCostWei);
      const estimatedCostUsd = tokenPrice > 0
        ? (parseFloat(estimatedCost) * tokenPrice).toFixed(2)
        : '0.00';

      return {
        network,
        gasPrice,
        maxFeePerGas,
        maxPriorityFeePerGas,
        estimatedGasLimit: totalGasLimit,
        estimatedCost,
        estimatedCostUsd,
        timestamp: new Date().toISOString(),
        totalRecipients: recipientCount
      };
    } catch (error) {
      console.error('Failed to get batch gas estimate:', error);
      const fallback = this.getFallbackGasInfo(network, tokenPrice);
      const totalGasLimit = (80000 + (12000 * recipientCount)).toString();

      return {
        ...fallback,
        estimatedGasLimit: totalGasLimit,
        totalRecipients: recipientCount
      };
    }
  }

  /**
   * Get real-time gas price from RPC for a specific chain
   * Supports both EIP-1559 and legacy transactions with safety buffer
   */
  async getGasPriceFromRPC(rpcUrl: string, chainId: string): Promise<{
    gasPrice: string;
    maxFeePerGas?: string;
    maxPriorityFeePerGas?: string;
    isEIP1559: boolean;
  }> {
    try {
      
      const provider = new ethers.JsonRpcProvider(rpcUrl, undefined, {
        batchMaxCount: 1,
        polling: false,
      });

      // Set timeout for RPC call
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Gas price RPC request timeout')), 10000);
      });

      const feeData = await Promise.race([
        provider.getFeeData(),
        timeoutPromise
      ]) as ethers.FeeData;

      // Check if network supports EIP-1559
      // Special handling for testnets and networks that don't properly support EIP-1559
      // Note: Sepolia (11155111) actually supports EIP-1559, so removed from list
      const nonEIP1559Chains: string[] = []; // No chains currently need special handling
      const isNonEIP1559Chain = nonEIP1559Chains.includes(chainId);

      console.log(`[GasService] 🔧 EIP-1559 Check:`);
      console.log(`  - Chain ID: ${chainId}`);
      console.log(`  - Is Non-EIP-1559 Chain: ${isNonEIP1559Chain}`);
      console.log(`  - Has maxFeePerGas: ${feeData.maxFeePerGas ? 'YES' : 'NO'}`);
      console.log(`  - Has maxPriorityFeePerGas: ${feeData.maxPriorityFeePerGas ? 'YES' : 'NO'}`);
      console.log(`  - maxFeePerGas > 0: ${feeData.maxFeePerGas && feeData.maxFeePerGas > 0n ? 'YES' : 'NO'}`);
      console.log(`  - maxPriorityFeePerGas > 0: ${feeData.maxPriorityFeePerGas && feeData.maxPriorityFeePerGas > 0n ? 'YES' : 'NO'}`);

      if (!isNonEIP1559Chain && feeData.maxFeePerGas && feeData.maxPriorityFeePerGas &&
          feeData.maxFeePerGas > 0n && feeData.maxPriorityFeePerGas > 0n) {

        console.log(`[GasService] ✅ Using EIP-1559 Path`);
        console.log(`[GasService] 📊 Raw EIP-1559 Values:`);
        console.log(`  - Raw maxFeePerGas: ${ethers.formatUnits(feeData.maxFeePerGas, 'gwei')} Gwei`);
        console.log(`  - Raw maxPriorityFeePerGas: ${ethers.formatUnits(feeData.maxPriorityFeePerGas, 'gwei')} Gwei`);
        console.log(`  - Gas Multiplier: ${this.GAS_MULTIPLIER} (${(this.GAS_MULTIPLIER - 1) * 100}% buffer)`);
        console.log(`  - Priority Multiplier: ${this.PRIORITY_FEE_MULTIPLIER} (${(this.PRIORITY_FEE_MULTIPLIER - 1) * 100}% buffer)`);

        // Apply safety buffer (20% on maxFee, 50% on priority)
        const adjustedMaxFee = (feeData.maxFeePerGas * BigInt(Math.floor(this.GAS_MULTIPLIER * 100))) / 100n;
        const adjustedPriorityFee = (feeData.maxPriorityFeePerGas * BigInt(Math.floor(this.PRIORITY_FEE_MULTIPLIER * 100))) / 100n;

        console.log(`[GasService] 📈 After Buffers:`);
        console.log(`  - Adjusted maxFeePerGas: ${ethers.formatUnits(adjustedMaxFee, 'gwei')} Gwei`);
        console.log(`  - Adjusted maxPriorityFeePerGas: ${ethers.formatUnits(adjustedPriorityFee, 'gwei')} Gwei`);

        // Ensure maxPriorityFeePerGas never exceeds maxFeePerGas (EIP-1559 requirement)
        const finalPriorityFee = adjustedPriorityFee > adjustedMaxFee ? adjustedMaxFee : adjustedPriorityFee;

        const maxFeePerGas = ethers.formatUnits(adjustedMaxFee, 'gwei');
        const maxPriorityFeePerGas = ethers.formatUnits(finalPriorityFee, 'gwei');

        console.log(`[GasService] 🎯 Final EIP-1559 Values:`);
        console.log(`  - Final maxFeePerGas: ${maxFeePerGas} Gwei`);
        console.log(`  - Final maxPriorityFeePerGas: ${maxPriorityFeePerGas} Gwei`);

        return {
          gasPrice: maxFeePerGas,
          maxFeePerGas,
          maxPriorityFeePerGas,
          isEIP1559: true,
        };
      } else if (feeData.gasPrice && feeData.gasPrice > 0n) {

        console.log(`[GasService] ⚠️  Using Legacy Path (EIP-1559 not available)`);
        console.log(`[GasService] 📊 Raw Legacy Values:`);
        console.log(`  - Raw gasPrice: ${ethers.formatUnits(feeData.gasPrice, 'gwei')} Gwei`);
        console.log(`  - Gas Multiplier: ${this.GAS_MULTIPLIER} (${(this.GAS_MULTIPLIER - 1) * 100}% buffer)`);

        // Legacy transaction with 20% buffer
        const adjustedGasPrice = (feeData.gasPrice * BigInt(Math.floor(this.GAS_MULTIPLIER * 100))) / 100n;
        const gasPrice = ethers.formatUnits(adjustedGasPrice, 'gwei');

        console.log(`[GasService] 📈 After Buffer:`);
        console.log(`  - Adjusted gasPrice: ${gasPrice} Gwei`);

        return {
          gasPrice,
          isEIP1559: false,
        };
      } else {
        console.log(`[GasService] ❌ No gas price data available from RPC`);
        throw new Error('No gas price data available from RPC');
      }
    } catch (error) {
      console.error(`❌ [GasService] Failed to get gas price from RPC for chain ${chainId}:`, error);
      throw error;
    }
  }

  /**
   * Get gas price for a specific chain (with RPC fallback)
   * This is the main method used by CampaignEstimator
   */
  async getGasPrice(chainId: string, rpcUrl?: string): Promise<string> {
    try {
      // If RPC URL is provided, try to get real-time gas price
      if (rpcUrl) {
        const gasData = await this.getGasPriceFromRPC(rpcUrl, chainId);
        return gasData.gasPrice;
      }

      // Fallback to preset values with safety buffer
      console.warn(`⚠️  [GasService] No RPC URL provided for chain ${chainId}, using fallback values`);
      return this.getFallbackGasPriceForChain(chainId);
    } catch (error) {
      console.error(`❌ [GasService] Failed to get gas price for chain ${chainId}:`, error);
      return this.getFallbackGasPriceForChain(chainId);
    }
  }

  /**
   * Get fallback gas price with safety buffer
   */
  private getFallbackGasPriceForChain(chainId: string): string {
    const fallbackGasPrices: Record<string, number> = {
      '1': 30,         // Ethereum Mainnet
      '11155111': 10,  // Sepolia Testnet (10 Gwei base + 20% buffer = 12 Gwei)
      '137': 30,       // Polygon
      '42161': 0.1,    // Arbitrum One
      '10': 0.1,       // Optimism
      '8453': 0.1,     // Base
      '56': 5,         // BSC
      '43114': 25,     // Avalanche C-Chain
    };

    const basePrice = fallbackGasPrices[chainId] || 20;
    const priceWithBuffer = basePrice * this.GAS_MULTIPLIER;

    
    return priceWithBuffer.toFixed(2);
  }

  /**
   * Get transaction options with proper gas settings
   */
  getTransactionOptions(gasInfo: GasInfo): any {
    const options: any = {};

    if (gasInfo.maxFeePerGas && gasInfo.maxPriorityFeePerGas) {
      // EIP-1559 transaction
      options.maxFeePerGas = ethers.parseUnits(gasInfo.maxFeePerGas, 'gwei');
      options.maxPriorityFeePerGas = ethers.parseUnits(gasInfo.maxPriorityFeePerGas, 'gwei');
    } else {
      // Legacy transaction
      options.gasPrice = ethers.parseUnits(gasInfo.gasPrice, 'gwei');
    }

    options.gasLimit = BigInt(Math.floor(Number(gasInfo.estimatedGasLimit) * 1.05)); // 5% buffer

    return options;
  }

  /**
   * Estimate total gas cost for campaign
   */
  async estimateCampaignGasCost(
    rpcUrl: string,
    network: string,
    totalRecipients: number,
    batchSize: number = 100,
    tokenPrice: number = 0
  ): Promise<{ totalBatches: number; totalGasCost: string; totalGasCostUsd: string }> {
    const batchesNeeded = Math.ceil(totalRecipients / batchSize);
    let totalCostWei = BigInt(0);

    for (let i = 0; i < batchesNeeded; i++) {
      const recipientsInBatch = Math.min(batchSize, totalRecipients - (i * batchSize));
      const gasInfo = await this.getBatchGasEstimate(rpcUrl, network, recipientsInBatch, tokenPrice);
      const gasPriceWei = ethers.parseUnits(gasInfo.gasPrice, 'gwei');
      const batchCost = gasPriceWei * BigInt(gasInfo.estimatedGasLimit);
      totalCostWei += batchCost;
    }

    const totalCost = ethers.formatEther(totalCostWei);
    const totalCostUsd = tokenPrice > 0
      ? (parseFloat(totalCost) * tokenPrice).toFixed(2)
      : '0.00';

    return {
      totalBatches: batchesNeeded,
      totalGasCost: totalCost,
      totalGasCostUsd: totalCostUsd
    };
  }
}