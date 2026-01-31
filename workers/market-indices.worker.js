/**
 * ═══════════════════════════════════════════════════════════════════════
 * PRODUCTION-GRADE MARKET INDICES WORKER
 * ═══════════════════════════════════════════════════════════════════════
 *
 * This is the ONLY component that touches external APIs.
 * All user requests go through Redis cache → MongoDB fallback.
 *
 * Architecture:
 * ┌────────────────────┐
 * │   NSE / Yahoo API   │
 * └─────────▲──────────┘
 *           │
 *  (CRON every 5 min during market hours)
 *           │
 * ┌─────────┴──────────┐
 * │  This Worker       │ ← Redis Lock prevents duplicates
 * └─────────┬──────────┘
 *           │
 *     ┌─────┴─────┐
 *     ▼           ▼
 * ┌───────┐  ┌────────┐
 * │ Redis │  │MongoDB │
 * │ Cache │  │History │
 * └───────┘  └────────┘
 *
 * Rules:
 * 1. Only fetch during market hours (9:15 AM - 3:30 PM IST)
 * 2. Acquire Redis lock before fetching
 * 3. Save to MongoDB for history
 * 4. Cache in Redis for fast reads
 * 5. On market close, cache last known values
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Redis = require('ioredis');
const axios = require('axios');

// Fix paths - workers folder is at root level, utils/models are in src/
const MarketHours = require('../src/utils/marketHours.production');
const {
  RedisLock,
  LOCK_KEYS,
  CACHE_KEYS,
  TTL_CONFIG,
} = require('../src/utils/redisLock.util');
const MarketIndexHistory = require('../src/models/MarketIndexHistory.model');

// Database connection
const DATABASE_URL = process.env.DATABASE_URL;
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Index configuration
const INDICES_CONFIG = [
  {
    name: 'NIFTY 50',
    symbol: 'NIFTY50',
    yahoo: '^NSEI',
    category: 'BROAD_MARKET',
  },
  {
    name: 'SENSEX',
    symbol: 'SENSEX',
    yahoo: '^BSESN',
    category: 'BROAD_MARKET',
  },
  {
    name: 'NIFTY BANK',
    symbol: 'NIFTYBANK',
    yahoo: '^NSEBANK',
    category: 'SECTORAL',
  },
  {
    name: 'NIFTY IT',
    symbol: 'NIFTYIT',
    yahoo: '^CNXIT',
    category: 'SECTORAL',
  },
  {
    name: 'NIFTY MIDCAP 100',
    symbol: 'NIFTYMIDCAP',
    yahoo: '^NSEMDCP50',
    category: 'BROAD_MARKET',
  },
  {
    name: 'NIFTY SMALLCAP 100',
    symbol: 'NIFTYSMALLCAP',
    yahoo: '^CNXSC', // Correct Yahoo symbol for Nifty Smallcap
    category: 'BROAD_MARKET',
  },
  {
    name: 'NIFTY PHARMA',
    symbol: 'NIFTYPHARMA',
    yahoo: '^CNXPHARMA',
    category: 'SECTORAL',
  },
  {
    name: 'NIFTY AUTO',
    symbol: 'NIFTYAUTO',
    yahoo: '^CNXAUTO',
    category: 'SECTORAL',
  },
  {
    name: 'NIFTY FMCG',
    symbol: 'NIFTYFMCG',
    yahoo: '^CNXFMCG',
    category: 'SECTORAL',
  },
  {
    name: 'NIFTY METAL',
    symbol: 'NIFTYMETAL',
    yahoo: '^CNXMETAL',
    category: 'SECTORAL',
  },
  { name: 'GOLD', symbol: 'GOLD', yahoo: 'GC=F', category: 'COMMODITY' },
];

class MarketIndicesWorker {
  constructor() {
    this.redis = null;
    this.redisLock = null;
    this.isConnected = false;
  }

  /**
   * Initialize connections
   */
  async initialize() {
    try {
      // Connect to MongoDB
      if (mongoose.connection.readyState !== 1) {
        await mongoose.connect(DATABASE_URL);
        console.log('✅ MongoDB connected');
      }

      // Connect to Redis
      this.redis = new Redis(REDIS_URL, {
        maxRetriesPerRequest: 3,
        retryDelayOnFailover: 100,
        lazyConnect: true,
      });

      await this.redis.connect();
      console.log('✅ Redis connected');

      this.redisLock = new RedisLock(this.redis);
      this.isConnected = true;

      return true;
    } catch (error) {
      console.error('❌ Failed to initialize:', error.message);
      return false;
    }
  }

  /**
   * Fetch data from Yahoo Finance
   */
  async fetchFromYahoo(yahooSymbol) {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}`;

      const response = await axios.get(url, {
        params: { range: '1d', interval: '1m' },
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        timeout: 10000,
      });

      const data = response.data?.chart?.result?.[0];
      if (!data) {
        throw new Error('Invalid response structure');
      }

      const meta = data.meta;
      const currentPrice = meta.regularMarketPrice;
      const previousClose = meta.previousClose || meta.chartPreviousClose;
      const change = currentPrice - previousClose;
      const percentChange = (change / previousClose) * 100;

      return {
        value: parseFloat(currentPrice.toFixed(2)),
        change: parseFloat(change.toFixed(2)),
        percentChange: parseFloat(percentChange.toFixed(2)),
        open: meta.regularMarketOpen || currentPrice,
        high: meta.regularMarketDayHigh || currentPrice,
        low: meta.regularMarketDayLow || currentPrice,
        previousClose: previousClose,
        volume: meta.regularMarketVolume || 0,
        source: 'YAHOO',
      };
    } catch (error) {
      console.error(`❌ Yahoo fetch failed for ${yahooSymbol}:`, error.message);
      return null;
    }
  }

  /**
   * Fetch all indices with retry logic
   */
  async fetchAllIndices() {
    const results = [];
    const timestamp = new Date();
    const dateStr = timestamp.toISOString().split('T')[0];
    const marketStatus = MarketHours.getMarketStatus();

    for (const index of INDICES_CONFIG) {
      console.log(`📈 Fetching ${index.name}...`);

      let data = await this.fetchFromYahoo(index.yahoo);

      if (data) {
        results.push({
          symbol: index.symbol,
          name: index.name,
          category: index.category,
          ...data,
          timestamp,
          date: dateStr,
          granularity: '5MIN',
          marketStatus: marketStatus.status,
        });
        console.log(
          `   ✅ ${index.name}: ${data.value} (${data.change > 0 ? '+' : ''}${data.change})`
        );
      } else {
        console.log(`   ⚠️  Failed to fetch ${index.name}`);
      }

      // Small delay between requests to avoid rate limiting
      await new Promise((r) => setTimeout(r, 200));
    }

    return results;
  }

  /**
   * Save indices to MongoDB (history)
   */
  async saveToMongoDB(indicesData) {
    try {
      if (indicesData.length === 0) return { success: false, saved: 0 };

      await MarketIndexHistory.bulkUpsertSnapshot(indicesData);
      console.log(`💾 Saved ${indicesData.length} indices to MongoDB`);

      return { success: true, saved: indicesData.length };
    } catch (error) {
      console.error('❌ MongoDB save failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Cache indices in Redis
   */
  async cacheInRedis(indicesData) {
    try {
      if (indicesData.length === 0) return { success: false };

      const marketStatus = MarketHours.getMarketStatus();
      const ttl = marketStatus.isOpen
        ? TTL_CONFIG.CACHE_TTL_OPEN
        : TTL_CONFIG.CACHE_TTL_CLOSED;

      const snapshot = {
        updatedAt: new Date().toISOString(),
        updatedAtIST: MarketHours.getCurrentIST().format('hh:mm A'),
        source: indicesData[0]?.source || 'YAHOO',
        marketStatus: marketStatus.status,
        isMarketOpen: marketStatus.isOpen,
        nextOpenTime: marketStatus.nextOpenTime,
        indices: indicesData.map((idx) => ({
          symbol: idx.symbol,
          name: idx.name,
          category: idx.category,
          value: idx.value,
          change: idx.change,
          percentChange: idx.percentChange,
          high: idx.high,
          low: idx.low,
          open: idx.open,
          previousClose: idx.previousClose,
        })),
      };

      await this.redis.setex(
        CACHE_KEYS.INDICES_LATEST,
        ttl,
        JSON.stringify(snapshot)
      );

      // Also cache market status separately
      await this.redis.setex(
        CACHE_KEYS.MARKET_STATUS,
        ttl,
        JSON.stringify(marketStatus)
      );

      console.log(`📦 Cached in Redis (TTL: ${ttl}s)`);
      return { success: true, ttl };
    } catch (error) {
      console.error('❌ Redis cache failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Main execution - called by cron
   * @param {boolean} forceRun - Skip market hours check (for testing)
   */
  async execute(forceRun = false) {
    const startTime = Date.now();
    console.log('\n' + '═'.repeat(60));
    console.log('🚀 MARKET INDICES WORKER STARTED');
    console.log('═'.repeat(60));
    console.log(
      `⏰ Time: ${MarketHours.getCurrentIST().format('YYYY-MM-DD hh:mm:ss A')} IST`
    );

    try {
      // Step 1: Check market hours
      const marketStatus = MarketHours.getMarketStatus();
      console.log(
        `📊 Market Status: ${marketStatus.status} - ${marketStatus.message}`
      );

      if (!forceRun && !MarketHours.shouldFetchData()) {
        console.log('⏸️  Market is closed. Using cached/stored data.');
        console.log(`   Next open: ${marketStatus.nextOpenTime}`);

        // Ensure we have cached data even when market is closed
        await this.ensureCacheExists();

        console.log('═'.repeat(60));
        return { success: true, skipped: true, reason: 'Market closed' };
      }

      // Step 2: Initialize connections
      if (!this.isConnected) {
        const connected = await this.initialize();
        if (!connected) {
          throw new Error('Failed to initialize connections');
        }
      }

      // Step 3: Acquire distributed lock
      console.log('\n🔐 Acquiring distributed lock...');
      const lockAcquired = await this.redisLock.acquireLock(
        LOCK_KEYS.MARKET_INDICES_UPDATE,
        TTL_CONFIG.LOCK_TTL
      );

      if (!lockAcquired) {
        console.log('⚠️  Another worker is already updating. Skipping.');
        return { success: true, skipped: true, reason: 'Lock not acquired' };
      }
      console.log('✅ Lock acquired');

      try {
        // Step 4: Fetch all indices
        console.log('\n📡 Fetching market indices...');
        const indicesData = await this.fetchAllIndices();

        if (indicesData.length === 0) {
          throw new Error('No indices data fetched');
        }

        console.log(
          `\n📊 Fetched ${indicesData.length}/${INDICES_CONFIG.length} indices`
        );

        // Step 5: Save to MongoDB (history)
        console.log('\n💾 Saving to MongoDB...');
        const mongoResult = await this.saveToMongoDB(indicesData);

        // Step 6: Cache in Redis
        console.log('\n📦 Caching in Redis...');
        const redisResult = await this.cacheInRedis(indicesData);

        // Summary
        const duration = Date.now() - startTime;
        console.log('\n' + '─'.repeat(60));
        console.log('✅ WORKER COMPLETED SUCCESSFULLY');
        console.log(`   Duration: ${duration}ms`);
        console.log(`   Indices: ${indicesData.length}`);
        console.log(`   MongoDB: ${mongoResult.success ? 'OK' : 'FAILED'}`);
        console.log(`   Redis: ${redisResult.success ? 'OK' : 'FAILED'}`);
        console.log('═'.repeat(60) + '\n');

        return {
          success: true,
          duration,
          fetched: indicesData.length,
          mongodb: mongoResult,
          redis: redisResult,
        };
      } finally {
        // Always release the lock
        await this.redisLock.releaseLock(LOCK_KEYS.MARKET_INDICES_UPDATE);
        console.log('🔓 Lock released');
      }
    } catch (error) {
      console.error('\n❌ WORKER FAILED:', error.message);
      console.log('═'.repeat(60) + '\n');
      return { success: false, error: error.message };
    }
  }

  /**
   * Ensure cache exists (for market closed scenario)
   */
  async ensureCacheExists() {
    try {
      if (!this.isConnected) {
        await this.initialize();
      }

      // Check if cache exists
      const cached = await this.redis.get(CACHE_KEYS.INDICES_LATEST);

      if (!cached) {
        console.log('📦 Cache empty. Loading from MongoDB...');

        // Get latest data from MongoDB for each symbol
        const latestData = [];
        for (const index of INDICES_CONFIG) {
          const latest = await MarketIndexHistory.getLatestBySymbol(
            index.symbol
          );
          if (latest) {
            latestData.push(latest);
          }
        }

        if (latestData.length > 0) {
          await this.cacheInRedis(latestData);
          console.log(
            `✅ Restored ${latestData.length} indices from MongoDB to cache`
          );
        }
      } else {
        console.log('✅ Cache exists. No action needed.');
      }
    } catch (error) {
      console.error('❌ Failed to ensure cache:', error.message);
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    try {
      if (this.redis) {
        await this.redis.quit();
        console.log('✅ Redis connection closed');
      }
      if (mongoose.connection.readyState === 1) {
        await mongoose.connection.close();
        console.log('✅ MongoDB connection closed');
      }
    } catch (error) {
      console.error('❌ Shutdown error:', error.message);
    }
  }
}

// Export for use in scheduler
module.exports = new MarketIndicesWorker();

// Run standalone
if (require.main === module) {
  const worker = new MarketIndicesWorker();
  const forceRun = process.argv.includes('--force');

  if (forceRun) {
    console.log('⚠️  FORCE MODE: Ignoring market hours check\n');
  }

  worker.execute(forceRun).then(async (result) => {
    console.log('\nResult:', JSON.stringify(result, null, 2));
    await worker.shutdown();
    process.exit(result.success ? 0 : 1);
  });
}
