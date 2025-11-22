import { WalletService } from './WalletService';
import { ChainService } from './ChainService';
import type { DatabaseManager } from '../database/sqlite-schema';

export interface ActivityWallet {
  id: string;
  campaignId: string;
  campaignName: string;
  address: string;
  chain: string;
  status: string;
  balances: Array<{
    tokenAddress: string;
    tokenSymbol: string;
    tokenDecimals: number;
    balance: string;
    usdValue?: string;
  }>;
  totalBalance: string;
  totalCapacity: string;
  createdAt: string;
  updatedAt: string;
  lastBalanceUpdate?: string;
  privateKeyBase64?: string;
}

export class WalletManagementService {
  private db: any;
  private walletService: WalletService;
  private chainService: ChainService;

  constructor(databaseManager: DatabaseManager) {
    this.db = databaseManager.getDatabase();
    this.walletService = new WalletService();
    this.chainService = new ChainService(databaseManager);
  }

  /**
   * 获取所有活动钱包列表
   */
  async listActivityWallets(options?: {
    status?: string;
    chain?: string;
    limit?: number;
    offset?: number;
  }): Promise<ActivityWallet[]> {
    try {
      let query = `
        SELECT
          c.id,
          c.id as campaign_id,
          c.name as campaign_name,
          c.wallet_address as address,
          c.chain_type,
          c.chain_id,
          c.network,
          c.status,
          c.token_address,
          c.token_symbol,
          c.wallet_private_key_base64 as private_key_base64,
          c.created_at,
          c.updated_at
        FROM campaigns c
        WHERE c.wallet_address IS NOT NULL
      `;
      const params: any[] = [];

      if (options?.status) {
        query += ' AND c.status = ?';
        params.push(options.status);
      }

      if (options?.chain) {
        // Support both chain_id and chain_type filtering
        query += ' AND (c.chain_id = ? OR c.chain_type = ?)';
        params.push(options.chain, options.chain);
      }

      query += ' ORDER BY c.created_at DESC';

      if (options?.limit) {
        query += ' LIMIT ?';
        params.push(options.limit);
      }

      if (options?.offset) {
        query += ' OFFSET ?';
        params.push(options.offset);
      }

      const rows = await this.db.prepare(query).all(...params) as any[];

      const wallets: ActivityWallet[] = await Promise.all(
        rows.map(async (row) => {
          // Determine chain identifier based on chain type
          const chain = row.chain_type === 'evm'
            ? row.chain_id?.toString() || ''
            : row.network || 'mainnet-beta';

          // 为每个钱包获取余额信息（这里返回基本结构，实际余额需要链上查询）
          return {
            id: row.id,
            campaignId: row.campaign_id,
            campaignName: row.campaign_name,
            address: row.address,
            chain: chain,
            status: row.status,
            balances: [
              {
                tokenAddress: row.token_address || '0x0000000000000000000000000000000000000000',
                tokenSymbol: row.token_symbol || 'ETH',
                tokenDecimals: 18,
                balance: '0', // 需要链上查询
                usdValue: '0',
              },
            ],
            totalBalance: '0',
            totalCapacity: '0',
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            lastBalanceUpdate: new Date().toISOString(),
            privateKeyBase64: row.private_key_base64,
          };
        })
      );

      return wallets;
    } catch (error) {
      console.error('Failed to list activity wallets:', error);
      throw new Error('Activity wallet listing failed');
    }
  }

  /**
   * 获取单个钱包的详细余额信息
   */
  async getWalletBalances(
    campaignId: string
  ): Promise<{
    address: string;
    chain: string;
    balances: Array<{
      tokenAddress: string;
      tokenSymbol: string;
      tokenDecimals: number;
      balance: string;
      usdValue?: string;
    }>;
  } | null> {
    try {
      const campaign = await this.db
        .prepare(
          `SELECT wallet_address, chain_type, chain_id, network, token_address, token_symbol
           FROM campaigns WHERE id = ?`
        )
        .get(campaignId) as any;

      if (!campaign || !campaign.wallet_address) {
        return null;
      }

      // 获取链的RPC URL
      const chains = await this.chainService.getEVMChains();
      const chainConfig = chains.find((c) => c.chainId === campaign.chain_id);

      if (!chainConfig) {
        throw new Error(`Chain configuration not found for chain ID ${campaign.chain_id}`);
      }

      // 查询代币余额
      const tokenBalance = await this.walletService.getEVMBalance(
        campaign.wallet_address,
        chainConfig.rpcUrl,
        campaign.token_address
      );

      // 查询原生代币余额（用于Gas）
      const nativeBalance = await this.walletService.getEVMBalance(
        campaign.wallet_address,
        chainConfig.rpcUrl
      );

      // Determine chain identifier
      const chain = campaign.chain_type === 'evm'
        ? campaign.chain_id?.toString() || ''
        : campaign.network || 'mainnet-beta';

      return {
        address: campaign.wallet_address,
        chain: chain,
        balances: [
          {
            tokenAddress: campaign.token_address || '0x0000000000000000000000000000000000000000',
            tokenSymbol: tokenBalance.symbol,
            tokenDecimals: tokenBalance.decimals,
            balance: tokenBalance.balance,
          },
          {
            tokenAddress: '0x0000000000000000000000000000000000000000',
            tokenSymbol: chainConfig.symbol,
            tokenDecimals: 18,
            balance: nativeBalance.balance,
          },
        ],
      };
    } catch (error) {
      console.error('Failed to get wallet balances:', error);
      throw new Error('Wallet balance query failed');
    }
  }

  /**
   * 批量刷新钱包余额
   */
  async refreshWalletBalances(campaignIds: string[]): Promise<Map<string, any>> {
    const results = new Map<string, any>();

    await Promise.all(
      campaignIds.map(async (campaignId) => {
        try {
          const balances = await this.getWalletBalances(campaignId);
          results.set(campaignId, balances);
        } catch (error) {
          console.error(`Failed to refresh balance for campaign ${campaignId}:`, error);
          results.set(campaignId, { error: 'Balance refresh failed' });
        }
      })
    );

    return results;
  }
}
