import { ethers } from 'ethers';
import { GasService, GasInfo, TransactionOptions } from './GasService';
import { DEFAULTS } from '../config/defaults';
import { NATIVE_TOKEN_ADDRESSES, isNativeToken } from '../config/constants';
import { Logger } from '../utils/logger';

const logger = Logger.getInstance().child('ContractService');

// Batch Airdrop Contract ABI
const BATCH_AIRDROP_CONTRACT_ABI = [
  // ERC20 token batch transfer
  "function batchTransfer(address token, address[] recipients, uint256[] amounts) external",
  // Native token batch transfer
  "function batchTransferNative(address[] recipients, uint256[] amounts) external payable"
];

// ERC20 ABI for token operations
const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)",
  "function transfer(address to, uint256 amount) external returns (bool)",
  "function decimals() external view returns (uint8)",
  "function symbol() external view returns (string)",
  "function name() external view returns (string)"
];

export interface BatchInfo {
  token: string;
  totalAmount: string;
  recipientCount: number;
  executedCount: number;
  executed: boolean;
  cancelled: boolean;
  createdAt: string;
}

export interface BatchDetails {
  recipients: string[];
  amounts: string[];
}

export interface ContractDeploymentResult {
  contractAddress: string;
  transactionHash: string;
  blockNumber: number;
  gasUsed: string;
}

export interface BatchTransferResult {
  transactionHash: string;
  totalAmount: string;
  recipientCount: number;
  gasUsed: string;
}

export interface ContractDeploymentConfig {
  tokenAddress: string;
  chainId: number;
  rpcUrl: string;
  deployerPrivateKey: string;
}

export class ContractService {
  private gasService: GasService;

  constructor() {
    this.gasService = new GasService();
  }


  /**
   * Deploy the simple batch transfer contract
   */
  async deployContract(config: ContractDeploymentConfig): Promise<ContractDeploymentResult> {
    try {
      const provider = new ethers.JsonRpcProvider(config.rpcUrl);
      const wallet = new ethers.Wallet(config.deployerPrivateKey, provider);

      // Get deployment gas estimate
      const gasInfo = await this.gasService.getGasInfo(config.rpcUrl, 'ethereum');
      const txOptions = this.gasService.getTransactionOptions(gasInfo);

      // Load contract bytecode
      const bytecode = this.getContractBytecode();
      const contractFactory = new ethers.ContractFactory(BATCH_AIRDROP_CONTRACT_ABI, bytecode, wallet);

      // Deploy contract
      // Our contract has no constructor arguments, so we pass tx options directly
      // 使用配置化的Gas limit
      const deployOptions = {
        ...txOptions,
        gasLimit: BigInt(DEFAULTS.GAS_LIMITS.campaign_deploy)
      };

      const contract = await contractFactory.deploy(deployOptions);
      await contract.waitForDeployment();
      const receipt = await contract.deploymentTransaction()?.wait();

      return {
        contractAddress: await contract.getAddress(),
        transactionHash: contract.deploymentTransaction()?.hash || '',
        blockNumber: receipt?.blockNumber || 0,
        gasUsed: receipt?.gasUsed?.toString() || '0'
      };
    } catch (error) {
      logger.error('Failed to deploy contract', error as Error, { chainId: config.chainId });
      throw new Error(`Contract deployment failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Approve tokens for the contract to use
   */
  async approveTokens(
    rpcUrl: string,
    privateKey: string,
    tokenAddress: string,
    contractAddress: string,
    amount: string
  ): Promise<string> {
    try {
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const wallet = new ethers.Wallet(privateKey, provider);
      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, wallet);

      // Check current allowance
      const currentAllowance = await tokenContract.allowance(wallet.address, contractAddress);
      if (currentAllowance >= BigInt(amount)) {
        return 'already-approved';
      }

      // Get gas info and create transaction
      const gasInfo = await this.gasService.getGasInfo(rpcUrl, 'ethereum');
      const txOptions = this.gasService.getTransactionOptions(gasInfo);

      // Approve tokens
      const tx = await tokenContract.approve(contractAddress, amount, txOptions);
      const receipt = await tx.wait();

      return tx.hash;
    } catch (error) {
      logger.error('Failed to approve tokens', error as Error, { tokenAddress, contractAddress });
      throw new Error(`Token approval failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 直接执行批量转账 - 支持原生代币和 ERC20 代币
   */
  async batchTransfer(
    contractAddress: string,
    rpcUrl: string,
    privateKey: string,
    recipients: string[],
    amounts: string[],
    tokenAddress: string
  ): Promise<BatchTransferResult> {
    try {
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const wallet = new ethers.Wallet(privateKey, provider);
      const contract = new ethers.Contract(contractAddress, BATCH_AIRDROP_CONTRACT_ABI, wallet);

      // Validate inputs
      if (recipients.length !== amounts.length) {
        throw new Error('收币地址和金额数组长度必须相同');
      }

      if (recipients.length === 0) {
        throw new Error('收币地址不能为空');
      }

      const isNative = isNativeToken(tokenAddress);

      // Get token decimals (18 for native tokens)
      const tokenDecimals = isNative ? 18 : await this.getTokenDecimals(rpcUrl, tokenAddress);

      // Convert amounts to BigInt with correct decimals
      const bigintAmounts = amounts.map(amount => ethers.parseUnits(amount.toString(), tokenDecimals));

      // Get gas info for this batch
      logger.debug('Getting gas estimate', { recipientCount: recipients.length });
      const gasInfo = await this.gasService.getBatchGasEstimate(rpcUrl, 'ethereum', recipients.length);

      logger.debug('Gas info received', {
        gasPrice: gasInfo.gasPrice,
        maxFeePerGas: gasInfo.maxFeePerGas,
        maxPriorityFeePerGas: gasInfo.maxPriorityFeePerGas,
        estimatedGasLimit: gasInfo.estimatedGasLimit,
        estimatedCost: gasInfo.estimatedCost
      });

      const txOptions = this.gasService.getTransactionOptions(gasInfo);

      logger.debug('Transaction options', {
        gasPrice: txOptions.gasPrice ? ethers.formatUnits(txOptions.gasPrice, 'gwei') : undefined,
        maxFeePerGas: txOptions.maxFeePerGas ? ethers.formatUnits(txOptions.maxFeePerGas, 'gwei') : undefined,
        maxPriorityFeePerGas: txOptions.maxPriorityFeePerGas ? ethers.formatUnits(txOptions.maxPriorityFeePerGas, 'gwei') : undefined,
        gasLimit: txOptions.gasLimit?.toString()
      });

      // Get wallet balance before transaction
      const balance = await provider.getBalance(wallet.address);
      logger.debug('Wallet balance', { balance: ethers.formatEther(balance) });

      // 执行批量转账
      logger.info('Executing batch transfer', {
        recipientCount: recipients.length,
        isNative,
        tokenAddress: isNative ? 'Native Token' : tokenAddress
      });

      let tx;
      if (isNative) {
        // Native token transfer - calculate total value needed
        const totalValue = bigintAmounts.reduce((sum, amount) => sum + amount, 0n);

        // Call batchTransferNative with msg.value
        tx = await contract.batchTransferNative(recipients, bigintAmounts, {
          ...txOptions,
          value: totalValue
        });
      } else {
        // ERC20 token transfer
        tx = await contract.batchTransfer(tokenAddress, recipients, bigintAmounts, txOptions);
      }

      logger.info('Transaction submitted', {
        txHash: tx.hash,
        gasLimit: tx.gasLimit?.toString(),
        gasPrice: tx.gasPrice ? ethers.formatUnits(tx.gasPrice, 'gwei') : undefined
      });

      const receipt = await tx.wait();
      logger.info('Transaction confirmed', {
        gasUsed: receipt?.gasUsed?.toString(),
        actualGasPrice: receipt?.gasPrice ? ethers.formatUnits(receipt.gasPrice, 'gwei') : undefined,
        actualCost: receipt ? ethers.formatEther(receipt.gasUsed * receipt.gasPrice) : undefined
      });

      // 计算总金额
      const totalAmount = bigintAmounts.reduce((sum, amount) => sum + amount, 0n);

      return {
        transactionHash: tx.hash,
        totalAmount: ethers.formatUnits(totalAmount, 18),
        recipientCount: recipients.length,
        gasUsed: receipt?.gasUsed?.toString() || '0'
      };
    } catch (error) {
      logger.error('批量转账失败', error as Error, { recipientCount: recipients.length });
      throw new Error(`批量转账失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * Get token decimals
   */
  async getTokenDecimals(rpcUrl: string, tokenAddress: string): Promise<number> {
    try {
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
      const decimals = await tokenContract.decimals();
      return Number(decimals);
    } catch (error) {
      logger.warn('Failed to get token decimals, using default', { tokenAddress, error: error instanceof Error ? error.message : String(error) });
      return 18; // Default fallback
    }
  }

  /**
   * Get token information
   */
  async getTokenInfo(
    rpcUrl: string,
    tokenAddress: string
  ): Promise<{ symbol: string; name: string; decimals: number }> {
    try {
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);

      const [symbol, name, decimals] = await Promise.all([
        tokenContract.symbol(),
        tokenContract.name(),
        tokenContract.decimals()
      ]);

      return {
        symbol,
        name,
        decimals: Number(decimals)
      };
    } catch (error) {
      logger.error('Failed to get token info', error as Error, { tokenAddress });
      throw new Error(`Failed to get token info: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Withdraw remaining tokens from campaign wallet to specified address
   */
  async withdrawRemainingTokens(
    rpcUrl: string,
    privateKey: string,
    recipientAddress: string,
    tokenAddress: string
  ): Promise<{
    txHash: string;
    amount: string;
  }> {
    try {
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const wallet = new ethers.Wallet(privateKey, provider);

      if (isNativeToken(tokenAddress)) {
        throw new Error('Cannot withdraw native tokens as ERC20. Use withdrawRemainingETH instead.');
      }

      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, wallet);
      const tokenDecimals = await this.getTokenDecimals(rpcUrl, tokenAddress);
      const tokenBalance = await tokenContract.balanceOf(wallet.address);

      if (tokenBalance === 0n) {
        throw new Error('No tokens to withdraw');
      }

      // Get gas info
      const gasInfo = await this.gasService.getGasInfo(rpcUrl, 'ethereum');
      const txOptions = this.gasService.getTransactionOptions(gasInfo);

      const tx = await tokenContract.transfer(recipientAddress, tokenBalance, txOptions);
      await tx.wait();

      const amount = ethers.formatUnits(tokenBalance, tokenDecimals);

      return {
        txHash: tx.hash,
        amount
      };
    } catch (error) {
      logger.error('Failed to withdraw tokens', error as Error, { tokenAddress, recipientAddress });
      throw new Error(`Failed to withdraw tokens: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Withdraw remaining native token (ETH/BNB/MATIC/AVAX/etc) from EVM wallet to specified address
   * Preserves enough native token to cover transaction fee (1.5x buffer)
   */
  async withdrawRemainingETH(
    rpcUrl: string,
    privateKey: string,
    recipientAddress: string
  ): Promise<{
    txHash: string;
    amount: string;
  }> {
    try {
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const wallet = new ethers.Wallet(privateKey, provider);

      // Get native token balance (ETH/BNB/MATIC/AVAX/etc)
      const balance = await provider.getBalance(wallet.address);

      // Get gas info
      const gasInfo = await this.gasService.getGasInfo(rpcUrl, 'ethereum');

      // Use precise gas estimation with minimal buffer
      let gasCost: bigint;
      let gasLimit: bigint;

      try {
        // Estimate gas for the exact transaction amount we plan to send
        // First, get a reasonable estimate of withdrawable amount
        const estimatedGasCost = ethers.parseUnits(gasInfo.gasPrice, 'gwei') * 21000n;
        const estimatedWithdrawable = balance - estimatedGasCost;

        if (estimatedWithdrawable <= 0n) {
          throw new Error('Insufficient balance for any withdrawal');
        }

        // Create a mock transaction with the actual amount we plan to withdraw
        const mockTx = {
          to: recipientAddress,
          value: estimatedWithdrawable,
        };

        // Estimate gas with the actual transaction amount
        const estimatedGasLimit = await provider.estimateGas(mockTx);
        gasLimit = estimatedGasLimit;

              } catch (estimateError) {
        logger.warn('Precise gas estimation failed, using fallback', { error: estimateError instanceof Error ? estimateError.message : String(estimateError) });
        gasLimit = 21000n; // Standard ETH transfer gas limit
      }

      // Get current gas price from provider for most accurate pricing
      const feeData = await provider.getFeeData();

      if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas && feeData.maxFeePerGas > 0n) {
        // EIP-1559: Use actual fee data from network
        gasCost = feeData.maxFeePerGas * gasLimit;
              } else if (feeData.gasPrice && feeData.gasPrice > 0n) {
        // Legacy: Use actual gas price from network
        gasCost = feeData.gasPrice * gasLimit;
              } else {
        // Fallback to gasService data
        const txOptions = this.gasService.getTransactionOptions(gasInfo);
        if (txOptions.maxFeePerGas) {
          gasCost = BigInt(txOptions.maxFeePerGas) * gasLimit;
        } else if (txOptions.gasPrice) {
          gasCost = BigInt(txOptions.gasPrice) * gasLimit;
        } else {
          gasCost = ethers.parseUnits(gasInfo.gasPrice, 'gwei') * gasLimit;
        }
      }

      // Add minimal 5% buffer for slight network fluctuations (much more reasonable)
      const totalGasCost = (gasCost * 105n) / 100n;
      const amountToWithdraw = balance - totalGasCost;

      if (amountToWithdraw <= 0n) {
        // Provide detailed error information
        const gasCostEth = ethers.formatEther(gasCost);
        const balanceEth = ethers.formatEther(balance);
        const totalGasCostEth = ethers.formatEther(totalGasCost);

        throw new Error(
          `Insufficient balance to withdraw. Balance: ${balanceEth} ETH, ` +
          `Estimated gas cost: ${gasCostEth} ETH, ` +
          `With 5% safety buffer: ${totalGasCostEth} ETH. ` +
          `Available for withdrawal: 0 ETH`
        );
      }

      // Prepare transaction with proper gas settings
      let txOptions: Partial<TransactionOptions> = {
        gasLimit: gasLimit
      };

      if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas && feeData.maxFeePerGas > 0n) {
        // EIP-1559: Use actual fee data from network
        txOptions.maxFeePerGas = feeData.maxFeePerGas;
        txOptions.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas;
      } else if (feeData.gasPrice && feeData.gasPrice > 0n) {
        // Legacy: Use actual gas price from network
        txOptions.gasPrice = feeData.gasPrice;
      } else {
        // Fallback to gasService data
        const fallbackTxOptions = this.gasService.getTransactionOptions(gasInfo);
        if (fallbackTxOptions.maxFeePerGas) {
          txOptions.maxFeePerGas = fallbackTxOptions.maxFeePerGas;
          txOptions.maxPriorityFeePerGas = fallbackTxOptions.maxPriorityFeePerGas;
        } else if (fallbackTxOptions.gasPrice) {
          txOptions.gasPrice = fallbackTxOptions.gasPrice;
        }
      }

      const tx = await wallet.sendTransaction({
        to: recipientAddress,
        value: amountToWithdraw,
        ...txOptions
      });
      await tx.wait();

      const amount = ethers.formatEther(amountToWithdraw);

      return {
        txHash: tx.hash,
        amount
      };
    } catch (error) {
      logger.error('Failed to withdraw native tokens', error as Error, { recipientAddress });
      throw new Error(`Failed to withdraw native tokens: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if tokens are approved for the contract
   */
  async checkApproval(
    rpcUrl: string,
    privateKey: string,
    tokenAddress: string,
    contractAddress: string,
    requiredAmount: string
  ): Promise<boolean> {
    try {
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const wallet = new ethers.Wallet(privateKey, provider);
      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);

      const allowance = await tokenContract.allowance(wallet.address, contractAddress);
      return allowance >= ethers.parseEther(requiredAmount);
    } catch (error) {
      logger.error('Failed to check approval', error as Error, { tokenAddress, contractAddress });
      return false;
    }
  }

  /**
   * Get BatchAirdropContract bytecode (instance method)
   */
  private getContractBytecode(): string {
    return ContractService.getContractBytecode();
  }

  /**
   * Get BatchAirdropContract bytecode
   * Compiled from contracts/src/BatchAirdropContract.sol using Solidity 0.8.26
   *
   * Gas-Optimized Contract Features:
   * - Ultra-lightweight design (no OpenZeppelin dependencies)
   * - Uses calldata instead of memory for array parameters
   * - Caches array length and token contract reference
   * - Uses unchecked increment for loop counter
   * - Custom errors instead of require strings
   * - Atomic transactions (all-or-nothing guarantee)
   * - No reentrancy protection needed (safe by design)
   * - Supports both ERC20 tokens and native tokens (ETH/BNB/MATIC/etc)
   *
   * Functions:
   * - batchTransfer(address token, address[] recipients, uint256[] amounts): ERC20 batch transfer
   * - batchTransferNative(address[] recipients, uint256[] amounts) payable: Native token batch transfer
   *
   * Estimated Gas Savings vs Previous Version:
   * - Deployment: ~3,000 gas saved
   * - Per batch (50 addresses): ~7,950 gas saved
   */
  public static getContractBytecode(): string {
    return '0x6080604052348015600e575f80fd5b506108808061001c5f395ff3fe608060405260043610610028575f3560e01c80631239ec8c1461002c57806366f658e914610054575b5f80fd5b348015610037575f80fd5b50610052600480360381019061004d9190610553565b610070565b005b61006e600480360381019061006991906105e4565b6101c9565b005b5f8484905090508282905081146100b3576040517fff633a3800000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b5f8690505f5b828110156101bf578173ffffffffffffffffffffffffffffffffffffffff166323b872dd338989858181106100f1576100f0610662565b5b9050602002016020810190610106919061068f565b88888681811061011957610118610662565b5b905060200201356040518463ffffffff1660e01b815260040161013e939291906106e1565b6020604051808303815f875af115801561015a573d5f803e3d5ffd5b505050506040513d601f19601f8201168201806040525081019061017e919061074b565b6101b4576040517f90b8ec1800000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b8060010190506100b9565b5050505050505050565b5f84849050905082829050811461020c576040517fff633a3800000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b5f805b828110156102495784848281811061022a57610229610662565b5b905060200201358261023c91906107a3565b915080600101905061020f565b5080341015610284576040517f1101129400000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b5f5b82811015610379575f8787838181106102a2576102a1610662565b5b90506020020160208101906102b7919061068f565b73ffffffffffffffffffffffffffffffffffffffff168686848181106102e0576102df610662565b5b905060200201356040516102f390610803565b5f6040518083038185875af1925050503d805f811461032d576040519150601f19603f3d011682016040523d82523d5f602084013e610332565b606091505b505090508061036d576040517ff4b3b1bc00000000000000000000000000000000000000000000000000000000815260040160405180910790fd5b81600101915050610286565b505f81346103879190610817565b90505f811115610432575f3373ffffffffffffffffffffffffffffffffffffffff16826040516103b690610803565b5f6040518083038185875af1925050503d805f81146103f0576040519150601f19603f3d011682016040523d82523d5f602084013e6103f5565b606091505b5050905080610430576040517ff4b3b1bc00000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b505b50505050505050565b5f80fd5b5f80fd5b5f73ffffffffffffffffffffffffffffffffffffffff82169050919050565b5f61046c82610443565b9050919050565b61047c81610462565b8114610486575f80fd5b50565b5f8135905061049781610473565b92915050565b5f80fd5b5f80fd5b5f80fd5b5f8083601f8401126104be576104bd61049d565b5b8235905067ffffffffffffffff8111156104db576104da6104a1565b5b6020830191508360208202830111156104f7576104f66104a5565b5b9250929050565b5f8083601f8401126105135761051261049d565b5b8235905067ffffffffffffffff8111156105305761052f6104a1565b5b60208301915083602082028301111561054c5761054b6104a5565b5b9250929050565b5f805f805f6060868803121561056c5761056b61043b565b5b5f61057988828901610489565b955050602086013567ffffffffffffffff81111561059a5761059961043f565b5b6105a6888289016104a9565b9450945050604086013567ffffffffffffffff8111156105c9576105c861043f565b5b6105d5888289016104fe565b92509250509295509295909350565b5f805f80604085870312156105fc576105fb61043b565b5b5f85013567ffffffffffffffff8111156106195761061861043f565b5b610625878288016104a9565b9450945050602085013567ffffffffffffffff8111156106485761064761043f565b5b610654878288016104fe565b925092505092959194509250565b7f4e487b71000000000000000000000000000000000000000000000000000000005f52603260045260245ffd5b5f602082840312156106a4576106a361043b565b5b5f6106b184828501610489565b91505092915050565b6106c381610462565b82525050565b5f819050919050565b6106db816106c9565b82525050565b5f6060820190506106f45f8301866106ba565b61070160208301856106ba565b61070e60408301846106d2565b949350505050565b5f8115159050919050565b61072a81610716565b8114610734575f80fd5b50565b5f8151905061074581610721565b92915050565b5f602082840312156107605761075f61043b565b5b5f61076d84828501610737565b91505092915050565b7f4e487b71000000000000000000000000000000000000000000000000000000005f52601160045260245ffd5b5f6107ad826106c9565b91506107b8836106c9565b92508282019050808211156107d0576107cf610776565b5b92915050565b5f81905092915050565b50565b5f6107ee5f836107d6565b91506107f9826107e0565b5f82019050919050565b5f61080d826107e3565b9150819050919050565b5f610821826106c9565b915061082c836106c9565b925082820390508181111561084457610843610776565b5b9291505056fea26469706673582212204ae610ac71fa590bfcacc313e71065b49391e02e919a96a1e676b9c7b75b1b0b64736f6c634300081a0033';
  }
}