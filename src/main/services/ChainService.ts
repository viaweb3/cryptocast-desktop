import { ethers } from 'ethers';
import { Connection } from '@solana/web3.js';

export interface Chain {
  id?: number;
  type: 'evm' | 'solana';
  chainId?: number;  // EVM链ID或Solana链ID (501主网, 502测试网)
  name: string;
  rpcUrl: string;
  rpcBackup?: string;
  explorerUrl?: string;
  symbol: string;
  decimals: number;
  color?: string;
  badgeColor?: string;
  network?: string;  // Solana网络类型 (mainnet-beta, devnet, testnet)
  priority?: number;  // 主要用于Solana RPC优先级
  latency?: number;  // 延迟测试结果(ms)
  enabled: boolean;
  isCustom: boolean;
  createdAt?: string;
}

export interface EVMChain extends Chain {
  type: 'evm';
  chainId: number;
}

export interface SolanaChain extends Chain {
  type: 'solana';
  network: 'mainnet-beta' | 'devnet' | 'testnet';
}

export interface SolanaRPC {
  id?: number;
  network: 'mainnet-beta' | 'devnet' | 'testnet';
  name: string;
  rpcUrl: string;
  wsUrl?: string;
  priority: number;
  enabled: boolean;
  createdAt?: string;
}

export interface RPCTestResult {
  success: boolean;
  latency?: number;
  blockNumber?: number;
  error?: string;
}

export class ChainService {
  private db: any;

  constructor(databaseManager: any) {
    this.db = databaseManager.getDatabase();
  }

  // 统一获取所有链的方法
  async getAllChains(onlyEnabled = true): Promise<Chain[]> {
    try {
      console.log('🔍 [ChainService] getAllChains: Starting to fetch chains from database');
      let query = 'SELECT * FROM chains';
      const params: any[] = [];

      if (onlyEnabled) {
        query += ' WHERE enabled = 1';
      }

      query += ' ORDER BY type, name';

      const chains = await this.db.prepare(query).all(...params) as any[];
      console.log(`🔍 [ChainService] getAllChains: Retrieved ${chains.length} chains from database`);

      const mappedChains = chains.map(this.mapRowToChain);
      console.log(`🔍 [ChainService] getAllChains: Mapped ${mappedChains.length} chains to Chain format`);

      return mappedChains;
    } catch (error) {
      console.error('Failed to get chains:', error);
      throw new Error('Chains retrieval failed');
    }
  }

  // 获取EVM链（向后兼容）
  async getEVMChains(onlyEnabled = true): Promise<EVMChain[]> {
    try {
      console.log('🔍 [ChainService] getEVMChains: Starting to fetch EVM chains from database');
      let query = 'SELECT * FROM chains WHERE type = ?';
      const params: any[] = ['evm'];

      if (onlyEnabled) {
        query += ' AND enabled = 1';
      }

      query += ' ORDER BY name';

      const chains = await this.db.prepare(query).all(...params) as any[];
      console.log(`🔍 [ChainService] getEVMChains: Retrieved ${chains.length} EVM chains from database`);

      const mappedChains = chains.map(this.mapRowToChain) as EVMChain[];
      console.log(`🔍 [ChainService] getEVMChains: Mapped ${mappedChains.length} chains to EVMChain format`);

      // Log each chain's color data
      mappedChains.forEach((chain, index) => {
        console.log(`🔍 [ChainService] Chain ${index}: ${chain.name} -> color: ${chain.color}, badgeColor: ${chain.badgeColor}`);
      });

      return mappedChains;
    } catch (error) {
      console.error('Failed to get EVM chains:', error);
      throw new Error('EVM chains retrieval failed');
    }
  }

  async addEVMChain(chainData: Omit<EVMChain, 'id' | 'type'>): Promise<number> {
    try {
      // 验证Chain ID是否重复
      const existing = await this.db.prepare('SELECT id FROM chains WHERE chain_id = ? AND type = ?').get(chainData.chainId, 'evm');
      if (existing) {
        throw new Error(`Chain ID ${chainData.chainId} already exists`);
      }

      // 测试RPC连接
      const testResult = await this.testEVMLatencyByUrl(chainData.rpcUrl);
      if (!testResult.success) {
        throw new Error(`RPC connection failed: ${testResult.error}`);
      }

      const insertChain = this.db.prepare(`
        INSERT INTO chains (
          type, chain_id, name, rpc_url, rpc_backup, explorer_url, symbol, decimals, color, badge_color, is_custom, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = insertChain.run(
        'evm',
        chainData.chainId,
        chainData.name,
        chainData.rpcUrl,
        chainData.rpcBackup,
        chainData.explorerUrl,
        chainData.symbol,
        chainData.decimals,
        chainData.color || '#3B82F6',
        chainData.badgeColor || 'badge-primary',
        chainData.isCustom ? 1 : 0,
        new Date().toISOString()
      );

      return result.lastInsertRowid as number;
    } catch (error) {
      console.error('Failed to add EVM chain:', error);
      throw new Error('EVM chain addition failed');
    }
  }

  async updateEVMChain(chainId: number, updates: Partial<EVMChain>): Promise<void> {
    try {
      const fields: string[] = [];
      const params: any[] = [];

      if (updates.name !== undefined) {
        fields.push('name = ?');
        params.push(updates.name);
      }
      if (updates.rpcUrl !== undefined) {
        // 测试新的RPC连接
        const testResult = await this.testEVMLatencyByUrl(updates.rpcUrl);
        if (!testResult.success) {
          throw new Error(`RPC connection failed: ${testResult.error}`);
        }

        fields.push('rpc_url = ?');
        params.push(updates.rpcUrl);
      }
      if (updates.rpcBackup !== undefined) {
        fields.push('rpc_backup = ?');
        params.push(updates.rpcBackup);
      }
      if (updates.explorerUrl !== undefined) {
        fields.push('explorer_url = ?');
        params.push(updates.explorerUrl);
      }
      if (updates.symbol !== undefined) {
        fields.push('symbol = ?');
        params.push(updates.symbol);
      }
      if (updates.decimals !== undefined) {
        fields.push('decimals = ?');
        params.push(updates.decimals);
      }
      if (updates.color !== undefined) {
        fields.push('color = ?');
        params.push(updates.color);
      }
      if (updates.badgeColor !== undefined) {
        fields.push('badge_color = ?');
        params.push(updates.badgeColor);
      }

      if (fields.length === 0) {
        return;
      }

      params.push(chainId);

      const updateChain = this.db.prepare(`
        UPDATE evm_chains SET ${fields.join(', ')} WHERE id = ?
      `);

      updateChain.run(...params);
    } catch (error) {
      console.error('Failed to update EVM chain:', error);
      throw new Error('EVM chain update failed');
    }
  }

  async deleteEVMChain(chainId: number): Promise<void> {
    try {
      // 检查是否是内置链
      const chain = await this.db.prepare('SELECT is_custom FROM evm_chains WHERE id = ?').get(chainId) as any;
      if (!chain || !chain.is_custom) {
        throw new Error('Cannot delete built-in chain');
      }

      await this.db.prepare('DELETE FROM evm_chains WHERE id = ?').run(chainId);
    } catch (error) {
      console.error('Failed to delete EVM chain:', error);
      throw new Error('EVM chain deletion failed');
    }
  }

  async testEVMLatency(rpcUrl: string): Promise<{ latency: number; blockNumber: number }> {
    try {
      console.log(`测试RPC URL: ${rpcUrl}`);

      const testResult = await this.testEVMLatencyByUrl(rpcUrl);
      if (!testResult.success || !testResult.latency || !testResult.blockNumber) {
        throw new Error(testResult.error || 'Test failed');
      }

      return { latency: testResult.latency, blockNumber: testResult.blockNumber };
    } catch (error) {
      console.error('Failed to test EVM latency:', error);
      throw new Error('EVM latency test failed');
    }
  }

  async testEVMLatencyByUrl(rpcUrl: string): Promise<RPCTestResult> {
    try {
      console.log(`开始测试RPC: ${rpcUrl}`);
      const startTime = Date.now();

      // 创建带超时的Promise
      const provider = new ethers.JsonRpcProvider(rpcUrl, undefined, {
        batchMaxCount: 1, // 禁用批处理
        polling: false,   // 禁用轮询
      });

      // 设置10秒超时
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('RPC请求超时')), 10000);
      });

      const blockNumberPromise = provider.getBlockNumber();
      const blockNumber = await Promise.race([blockNumberPromise, timeoutPromise]) as number;

      const latency = Date.now() - startTime;

      console.log(`RPC测试成功: ${rpcUrl}, 延迟: ${latency}ms, 区块: ${blockNumber}`);

      return {
        success: true,
        latency,
        blockNumber,
      };
    } catch (error) {
      console.error(`RPC测试失败: ${rpcUrl}`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // 获取Solana链（新的统一方法）
  async getSolanaChains(network?: string, onlyEnabled = true): Promise<SolanaChain[]> {
    try {
      console.log(`🔍 [ChainService] getSolanaChains: ${network || 'all'} enabled=${onlyEnabled}`);
      let query = 'SELECT * FROM chains WHERE type = ?';
      const params: any[] = ['solana'];

      if (network) {
        query += ' AND network = ?';
        params.push(network);
      }

      if (onlyEnabled) {
        query += ' AND enabled = 1';
      }

      query += ' ORDER BY priority, name';

      const chains = await this.db.prepare(query).all(...params) as any[];
      console.log(`🔍 [ChainService] getSolanaChains: Retrieved ${chains.length} Solana chains from database`);

      const mappedChains = chains.map(this.mapRowToChain) as SolanaChain[];
      console.log(`🔍 [ChainService] getSolanaChains: Mapped ${mappedChains.length} chains to SolanaChain format`);

      return mappedChains;
    } catch (error) {
      console.error('Failed to get Solana chains:', error);
      throw new Error('Solana chains retrieval failed');
    }
  }

  // 向后兼容的Solana RPC获取方法
  async getSolanaRPCs(network?: string, onlyEnabled = true): Promise<SolanaChain[]> {
    return this.getSolanaChains(network, onlyEnabled);
  }

  
  async addSolanaRPC(rpcData: Omit<SolanaRPC, 'id'>): Promise<number> {
    try {
      // 测试RPC连接
      const testResult = await this.testSolanaRPC(rpcData.rpcUrl);
      if (!testResult.success) {
        throw new Error(`RPC connection failed`);
      }

      const insertRPC = this.db.prepare(`
        INSERT INTO solana_rpcs (
          network, name, rpc_url, ws_url, priority, enabled, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      const result = insertRPC.run(
        rpcData.network,
        rpcData.name,
        rpcData.rpcUrl,
        rpcData.wsUrl,
        rpcData.priority,
        rpcData.enabled ? 1 : 0,
        new Date().toISOString()
      );

      return result.lastInsertRowid as number;
    } catch (error) {
      console.error('Failed to add Solana RPC:', error);
      throw new Error('Solana RPC addition failed');
    }
  }

  async updateSolanaRPCPriority(id: number, priority: number): Promise<void> {
    try {
      await this.db.prepare('UPDATE solana_rpcs SET priority = ? WHERE id = ?').run(priority, id);
    } catch (error) {
      console.error('Failed to update Solana RPC priority:', error);
      throw new Error('Solana RPC priority update failed');
    }
  }

  async deleteSolanaRPC(id: number): Promise<void> {
    try {
      await this.db.prepare('DELETE FROM solana_rpcs WHERE id = ?').run(id);
    } catch (error) {
      console.error('Failed to delete Solana RPC:', error);
      throw new Error('Solana RPC deletion failed');
    }
  }

  async testSolanaRPC(rpcUrl: string): Promise<RPCTestResult> {
    try {
      const startTime = Date.now();
      const connection = new Connection(rpcUrl, 'confirmed');

      // 测试连接
      const slot = await connection.getSlot();
      const latency = Date.now() - startTime;

      return {
        success: true,
        latency,
        blockNumber: slot,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async healthCheckSolanaRPCs(): Promise<void> {
    try {
      const rpcs = await this.getSolanaRPCs(undefined, true);
      const updateRPC = this.db.prepare(`
        UPDATE solana_rpcs
        SET latency = ?, uptime_24h = ?, last_checked = ?
        WHERE id = ?
      `);

      for (const rpc of rpcs) {
        try {
          const testResult = await this.testSolanaRPC(rpc.rpcUrl);
          const uptime = testResult.success ? 100 : 0;

          updateRPC.run(
            testResult.latency || null,
            uptime,
            new Date().toISOString(),
            rpc.id
          );
        } catch (error) {
          updateRPC.run(null, 0, new Date().toISOString(), rpc.id);
        }
      }
    } catch (error) {
      console.error('Failed to perform health check:', error);
      throw new Error('Solana RPC health check failed');
    }
  }

  // 新的统一映射方法
  private mapRowToChain(row: any): Chain {
    // Debug: Log the complete raw row data from database
    console.log(`🔍 [ChainService] mapRowToChain: Raw database row data:`);
    console.log(`🔍 [ChainService]   - id: ${row.id}`);
    console.log(`🔍 [ChainService]   - type: ${row.type}`);
    console.log(`🔍 [ChainService]   - name: ${row.name}`);
    console.log(`🔍 [ChainService]   - chain_id: ${row.chain_id}`);
    console.log(`🔍 [ChainService]   - rpc_url: ${row.rpc_url}`);
    console.log(`🔍 [ChainService]   - color: ${row.color}`);
    console.log(`🔍 [ChainService]   - badge_color: ${row.badge_color}`);

    const color = row.color || '#3B82F6';
    const badgeColor = row.badge_color || 'badge-primary';

    const baseChain = {
      id: row.id,
      type: row.type as 'evm' | 'solana',
      chainId: row.chain_id || undefined,
      name: row.name,
      rpcUrl: row.rpc_url,
      rpcBackup: row.rpc_backup || undefined,
      explorerUrl: row.explorer_url || undefined,
      symbol: row.symbol,
      decimals: row.decimals || (row.type === 'solana' ? 9 : 18),
      color: color,
      badgeColor: badgeColor,
      enabled: Boolean(row.enabled),
      isCustom: Boolean(row.is_custom),
      createdAt: row.created_at,
    };

    // 为不同类型添加特定字段
    if (row.type === 'evm') {
      const evmChain: EVMChain = {
        ...baseChain,
        type: 'evm',
        chainId: row.chain_id,
      };
      return evmChain;
    } else if (row.type === 'solana') {
      const solanaChain: SolanaChain = {
        ...baseChain,
        type: 'solana',
        network: row.network,
        priority: row.priority,
        latency: row.latency,
      };
      return solanaChain;
    }

    return baseChain as Chain;
  }

  // 向后兼容的映射方法
  private mapRowToEVMChain(row: any): EVMChain {
    return this.mapRowToChain(row) as EVMChain;
  }

  private mapRowToSolanaRPC(row: any): SolanaChain {
    return this.mapRowToChain(row) as SolanaChain;
  }

  // 统一的链查找方法
  async getChainById(chainId: number): Promise<Chain | null> {
    try {
      const row = await this.db.prepare('SELECT * FROM chains WHERE chain_id = ?').get(chainId) as any;
      return row ? this.mapRowToChain(row) : null;
    } catch (error) {
      console.error('Failed to get chain by chain ID:', error);
      return null;
    }
  }

  async getChainByChainId(chainId: number): Promise<EVMChain | null> {
    try {
      const row = await this.db.prepare('SELECT * FROM chains WHERE chain_id = ? AND type = ?').get(chainId, 'evm') as any;
      return row ? this.mapRowToChain(row) as EVMChain : null;
    } catch (error) {
      console.error('Failed to get EVM chain by chain ID:', error);
      return null;
    }
  }

  async getEVMChainById(chainId: number): Promise<EVMChain | null> {
    return this.getChainByChainId(chainId);
  }

  // 统一的链切换方法
  async toggleChain(chainId: number, enabled: boolean): Promise<void> {
    try {
      await this.db.prepare('UPDATE chains SET enabled = ? WHERE id = ?').run(enabled ? 1 : 0, chainId);
    } catch (error) {
      console.error('Failed to toggle chain:', error);
      throw new Error('Chain toggle failed');
    }
  }

  // 向后兼容的切换方法
  async toggleEVMChain(chainId: number, enabled: boolean): Promise<void> {
    return this.toggleChain(chainId, enabled);
  }

  async toggleSolanaRPC(rpcId: number, enabled: boolean): Promise<void> {
    return this.toggleChain(rpcId, enabled);
  }
}