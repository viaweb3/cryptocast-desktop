import { ethers } from 'ethers';
import { Connection, clusterApiUrl } from '@solana/web3.js';
import { DatabaseManager } from '../database/sqlite-schema';

interface EVMChain {
  id?: number;
  type: 'evm';
  chain_id: number;
  name: string;
  rpc_url: string;
  rpc_backup?: string;
  explorer_url: string;
  symbol: string;
  decimals: number;
  enabled: boolean;
  is_custom: boolean;
}

interface SolanaRPC {
  id?: number;
  network: 'mainnet-beta' | 'devnet' | 'testnet';
  name: string;
  rpc_url: string;
  ws_url?: string;
  priority: number;
  latency?: number;
  uptime_24h?: number;
  enabled: boolean;
}

export class ChainManagementService {
  private db: any;

  constructor(databaseManager: DatabaseManager) {
    this.db = databaseManager.getDatabase();
    this.initializeDefaultChains();
  }

  private async initializeDefaultChains() {
    try {
      // Check if chains already exist
      const existingChains = this.db.prepare('SELECT COUNT(*) as count FROM chains WHERE type = "evm"').get();

      if (existingChains.count === 0) {
        // Insert default EVM chains
        const defaultChains = [
          {
            chain_id: 1,
            name: 'Ethereum Mainnet',
            rpc_url: 'https://eth.llamarpc.com',
            rpc_backup: 'https://rpc.ankr.com/eth',
            explorer_url: 'https://etherscan.io',
            symbol: 'ETH',
            decimals: 18,
            enabled: true,
            is_custom: false
          },
          {
            chain_id: 137,
            name: 'Polygon',
            rpc_url: 'https://polygon-rpc.com',
            rpc_backup: 'https://rpc-mainnet.matic.network',
            explorer_url: 'https://polygonscan.com',
            symbol: 'POL',
            decimals: 18,
            enabled: true,
            is_custom: false
          },
          {
            chain_id: 42161,
            name: 'Arbitrum One',
            rpc_url: 'https://arb1.arbitrum.io/rpc',
            rpc_backup: 'https://rpc.ankr.com/arbitrum',
            explorer_url: 'https://arbiscan.io',
            symbol: 'ETH',
            decimals: 18,
            enabled: true,
            is_custom: false
          },
          {
            chain_id: 10,
            name: 'Optimism',
            rpc_url: 'https://mainnet.optimism.io',
            rpc_backup: 'https://rpc.ankr.com/optimism',
            explorer_url: 'https://optimistic.etherscan.io',
            symbol: 'ETH',
            decimals: 18,
            enabled: true,
            is_custom: false
          },
          {
            chain_id: 8453,
            name: 'Base',
            rpc_url: 'https://mainnet.base.org',
            rpc_backup: 'https://rpc.ankr.com/base',
            explorer_url: 'https://basescan.org',
            symbol: 'ETH',
            decimals: 18,
            enabled: true,
            is_custom: false
          },
          {
            chain_id: 56,
            name: 'BSC',
            rpc_url: 'https://bsc-dataseed1.binance.org',
            rpc_backup: 'https://rpc.ankr.com/bsc',
            explorer_url: 'https://bscscan.com',
            symbol: 'BNB',
            decimals: 18,
            enabled: false,
            is_custom: false
          },
          {
            chain_id: 43114,
            name: 'Avalanche C-Chain',
            rpc_url: 'https://api.avax.network/ext/bc/C/rpc',
            rpc_backup: 'https://rpc.ankr.com/avalanche',
            explorer_url: 'https://snowtrace.io',
            symbol: 'AVAX',
            decimals: 18,
            enabled: false,
            is_custom: false
          }
        ];

        const insertChain = this.db.prepare(`
          INSERT INTO chains (
            type, chain_id, name, rpc_url, rpc_backup, explorer_url, symbol, decimals, enabled, is_custom, created_at
          ) VALUES ('evm', ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `);

        defaultChains.forEach(chain => {
          insertChain.run(
            chain.chain_id,
            chain.name,
            chain.rpc_url,
            chain.rpc_backup,
            chain.explorer_url,
            chain.symbol,
            chain.decimals,
            chain.enabled,
            chain.is_custom
          );
        });
      }

      // Initialize default Solana RPCs
      const existingSolanaRPCs = this.db.prepare('SELECT COUNT(*) as count FROM solana_rpcs').get();

      if (existingSolanaRPCs.count === 0) {
        const defaultSolanaRPCs = [
          {
            network: 'mainnet-beta',
            name: 'Solana Mainnet (Official)',
            rpc_url: 'https://api.mainnet-beta.solana.com',
            ws_url: 'wss://api.mainnet-beta.solana.com',
            priority: 5,
            enabled: true
          },
          {
            network: 'mainnet-beta',
            name: 'Triton One RPC',
            rpc_url: 'https://rpc.ankr.com/solana',
            ws_url: '',
            priority: 3,
            enabled: true
          },
          {
            network: 'devnet',
            name: 'Solana Devnet (Official)',
            rpc_url: 'https://api.devnet.solana.com',
            ws_url: 'wss://api.devnet.solana.com',
            priority: 5,
            enabled: true
          },
          {
            network: 'testnet',
            name: 'Solana Testnet (Official)',
            rpc_url: 'https://api.testnet.solana.com',
            ws_url: 'wss://api.testnet.solana.com',
            priority: 5,
            enabled: true
          }
        ];

        const insertSolanaRPC = this.db.prepare(`
          INSERT INTO solana_rpcs (
            network, name, rpc_url, ws_url, priority, latency, uptime_24h, enabled, last_checked
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `);

        defaultSolanaRPCs.forEach(rpc => {
          insertSolanaRPC.run(
            rpc.network,
            rpc.name,
            rpc.rpc_url,
            rpc.ws_url,
            rpc.priority,
            null, // latency - will be set on first health check
            100, // uptime_24h
            rpc.enabled
          );
        });
      }
    } catch (error) {
      console.error('Failed to initialize default chains:', error);
    }
  }

  // ============ EVM链管理 ============

  /**
   * 获取所有EVM链（内置+自定义）
   */
  async getEVMChains(): Promise<EVMChain[]> {
    try {
      const query = `SELECT * FROM chains WHERE type = 'evm' ORDER BY chain_id`;
      const stmt = this.db.prepare(query);
      return stmt.all() as EVMChain[];
    } catch (error) {
      console.error('Failed to get EVM chains:', error);
      throw new Error('Failed to retrieve EVM chains');
    }
  }

  /**
   * 添加自定义EVM链
   */
  async addCustomEVMChain(chain: Omit<EVMChain, 'id' | 'is_custom'>): Promise<number> {
    try {
      // 1. 验证Chain ID是否匹配
      const verified = await this.verifyEVMChain(chain.rpc_url, chain.chain_id);
      if (!verified) {
        throw new Error('Chain ID不匹配或RPC无法连接');
      }

      // 2. 检查是否已存在
      const existing = this.db.prepare(
        `SELECT id FROM chains WHERE type = 'evm' AND chain_id = ?`
      ).get(chain.chain_id);

      if (existing) {
        throw new Error(`Chain ID ${chain.chain_id} 已存在`);
      }

      // 3. 插入数据库
      const stmt = this.db.prepare(`
        INSERT INTO chains (type, chain_id, name, rpc_url, rpc_backup, explorer_url, symbol, decimals, enabled, is_custom, created_at)
        VALUES ('evm', ?, ?, ?, ?, ?, ?, ?, 1, 1, datetime('now'))
      `);

      const result = stmt.run(
        chain.chain_id,
        chain.name,
        chain.rpc_url,
        chain.rpc_backup || null,
        chain.explorer_url,
        chain.symbol,
        chain.decimals
      );

      return result.lastInsertRowid as number;
    } catch (error) {
      console.error('Failed to add custom EVM chain:', error);
      throw error;
    }
  }

  /**
   * 验证EVM链配置
   */
  private async verifyEVMChain(rpcUrl: string, expectedChainId: number): Promise<boolean> {
    try {
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const network = await provider.getNetwork();
      return Number(network.chainId) === expectedChainId;
    } catch (error) {
      return false;
    }
  }

  /**
   * 测试EVM链RPC延迟
   */
  async testEVMChainLatency(chainId: number): Promise<{ latency: number; blockNumber: number }> {
    try {
      const chain = this.db.prepare(
        `SELECT rpc_url FROM chains WHERE type = 'evm' AND chain_id = ?`
      ).get(chainId) as EVMChain;

      if (!chain) {
        throw new Error(`Chain ID ${chainId} 不存在`);
      }

      const startTime = Date.now();
      const provider = new ethers.JsonRpcProvider(chain.rpc_url);
      const blockNumber = await provider.getBlockNumber();
      const latency = Date.now() - startTime;

      return { latency, blockNumber };
    } catch (error) {
      console.error('Failed to test EVM chain latency:', error);
      throw new Error('Failed to test EVM chain latency');
    }
  }

  /**
   * 更新EVM链配置
   */
  async updateEVMChain(chainId: number, updates: Partial<EVMChain>): Promise<void> {
    try {
      const allowedFields = ['name', 'rpc_url', 'rpc_backup', 'explorer_url', 'enabled'];
      const fields = Object.keys(updates).filter(k => allowedFields.includes(k));

      if (fields.length === 0) return;

      const setClause = fields.map(f => `${f} = ?`).join(', ');
      const values = fields.map(f => (updates as any)[f]);

      const stmt = this.db.prepare(
        `UPDATE chains SET ${setClause} WHERE type = 'evm' AND chain_id = ?`
      );

      stmt.run(...values, chainId);
    } catch (error) {
      console.error('Failed to update EVM chain:', error);
      throw new Error('Failed to update EVM chain');
    }
  }

  /**
   * 删除自定义EVM链
   */
  async deleteCustomEVMChain(chainId: number): Promise<void> {
    try {
      const stmt = this.db.prepare(
        `DELETE FROM chains WHERE type = 'evm' AND chain_id = ? AND is_custom = 1`
      );
      const result = stmt.run(chainId);

      if (result.changes === 0) {
        throw new Error('链不存在或不可删除（内置链不能删除）');
      }
    } catch (error) {
      console.error('Failed to delete custom EVM chain:', error);
      throw error;
    }
  }

  // ============ Solana RPC管理 ============

  /**
   * 获取Solana RPC节点列表
   */
  async getSolanaRPCs(network?: string, onlyEnabled = false): Promise<SolanaRPC[]> {
    try {
      let query = `SELECT * FROM solana_rpcs`;
      const params: any[] = [];

      if (network) {
        query += ` WHERE network = ?`;
        params.push(network);
      }

      if (onlyEnabled) {
        query += network ? ` AND enabled = 1` : ` WHERE enabled = 1`;
      }

      query += ` ORDER BY priority ASC, latency ASC`;

      const stmt = this.db.prepare(query);
      return stmt.all(...params) as SolanaRPC[];
    } catch (error) {
      console.error('Failed to get Solana RPCs:', error);
      throw new Error('Failed to retrieve Solana RPCs');
    }
  }

  
  /**
   * 添加Solana RPC节点
   */
  async addSolanaRPC(rpc: Omit<SolanaRPC, 'id'>): Promise<number> {
    try {
      // 测试连接
      const testResult = await this.testSolanaRPC(rpc.rpc_url);
      if (!testResult.success) {
        throw new Error('无法连接到Solana RPC节点');
      }

      const stmt = this.db.prepare(`
        INSERT INTO solana_rpcs (network, name, rpc_url, ws_url, priority, latency, uptime_24h, enabled, last_checked)
        VALUES (?, ?, ?, ?, ?, ?, 100, 1, datetime('now'))
      `);

      const result = stmt.run(
        rpc.network,
        rpc.name,
        rpc.rpc_url,
        rpc.ws_url || null,
        rpc.priority,
        testResult.latency
      );

      return result.lastInsertRowid as number;
    } catch (error) {
      console.error('Failed to add Solana RPC:', error);
      throw error;
    }
  }

  /**
   * 测试Solana RPC连接
   */
  async testSolanaRPC(rpcUrl: string): Promise<{
    success: boolean;
    latency?: number;
    slot?: number;
    error?: string;
  }> {
    try {
      const startTime = Date.now();
      const connection = new Connection(rpcUrl, 'confirmed');
      const slot = await connection.getSlot();
      const latency = Date.now() - startTime;

      return { success: true, latency, slot };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 更新Solana RPC优先级
   */
  async updateSolanaRPCPriority(id: number, priority: number): Promise<void> {
    try {
      const stmt = this.db.prepare(
        `UPDATE solana_rpcs SET priority = ? WHERE id = ?`
      );
      stmt.run(priority, id);
    } catch (error) {
      console.error('Failed to update Solana RPC priority:', error);
      throw new Error('Failed to update Solana RPC priority');
    }
  }

  /**
   * 删除Solana RPC节点
   */
  async deleteSolanaRPC(id: number): Promise<void> {
    try {
      const stmt = this.db.prepare(`DELETE FROM solana_rpcs WHERE id = ?`);
      const result = stmt.run(id);

      if (result.changes === 0) {
        throw new Error('RPC节点不存在');
      }
    } catch (error) {
      console.error('Failed to delete Solana RPC:', error);
      throw error;
    }
  }

  
  /**
   * 获取区块链信息（支持EVM和Solana）
   */
  async getChainInfo(chain: string): Promise<any> {
    if (chain.toLowerCase().includes('solana')) {
      const rpcs = await this.getSolanaRPCs('mainnet-beta');
      const activeRPC = rpcs.find(rpc => rpc.enabled) || rpcs[0];
      if (!activeRPC) {
        throw new Error('No active Solana RPC available');
      }

      const connection = new Connection(activeRPC.rpc_url, 'confirmed');
      const slot = await connection.getSlot();
      const epochInfo = await connection.getEpochInfo();

      return {
        type: 'solana',
        network: 'mainnet-beta',
        slot,
        epochInfo,
        rpc: activeRPC
      };
    } else {
      // EVM chain
      const evmChains = await this.getEVMChains();
      const chainInfo = evmChains.find(c => c.chain_id.toString() === chain || c.name.toLowerCase() === chain.toLowerCase());

      if (!chainInfo) {
        throw new Error(`EVM chain ${chain} not found or not enabled`);
      }

      const provider = new ethers.JsonRpcProvider(chainInfo.rpc_url);
      const [blockNumber, feeData] = await Promise.all([
        provider.getBlockNumber(),
        provider.getFeeData()
      ]);

      return {
        type: 'evm',
        chainId: chainInfo.chain_id,
        name: chainInfo.name,
        blockNumber,
        feeData,
        rpc: chainInfo
      };
    }
  }
}