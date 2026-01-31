import { Router, Request, Response } from 'express';
import { Db } from 'mongodb';
import { mongodb } from '../db/mongodb';
import { redis } from '../cache/redis';
import { optionalAuth } from '../middleware/auth.middleware';

/**
 * Fund Routes
 *
 * Endpoints:
 * - GET /api/funds - List all funds (with filters, pagination)
 * - GET /api/funds/:id - Get fund details
 * - GET /api/funds/:id/price-history - Get NAV history
 * - GET /api/funds/:id/holdings - Get fund holdings
 * - GET /api/funds/top/:category - Get top funds by category
 */

const router = Router();

// ==================== GET ALL FUNDS ====================
/**
 * GET /api/funds
 *
 * Query params:
 * - category: equity|debt|hybrid|commodity|etf
 * - subCategory: Large Cap, Mid Cap, Gold ETF, etc.
 * - fundHouse: Fund house name
 * - minAum: Minimum AUM
 * - sortBy: aum|returns.oneYear|returns.threeYear|name
 * - sortOrder: asc|desc
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20, max: 15000 for all funds)
 */
router.get('/', optionalAuth, async (req: Request, res: Response) => {
  try {
    const {
      category,
      subCategory,
      fundHouse,
      minAum,
      sortBy = 'aum',
      sortOrder = 'desc',
      page = '1',
      limit = '20',
    } = req.query;

    const pageNum = Math.max(1, parseInt(page as string));
    const limitNum = Math.min(15000, Math.max(1, parseInt(limit as string)));
    const skip = (pageNum - 1) * limitNum;

    // Build query
    const query: any = { isActive: true };

    if (category) {
      query.category = category;
    }

    if (subCategory) {
      query.subCategory = subCategory;
    }

    if (fundHouse) {
      query.fundHouse = new RegExp(fundHouse as string, 'i');
    }

    if (minAum) {
      query.aum = { $gte: parseFloat(minAum as string) };
    }

    // Build sort
    const sort: any = {};
    if (sortBy === 'name') {
      sort.name = sortOrder === 'asc' ? 1 : -1;
    } else if (sortBy === 'aum') {
      sort.aum = sortOrder === 'asc' ? 1 : -1;
    } else if (typeof sortBy === 'string' && sortBy.startsWith('returns.')) {
      sort[sortBy] = sortOrder === 'asc' ? 1 : -1;
    }

    const db = mongodb.getDb();
    const fundsCollection = db.collection('funds');

    // Check cache
    const cacheKey = `funds:list:${JSON.stringify({ query, sort, skip, limitNum })}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    // Execute query
    const [funds, total] = await Promise.all([
      fundsCollection
        .find(query)
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .project({
          fundId: 1,
          name: 1,
          category: 1,
          subCategory: 1,
          fundHouse: 1,
          fundType: 1,
          aum: 1,
          expenseRatio: 1,
          currentNav: 1,
          returns: 1,
          riskMetrics: 1,
          ratings: 1,
          tags: 1,
          _id: 0,
        })
        .toArray(),
      fundsCollection.countDocuments(query),
    ]);

    const response = {
      success: true,
      data: funds,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
        hasNext: pageNum < Math.ceil(total / limitNum),
        hasPrev: pageNum > 1,
      },
    };

    // Cache for 15 minutes
    await redis.set(cacheKey, response, 15 * 60);

    res.json(response);
  } catch (error: any) {
    console.error('Error fetching funds:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch funds',
      error: error.message,
    });
  }
});

// ==================== GET FUND BY ID ====================
/**
 * GET /api/funds/:id
 */
router.get('/:id', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check cache
    const cached = await redis.getFundMetadata(id);
    if (cached) {
      return res.json({
        success: true,
        data: cached,
        cached: true,
      });
    }

    const db = mongodb.getDb();

    // Try to find by fundId, schemeCode, or _id
    let fund = await db
      .collection('funds')
      .findOne({ fundId: id, isActive: true }, { projection: { _id: 0 } });

    // If not found by fundId, try schemeCode (as string or number)
    if (!fund) {
      fund = await db.collection('funds').findOne({
        $or: [
          { schemeCode: id },
          { schemeCode: parseInt(id) },
          { schemeCode: id.toString() },
        ],
      });
    }

    if (!fund) {
      return res.status(404).json({
        success: false,
        message: 'Fund not found',
      });
    }

    // Cache fund metadata
    await redis.cacheFundMetadata(id, fund);

    res.json({
      success: true,
      data: fund,
      cached: false,
    });
  } catch (error: any) {
    console.error('Error fetching fund:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch fund',
      error: error.message,
    });
  }
});

// ==================== GET PRICE HISTORY ====================
/**
 * GET /api/funds/:id/price-history
 *
 * Query params:
 * - period: 1M|3M|6M|1Y|3Y|5Y|MAX
 */
router.get('/:id/price-history', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { period = '1Y' } = req.query;

    const db = mongodb.getDb();

    // Calculate date range
    const endDate = new Date();
    let startDate = new Date();

    switch (period) {
      case '1M':
        startDate.setMonth(endDate.getMonth() - 1);
        break;
      case '3M':
        startDate.setMonth(endDate.getMonth() - 3);
        break;
      case '6M':
        startDate.setMonth(endDate.getMonth() - 6);
        break;
      case '1Y':
        startDate.setFullYear(endDate.getFullYear() - 1);
        break;
      case '3Y':
        startDate.setFullYear(endDate.getFullYear() - 3);
        break;
      case '5Y':
        startDate.setFullYear(endDate.getFullYear() - 5);
        break;
      case 'MAX':
        startDate = new Date('2000-01-01');
        break;
      default:
        startDate.setFullYear(endDate.getFullYear() - 1);
    }

    const prices = await db
      .collection('fundPrices')
      .find({
        fundId: id,
        date: { $gte: startDate, $lte: endDate },
      })
      .sort({ date: 1 })
      .project({ _id: 0, fundId: 1, date: 1, nav: 1 })
      .toArray();

    res.json({
      success: true,
      data: {
        fundId: id,
        period,
        prices,
        count: prices.length,
      },
    });
  } catch (error: any) {
    console.error('Error fetching price history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch price history',
      error: error.message,
    });
  }
});

// ==================== GET HOLDINGS ====================
/**
 * GET /api/funds/:id/holdings
 */
router.get('/:id/holdings', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const db = mongodb.getDb();
    const fund = await db
      .collection('funds')
      .findOne(
        { fundId: id, isActive: true },
        { projection: { holdings: 1, sectorAllocation: 1, _id: 0 } }
      );

    if (!fund) {
      return res.status(404).json({
        success: false,
        message: 'Fund not found',
      });
    }

    res.json({
      success: true,
      data: {
        fundId: id,
        holdings: fund.holdings || [],
        sectorAllocation: fund.sectorAllocation || [],
      },
    });
  } catch (error: any) {
    console.error('Error fetching holdings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch holdings',
      error: error.message,
    });
  }
});

// ==================== GET TOP FUNDS ====================
/**
 * GET /api/funds/top/:category
 *
 * Get top performing funds in a category
 */
router.get('/top/:category', async (req: Request, res: Response) => {
  try {
    const { category } = req.params;
    const { sortBy = 'returns.oneYear', limit = '10' } = req.query;

    const limitNum = Math.min(500, Math.max(1, parseInt(limit as string)));

    const db = mongodb.getDb();

    // Check cache
    const cacheKey = `funds:top:${category}:${sortBy}:${limitNum}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const sort: any = {};
    sort[sortBy as string] = -1;

    const funds = await db
      .collection('funds')
      .find({
        category,
        isActive: true,
        [sortBy as string]: { $exists: true, $ne: null },
      })
      .sort(sort)
      .limit(limitNum)
      .project({
        fundId: 1,
        name: 1,
        fundHouse: 1,
        category: 1,
        subCategory: 1,
        currentNav: 1,
        returns: 1,
        aum: 1,
        expenseRatio: 1,
        ratings: 1,
        _id: 0,
      })
      .toArray();

    const response = {
      success: true,
      data: {
        category,
        sortBy,
        funds,
      },
    };

    // Cache for 1 hour
    await redis.set(cacheKey, response, 60 * 60);

    res.json(response);
  } catch (error: any) {
    console.error('Error fetching top funds:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch top funds',
      error: error.message,
    });
  }
});

export default router;
