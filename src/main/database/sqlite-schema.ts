import * as sqlite3 from 'sqlite3';
import { Database, open } from 'sqlite';
import path from 'path';
import os from 'os';
import { DatabaseAdapter } from './db-adapter';

export interface Campaign {
  id: string;
  name: string;
  description?: string;
  chain: string;
  token_address: string;
  token_symbol?: string;
  status: 'CREATED' | 'FUNDED' | 'READY' | 'SENDING' | 'PAUSED' | 'COMPLETED' | 'FAILED';
  total_recipients: number;
  completed_recipients: number;
  failed_recipients: number;
  wallet_address?: string;
  wallet_private_key_base64?: string;
  contract_address?: string;
  contract_deployed_at?: string;
  batch_size: number;
  send_interval: number;
  gas_used: number;
  gas_cost_usd: number;
  created_at: string;
  updated_at: string;
  completed_at?: string;
}


export class DatabaseManager {
  private db: Database | null = null;

  constructor() {
    console.log('Using SQLite3 database');
  }

  async initialize(): Promise<void> {
    try {
      const dbPath = this.getDefaultDataDir();
      await this.ensureDirectoryExists(dbPath);

      this.db = await open({
        filename: path.join(dbPath, 'cryptocast.db'),
        driver: sqlite3.Database
      });

      await this.initializeTables();
      console.log('SQLite database initialized successfully');
    } catch (error) {
      console.error('Failed to initialize SQLite database:', error);
      // 降级到内存数据库
      await this.initializeMemoryDB();
    }
  }

  private getDefaultDataDir(): string {
    const platform = os.platform();
    const homeDir = os.homedir();

    switch (platform) {
      case 'win32':
        return path.join(homeDir, 'AppData', 'Roaming', 'cryptocast');
      case 'darwin':
        return path.join(homeDir, 'Library', 'Application Support', 'cryptocast');
      default:
        return path.join(homeDir, '.config', 'cryptocast');
    }
  }

  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    const fs = require('fs').promises;
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  private async initializeMemoryDB(): Promise<void> {
    console.log('Falling back to in-memory database');
    this.db = await open({
      filename: ':memory:',
      driver: sqlite3.Database
    });
    await this.initializeTables();
  }

  private async initializeTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    // 活动表 - 优化后移除冗余字段
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS campaigns (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        chain_type TEXT NOT NULL CHECK (chain_type IN ('evm', 'solana')),
        chain_id INTEGER,  -- EVM链ID，Solana为NULL
        network TEXT,     -- Solana网络类型，EVM为NULL
        token_address TEXT NOT NULL,
        token_symbol TEXT,
        token_name TEXT,
        token_decimals INTEGER,
        status TEXT NOT NULL CHECK (status IN ('CREATED', 'FUNDED', 'READY', 'SENDING', 'PAUSED', 'COMPLETED', 'FAILED')),
        total_recipients INTEGER NOT NULL,
        completed_recipients INTEGER DEFAULT 0,
        failed_recipients INTEGER DEFAULT 0,
        wallet_address TEXT,
        wallet_private_key_base64 TEXT,
        contract_address TEXT,
        batch_size INTEGER DEFAULT 100,
        send_interval INTEGER DEFAULT 2000,
        total_gas_used REAL DEFAULT 0,
        total_cost_usd REAL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        completed_at TEXT
      )
    `);

    // 接收者表 - 优化后移除不必要的时间戳
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS recipients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        campaign_id TEXT NOT NULL,
        address TEXT NOT NULL,
        amount TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('PENDING', 'SENT', 'FAILED')),
        tx_hash TEXT,
        gas_used REAL DEFAULT 0,
        error_message TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (campaign_id) REFERENCES campaigns (id) ON DELETE CASCADE,
        UNIQUE(campaign_id, address)
      )
    `);

    // 交易记录表 - 完整字段
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        campaign_id TEXT NOT NULL,
        tx_hash TEXT NOT NULL,
        tx_type TEXT NOT NULL CHECK (tx_type IN ('DEPLOY_CONTRACT', 'TRANSFER_TO_CONTRACT', 'BATCH_SEND', 'WITHDRAW_REMAINING')),
        from_address TEXT NOT NULL,
        to_address TEXT,
        amount TEXT,
        gas_used REAL DEFAULT 0,
        gas_price TEXT,
        gas_cost REAL DEFAULT 0,
        status TEXT NOT NULL CHECK (status IN ('PENDING', 'CONFIRMED', 'FAILED')),
        block_number INTEGER,
        block_hash TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        confirmed_at TEXT,
        FOREIGN KEY (campaign_id) REFERENCES campaigns (id) ON DELETE CASCADE,
        UNIQUE(tx_hash)  -- 防止重复交易
      )
    `);

    // 统一链配置表 (优化后移除冗余字段)
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS chains (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL CHECK (type IN ('evm', 'solana')),
        chain_id INTEGER,  -- EVM链ID或Solana链ID(501)
        name TEXT NOT NULL UNIQUE,
        rpc_url TEXT NOT NULL,
        rpc_backup TEXT,
        explorer_url TEXT,
        symbol TEXT NOT NULL,
        decimals INTEGER DEFAULT 18,  -- EVM默认18，Solana可设为9
        color TEXT DEFAULT '#3B82F6',
        badge_color TEXT DEFAULT 'badge-primary',
        network TEXT,  -- Solana网络类型，EVM链为NULL
        priority INTEGER DEFAULT 5,  -- 主要用于Solana RPC优先级
        latency INTEGER,  -- 延迟测试结果(ms)
        enabled BOOLEAN DEFAULT 1,
        is_custom BOOLEAN DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('🔍 [Database] Unified chains table created/verified successfully');

    // 价格历史表 - 优化后移除冗余时间戳
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS price_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL,
        price REAL NOT NULL,
        change_24h REAL,
        change_percent_24h REAL,
        market_cap REAL,
        volume_24h REAL,
        timestamp INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 文件信息表 - 考虑是否需要保留，暂时简化
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS files (
        id TEXT PRIMARY KEY,
        filename TEXT NOT NULL,
        file_path TEXT NOT NULL UNIQUE,
        size INTEGER NOT NULL,
        mime_type TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 运行数据库迁移(必须在创建索引之前,因为索引依赖完整的schema)
    await this.runMigrations();

    // 创建优化的索引(在migration之后,确保所有列都存在)
    await this.db.exec(`
      -- 活动相关索引
      CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
      CREATE INDEX IF NOT EXISTS idx_campaigns_chain ON campaigns(chain_type, chain_id);
      CREATE INDEX IF NOT EXISTS idx_campaigns_created_at ON campaigns(created_at);

      -- 接收者相关索引
      CREATE INDEX IF NOT EXISTS idx_recipients_campaign_id ON recipients(campaign_id);
      CREATE INDEX IF NOT EXISTS idx_recipients_status ON recipients(status);
      CREATE INDEX IF NOT EXISTS idx_recipients_address ON recipients(address);

      -- 交易相关索引
      CREATE INDEX IF NOT EXISTS idx_transactions_campaign_id ON transactions(campaign_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
      CREATE INDEX IF NOT EXISTS idx_transactions_hash ON transactions(tx_hash);

      -- 链配置相关索引
      CREATE INDEX IF NOT EXISTS idx_chains_type_enabled ON chains(type, enabled);
      CREATE INDEX IF NOT EXISTS idx_chains_chain_id ON chains(chain_id);
      CREATE INDEX IF NOT EXISTS idx_chains_network ON chains(network);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_chains_name ON chains(name);

      -- 价格历史索引
      CREATE INDEX IF NOT EXISTS idx_price_symbol_timestamp ON price_history(symbol, timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_price_timestamp ON price_history(timestamp DESC);

      -- 文件索引
      CREATE UNIQUE INDEX IF NOT EXISTS idx_files_path ON files(file_path);
    `);

    // 插入默认链信息
    await this.insertDefaultChains();
  }

  private async runMigrations(): Promise<void> {
    if (!this.db) return;

    try {
      // 只处理从旧版本数据库迁移到新版本的情况
      // 检查campaigns表是否存在所有必需的列
      const campaignsInfo = await this.db.all(`PRAGMA table_info(campaigns)`);
      const existingColumns = campaignsInfo.map((col: any) => col.name);

      // 如果缺少关键列(如chain_type),说明是旧数据库,需要重建
      const requiredColumns = ['chain_type', 'token_symbol', 'token_name', 'token_decimals',
                               'failed_recipients', 'batch_size', 'send_interval', 'completed_at'];
      const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));

      if (missingColumns.length > 0) {
        console.log(`⚠️  [Database] Old schema detected, missing columns: ${missingColumns.join(', ')}`);
        console.log('🔄 [Database] Recreating campaigns table with new schema...');

        // 备份旧数据
        const oldCampaigns = await this.db.all('SELECT * FROM campaigns') as any[];

        // 删除旧表
        await this.db.exec('DROP TABLE IF EXISTS campaigns');

        // 重新创建表(使用initializeTables中的完整schema)
        await this.db.exec(`
          CREATE TABLE IF NOT EXISTS campaigns (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            chain_type TEXT NOT NULL CHECK (chain_type IN ('evm', 'solana')),
            chain_id INTEGER,
            network TEXT,
            token_address TEXT NOT NULL,
            token_symbol TEXT,
            token_name TEXT,
            token_decimals INTEGER,
            status TEXT NOT NULL CHECK (status IN ('CREATED', 'FUNDED', 'READY', 'SENDING', 'PAUSED', 'COMPLETED', 'FAILED')),
            total_recipients INTEGER NOT NULL,
            completed_recipients INTEGER DEFAULT 0,
            failed_recipients INTEGER DEFAULT 0,
            wallet_address TEXT,
            wallet_private_key_base64 TEXT,
            contract_address TEXT,
            batch_size INTEGER DEFAULT 100,
            send_interval INTEGER DEFAULT 2000,
            total_gas_used REAL DEFAULT 0,
            total_cost_usd REAL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            completed_at TEXT
          )
        `);

        // 迁移旧数据(带默认值)
        for (const campaign of oldCampaigns) {
          await this.db.run(`
            INSERT OR REPLACE INTO campaigns (
              id, name, description, chain_type, chain_id, network, token_address,
              token_symbol, token_name, token_decimals, status, total_recipients,
              completed_recipients, failed_recipients, wallet_address, wallet_private_key_base64,
              contract_address, batch_size, send_interval, total_gas_used, total_cost_usd,
              created_at, updated_at, completed_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            campaign.id,
            campaign.name,
            campaign.description || null,
            campaign.chain_type || 'evm', // 默认EVM
            campaign.chain_id || null,
            campaign.network || null,
            campaign.token_address,
            campaign.token_symbol || null,
            campaign.token_name || null,
            campaign.token_decimals || null,
            campaign.status,
            campaign.total_recipients,
            campaign.completed_recipients || 0,
            campaign.failed_recipients || 0,
            campaign.wallet_address || null,
            campaign.wallet_private_key_base64 || null,
            campaign.contract_address || null,
            campaign.batch_size || 100,
            campaign.send_interval || 2000,
            campaign.total_gas_used || 0,
            campaign.total_cost_usd || 0,
            campaign.created_at,
            campaign.updated_at,
            campaign.completed_at || null
          ]);
        }

        console.log(`✅ [Database] Migrated ${oldCampaigns.length} campaigns to new schema`);
      }

      // 检查是否需要添加wallet_private_key_base64字段
      const campaignsInfoAfterMigration = await this.db.all(`PRAGMA table_info(campaigns)`);
      const columnsAfterMigration = campaignsInfoAfterMigration.map((col: any) => col.name);

      if (!columnsAfterMigration.includes('wallet_private_key_base64')) {
        console.log('🔄 [Database] Adding wallet_private_key_base64 column to campaigns table');
        await this.db.exec('ALTER TABLE campaigns ADD COLUMN wallet_private_key_base64 TEXT');
        console.log('✅ [Database] Added wallet_private_key_base64 column');
      }

      // 检查transactions表是否需要迁移
      const transactionsInfo = await this.db.all(`PRAGMA table_info(transactions)`);
      const existingTxColumns = transactionsInfo.map((col: any) => col.name);

      const requiredTxColumns = ['gas_price', 'block_hash', 'confirmed_at'];
      const missingTxColumns = requiredTxColumns.filter(col => !existingTxColumns.includes(col));

      if (missingTxColumns.length > 0) {
        console.log(`⚠️  [Database] Old transactions table detected, missing columns: ${missingTxColumns.join(', ')}`);
        console.log('🔄 [Database] Recreating transactions table with new schema...');

        // 备份旧数据
        const oldTransactions = await this.db.all('SELECT * FROM transactions') as any[];

        // 删除旧表
        await this.db.exec('DROP TABLE IF EXISTS transactions');

        // 重新创建表
        await this.db.exec(`
          CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            campaign_id TEXT NOT NULL,
            tx_hash TEXT NOT NULL,
            tx_type TEXT NOT NULL CHECK (tx_type IN ('DEPLOY_CONTRACT', 'TRANSFER_TO_CONTRACT', 'BATCH_SEND', 'WITHDRAW_REMAINING')),
            from_address TEXT NOT NULL,
            to_address TEXT,
            amount TEXT,
            gas_used REAL DEFAULT 0,
            gas_price TEXT,
            gas_cost REAL DEFAULT 0,
            status TEXT NOT NULL CHECK (status IN ('PENDING', 'CONFIRMED', 'FAILED')),
            block_number INTEGER,
            block_hash TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            confirmed_at TEXT,
            FOREIGN KEY (campaign_id) REFERENCES campaigns (id) ON DELETE CASCADE,
            UNIQUE(tx_hash)
          )
        `);

        // 迁移旧数据
        for (const tx of oldTransactions) {
          await this.db.run(`
            INSERT OR REPLACE INTO transactions (
              id, campaign_id, tx_hash, tx_type, from_address, to_address,
              amount, gas_used, gas_price, gas_cost, status, block_number,
              block_hash, created_at, confirmed_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            tx.id,
            tx.campaign_id,
            tx.tx_hash,
            tx.tx_type,
            tx.from_address,
            tx.to_address || null,
            tx.amount || null,
            tx.gas_used || 0,
            tx.gas_price || null,
            tx.gas_cost || 0,
            tx.status,
            tx.block_number || null,
            tx.block_hash || null,
            tx.created_at,
            tx.confirmed_at || null
          ]);
        }

        console.log(`✅ [Database] Migrated ${oldTransactions.length} transactions to new schema`);
      }
    } catch (error) {
      console.error('❌ [Database] Migration failed:', error);
      // 不抛出错误,允许继续使用新schema
    }

    // 迁移链数据到统一表
    await this.migrateChainsToUnifiedTable();
  }

  private async migrateChainsToUnifiedTable(): Promise<void> {
    if (!this.db) return;

    try {
      // 检查是否存在旧的evm_chains表
      const tableInfo = await this.db.all(`SELECT name FROM sqlite_master WHERE type='table' AND name IN ('evm_chains', 'solana_rpcs')`);
      const hasOldTables = tableInfo.length > 0;

      if (hasOldTables) {
        console.log('🔄 [Database] Starting migration from old chain tables to unified chains table');

        // 迁移EVM链
        try {
          const evmChains = await this.db.all('SELECT * FROM evm_chains') as any[];
          for (const chain of evmChains) {
            await this.db.run(`
              INSERT OR REPLACE INTO chains (
                type, chain_id, name, rpc_url, rpc_backup, explorer_url,
                symbol, decimals, color, badge_color, enabled, is_custom, created_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
              'evm',
              chain.chain_id,
              chain.name,
              chain.rpc_url,
              chain.rpc_backup,
              chain.explorer_url,
              chain.symbol,
              chain.decimals || 18,
              chain.color || '#3B82F6',
              chain.badge_color || 'badge-primary',
              1, // enabled
              chain.is_custom || 0,
              chain.created_at || new Date().toISOString()
            ]);
          }
          console.log(`✅ [Database] Migrated ${evmChains.length} EVM chains`);
        } catch (error) {
          console.error('❌ [Database] Failed to migrate EVM chains:', error);
        }

        // 迁移Solana RPCs
        try {
          const solanaRpcs = await this.db.all('SELECT * FROM solana_rpcs') as any[];
          for (const rpc of solanaRpcs) {
            await this.db.run(`
              INSERT OR REPLACE INTO chains (
                type, chain_id, name, rpc_url, network, symbol, decimals,
                color, badge_color, priority, latency, uptime_24h, enabled, created_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
              'solana',
              null, // Solana doesn't have chain_id
              rpc.name,
              rpc.rpc_url,
              rpc.network,
              'SOL',
              9, // Solana decimals
              '#00FFA3', // Solana color
              'badge-accent',
              rpc.priority || 5,
              rpc.latency,
              rpc.uptime_24h || 100.0,
              rpc.enabled,
              rpc.created_at || new Date().toISOString()
            ]);
          }
          console.log(`✅ [Database] Migrated ${solanaRpcs.length} Solana RPCs`);
        } catch (error) {
          console.error('❌ [Database] Failed to migrate Solana RPCs:', error);
        }

        console.log('✅ [Database] Migration to unified chains table completed');
      }
    } catch (error) {
      console.error('❌ [Database] Migration failed:', error);
    }
  }

  private async insertDefaultChains(): Promise<void> {
    if (!this.db) return;

    // 插入默认EVM链 - 使用 publicnode.com 的统一RPC端点，并分配固定颜色
    const defaultEVMChains = [
      {
        type: 'evm',
        chain_id: 1,
        name: 'Ethereum Mainnet',
        rpc_url: 'https://ethereum-rpc.publicnode.com',
        rpc_backup: 'https://ethereum-rpc.publicnode.com',
        explorer_url: 'https://etherscan.io',
        symbol: 'ETH',
        decimals: 18,
        color: '#627EEA',
        badge_color: 'badge-neutral',
      },
      {
        type: 'evm',
        chain_id: 11155111,
        name: 'Ethereum Sepolia Testnet',
        rpc_url: 'https://ethereum-sepolia-rpc.publicnode.com',
        rpc_backup: 'https://ethereum-sepolia-rpc.publicnode.com',
        explorer_url: 'https://sepolia.etherscan.io',
        symbol: 'ETH',
        decimals: 18,
        color: '#4169E1',
        badge_color: 'badge-info',
      },
      {
        type: 'evm',
        chain_id: 137,
        name: 'Polygon',
        rpc_url: 'https://polygon-bor-rpc.publicnode.com',
        rpc_backup: 'https://polygon-bor-rpc.publicnode.com',
        explorer_url: 'https://polygonscan.com',
        symbol: 'POL',
        decimals: 18,
        color: '#8247E5',
        badge_color: 'badge-secondary',
      },
      {
        type: 'evm',
        chain_id: 42161,
        name: 'Arbitrum One',
        rpc_url: 'https://arbitrum-one-rpc.publicnode.com',
        rpc_backup: 'https://arbitrum-one-rpc.publicnode.com',
        explorer_url: 'https://arbiscan.io',
        symbol: 'ETH',
        decimals: 18,
        color: '#28A0F0',
        badge_color: 'badge-info',
      },
      {
        type: 'evm',
        chain_id: 10,
        name: 'Optimism',
        rpc_url: 'https://optimism-rpc.publicnode.com',
        rpc_backup: 'https://optimism-rpc.publicnode.com',
        explorer_url: 'https://optimistic.etherscan.io',
        symbol: 'ETH',
        decimals: 18,
        color: '#FF0420',
        badge_color: 'badge-error',
      },
      {
        type: 'evm',
        chain_id: 8453,
        name: 'Base',
        rpc_url: 'https://base-rpc.publicnode.com',
        rpc_backup: 'https://base-rpc.publicnode.com',
        explorer_url: 'https://basescan.org',
        symbol: 'ETH',
        decimals: 18,
        color: '#0052FF',
        badge_color: 'badge-success',
      },
      {
        type: 'evm',
        chain_id: 56,
        name: 'BSC',
        rpc_url: 'https://bsc-rpc.publicnode.com',
        rpc_backup: 'https://bsc-rpc.publicnode.com',
        explorer_url: 'https://bscscan.com',
        symbol: 'BNB',
        decimals: 18,
        color: '#F3BA2F',
        badge_color: 'badge-warning',
      },
      {
        type: 'evm',
        chain_id: 43114,
        name: 'Avalanche C-Chain',
        rpc_url: 'https://avalanche-c-chain-rpc.publicnode.com',
        rpc_backup: 'https://avalanche-c-chain-rpc.publicnode.com',
        explorer_url: 'https://snowtrace.io',
        symbol: 'AVAX',
        decimals: 18,
        color: '#E84142',
        badge_color: 'badge-accent',
      },
    ];

    // 插入默认Solana网络
    const defaultSolanaNetworks = [
      {
        type: 'solana',
        chain_id: 501,
        name: 'Solana Mainnet',
        rpc_url: 'https://api.mainnet-beta.solana.com',
        rpc_backup: null,
        explorer_url: 'https://explorer.solana.com',
        symbol: 'SOL',
        decimals: 9,
        color: '#00FFA3',
        badge_color: 'badge-accent',
        network: 'mainnet-beta',
        priority: 1,
      },
      {
        type: 'solana',
        chain_id: 502,
        name: 'Solana Devnet',
        rpc_url: 'https://api.devnet.solana.com',
        rpc_backup: null,
        explorer_url: 'https://explorer.solana.com',
        symbol: 'SOL',
        decimals: 9,
        color: '#00D4AA',
        badge_color: 'badge-info',
        network: 'devnet',
        priority: 1,
      },
    ];

    const allDefaultChains = [...defaultEVMChains, ...defaultSolanaNetworks];

    for (const chain of allDefaultChains) {
      try {
        console.log(`🔍 [Database] Processing chain ${chain.name} (${chain.type}) with color ${chain.color}`);

        await this.db.run(`
          INSERT OR REPLACE INTO chains (
            type, chain_id, name, rpc_url, rpc_backup, explorer_url, symbol, decimals,
            color, badge_color, network, priority, enabled, is_custom, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          chain.type,
          chain.chain_id,
          chain.name,
          chain.rpc_url,
          chain.rpc_backup,
          chain.explorer_url,
          chain.symbol,
          chain.decimals,
          chain.color,
          chain.badge_color,
          (chain as any).network || null,
          (chain as any).priority || null,
          1, // enabled
          0, // is_custom (default chains are not custom)
          new Date().toISOString()
        ]);

        console.log(`🔍 [Database] Successfully processed chain ${chain.name}`);
      } catch (error) {
        console.error(`Failed to insert/update chain ${chain.name}:`, error);
      }
    }
  }

  
  // 获取数据库实例 - 返回适配器以提供同步API
  getDatabase(): DatabaseAdapter {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    return new DatabaseAdapter(this.db);
  }

  // 关闭数据库连接
  async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
    }
  }
}