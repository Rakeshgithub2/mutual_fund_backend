/**
 * Market Index Controller
 * Handles market indices data
 */

const MarketIndex = require('../../dist/src/models/MarketIndex.model');
const cacheClient = require('../cache/redis.client');
const MarketHoursUtil = require('../utils/marketHours.util');

class MarketIndexController {
  /**
   * Get all market indices
   * GET /api/market/indices
   */
  static async getAllIndices(req, res) {
    try {
      // ✅ BYPASS CACHE - Query database directly for now
      console.log('📊 Fetching market indices from database...');

      // Query all active indices from the MarketIndex collection
      const indices = await MarketIndex.find({ isActive: true })
        .sort({ displayOrder: 1 })
        .lean();

      console.log(`📊 Found ${indices.length} indices in database`);

      // Transform data to match frontend expectations
      const transformedIndices = indices.map((index) => ({
        name:
          index.symbol?.toLowerCase() ||
          index.name?.toLowerCase().replace(/\s+/g, ''),
        displayName: index.name,
        value: index.value,
        change: index.change?.value || 0,
        percent_change: index.change?.percent || 0,
        updated_at: index.lastUpdated,
      }));

      // Cache result only if we have data
      if (transformedIndices && transformedIndices.length > 0) {
        await cacheClient.cacheAllIndices(transformedIndices);
      }

      res.json({
        success: true,
        source: 'database',
        data: transformedIndices,
        marketStatus: MarketHoursUtil.getMarketStatus(),
      });
    } catch (error) {
      console.error('Error fetching indices:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch market indices',
        message: error.message,
      });
    }
  }

  /**
   * Get specific market index
   * GET /api/market/indices/:symbol
   */
  static async getIndexBySymbol(req, res) {
    try {
      const { symbol } = req.params;
      const indexName = symbol.toLowerCase(); // Convert to lowercase

      console.log('🔍 Fetching index:', indexName);

      // Query database by name (lowercase)
      const index = await MarketIndex.findOne({
        $or: [
          { symbol: indexName.toUpperCase() },
          { name: new RegExp(indexName, 'i') },
        ],
      }).lean();

      if (!index) {
        console.log('❌ Index not found:', indexName);
        return res.status(404).json({
          success: false,
          error: 'Index not found',
          message: `No index found with name: ${indexName}`,
        });
      }

      console.log('✅ Found index:', index.name, index.value);

      res.json({
        success: true,
        source: 'database',
        data: index,
      });
    } catch (error) {
      console.error('Error fetching index:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch index',
        message: error.message,
      });
    }
  }

  /**
   * Get broad market indices
   * GET /api/market/indices/broad
   */
  static async getBroadMarketIndices(req, res) {
    try {
      // Check cache
      const cacheKey = 'market:indices:broad';
      const cached = await cacheClient.get(cacheKey);
      if (cached) {
        return res.json({
          success: true,
          source: 'cache',
          data: cached,
        });
      }

      // Query database
      const indices = await MarketIndex.find({
        category: 'BROAD_MARKET',
        isActive: true,
      }).lean();

      // Cache result
      await cacheClient.set(cacheKey, indices, 7200); // 2h

      res.json({
        success: true,
        source: 'database',
        data: indices,
      });
    } catch (error) {
      console.error('Error fetching broad market indices:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch broad market indices',
        message: error.message,
      });
    }
  }

  /**
   * Get sectoral indices
   * GET /api/market/indices/sectoral
   */
  static async getSectoralIndices(req, res) {
    try {
      // Check cache
      const cacheKey = 'market:indices:sectoral';
      const cached = await cacheClient.get(cacheKey);
      if (cached) {
        return res.json({
          success: true,
          source: 'cache',
          data: cached,
        });
      }

      // Query database
      const indices = await MarketIndex.find({
        category: 'SECTORAL',
        isActive: true,
      }).lean();

      // Cache result
      await cacheClient.set(cacheKey, indices, 7200); // 2h

      res.json({
        success: true,
        source: 'database',
        data: indices,
      });
    } catch (error) {
      console.error('Error fetching sectoral indices:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch sectoral indices',
        message: error.message,
      });
    }
  }

  /**
   * Get market status
   * GET /api/market/status
   */
  static async getMarketStatus(req, res) {
    try {
      const sessionInfo = MarketHoursUtil.getMarketSessionInfo();

      res.json({
        success: true,
        data: sessionInfo,
      });
    } catch (error) {
      console.error('Error fetching market status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch market status',
        message: error.message,
      });
    }
  }

  /**
   * Get market summary
   * GET /api/market/summary
   */
  static async getMarketSummary(req, res) {
    try {
      // Check cache
      const cacheKey = 'market:summary';
      const cached = await cacheClient.get(cacheKey);
      if (cached) {
        return res.json({
          success: true,
          source: 'cache',
          ...cached,
        });
      }

      // Get key indices
      const [nifty, sensex, bankNifty] = await Promise.all([
        MarketIndex.findOne({ symbol: 'NIFTY50' }).lean(),
        MarketIndex.findOne({ symbol: 'SENSEX' }).lean(),
        MarketIndex.findOne({ symbol: 'BANKNIFTY' }).lean(),
      ]);

      const summary = {
        majorIndices: [nifty, sensex, bankNifty].filter(Boolean),
        marketStatus: MarketHoursUtil.getMarketStatus(),
        lastUpdated: new Date(),
      };

      // Cache result
      await cacheClient.set(cacheKey, summary, 600); // 10min

      res.json({
        success: true,
        source: 'database',
        data: summary,
      });
    } catch (error) {
      console.error('Error fetching market summary:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch market summary',
        message: error.message,
      });
    }
  }
}

module.exports = MarketIndexController;
