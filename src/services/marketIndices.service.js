/**
 * MARKET INDICES AUTO-UPDATE SERVICE
 * Updates market indices every 2 hours during market hours
 * On holidays/weekends, returns last cached values
 *
 * Features:
 * - Fetches live data from NSE/BSE
 * - Caches last values for holidays
 * - Updates every 2 hours (9 AM - 3:30 PM on trading days)
 */

const axios = require('axios');
const MarketIndex = require('../models/MarketIndex.model');

class MarketIndicesService {
  constructor() {
    this.UPDATE_INTERVAL = 2 * 60 * 60 * 1000; // 2 hours
    this.MARKET_OPEN_HOUR = 9;
    this.MARKET_CLOSE_HOUR = 15;
    this.MARKET_CLOSE_MINUTE = 30;
  }

  /**
   * Check if market is open
   */
  isMarketOpen() {
    const now = new Date();
    const day = now.getDay(); // 0 = Sunday, 6 = Saturday
    const hour = now.getHours();
    const minute = now.getMinutes();

    // Weekend check
    if (day === 0 || day === 6) {
      return false;
    }

    // Market hours: 9:00 AM to 3:30 PM
    if (hour < this.MARKET_OPEN_HOUR) return false;
    if (hour > this.MARKET_CLOSE_HOUR) return false;
    if (hour === this.MARKET_CLOSE_HOUR && minute > this.MARKET_CLOSE_MINUTE)
      return false;

    return true;
  }

  /**
   * Fetch live market data from NSE
   */
  async fetchNSEData(symbol) {
    try {
      // NSE API endpoint (you may need to adjust based on actual NSE API)
      const url = `https://www.nseindia.com/api/equity-stockIndices?index=${symbol}`;

      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          Accept: 'application/json',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        timeout: 10000,
      });

      return response.data;
    } catch (error) {
      console.error(`Error fetching NSE data for ${symbol}:`, error.message);
      return null;
    }
  }

  /**
   * Fetch from Yahoo Finance as fallback
   */
  async fetchYahooFinanceData(symbol) {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`;

      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      const quote = response.data.chart.result[0];
      const meta = quote.meta;
      const indicators = quote.indicators.quote[0];

      return {
        value: meta.regularMarketPrice,
        change: meta.regularMarketPrice - meta.previousClose,
        changePercent:
          ((meta.regularMarketPrice - meta.previousClose) /
            meta.previousClose) *
          100,
        high: meta.regularMarketDayHigh,
        low: meta.regularMarketDayLow,
        open: indicators.open[indicators.open.length - 1],
        previousClose: meta.previousClose,
        volume: meta.regularMarketVolume,
      };
    } catch (error) {
      console.error(
        `Error fetching Yahoo Finance data for ${symbol}:`,
        error.message
      );
      return null;
    }
  }

  /**
   * Fetch from RapidAPI NSE (Paid but reliable)
   */
  async fetchFromRapidAPI(indexName) {
    try {
      const apiKey = process.env.RAPIDAPI_KEY;
      if (!apiKey) {
        console.log('⚠️  RAPIDAPI_KEY not configured');
        return null;
      }

      const symbolMap = {
        'NIFTY 50': 'NIFTY 50',
        SENSEX: 'SENSEX',
        'NIFTY BANK': 'NIFTY BANK',
      };

      const response = await axios.get(
        'https://latest-stock-price.p.rapidapi.com/equities-indices',
        {
          headers: {
            'X-RapidAPI-Key': apiKey,
            'X-RapidAPI-Host': 'latest-stock-price.p.rapidapi.com',
          },
          params: {
            Index: symbolMap[indexName],
          },
          timeout: 10000,
        }
      );

      const data = response.data[0];
      if (!data) return null;

      return {
        value: data.lastPrice,
        change: data.change,
        changePercent: data.pChange,
        high: data.dayHigh,
        low: data.dayLow,
        open: data.open,
        previousClose: data.previousClose,
        volume: data.totalTradedVolume,
      };
    } catch (error) {
      console.error(`RapidAPI fetch failed for ${indexName}:`, error.message);
      return null;
    }
  }

  /**
   * Update single index with multi-source fallback
   */
  async updateIndex(indexName, symbol, yahooSymbol) {
    try {
      const isOpen = this.isMarketOpen();
      let data = null;
      let source = 'unknown';

      // Try multiple sources in order
      console.log(`🔄 Fetching ${indexName}...`);

      // Try RapidAPI first (most reliable for Indian markets)
      data = await this.fetchFromRapidAPI(indexName);
      if (data) {
        source = 'RapidAPI';
        console.log(`✅ RapidAPI succeeded for ${indexName}`);
      }

      // Fallback to Yahoo Finance
      if (!data) {
        console.log(`⚠️  RapidAPI failed, trying Yahoo Finance...`);
        data = await this.fetchYahooFinanceData(yahooSymbol);
        if (data) {
          source = 'Yahoo Finance';
          console.log(`✅ Yahoo Finance succeeded for ${indexName}`);
        }
      }

      // Fallback to NSE (if configured)
      if (!data) {
        console.log(`⚠️  Yahoo Finance failed, trying NSE...`);
        data = await this.fetchNSEData(symbol);
        if (data) {
          source = 'NSE';
          console.log(`✅ NSE succeeded for ${indexName}`);
        }
      }

      if (!data) {
        console.error(
          `❌ ALL SOURCES FAILED for ${indexName}. Keeping cached values.`
        );
        return;
      }

      // Safely extract values with defaults
      const value = data.value || data.regularMarketPrice || 0;
      const change = data.change || 0;
      const changePercent = data.changePercent || 0;
      const high = data.high || value;
      const low = data.low || value;
      const open = data.open || value;
      const previousClose = data.previousClose || value;
      const volume = data.volume || 0;

      // Update or create index using the centralized model
      await MarketIndex.findOneAndUpdate(
        { symbol: indexName.toUpperCase().replace(/\s/g, '_') },
        {
          symbol: indexName.toUpperCase().replace(/\s/g, '_'),
          name: indexName,
          value: value,
          change: {
            value: change,
            percent: changePercent,
          },
          high: high,
          low: low,
          open: open,
          previousClose: previousClose,
          volume: volume,
          lastUpdated: new Date(),
          marketStatus: isOpen ? 'OPEN' : 'CLOSED',
          isActive: true,
        },
        { upsert: true, new: true }
      );

      console.log(
        `✅ Updated ${indexName} from ${source}: ${value} (${changePercent > 0 ? '+' : ''}${changePercent.toFixed(2)}%)`
      );
    } catch (error) {
      console.error(`❌ Error updating ${indexName}:`, error.message);
    }
  }

  /**
   * Update all indices
   */
  async updateAllIndices() {
    console.log(
      `\n🔄 Updating market indices... ${new Date().toLocaleString()}`
    );

    const isOpen = this.isMarketOpen();
    console.log(`📊 Market Status: ${isOpen ? '🟢 OPEN' : '🔴 CLOSED'}`);

    const indices = [
      { name: 'NIFTY 50', symbol: 'NIFTY 50', yahoo: '^NSEI' },
      { name: 'SENSEX', symbol: 'SENSEX', yahoo: '^BSESN' },
      { name: 'NIFTY BANK', symbol: 'NIFTY BANK', yahoo: '^NSEBANK' },
      { name: 'NIFTY IT', symbol: 'NIFTY IT', yahoo: 'NIFTYIT.NS' },
      {
        name: 'NIFTY MIDCAP 100',
        symbol: 'NIFTY MIDCAP 100',
        yahoo: '^NSEMDCP100',
      },
      {
        name: 'NIFTY SMALLCAP 100',
        symbol: 'NIFTY SMALLCAP 100',
        yahoo: '^NSESMLCP100',
      },
    ];

    for (const index of indices) {
      await this.updateIndex(index.name, index.symbol, index.yahoo);
      // Small delay between requests
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    console.log('✅ Market indices update completed\n');
  }

  /**
   * Get all indices (returns cached if market closed)
   */
  async getAllIndices() {
    try {
      const indices = await MarketIndex.find().sort({ index: 1 }).lean();

      if (indices.length === 0) {
        console.warn(
          '⚠️  No indices in database! Returning defaults. Run forceInitialUpdate()'
        );
        return this.getDefaultIndices();
      }

      // Check if data is fresh (updated in last 6 hours)
      const now = Date.now();
      const staleIndices = indices.filter(
        (idx) => now - new Date(idx.lastUpdated).getTime() > 6 * 60 * 60 * 1000
      );

      if (staleIndices.length > 0) {
        console.warn(
          `⚠️  ${staleIndices.length} indices are stale (>6 hours old). Triggering update...`
        );
        // Non-blocking background update
        this.updateAllIndices().catch((err) =>
          console.error('Background update failed:', err)
        );
      }

      return indices.map((idx) => ({
        index: idx.index,
        value: idx.value,
        change: idx.change,
        changePercent: idx.changePercent,
        high: idx.high,
        low: idx.low,
        open: idx.open,
        previousClose: idx.previousClose,
        lastUpdated: idx.lastUpdated,
        isMarketOpen: idx.isMarketOpen,
        dataSource: idx.dataSource || 'legacy',
      }));
    } catch (error) {
      console.error('Error fetching indices:', error);
      return this.getDefaultIndices();
    }
  }

  /**
   * Default/fallback indices
   */
  getDefaultIndices() {
    console.warn('⚠️  USING STATIC DEFAULT VALUES - API fetch may have failed');
    return [
      {
        index: 'NIFTY 50',
        value: 21500,
        change: 0,
        changePercent: 0,
        isMarketOpen: false,
        dataSource: 'fallback',
      },
      {
        index: 'SENSEX',
        value: 71000,
        change: 0,
        changePercent: 0,
        isMarketOpen: false,
        dataSource: 'fallback',
      },
      {
        index: 'NIFTY BANK',
        value: 45000,
        change: 0,
        changePercent: 0,
        isMarketOpen: false,
        dataSource: 'fallback',
      },
    ];
  }

  /**
   * Force update on server start
   */
  async forceInitialUpdate() {
    console.log('🚀 FORCING INITIAL MARKET DATA FETCH...');
    await this.updateAllIndices();

    // Verify data is not static
    const indices = await MarketIndex.find();
    const hasRealData = indices.some(
      (idx) =>
        idx.value !== 21500 &&
        idx.value !== 71000 &&
        idx.value !== 45000 &&
        Math.abs(idx.changePercent) > 0.01 // Allow small variations
    );

    if (!hasRealData && indices.length > 0) {
      console.error(
        '⚠️  WARNING: Market data still appears static after initial fetch!'
      );
      console.error('Check API keys in .env:');
      console.error('- RAPIDAPI_KEY=your_key_here');
      console.error(
        'Get free key at: https://rapidapi.com/suneetk92/api/latest-stock-price'
      );
    } else if (hasRealData) {
      console.log('✅ Market data verified as REAL (not static)');
    }
  }

  /**
   * Start auto-update service
   */
  startAutoUpdate() {
    console.log('🚀 Starting Market Indices Auto-Update Service');
    console.log(
      `⏰ Update interval: ${this.UPDATE_INTERVAL / 1000 / 60} minutes\n`
    );

    // Initial update
    this.updateAllIndices();

    // Schedule updates every 2 hours
    setInterval(() => {
      if (this.isMarketOpen()) {
        this.updateAllIndices();
      } else {
        console.log(
          `⏸️  Market is closed. Using cached values. Next check at ${new Date(Date.now() + this.UPDATE_INTERVAL).toLocaleTimeString()}`
        );
      }
    }, this.UPDATE_INTERVAL);
  }
}

// Create singleton instance
const serviceInstance = new MarketIndicesService();

// Export for use in routes
module.exports = serviceInstance;
module.exports.default = serviceInstance;

// If run directly, start the service
if (require.main === module) {
  const MONGODB_URI =
    process.env.MONGODB_URI || 'mongodb://localhost:27017/mutual-funds';

  mongoose
    .connect(MONGODB_URI)
    .then(() => {
      console.log('✅ Connected to MongoDB');
      const service = new MarketIndicesService();
      service.startAutoUpdate();
    })
    .catch((err) => {
      console.error('❌ MongoDB connection error:', err);
      process.exit(1);
    });
}
