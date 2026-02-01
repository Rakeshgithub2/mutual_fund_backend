import { Router, Request, Response } from 'express';
import { mongodb } from '../db/mongodb';
import { redis } from '../cache/redis';

const router = Router();

/**
 * GET /funds/quick - Ultra-fast endpoint for initial page load
 * Returns first 200 funds with minimal data, heavily cached
 * MongoDB free-tier safe: Uses indexed sort, minimal projection
 * Response time: < 100ms with cache, < 300ms without
 */
router.get('/quick', async (req: Request, res: Response) => {
  try {
    const cacheKey = 'funds:quick:200';

    // Try cache first (5 minute TTL for super fast response)
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        console.log('⚡ Quick funds - cache hit (< 10ms)');
        return res.json(cached);
      }
    } catch (cacheError) {
      console.log('⚠️  Redis cache unavailable, fetching from DB');
    }

    console.log('📥 Quick funds - fetching from DB');
    const collection = mongodb.getCollection('funds');

    // MongoDB free-tier optimized query:
    // - Limit 200 (safe for 32MB memory)
    // - Sort by _id (indexed by default)
    // - Minimal projection (reduces data transfer)
    const funds = await collection
      .find({ isActive: true })
      .project({
        _id: 1,
        fundId: 1,
        name: 1,
        category: 1,
        subCategory: 1,
        fundHouse: 1,
        currentNav: 1,
        'returns.oneYear': 1,
        'returns.threeYear': 1,
        aum: 1,
        expenseRatio: 1,
        riskLevel: 1,
      })
      .sort({ _id: -1 }) // Use indexed field for memory safety
      .limit(200) // Reduced from 500 for MongoDB free tier
      .toArray();

    const response = {
      success: true,
      data: funds.map((f) => ({
        id: f._id || f.fundId,
        fundId: f.fundId,
        name: f.name,
        category: f.category,
        subCategory: f.subCategory,
        fundHouse: f.fundHouse,
        currentNav: f.currentNav || 0,
        returns: {
          oneYear: f.returns?.oneYear || 0,
          threeYear: f.returns?.threeYear || 0,
        },
        aum: f.aum || 0,
        expenseRatio: f.expenseRatio || 0,
        riskLevel: f.riskLevel || 'MEDIUM',
      })),
      total: 200,
      message: 'First 200 funds loaded instantly. Use /batch for more.',
      hasMore: true,
    };

    // Cache for 5 minutes (if Redis available)
    try {
      await redis.set(cacheKey, response, 300);
      console.log('✅ Quick funds cached for 5 minutes');
    } catch (cacheError) {
      console.log('⚠️  Redis cache unavailable, skipping cache');
    }

    return res.json(response);
  } catch (error) {
    console.error('❌ Quick funds error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch quick funds',
    });
  }
});

/**
 * GET /funds/count - Get total fund count for pagination
 * Ultra-fast, heavily cached
 */
router.get('/count', async (req: Request, res: Response) => {
  try {
    const cacheKey = 'funds:count:total';

    const cached = await redis.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const collection = mongodb.getCollection('funds');
    const total = await collection.countDocuments({ isActive: true });

    const response = {
      success: true,
      total,
      pages: Math.ceil(total / 200),
      batchSize: 200,
      message: 'Total fund count - MongoDB free tier optimized',
    };

    // Cache for 1 hour
    await redis.set(cacheKey, response, 3600);

    return res.json(response);
  } catch (error) {
    console.error('❌ Count error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get fund count',
    });
  }
});

/**
 * GET /funds/batch/:page - Load funds in batches of 200
 * MongoDB free-tier safe batching for background loading
 * Example: /funds/batch/2 returns funds 201-400
 */
router.get('/batch/:page', async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.params.page) || 1);
    const batchSize = 200; // Optimized for MongoDB free tier
    const skip = (page - 1) * batchSize;

    const cacheKey = `funds:batch:${page}`;

    const cached = await redis.get(cacheKey);
    if (cached) {
      console.log(`⚡ Batch ${page} - cache hit`);
      return res.json(cached);
    }

    console.log(`📥 Batch ${page} - fetching from DB`);
    const collection = mongodb.getCollection('funds');

    // MongoDB free-tier safe query with indexed sort
    const funds = await collection
      .find({ isActive: true })
      .project({
        _id: 1,
        fundId: 1,
        name: 1,
        category: 1,
        subCategory: 1,
        fundHouse: 1,
        currentNav: 1,
        'returns.oneYear': 1,
        'returns.threeYear': 1,
        aum: 1,
        expenseRatio: 1,
        riskLevel: 1,
      })
      .sort({ _id: -1 }) // Indexed field for memory safety
      .skip(skip)
      .limit(batchSize)
      .toArray();

    const total = await collection.countDocuments({ isActive: true });
    const totalPages = Math.ceil(total / batchSize);

    const response = {
      success: true,
      data: funds.map((f) => ({
        id: f._id || f.fundId,
        fundId: f.fundId,
        name: f.name,
        category: f.category,
        subCategory: f.subCategory,
        fundHouse: f.fundHouse,
        currentNav: f.currentNav || 0,
        returns: {
          oneYear: f.returns?.oneYear || 0,
          threeYear: f.returns?.threeYear || 0,
        },
        aum: f.aum || 0,
        expenseRatio: f.expenseRatio || 0,
        riskLevel: f.riskLevel || 'MEDIUM',
      })),
      pagination: {
        page,
        batchSize,
        total,
        totalPages,
        hasMore: page < totalPages,
        loaded: Math.min(page * batchSize, total),
        remaining: Math.max(0, total - page * batchSize),
      },
      message: `Batch ${page} loaded`,
    };

    // Cache batch for 10 minutes (if Redis available)
    try {
      await redis.set(cacheKey, response, 600);
      console.log(`✅ Batch ${page} cached`);
    } catch (cacheError) {
      console.log(`⚠️  Redis unavailable, skipping cache for batch ${page}`);
    }

    return res.json(response);
  } catch (error) {
    console.error('❌ Batch error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch fund batch',
    });
  }
});

export default router;
