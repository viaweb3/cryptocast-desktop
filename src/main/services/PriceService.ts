import axios from 'axios';
import { Logger } from '../utils/logger';
import type { DatabaseManager } from '../database/sqlite-schema';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DatabaseInstance = any;

const logger = Logger.getInstance().child('PriceService');

export interface PriceData {
  symbol: string;
  price: number;
  change24h: number;
  changePercent24h: number;
  marketCap: number;
  volume24h: number;
  lastUpdated: number;
}


export interface NetworkConfig {
  name: string;
  chainId: number;
  currency: string;
  nativeTokenSymbol: string;
  coingeckoId: string;
}

export class PriceService {
  private db: DatabaseInstance;
  private priceCache: Map<string, PriceData> = new Map();
  private updateInterval: NodeJS.Timeout | null = null;

  // Supported networks
  private readonly networks: NetworkConfig[] = [
    { name: 'ethereum', chainId: 1, currency: 'USD', nativeTokenSymbol: 'ETH', coingeckoId: 'ethereum' },
    { name: 'polygon', chainId: 137, currency: 'USD', nativeTokenSymbol: 'POL', coingeckoId: 'polygon-ecosystem-token' },
    { name: 'arbitrum', chainId: 42161, currency: 'USD', nativeTokenSymbol: 'ETH', coingeckoId: 'ethereum' },
    { name: 'optimism', chainId: 10, currency: 'USD', nativeTokenSymbol: 'ETH', coingeckoId: 'ethereum' },
    { name: 'base', chainId: 8453, currency: 'USD', nativeTokenSymbol: 'ETH', coingeckoId: 'ethereum' },
    { name: 'bsc', chainId: 56, currency: 'USD', nativeTokenSymbol: 'BNB', coingeckoId: 'binancecoin' },
    { name: 'avalanche', chainId: 43114, currency: 'USD', nativeTokenSymbol: 'AVAX', coingeckoId: 'avalanche-2' },
    { name: 'solana', chainId: 0, currency: 'USD', nativeTokenSymbol: 'SOL', coingeckoId: 'solana' },
  ];

  constructor(database: DatabaseManager) {
    this.db = database.getDatabase();
    this.startPriceUpdates();
  }

  private startPriceUpdates(): void {
    // Update prices every 2 minutes (120 seconds) for more accuracy
    this.updateInterval = setInterval(async () => {
      try {
        await this.updateAllPrices();
      } catch (error) {
        logger.error('Price update failed', error as Error);
        // If scheduled update fails, try fallback after 30 seconds
        setTimeout(async () => {
          try {
            await this.updateAllPrices();
          } catch (retryError) {
            logger.error('Retry price update also failed', retryError as Error);
          }
        }, 30000);
      }
    }, 120000); // Reduced from 180000 to 120000

    // Delay initial price update to avoid startup conflicts
    setTimeout(async () => {
      try {
        await this.updateAllPrices();
      } catch (error) {
        logger.error('Delayed initial price update failed', error as Error);
      }
    }, 3000); // Reduced from 5000 to 3000 for faster initial prices
  }

  private async updateAllPrices(): Promise<void> {
    const coinIds = this.networks.map(n => n.coingeckoId).filter((id, index, self) => self.indexOf(id) === index);

    try {
      const url = 'https://api.coingecko.com/api/v3/simple/price';
      const params = {
        ids: coinIds.join(','),
        vs_currencies: 'usd',
      };

      const response = await axios.get(url, {
        params,
        timeout: 10000,
      });

      const timestamp = Math.floor(Date.now() / 1000);

      for (const network of this.networks) {
        const coinData = response.data[network.coingeckoId];
        if (coinData && typeof coinData.usd === 'number' && coinData.usd > 0) {
          const priceData: PriceData = {
            symbol: network.nativeTokenSymbol,
            price: coinData.usd,
            change24h: 0,
            changePercent24h: 0,
            marketCap: 0,
            volume24h: 0,
            lastUpdated: timestamp,
          };

          this.priceCache.set(network.nativeTokenSymbol, priceData);
          await this.savePriceToDatabase(priceData);
        }
      }
    } catch (error) {
      logger.error('Failed to fetch prices from CoinGecko', error as Error);
      // Fallback to cached prices
    }
  }

  
  private async savePriceToDatabase(priceData: PriceData): Promise<void> {
    try {
      // Double-check price validity before database insertion
      if (typeof priceData.price !== 'number' || priceData.price < 0 || !isFinite(priceData.price)) {
        logger.warn('Invalid price value', { symbol: priceData.symbol, price: priceData.price });
        return;
      }

      const stmt = this.db.prepare(`
        INSERT INTO price_history (symbol, price, change_24h, change_percent_24h, market_cap, volume_24h, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      await stmt.run(
        priceData.symbol,
        priceData.price,
        priceData.change24h,
        priceData.changePercent24h,
        priceData.marketCap,
        priceData.volume24h,
        priceData.lastUpdated
      );
    } catch (error) {
      logger.error('Failed to save price to database', error as Error, { symbol: priceData.symbol });
    }
  }

  async getPrice(symbol: string, forceRefresh: boolean = false): Promise<number> {
    symbol = symbol.toUpperCase();

    // If force refresh or no cached data, try to get fresh price
    if (forceRefresh || !this.priceCache.has(symbol)) {
      try {
        await this.updateSinglePrice(symbol);
      } catch (error) {
        logger.warn('Failed to refresh price', { symbol, error: error instanceof Error ? error.message : String(error) });
      }
    }

    // Try cache first
    const cachedPrice = this.priceCache.get(symbol);
    if (cachedPrice) {
      // Check if price is recent (within 5 minutes)
      const ageSeconds = Math.floor(Date.now() / 1000) - cachedPrice.lastUpdated;
      if (ageSeconds < 300) { // 5 minutes
        return cachedPrice.price;
      }
    }

    // Fallback to database
    try {
      const result = await this.db.prepare(`
        SELECT price FROM price_history
        WHERE symbol = ?
        ORDER BY timestamp DESC
        LIMIT 1
      `).get(symbol) as { price: number } | undefined;

      if (result && result.price > 0) {
        return result.price;
      }
    } catch (error) {
      logger.error('Failed to get price from database', error as Error, { symbol });
    }

    // Final fallback with hardcoded prices for major tokens
    const fallbackPrices: Record<string, number> = {
      'ETH': 3500,  // Conservative ETH price
      'BNB': 600,   // Conservative BNB price
      'MATIC': 0.9, // Conservative MATIC price
      'SOL': 150,   // Conservative SOL price
      'AVAX': 35,   // Conservative AVAX price
    };

    return fallbackPrices[symbol] || 0;
  }

  /**
   * Update price for a single token immediately
   */
  private async updateSinglePrice(symbol: string): Promise<void> {
    const network = this.networks.find(n => n.nativeTokenSymbol === symbol);
    if (!network) {
      throw new Error(`Network not found for symbol ${symbol}`);
    }

    try {
      const url = 'https://api.coingecko.com/api/v3/simple/price';
      const params = {
        ids: network.coingeckoId,
        vs_currencies: 'usd',
      };

      const response = await axios.get(url, {
        params,
        timeout: 5000, // Shorter timeout for single requests
      });

      const coinData = response.data[network.coingeckoId];
      if (coinData && typeof coinData.usd === 'number' && coinData.usd > 0) {
        const timestamp = Math.floor(Date.now() / 1000);
        const priceData: PriceData = {
          symbol: network.nativeTokenSymbol,
          price: coinData.usd,
          change24h: 0,
          changePercent24h: 0,
          marketCap: 0,
          volume24h: 0,
          lastUpdated: timestamp,
        };

        this.priceCache.set(symbol, priceData);
        await this.savePriceToDatabase(priceData);
      } else {
        throw new Error(`Invalid price data received: ${JSON.stringify(coinData)}`);
      }
    } catch (error) {
      logger.error('Failed to update price', error as Error, { symbol });
      throw error;
    }
  }

  async getPriceData(symbol: string): Promise<PriceData | null> {
    const cachedPrice = this.priceCache.get(symbol.toUpperCase());
    if (cachedPrice) {
      return cachedPrice;
    }

    // Fallback to database
    try {
      const result = await this.db.prepare(`
        SELECT * FROM price_history
        WHERE symbol = ?
        ORDER BY timestamp DESC
        LIMIT 1
      `).get(symbol.toUpperCase()) as {
        symbol: string;
        price: number;
        change_24h: number;
        change_percent_24h: number;
        market_cap: number;
        volume_24h: number;
        timestamp: number;
      } | undefined;

      if (result) {
        return {
          symbol: result.symbol,
          price: result.price,
          change24h: result.change_24h,
          changePercent24h: result.change_percent_24h,
          marketCap: result.market_cap,
          volume24h: result.volume_24h,
          lastUpdated: result.timestamp,
        };
      }
      return null;
    } catch (error) {
      logger.error('Failed to get price data from database', error as Error, { symbol });
      return null;
    }
  }

  
  async getPricesForSymbols(symbols: string[]): Promise<Record<string, number>> {
    const prices: Record<string, number> = {};

    for (const symbol of symbols) {
      const price = await this.getPrice(symbol);
      prices[symbol] = price;
    }

    return prices;
  }

  async getTokenPriceUSD(tokenAddress: string, network: string): Promise<number> {
    try {
      // For now, return the native token price
      // In a real implementation, you'd query DEX prices or token price APIs
      const networkConfig = this.networks.find(n => n.name === network);
      if (networkConfig) {
        return await this.getPrice(networkConfig.nativeTokenSymbol);
      }
      return 0;
    } catch (error) {
      logger.error('Failed to get token price', error as Error, { tokenAddress, network });
      return 0;
    }
  }

  async getPriceHistory(symbol: string, hours: number = 24): Promise<Array<{ timestamp: number; price: number }>> {
    try {
      const since = Math.floor(Date.now() / 1000) - (hours * 3600);

      const results = await this.db.prepare(`
        SELECT timestamp, price FROM price_history
        WHERE symbol = ? AND timestamp >= ?
        ORDER BY timestamp ASC
      `).all(symbol.toUpperCase(), since) as Array<{ timestamp: number; price: number }>;

      return results;
    } catch (error) {
      logger.error('Failed to get price history', error as Error, { symbol, hours });
      return [];
    }
  }

  calculateGasCostUSD(gasLimit: string, gasPrice: string, ethPrice: number): number {
    try {
      const gasLimitWei = BigInt(gasLimit);
      const gasPriceWei = BigInt(Math.floor(parseFloat(gasPrice) * 1e9));
      const gasCostWei = gasLimitWei * gasPriceWei;
      const gasCostEth = Number(gasCostWei) / 1e18;
      return gasCostEth * ethPrice;
    } catch (error) {
      logger.error('Failed to calculate gas cost', error as Error);
      return 0;
    }
  }

  getNetworkConfig(chainId: number): NetworkConfig | null {
    return this.networks.find(n => n.chainId === chainId) || null;
  }

  getNetworkConfigByName(name: string): NetworkConfig | null {
    return this.networks.find(n => n.name === name) || null;
  }

  async convertToUSD(amount: string, tokenSymbol: string): Promise<number> {
    try {
      const price = await this.getPrice(tokenSymbol);
      const amountNumber = parseFloat(amount);
      return amountNumber * price;
    } catch (error) {
      logger.error('Failed to convert to USD', error as Error, { amount, tokenSymbol });
      return 0;
    }
  }

  async convertFromUSD(usdAmount: number, tokenSymbol: string): Promise<number> {
    try {
      const price = await this.getPrice(tokenSymbol);
      if (price === 0) return 0;
      return usdAmount / price;
    } catch (error) {
      logger.error('Failed to convert from USD', error as Error, { usdAmount, tokenSymbol });
      return 0;
    }
  }

  getSupportedNetworks(): NetworkConfig[] {
    return [...this.networks];
  }

  clearCache(): void {
    this.priceCache.clear();
  }

  forceUpdate(): void {
    this.clearCache();
    this.updateAllPrices();
  }

  /**
   * Save historical price data to database
   */
  async saveHistoricalPrice(symbol: string, price: number, change24h: number): Promise<void> {
    try {
      await this.db.prepare(`
        INSERT INTO price_history (symbol, price, change_24h, change_percent_24h, market_cap, volume_24h, timestamp)
        VALUES (?, ?, ?, ?, 0, 0, ?)
      `).run(
        symbol.toUpperCase(),
        price,
        change24h,
        0, // changePercent24h - calculate if needed
        Date.now()
      );
    } catch (error) {
      logger.error('Failed to save historical price', error as Error, { symbol, price });
      throw new Error(`Failed to save historical price: ${error}`);
    }
  }

  /**
   * Get historical prices for a symbol
   */
  async getHistoricalPrices(symbol: string, days: number): Promise<Array<{ symbol: string; price: number; change: number; timestamp: string }>> {
    try {
      const results = await this.db.prepare(`
        SELECT symbol, price, change_24h as change, timestamp
        FROM price_history
        WHERE symbol = ?
        ORDER BY timestamp DESC
        LIMIT ?
      `).all(symbol.toUpperCase(), days) as Array<{ symbol: string; price: number; change: number; timestamp: number }>;

      // Convert timestamp to ISO string
      return results.map(r => ({
        ...r,
        timestamp: new Date(r.timestamp).toISOString()
      }));
    } catch (error) {
      logger.error('Failed to get historical prices', error as Error, { symbol, days });
      return [];
    }
  }

  stopUpdates(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  async getPriceSummary(): Promise<{
    totalValue: number;
    tokenPrices: Record<string, PriceData>;
    lastUpdated: number;
  }> {
    const tokenPrices: Record<string, PriceData> = {};

    for (const [symbol, priceData] of this.priceCache) {
      tokenPrices[symbol] = priceData;
    }

    const totalValue = Object.values(tokenPrices).reduce((sum, price) => sum + price.price, 0);

    return {
      totalValue,
      tokenPrices,
      lastUpdated: Math.floor(Date.now() / 1000),
    };
  }

  async exportPriceData(symbols: string[], days: number = 30): Promise<string> {
    try {
      const since = Math.floor(Date.now() / 1000) - (days * 24 * 3600);
      const exportData: Array<{ symbol: string; price: number; change_24h: number; change_percent_24h: number; timestamp: number }> = [];

      for (const symbol of symbols) {
        const results = await this.db.prepare(`
          SELECT symbol, price, change_24h, change_percent_24h, timestamp
          FROM price_history
          WHERE symbol = ? AND timestamp >= ?
          ORDER BY timestamp ASC
        `).all(symbol.toUpperCase(), since);

        exportData.push(...results);
      }

      return JSON.stringify(exportData, null, 2);
    } catch (error) {
      logger.error('Failed to export price data', error as Error, { symbolCount: symbols.length, days });
      return '[]';
    }
  }
}