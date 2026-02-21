/**
 * Professional Fund API Controllers
 * Uses 4-tier data architecture with Redis caching
 */

const { fundFetchService } = require('../services/fund-fetch.service');
const { redisCache } = require('../services/redis.service');

/**
 * GET /api/v2/funds/:fundCode
 * Get complete fund data (static + periodic + daily NAV)
 */
async function getFundDetails(req, res) {
  try {
    const { fundCode } = req.params;

    if (!fundCode) {
      return res.status(400).json({
        success: false,
        error: 'Fund code is required',
      });
    }

    const fundData = await fundFetchService.getFundData(fundCode);

    res.json({
      success: true,
      data: fundData,
    });
  } catch (error) {
    console.error('Get fund details error:', error);

    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: error.message,
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to fetch fund details',
    });
  }
}

/**
 * GET /api/v2/funds/:fundCode/nav
 * Get live NAV with Redis caching
 */
async function getFundNAV(req, res) {
  try {
    const { fundCode } = req.params;

    if (!fundCode) {
      return res.status(400).json({
        success: false,
        error: 'Fund code is required',
      });
    }

    const navData = await fundFetchService.getDailyNAV(fundCode);

    res.json({
      success: true,
      data: navData,
      cached: navData.source === 'CACHE',
    });
  } catch (error) {
    console.error('Get fund NAV error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch NAV',
    });
  }
}

/**
 * GET /api/v2/funds
 * Search and filter funds with pagination
 */
async function searchFunds(req, res) {
  try {
    const {
      q: query,
      page = 1,
      limit = 100,
      category,
      subCategory,
      sortBy = 'aum',
      sortOrder = 'desc',
    } = req.query;

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      category,
      subCategory,
      sortBy,
      sortOrder,
    };

    const result = await fundFetchService.searchFunds(query, options);

    res.json({
      success: true,
      data: result.funds,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error('Search funds error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search funds',
    });
  }
}

/**
 * GET /api/v2/suggest
 * Fast search suggestions (for autocomplete)
 */
async function getSuggestions(req, res) {
  try {
    const { q: query } = req.query;

    if (!query || query.length < 2) {
      return res.json({
        success: true,
        data: [],
      });
    }

    // Search with minimal data for fast response
    const result = await fundFetchService.searchFunds(query, {
      page: 1,
      limit: 10,
      sortBy: 'aum',
      sortOrder: 'desc',
    });

    const suggestions = result.funds.map((fund) => ({
      fundCode: fund.fundCode,
      fundName: fund.fundName,
      amc: fund.amc,
      category: fund.category,
    }));

    res.json({
      success: true,
      data: suggestions,
    });
  } catch (error) {
    console.error('Get suggestions error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch suggestions',
    });
  }
}

/**
 * GET /api/v2/market/indices
 * Get live market indices with Redis caching
 */
async function getMarketIndices(req, res) {
  try {
    const indices = await fundFetchService.getMarketIndices();

    res.json({
      success: true,
      data: indices,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Get market indices error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch market indices',
    });
  }
}

/**
 * POST /api/admin/sync/nav
 * Manually trigger NAV sync (Admin only)
 */
async function triggerNAVSync(req, res) {
  try {
    const { navSyncService } = require('../services/nav-sync.service');

    // Run sync in background
    navSyncService.manualSync().catch((err) => {
      console.error('Background NAV sync failed:', err);
    });

    res.json({
      success: true,
      message: 'NAV sync triggered',
      status: navSyncService.getStatus(),
    });
  } catch (error) {
    console.error('Trigger NAV sync error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to trigger NAV sync',
    });
  }
}

/**
 * POST /api/admin/sync/indices
 * Manually trigger indices sync (Admin only)
 */
async function triggerIndicesSync(req, res) {
  try {
    const { indicesSyncService } = require('../services/indices-sync.service');

    // Run sync in background
    indicesSyncService.manualSync().catch((err) => {
      console.error('Background indices sync failed:', err);
    });

    res.json({
      success: true,
      message: 'Indices sync triggered',
      status: indicesSyncService.getStatus(),
    });
  } catch (error) {
    console.error('Trigger indices sync error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to trigger indices sync',
    });
  }
}

/**
 * GET /api/admin/sync/status
 * Get sync services status
 */
async function getSyncStatus(req, res) {
  try {
    const { navSyncService } = require('../services/nav-sync.service');
    const { indicesSyncService } = require('../services/indices-sync.service');

    res.json({
      success: true,
      data: {
        redis: {
          connected: redisCache.isConnected,
        },
        navSync: navSyncService.getStatus(),
        indicesSync: indicesSyncService.getStatus(),
      },
    });
  } catch (error) {
    console.error('Get sync status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get sync status',
    });
  }
}

module.exports = {
  getFundDetails,
  getFundNAV,
  searchFunds,
  getSuggestions,
  getMarketIndices,
  triggerNAVSync,
  triggerIndicesSync,
  getSyncStatus,
};
