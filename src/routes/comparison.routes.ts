import { Router, Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import { mongodb } from '../db/mongodb';
import { redis } from '../cache/redis';
import { optionalAuth } from '../middleware/auth.middleware';
import { ComparisonService } from '../services/comparison.service';

/**
 * Comparison Routes
 *
 * Endpoints:
 * - POST /api/comparison/compare - Compare multiple funds with advanced overlap analysis
 * - POST /api/comparison/overlap - Calculate portfolio overlap (legacy)
 * - GET /api/comparison/history - Get user's comparison history
 *
 * Features:
 * - Holdings overlap: Jaccard index + weighted overlap
 * - Sector overlap: Cosine similarity
 * - Returns correlation: Pearson correlation on daily returns
 * - Configurable top N holdings (default 50)
 * - Multi-period correlation analysis (3m, 6m, 1y, 3y)
 */

const router = Router();

// ==================== COMPARE FUNDS ====================
/**
 * POST /api/comparison/compare
 *
 * Body:
 * {
 *   fundIds: string[] | string (2-5 fund IDs or search terms),
 *   topNHoldings?: number (default: 50),
 *   correlationPeriod?: '3m' | '6m' | '1y' | '3y' (default: '1y'),
 *   includeCorrelation?: boolean (default: true)
 * }
 *
 * Output:
 * {
 *   funds: [fund summaries],
 *   holdingsOverlap: {
 *     jaccard: 0.12,
 *     weightedOverlap: 0.27,
 *     commonHoldings: [{ ticker, name, weightA, weightB, minWeight }],
 *     uniqueToFundA: 38,
 *     uniqueToFundB: 42
 *   },
 *   sectorOverlap: {
 *     cosineSimilarity: 0.85,
 *     percentOverlap: 67.5,
 *     commonSectors: [{ sector, weightA, weightB, difference }]
 *   },
 *   returnsCorrelation: {
 *     period: '1y',
 *     correlation: 0.82,
 *     dataPoints: 252
 *   }
 * }
 */
router.post(
  '/compare',
  optionalAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      let { fundIds, topNHoldings, correlationPeriod, includeCorrelation } =
        req.body;

      // Resolve search terms to fundIds if needed
      if (
        typeof fundIds === 'string' ||
        (Array.isArray(fundIds) &&
          fundIds.some((id: any) => typeof id === 'string' && id.includes(' ')))
      ) {
        // If fundIds contains search terms, resolve them first
        // For now, assume fundIds are already resolved
        // TODO: Integrate with SearchService to resolve free-text queries
      }

      // Validation
      if (!Array.isArray(fundIds) || fundIds.length < 2 || fundIds.length > 5) {
        return res.status(400).json({
          success: false,
          message: 'Please provide 2-5 fund IDs to compare',
        });
      }

      // Default options
      const options = {
        topNHoldings: topNHoldings || 50,
        correlationPeriod: correlationPeriod || '1y',
        includeCorrelation: includeCorrelation !== false,
      };

      // Check cache
      const cacheKey = `comparison:v2:${fundIds.sort().join(':')}:${options.topNHoldings}:${options.correlationPeriod}:${options.includeCorrelation}`;
      const cached = await redis.get(cacheKey);
      if (cached) {
        return res.json({
          success: true,
          data: cached,
          cached: true,
        });
      }

      const db = mongodb.getDb();
      const comparisonService = new ComparisonService(db);

      // Perform comparison
      const comparison = await comparisonService.compareFunds(fundIds, options);

      // Save to history (if authenticated)
      if (req.user) {
        await db.collection('comparisonHistory').insertOne({
          userId: req.user.id,
          fundIds,
          options,
          timestamp: new Date(),
          createdAt: new Date(),
        });
      }

      // Cache for 1 hour
      await redis.set(cacheKey, comparison, 60 * 60);

      res.json({
        success: true,
        data: comparison,
        cached: false,
      });
    } catch (error: any) {
      console.error('Error in compare endpoint:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to compare funds',
        error: error.message,
      });
    }
  }
);

// ==================== PORTFOLIO OVERLAP ====================
/**
 * POST /api/comparison/overlap
 *
 * Body:
 * {
 *   fundIds: string[] (multiple fund IDs)
 * }
 */
router.post(
  '/overlap',
  optionalAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const { fundIds } = req.body;

      if (!Array.isArray(fundIds) || fundIds.length < 2) {
        return res.status(400).json({
          success: false,
          message: 'Please provide at least 2 fund IDs',
        });
      }

      const db = mongodb.getDb();

      // Fetch funds with holdings
      const funds = await db
        .collection('funds')
        .find({ fundId: { $in: fundIds }, isActive: true })
        .project({
          fundId: 1,
          name: 1,
          holdings: 1,
          sectorAllocation: 1,
          _id: 0,
        })
        .toArray();

      if (funds.length < 2) {
        return res.status(404).json({
          success: false,
          message: 'Some funds not found',
        });
      }

      // Calculate detailed overlap
      const holdingsOverlap = calculateDetailedHoldingsOverlap(funds);
      const sectorOverlap = calculateDetailedSectorOverlap(funds);
      const duplicateExposure = findDuplicateExposure(funds);

      res.json({
        success: true,
        data: {
          funds: funds.map((f) => ({ fundId: f.fundId, name: f.name })),
          holdingsOverlap,
          sectorOverlap,
          duplicateExposure,
          warnings: generateOverlapWarnings(holdingsOverlap, sectorOverlap),
        },
      });
    } catch (error: any) {
      console.error('Error in overlap endpoint:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to calculate overlap',
        error: error.message,
      });
    }
  }
);

// ==================== COMPARISON HISTORY ====================
/**
 * GET /api/comparison/history
 */
router.get(
  '/history',
  optionalAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
      }

      const { limit = '10' } = req.query;
      const limitNum = Math.min(50, Math.max(1, parseInt(limit as string)));

      const db = mongodb.getDb();
      const history = await db
        .collection('comparisonHistory')
        .find({ userId: req.user.id })
        .sort({ timestamp: -1 })
        .limit(limitNum)
        .toArray();

      res.json({
        success: true,
        data: history,
      });
    } catch (error: any) {
      console.error('Error fetching comparison history:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch comparison history',
        error: error.message,
      });
    }
  }
);

// ==================== LEGACY HELPER FUNCTIONS ====================
// These are kept for backward compatibility with the /overlap endpoint

/**
 * Calculate detailed holdings overlap (legacy)
 */
function calculateDetailedHoldingsOverlap(funds: any[]): any {
  const allHoldings = new Map<
    string,
    { funds: string[]; totalWeight: number }
  >();

  // Aggregate all holdings
  for (const fund of funds) {
    if (fund.holdings) {
      for (const holding of fund.holdings) {
        const name = holding.name?.toLowerCase();
        if (name) {
          if (!allHoldings.has(name)) {
            allHoldings.set(name, { funds: [], totalWeight: 0 });
          }
          const data = allHoldings.get(name)!;
          data.funds.push(fund.fundId);
          data.totalWeight += holding.percentage || 0;
        }
      }
    }
  }

  // Find common holdings
  const commonHoldings = Array.from(allHoldings.entries())
    .filter(([_, data]) => data.funds.length > 1)
    .map(([name, data]) => ({
      name,
      funds: data.funds,
      count: data.funds.length,
      avgWeight: data.totalWeight / data.funds.length,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    total: allHoldings.size,
    common: commonHoldings.length,
    commonHoldings: commonHoldings.slice(0, 20), // Top 20
  };
}

/**
 * Calculate detailed sector overlap (legacy)
 */
function calculateDetailedSectorOverlap(funds: any[]): any {
  const sectorData = new Map<string, number[]>();

  for (const fund of funds) {
    if (fund.sectorAllocation) {
      for (const sector of fund.sectorAllocation) {
        const name = sector.sector.toLowerCase();
        if (!sectorData.has(name)) {
          sectorData.set(name, []);
        }
        sectorData.get(name)!.push(sector.percentage);
      }
    }
  }

  const sectors = Array.from(sectorData.entries())
    .map(([name, weights]) => ({
      sector: name,
      avgWeight: weights.reduce((sum, w) => sum + w, 0) / weights.length,
      maxWeight: Math.max(...weights),
      minWeight: Math.min(...weights),
      fundsCount: weights.length,
    }))
    .sort((a, b) => b.avgWeight - a.avgWeight);

  return sectors;
}

/**
 * Find duplicate exposure (legacy)
 */
function findDuplicateExposure(funds: any[]): any {
  const exposureMap = new Map<string, number>();

  for (const fund of funds) {
    if (fund.holdings) {
      for (const holding of fund.holdings) {
        const name = holding.name?.toLowerCase();
        if (name) {
          exposureMap.set(
            name,
            (exposureMap.get(name) || 0) + (holding.percentage || 0)
          );
        }
      }
    }
  }

  const duplicates = Array.from(exposureMap.entries())
    .filter(([_, weight]) => weight > 10) // More than 10% total exposure
    .map(([name, totalWeight]) => ({ name, totalWeight }))
    .sort((a, b) => b.totalWeight - a.totalWeight);

  return duplicates;
}

/**
 * Generate overlap warnings (legacy)
 */
function generateOverlapWarnings(
  holdingsOverlap: any,
  sectorOverlap: any
): string[] {
  const warnings: string[] = [];

  if (holdingsOverlap.common > 10) {
    warnings.push(
      `High holdings overlap detected: ${holdingsOverlap.common} common holdings`
    );
  }

  const highSectorOverlap = sectorOverlap.find((s: any) => s.avgWeight > 30);
  if (highSectorOverlap) {
    warnings.push(
      `Heavy concentration in ${highSectorOverlap.sector} sector (${highSectorOverlap.avgWeight.toFixed(1)}%)`
    );
  }

  return warnings;
}

export default router;
