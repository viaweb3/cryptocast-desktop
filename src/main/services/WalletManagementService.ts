import { WalletService } from './WalletService';
import { ChainService } from './ChainService';
import type { DatabaseManager } from '../database/sqlite-schema';
import { NATIVE_TOKEN_ADDRESSES } from '../config/constants';
import { logger } from '../utils/logger';

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
  private logger = logger.child('WalletManagementService');

  constructor(databaseManager: DatabaseManager) {
    this.db = databaseManager.getDatabase();
    this.walletService = new WalletService();
    this.chainService = new ChainService(databaseManager);
  }

  /**
   * Get all active wallet lists
   */
  async listActivityWallets(options?: {
    status?: string;
    chain?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ wallets: ActivityWallet[]; total: number }> {
    try {
      this.logger.debug('Listing activity wallets', { options });
      let query = `
        SELECT
          c.id,
          c.id as campaign_id,
          c.name as campaign_name,
          c.wallet_address as address,
          c.chain_type,
          c.chain_id,
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

      // Get total count
      const countQuery = `SELECT COUNT(*) as total FROM (${query})`;
      const countResult = await this.db.prepare(countQuery).get(...params) as any;
      const total = countResult?.total || 0;

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
          // Use chain_id uniformly
          const chain = row.chain_id?.toString() || '';

          // Get balance information for each wallet (here returns basic structure, actual balance needs on-chain query)
          return {
            id: row.id,
            campaignId: row.campaign_id,
            campaignName: row.campaign_name,
            address: row.address,
            chain: chain,
            status: row.status,
            balances: [
              {
                tokenAddress: row.token_address || NATIVE_TOKEN_ADDRESSES.EVM,
                tokenSymbol: row.token_symbol || 'ETH',
                tokenDecimals: 18,
                balance: '0', // Requires on-chain query
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

      return { wallets, total };
    } catch (error) {
      this.logger.error('Failed to list activity wallets', error as Error);
      throw new Error('Activity wallet listing failed');
    }
  }

  /**
   * Get detailed balance information for a single wallet
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
      this.logger.debug('Getting wallet balances', { campaignId });
      const campaign = await this.db
        .prepare(
          `SELECT wallet_address, chain_type, chain_id, network, token_address, token_symbol
           FROM campaigns WHERE id = ?`
        )
        .get(campaignId) as any;

      if (!campaign || !campaign.wallet_address) {
        return null;
      }

      // Get chain RPC URL
      const chains = await this.chainService.getEVMChains();
      const chainConfig = chains.find((c) => c.chainId === campaign.chain_id);

      if (!chainConfig) {
        throw new Error(`Chain configuration not found for chain ID ${campaign.chain_id}`);
      }

      // Query token balance
      const tokenBalance = await this.walletService.getEVMBalance(
        campaign.wallet_address,
        chainConfig.rpcUrl,
        campaign.token_address
      );

      // Query native token balance (for Gas)
      const nativeBalance = await this.walletService.getEVMBalance(
        campaign.wallet_address,
        chainConfig.rpcUrl
      );

      // Use chain_id uniformly
      const chain = campaign.chain_id?.toString() || '';

      return {
        address: campaign.wallet_address,
        chain: chain,
        balances: [
          {
            tokenAddress: campaign.token_address || NATIVE_TOKEN_ADDRESSES.EVM,
            tokenSymbol: tokenBalance.symbol,
            tokenDecimals: tokenBalance.decimals,
            balance: tokenBalance.balance,
          },
          {
            tokenAddress: NATIVE_TOKEN_ADDRESSES.EVM,
            tokenSymbol: chainConfig.symbol,
            tokenDecimals: 18,
            balance: nativeBalance.balance,
          },
        ],
      };
    } catch (error) {
      this.logger.error('Failed to get wallet balances', error as Error, { campaignId });
      throw new Error('Wallet balance query failed');
    }
  }

  /**
   * Batch refresh wallet balances
   */
  async refreshWalletBalances(campaignIds: string[]): Promise<Map<string, any>> {
    this.logger.debug('Refreshing wallet balances', { count: campaignIds.length });
    const results = new Map<string, any>();

    await Promise.all(
      campaignIds.map(async (campaignId) => {
        try {
          const balances = await this.getWalletBalances(campaignId);
          results.set(campaignId, balances);
        } catch (error) {
          this.logger.error(`Failed to refresh balance for campaign ${campaignId}`, error as Error);
          results.set(campaignId, { error: 'Balance refresh failed' });
        }
      })
    );

    return results;
  }
}
