import { Request, Response } from 'express';
import { rankingService, RankingCriteria } from '../services/ranking.service';
import { Fund } from '../db/schemas';

/**
 * Rankings Controller
 *
 * Mobile-first API design:
 * - Summary-first responses
 * - Collapsible data sections
 * - Clear numeric typography
 * - Optimized for 360px screens
 *
 * Endpoints:
 * - GET /api/rankings/top - Top 20/50/100 funds
 * - GET /api/rankings/category/:category - Category leaders
 * - GET /api/rankings/subcategory/:category/:subcategory - Sub-category leaders
 * - GET /api/rankings/risk-adjusted - Risk-adjusted rankings
 * - GET /api/rankings/rolling/:period - Rolling return rankings
 */

/**
 * Mobile-optimized response transformer
 * Summary first, details on demand
 */
function transformForMobile(funds: any[], includeDetails: boolean = false) {
  return funds.map((fund) => {
    // Core summary (always included)
    const summary = {
      fundId: fund.fundId,
      name: fund.name,
      rank: fund.overallRank || fund.categoryRank,

      // Key metrics (prominent display)
      returns: {
        '1Y': fund.returns.oneYear,
        '3Y': fund.returns.threeYear,
      },

      // Trust indicators
      score: Math.round(fund.overallScore),
      aum: fund.aum,

      // Quick identification
      category: fund.category,
      schemeType: fund.schemeType,
      fundHouse: fund.fundHouse,
    };

    // Extended details (expandable section)
    if (includeDetails) {
      return {
        ...summary,
        details: {
          // Full returns
          allReturns: {
            '1Y': fund.returns.oneYear,
            '2Y': fund.returns.twoYear,
            '3Y': fund.returns.threeYear,
            '5Y': fund.returns.fiveYear,
          },

          // Risk metrics
          risk: {
            sharpe: fund.sharpeRatio,
            stdDev: fund.standardDeviation,
            sortino: fund.sortino,
          },

          // Detailed scores
          scores: {
            overall: Math.round(fund.overallScore),
            performance: Math.round(fund.performanceScore),
            riskAdjusted: Math.round(fund.riskAdjustedScore),
            consistency: Math.round(fund.consistencyScore),
          },

          // Manager info
          manager: {
            name: fund.fundManager,
            tenure: fund.fundManagerTenure,
          },

          // Costs
          costs: {
            nav: fund.currentNav,
            expenseRatio: fund.expenseRatio,
          },

          // Metadata
          subCategory: fund.subCategory,
          lastUpdated: fund.lastUpdated,
        },
      };
    }

    return summary;
  });
}

/**
 * GET /api/rankings/top
 * Get top funds across all categories
 */
export const getTopFunds = async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const includeDetails = req.query.details === 'true';

    // Optional filters
    const criteria: RankingCriteria = {
      limit,
    };

    if (req.query.category) {
      criteria.category = req.query.category as Fund['category'];
    }

    if (req.query.schemeType) {
      criteria.schemeType = req.query.schemeType as 'direct' | 'regular';
    }

    if (req.query.minAUM) {
      criteria.minAUM = parseInt(req.query.minAUM as string);
    }

    const rankedFunds = await rankingService.getTopFunds(limit, criteria);

    // Mobile-optimized response
    const mobileData = transformForMobile(rankedFunds, includeDetails);

    return res.json({
      success: true,
      message: `Top ${limit} funds retrieved successfully`,
      data: mobileData,
      metadata: {
        count: mobileData.length,
        criteria: criteria,
        methodology:
          'Composite score: 50% returns, 30% risk-adjusted, 20% consistency',
        calculatedAt: new Date(),
        expandable: !includeDetails,
      },
    });
  } catch (error: any) {
    console.error('Error fetching top funds:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch top funds',
      error: error.message,
    });
  }
};

/**
 * GET /api/rankings/category/:category
 * Get category-wise leaders
 */
export const getCategoryLeaders = async (req: Request, res: Response) => {
  try {
    const { category } = req.params;
    const limit = parseInt(req.query.limit as string) || 10;
    const includeDetails = req.query.details === 'true';

    // Validate category
    const validCategories: Fund['category'][] = [
      'equity',
      'debt',
      'hybrid',
      'commodity',
      'etf',
      'index',
      'elss',
      'solution_oriented',
      'international',
    ];

    if (!validCategories.includes(category as Fund['category'])) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category',
        validCategories,
      });
    }

    const leaders = await rankingService.getCategoryLeaders(
      category as Fund['category'],
      limit
    );

    const mobileData = transformForMobile(leaders, includeDetails);

    return res.json({
      success: true,
      message: `Top ${limit} ${category} funds retrieved successfully`,
      data: mobileData,
      metadata: {
        count: mobileData.length,
        category,
        methodology: `Category-specific ranking within ${category} funds`,
        calculatedAt: new Date(),
        expandable: !includeDetails,
      },
    });
  } catch (error: any) {
    console.error('Error fetching category leaders:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch category leaders',
      error: error.message,
    });
  }
};

/**
 * GET /api/rankings/subcategory/:category/:subcategory
 * Get sub-category leaders
 */
export const getSubCategoryLeaders = async (req: Request, res: Response) => {
  try {
    const { category, subcategory } = req.params;
    const limit = parseInt(req.query.limit as string) || 10;
    const includeDetails = req.query.details === 'true';

    const leaders = await rankingService.getSubCategoryLeaders(
      category as Fund['category'],
      subcategory,
      limit
    );

    const mobileData = transformForMobile(leaders, includeDetails);

    return res.json({
      success: true,
      message: `Top ${limit} funds in ${subcategory} retrieved successfully`,
      data: mobileData,
      metadata: {
        count: mobileData.length,
        category,
        subcategory,
        methodology: `Sub-category specific ranking within ${category} > ${subcategory}`,
        calculatedAt: new Date(),
        expandable: !includeDetails,
      },
    });
  } catch (error: any) {
    console.error('Error fetching subcategory leaders:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch subcategory leaders',
      error: error.message,
    });
  }
};

/**
 * GET /api/rankings/risk-adjusted
 * Get risk-adjusted rankings (Sharpe/Sortino based)
 */
export const getRiskAdjustedRankings = async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const includeDetails = req.query.details === 'true';

    const criteria: RankingCriteria = {
      riskAdjusted: true,
      limit,
    };

    if (req.query.category) {
      criteria.category = req.query.category as Fund['category'];
    }

    const rankedFunds = await rankingService.getRiskAdjustedRankings(
      limit,
      criteria
    );

    const mobileData = transformForMobile(rankedFunds, includeDetails);

    return res.json({
      success: true,
      message: `Top ${limit} risk-adjusted funds retrieved successfully`,
      data: mobileData,
      metadata: {
        count: mobileData.length,
        criteria,
        methodology:
          'Risk-adjusted scoring: 60% Sharpe ratio, 40% Sortino ratio',
        calculatedAt: new Date(),
        expandable: !includeDetails,
      },
    });
  } catch (error: any) {
    console.error('Error fetching risk-adjusted rankings:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch risk-adjusted rankings',
      error: error.message,
    });
  }
};

/**
 * GET /api/rankings/rolling/:period
 * Get rolling return rankings (2Y, 3Y, 5Y)
 */
export const getRollingReturnRankings = async (req: Request, res: Response) => {
  try {
    const { period } = req.params;
    const limit = parseInt(req.query.limit as string) || 100;
    const includeDetails = req.query.details === 'true';

    // Validate period
    if (!['2y', '3y', '5y'].includes(period.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid period. Valid values: 2y, 3y, 5y',
      });
    }

    const criteria: RankingCriteria = {
      returnPeriod: period.toLowerCase() as '2y' | '3y' | '5y',
      limit,
    };

    if (req.query.category) {
      criteria.category = req.query.category as Fund['category'];
    }

    const rankedFunds = await rankingService.getRollingReturnRankings(
      period.toLowerCase() as '2y' | '3y' | '5y',
      limit,
      criteria
    );

    const mobileData = transformForMobile(rankedFunds, includeDetails);

    return res.json({
      success: true,
      message: `Top ${limit} funds by ${period.toUpperCase()} returns retrieved successfully`,
      data: mobileData,
      metadata: {
        count: mobileData.length,
        period: period.toUpperCase(),
        criteria,
        methodology: `Ranked by ${period.toUpperCase()} rolling returns`,
        calculatedAt: new Date(),
        expandable: !includeDetails,
      },
    });
  } catch (error: any) {
    console.error('Error fetching rolling return rankings:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch rolling return rankings',
      error: error.message,
    });
  }
};

/**
 * GET /api/rankings/all-categories
 * Get leaders from all categories (mobile dashboard view)
 */
export const getAllCategoryLeaders = async (req: Request, res: Response) => {
  try {
    const perCategory = parseInt(req.query.limit as string) || 5;
    const includeDetails = req.query.details === 'true';

    const categories: Fund['category'][] = [
      'equity',
      'debt',
      'hybrid',
      'elss',
      'commodity',
      'index',
      'etf',
      'solution_oriented',
      'international',
    ];

    const allLeaders: { [key: string]: any[] } = {};

    // Fetch top funds from each category
    for (const category of categories) {
      const leaders = await rankingService.getCategoryLeaders(
        category,
        perCategory
      );
      allLeaders[category] = transformForMobile(leaders, includeDetails);
    }

    return res.json({
      success: true,
      message: 'Category leaders retrieved successfully',
      data: allLeaders,
      metadata: {
        categories: Object.keys(allLeaders),
        perCategory,
        totalFunds: Object.values(allLeaders).reduce(
          (sum, arr) => sum + arr.length,
          0
        ),
        methodology: 'Top performers per category',
        calculatedAt: new Date(),
        expandable: !includeDetails,
      },
    });
  } catch (error: any) {
    console.error('Error fetching all category leaders:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch category leaders',
      error: error.message,
    });
  }
};

/**
 * POST /api/rankings/refresh
 * Clear ranking cache (admin endpoint)
 */
export const refreshRankings = async (req: Request, res: Response) => {
  try {
    rankingService.clearCache();

    return res.json({
      success: true,
      message:
        'Ranking cache cleared successfully. New rankings will be calculated on next request.',
    });
  } catch (error: any) {
    console.error('Error refreshing rankings:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to refresh rankings',
      error: error.message,
    });
  }
};
