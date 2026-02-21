/**
 * ═══════════════════════════════════════════════════════════════════════
 * PRODUCTION MARKET INDICES API ROUTE
 * ═══════════════════════════════════════════════════════════════════════
 *
 * This route NEVER touches external APIs directly.
 * All data comes from: Redis Cache → MongoDB Fallback
 *
 * Response time: < 30ms
 *
 * Endpoints:
 * - GET /api/market/indices        → All indices (cached)
 * - GET /api/market/indices/:symbol → Single index
 * - GET /api/market/status          → Market open/closed status
 * - GET /api/market/history/:symbol → Intraday history
 */

const express = require('express');
const router = express.Router();
const Redis = require('ioredis');

const MarketHours = require('../utils/marketHours.production');
const { CACHE_KEYS, TTL_CONFIG } = require('../utils/redisLock.util');
const MarketIndexHistory = require('../../dist/src/models/MarketIndexHistory.model');

// Redis client (lazy initialization)
let redis = null;

function getRedis() {
  if (!redis) {
    const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
    redis = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      enableReadyCheck: false,
    });

    redis.on('error', (err) => {
      console.error('Redis connection error:', err.message);
    });
  }
  return redis;
}

/**
 * GET /api/market/indices
 * Returns all market indices from cache
 */
router.get('/indices', async (req, res) => {
  const startTime = Date.now();

  try {
    // Try Redis cache first
    const redisClient = getRedis();
    let cachedData = null;

    try {
      const cached = await redisClient.get(CACHE_KEYS.INDICES_LATEST);
      if (cached) {
        cachedData = JSON.parse(cached);
      }
    } catch (redisError) {
      console.error('Redis read error:', redisError.message);
    }

    // If cache hit, return immediately
    if (cachedData) {
      const responseTime = Date.now() - startTime;
      return res.json({
        success: true,
        source: 'cache',
        responseTime: `${responseTime}ms`,
        data: cachedData.indices,
        meta: {
          updatedAt: cachedData.updatedAt,
          updatedAtIST: cachedData.updatedAtIST,
          marketStatus: cachedData.marketStatus,
          isMarketOpen: cachedData.isMarketOpen,
          nextOpenTime: cachedData.nextOpenTime,
          dataSource: cachedData.source,
        },
      });
    }

    // Cache miss - fallback to MongoDB
    console.log('⚠️  Cache miss - falling back to MongoDB');

    const symbols = [
      'NIFTY50',
      'SENSEX',
      'NIFTYBANK',
      'NIFTYIT',
      'NIFTYMIDCAP',
      'NIFTYSMALLCAP',
      'NIFTYPHARMA',
      'NIFTYAUTO',
      'NIFTYFMCG',
      'NIFTYMETAL',
      'GOLD',
    ];

    const latestData = [];
    for (const symbol of symbols) {
      const latest = await MarketIndexHistory.getLatestBySymbol(symbol);
      if (latest) {
        latestData.push({
          symbol: latest.symbol,
          name: latest.name,
          category: latest.category,
          value: latest.value,
          change: latest.change,
          percentChange: latest.percentChange,
          high: latest.high,
          low: latest.low,
          open: latest.open,
          previousClose: latest.previousClose,
        });
      }
    }

    const marketStatus = MarketHours.getMarketStatus();
    const responseTime = Date.now() - startTime;

    res.json({
      success: true,
      source: 'database',
      responseTime: `${responseTime}ms`,
      data: latestData,
      meta: {
        updatedAt: latestData[0]?.timestamp || new Date().toISOString(),
        marketStatus: marketStatus.status,
        isMarketOpen: marketStatus.isOpen,
        nextOpenTime: marketStatus.nextOpenTime,
        dataSource: 'MongoDB',
        note: 'Served from database fallback',
      },
    });
  } catch (error) {
    console.error('Market indices API error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch market indices',
      message: error.message,
    });
  }
});

/**
 * GET /api/market/indices/:symbol
 * Returns single index data
 */
router.get('/indices/:symbol', async (req, res) => {
  const { symbol } = req.params;
  const upperSymbol = symbol.toUpperCase();

  try {
    // Try cache first
    const redisClient = getRedis();
    let cachedData = null;

    try {
      const cached = await redisClient.get(CACHE_KEYS.INDICES_LATEST);
      if (cached) {
        cachedData = JSON.parse(cached);
      }
    } catch (redisError) {
      console.error('Redis read error:', redisError.message);
    }

    if (cachedData) {
      const index = cachedData.indices.find(
        (idx) =>
          idx.symbol === upperSymbol ||
          idx.name.toUpperCase().includes(upperSymbol)
      );

      if (index) {
        return res.json({
          success: true,
          source: 'cache',
          data: index,
          meta: {
            updatedAt: cachedData.updatedAt,
            marketStatus: cachedData.marketStatus,
          },
        });
      }
    }

    // Fallback to MongoDB
    const latest = await MarketIndexHistory.getLatestBySymbol(upperSymbol);

    if (!latest) {
      return res.status(404).json({
        success: false,
        error: 'Index not found',
        symbol: upperSymbol,
      });
    }

    res.json({
      success: true,
      source: 'database',
      data: {
        symbol: latest.symbol,
        name: latest.name,
        value: latest.value,
        change: latest.change,
        percentChange: latest.percentChange,
        high: latest.high,
        low: latest.low,
        open: latest.open,
        previousClose: latest.previousClose,
      },
      meta: {
        updatedAt: latest.timestamp,
        marketStatus: latest.marketStatus,
      },
    });
  } catch (error) {
    console.error(`Index API error for ${symbol}:`, error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch index',
      message: error.message,
    });
  }
});

/**
 * GET /api/market/status
 * Returns current market status
 */
router.get('/status', async (req, res) => {
  try {
    const status = MarketHours.getMarketStatus();

    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get market status',
    });
  }
});

/**
 * GET /api/market/history/:symbol
 * Returns intraday history for charts
 */
router.get('/history/:symbol', async (req, res) => {
  const { symbol } = req.params;
  const { date, days } = req.query;

  try {
    let data;

    if (days) {
      // Get daily data for multiple days
      data = await MarketIndexHistory.getDailyData(
        symbol.toUpperCase(),
        parseInt(days) || 30
      );
    } else {
      // Get intraday data for specific date (or today)
      data = await MarketIndexHistory.getIntradayData(
        symbol.toUpperCase(),
        date || null
      );
    }

    res.json({
      success: true,
      symbol: symbol.toUpperCase(),
      count: data.length,
      data: data.map((point) => ({
        timestamp: point.timestamp,
        value: point.value,
        change: point.change,
        percentChange: point.percentChange,
        high: point.high,
        low: point.low,
        volume: point.volume,
      })),
    });
  } catch (error) {
    console.error(`History API error for ${symbol}:`, error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch history',
      message: error.message,
    });
  }
});

/**
 * GET /api/market/summary
 * Returns summary with market status and top indices
 */
router.get('/summary', async (req, res) => {
  const startTime = Date.now();

  try {
    const redisClient = getRedis();
    let cachedData = null;

    try {
      const cached = await redisClient.get(CACHE_KEYS.INDICES_LATEST);
      if (cached) {
        cachedData = JSON.parse(cached);
      }
    } catch (redisError) {
      console.error('Redis read error:', redisError.message);
    }

    const marketStatus = MarketHours.getMarketStatus();

    // Top movers
    let topGainers = [];
    let topLosers = [];
    let majorIndices = [];

    if (cachedData && cachedData.indices) {
      const sorted = [...cachedData.indices].sort(
        (a, b) => b.percentChange - a.percentChange
      );
      topGainers = sorted.slice(0, 3);
      topLosers = sorted.slice(-3).reverse();
      majorIndices = cachedData.indices.filter((idx) =>
        ['NIFTY50', 'SENSEX', 'NIFTYBANK'].includes(idx.symbol)
      );
    }

    const responseTime = Date.now() - startTime;

    res.json({
      success: true,
      responseTime: `${responseTime}ms`,
      data: {
        marketStatus,
        majorIndices,
        topGainers,
        topLosers,
        lastUpdated: cachedData?.updatedAtIST || 'N/A',
      },
    });
  } catch (error) {
    console.error('Summary API error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch market summary',
    });
  }
});

module.exports = router;
