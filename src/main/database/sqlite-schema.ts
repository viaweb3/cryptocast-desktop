import * as sqlite3 from 'sqlite3';
import { Database, open } from 'sqlite';
import * as path from 'path';
import * as os from 'os';
import { DatabaseAdapter } from './db-adapter';
import { Logger } from '../utils/logger';

const logger = Logger.getInstance().child('sqlite-schema');

/**
 * Campaign interface
 */
export interface Campaign {
  id: string;
  name: string;
  description?: string;
  chain: string;
  chain_type: 'evm' | 'solana';
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

/**
 * Chain information from database
 */
export interface ChainInfo {
  id: number;
  type: 'evm' | 'solana';
  chain_id?: number;
  name: string;
  rpc_url: string;
  rpc_backup?: string;
  explorer_url?: string;
  symbol: string;
  decimals: number;
  color: string;
  badge_color: string;
  is_custom: boolean;
  created_at: string;
}

/**
 * Clean database manager without memory mode or migrations
 */
export class DatabaseManager {
  private db: Database | null = null;
  private dbPath: string = '';

  constructor() {
    logger.info('[Database] Using SQLite3 database');
  }

  /**
   * Initialize database connection
   */
  async initialize(): Promise<void> {
    try {
      this.dbPath = this.getDefaultDataDir();
      await this.ensureDirectoryExists(this.dbPath);

      const dbFilePath = path.join(this.dbPath, 'cryptocast.db');
      logger.info(`[Database] Opening database at: ${dbFilePath}`);

      this.db = await open({
        filename: dbFilePath,
        driver: sqlite3.Database
      });

      // Enable foreign keys
      await this.db.exec('PRAGMA foreign_keys = ON');

      // Enable WAL mode for better concurrency
      await this.db.exec('PRAGMA journal_mode = WAL');

      // Set synchronous mode
      await this.db.exec('PRAGMA synchronous = NORMAL');

      await this.createTables();
      await this.dropObsoleteTables();
      await this.migrateDatabase();
      await this.createIndexes();
      await this.insertDefaultChains();

      logger.info('[Database] SQLite database initialized successfully');
    } catch (error) {
      logger.error('[Database] Failed to initialize database:', error as Error);
      throw error;
    }
  }

  /**
   * Get default data directory based on platform
   */
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

  /**
   * Ensure directory exists
   */
  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    const fs = require('fs').promises;
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  /**
   * Create all database tables
   */
  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    logger.info('[Database] Creating tables...');

    // Campaigns table
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS campaigns (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        chain_type TEXT NOT NULL CHECK (chain_type IN ('evm', 'solana')),
        chain_id INTEGER,
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
        contract_deployed_at TEXT,
        batch_size INTEGER DEFAULT 100,
        send_interval INTEGER DEFAULT 2000,
        total_gas_used REAL DEFAULT 0,
        total_cost_usd REAL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        completed_at TEXT
      )
    `);

    // Recipients table
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS recipients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        campaign_id TEXT NOT NULL,
        address TEXT NOT NULL,
        amount TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('PENDING', 'PROCESSING', 'SENT', 'FAILED')),
        tx_hash TEXT,
        gas_used REAL DEFAULT 0,
        error_message TEXT,
        batch_number INTEGER,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (campaign_id) REFERENCES campaigns (id) ON DELETE CASCADE,
        UNIQUE(campaign_id, address)
      )
    `);

    // Transactions table
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        campaign_id TEXT NOT NULL,
        tx_hash TEXT NOT NULL,
        tx_type TEXT NOT NULL CHECK (tx_type IN ('DEPLOY_CONTRACT', 'TRANSFER_TO_CONTRACT', 'APPROVE_TOKENS', 'BATCH_SEND', 'WITHDRAW_REMAINING')),
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

    // Chains table (unified for both EVM and Solana)
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS chains (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL CHECK (type IN ('evm', 'solana')),
        chain_id INTEGER,
        name TEXT NOT NULL UNIQUE,
        rpc_url TEXT NOT NULL,
        rpc_backup TEXT,
        explorer_url TEXT,
        symbol TEXT NOT NULL,
        decimals INTEGER DEFAULT 18,
        color TEXT DEFAULT '#3B82F6',
        badge_color TEXT DEFAULT 'badge-primary',
        is_custom BOOLEAN DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Price history table
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

    logger.info('[Database] Tables created successfully');
  }

  /**
   * Drop obsolete tables to clean up database
   */
  private async dropObsoleteTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    logger.info('[Database] Dropping obsolete tables...');

    // Drop the obsolete files table if it exists (was completely unused)
    await this.db.exec('DROP TABLE IF EXISTS files');

    logger.info('[Database] Obsolete tables dropped successfully');
  }

  /**
   * Migrate existing database to handle schema changes
   */
  private async migrateDatabase(): Promise<void> {
    // No migrations needed for fresh installations
    logger.info('[Database] Database migrations skipped (using final schema)');
  }

  /**
   * Create indexes for better performance
   */
  private async createIndexes(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    logger.info('[Database] Creating indexes...');

    await this.db.exec(`
      -- Campaign indexes for common queries
      CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
      CREATE INDEX IF NOT EXISTS idx_campaigns_chain ON campaigns(chain_type, chain_id);
      CREATE INDEX IF NOT EXISTS idx_campaigns_created_at ON campaigns(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_campaigns_status_updated ON campaigns(status, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_campaigns_chain_status ON campaigns(chain_id, status);

      -- Recipient indexes for batch processing and status tracking
      CREATE INDEX IF NOT EXISTS idx_recipients_campaign_id ON recipients(campaign_id);
      CREATE INDEX IF NOT EXISTS idx_recipients_status ON recipients(status);
      CREATE INDEX IF NOT EXISTS idx_recipients_address ON recipients(address);
      CREATE INDEX IF NOT EXISTS idx_recipients_campaign_status_created ON recipients(campaign_id, status, created_at);
      CREATE INDEX IF NOT EXISTS idx_recipients_campaign_status_id ON recipients(campaign_id, status, id);
      CREATE INDEX IF NOT EXISTS idx_recipients_batch_number ON recipients(campaign_id, batch_number);
      CREATE INDEX IF NOT EXISTS idx_recipients_tx_hash ON recipients(tx_hash) WHERE tx_hash IS NOT NULL;

      -- Transaction indexes for lookups and filtering
      CREATE INDEX IF NOT EXISTS idx_transactions_campaign_id ON transactions(campaign_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_hash ON transactions(tx_hash);
      CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(tx_type);
      CREATE INDEX IF NOT EXISTS idx_transactions_campaign_created ON transactions(campaign_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_transactions_status_created ON transactions(status, created_at DESC);

      -- Chain indexes
      CREATE INDEX IF NOT EXISTS idx_chains_type ON chains(type);
      CREATE INDEX IF NOT EXISTS idx_chains_chain_id ON chains(chain_id);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_chains_name_unique ON chains(name);

      -- Price history indexes for time-series queries
      CREATE INDEX IF NOT EXISTS idx_price_symbol_timestamp ON price_history(symbol, timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_price_timestamp ON price_history(timestamp DESC);

      `);

    logger.info('[Database] Indexes created successfully');
  }

  /**
   * Insert default chain configurations
   */
  private async insertDefaultChains(): Promise<void> {
    if (!this.db) return;

    logger.info('[Database] Inserting default chains...');

    // Default EVM chains
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
        badge_color: 'badge-neutral'
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
        badge_color: 'badge-info'
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
        badge_color: 'badge-secondary'
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
        badge_color: 'badge-info'
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
        badge_color: 'badge-error'
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
        badge_color: 'badge-success'
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
        badge_color: 'badge-warning'
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
        badge_color: 'badge-accent'
      }
    ];

    // Default Solana networks
    const defaultSolanaNetworks = [
      {
        type: 'solana',
        chain_id: 501,
        name: 'Solana Mainnet',
        rpc_url: 'https://solana-rpc.publicnode.com',
        rpc_backup: null,
        explorer_url: 'https://solscan.io',
        symbol: 'SOL',
        decimals: 9,
        color: '#00FFA3',
        badge_color: 'badge-accent'
      },
      {
        type: 'solana',
        chain_id: 502,
        name: 'Solana Devnet',
        rpc_url: 'https://api.devnet.solana.com',
        rpc_backup: null,
        explorer_url: 'https://solscan.io/?cluster=devnet',
        symbol: 'SOL',
        decimals: 9,
        color: '#00D4AA',
        badge_color: 'badge-info'
      }
    ];

    const allDefaultChains = [...defaultEVMChains, ...defaultSolanaNetworks];

    for (const chain of allDefaultChains) {
      try {
        // Check if chain already exists and is not custom
        const existingChain = await this.db.get(
          'SELECT * FROM chains WHERE type = ? AND chain_id = ? AND is_custom = 0',
          [chain.type, chain.chain_id]
        );

        if (!existingChain) {
          await this.db.run(
            `
            INSERT OR IGNORE INTO chains (
              type, chain_id, name, rpc_url, rpc_backup, explorer_url, symbol, decimals,
              color, badge_color, is_custom, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
            [
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
              0, // is_custom (default chains are built-in)
              new Date().toISOString()
            ]
          );
        }
      } catch (error) {
        console.error(`[Database] Failed to insert chain ${chain.name}:`, error);
      }
    }

    logger.info(`[Database] Inserted ${allDefaultChains.length} default chains`);
  }

  /**
   * Get database instance with sync adapter
   */
  getDatabase(): DatabaseAdapter {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    return new DatabaseAdapter(this.db);
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
      logger.info('[Database] Database connection closed');
    }
  }
}
