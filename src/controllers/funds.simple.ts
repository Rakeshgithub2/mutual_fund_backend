import { Request, Response } from 'express';
import { z } from 'zod';
import { mongodb } from '../db/mongodb';
import { FundModel } from '../models/Fund.model';
import { FundManagerModel } from '../models/FundManager.model';
import {
  formatResponse,
  formatPaginatedResponse,
  pagination,
  buildSortOrder,
} from '../utils/response';
import { redis } from '../cache/redis';
import axios from 'axios';

const getFundsSchema = z.object({
  query: z.string().optional(), // Changed from 'q' to 'query'
  type: z.string().optional(),
  category: z.string().optional(),
  subCategory: z.string().optional(), // Add subCategory support
  top: z.enum(['20', '50', '100']).optional(), // Add top funds filter
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(500).default(200), // MongoDB free-tier safe: default 200, max 500
  sort: z.string().optional(),
});

const getFundNavsSchema = z.object({
  period: z.enum(['1M', '3M', '1Y', '5Y', 'ALL']).optional().default('1Y'),
  from: z.string().optional(),
  to: z.string().optional(),
});

/**
 * GET /funds
 * Search, filter, paginate funds
 * Query params: query, type, category, limit, page
 * Replaces all mock fund lists
 */
export const getFunds = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    console.log('📥 GET /funds request received');
    const { query, type, category, subCategory, top, page, limit, sort } =
      getFundsSchema.parse(req.query);
    console.log('✅ Request params validated:', {
      query,
      type,
      category,
      subCategory,
      top,
      page,
      limit,
      sort,
    });

    // Cache first page for instant response (1 hour TTL)
    if (page === 1 && !query && !type && !category && !subCategory && !top) {
      const cacheKey = `funds:all:page1:limit${limit}`;
      try {
        const cached = await redis.get(cacheKey);
        if (cached) {
          console.log('⚡ Cache hit - returning cached first page');
          return res.json(cached);
        }
      } catch (cacheError) {
        console.log('⚠️  Redis unavailable, fetching from DB');
      }
    }

    // Handle Top N funds filtering
    if (top) {
      const topLimit = parseInt(top);
      const collection = mongodb.getCollection('funds');

      const topFunds = await collection
        .find({ isActive: true })
        .sort({
          'returns.oneYear': -1, // Sort by 1-year returns
          aum: -1, // Then by AUM
          popularity: -1,
        })
        .limit(topLimit)
        .toArray();

      const formattedFunds = topFunds.map((fund) => ({
        id: fund._id || fund.fundId,
        fundId: fund.fundId,
        name: fund.name,
        category: fund.category,
        subCategory: fund.subCategory,
        fundType: fund.fundType,
        fundHouse: fund.fundHouse,
        currentNav: fund.currentNav || 0,
        returns: fund.returns || {},
        aum: fund.aum || 0,
        expenseRatio: fund.expenseRatio || 0,
        riskLevel: fund.riskLevel || 'MEDIUM',
      }));

      return res.json(
        formatPaginatedResponse(
          formattedFunds,
          1, // page
          topLimit, // limit
          topFunds.length, // total
          `Top ${top} funds retrieved successfully`
        )
      );
    }

    const { skip, take } = pagination(page, limit);

    // Build MongoDB query using Fund Model
    const fundModel = FundModel.getInstance();

    let fundsRaw: any[];
    let total: number;

    // Build filter with proper subcategory filtering for equity
    const searchOptions: any = {
      limit: take,
      skip,
    };

    // Build query filter for counting total
    const collection = mongodb.getCollection('funds');
    let countFilter: any = { isActive: true };

    // If query parameter is provided, use search method
    if (query) {
      fundsRaw = await fundModel.search(query, {
        category: category as any,
        fundType: type as any,
        limit: take,
        skip,
      });
      // For search, approximate total from results
      total = fundsRaw.length;
    } else {
      // Use findByCategory for category filtering or findAll
      if (category || subCategory) {
        // If subCategory is provided, filter by that specific subcategory
        if (subCategory) {
          fundsRaw = await fundModel.findBySubCategory(subCategory, {
            limit: take,
            skip,
          });
          countFilter.subCategory = subCategory;
        } else if (category === 'equity') {
          // For equity, filter by matching subcategories
          const equitySubcategories = [
            'Large Cap',
            'Mid Cap',
            'Small Cap',
            'Multi Cap',
            'Flexi Cap',
            'ELSS',
            'Sectoral',
            'Thematic',
            'Value Fund',
            'Contra Fund',
            'Dividend Yield',
            'Focused Fund',
            'Large & Mid Cap',
          ];
          // Search by subCategory, not category
          fundsRaw = await collection
            .find({
              subCategory: { $in: equitySubcategories },
              isActive: true,
            })
            .sort({ _id: -1 }) // Use indexed field first
            .skip(skip)
            .limit(take)
            .toArray();
          countFilter.subCategory = { $in: equitySubcategories };
        } else if (category === 'commodity') {
          // For commodity, filter by commodity category (lowercase)
          fundsRaw = await fundModel.findByCategory('commodity', {
            limit: take,
            skip,
          });
          countFilter.category = 'commodity';
        } else {
          fundsRaw = await fundModel.findByCategory(category as string, {
            limit: take,
            skip,
          });
          countFilter.category = category;
        }
      } else {
        fundsRaw = await fundModel.findAll({
          limit: take,
          skip,
        });
        // countFilter already has isActive: true
      }

      // Get accurate total count
      total = await collection.countDocuments(countFilter);
    }

    // Map _id to id for frontend compatibility
    const funds = fundsRaw.map((fund) => ({
      id: fund._id || fund.fundId,
      fundId: fund.fundId,
      name: fund.name,
      category: fund.category,
      subCategory: fund.subCategory,
      fundType: fund.fundType,
      fundHouse: fund.fundHouse,
      currentNav: fund.currentNav,
      previousNav: fund.previousNav,
      navDate: fund.navDate,
      returns: fund.returns,
      riskMetrics: {
        sharpeRatio: fund.riskMetrics?.sharpeRatio,
        standardDeviation: fund.riskMetrics?.standardDeviation,
      },
      aum: fund.aum,
      expenseRatio: fund.expenseRatio,
      ratings: fund.ratings,
      popularity: fund.popularity,
    }));

    console.log('✅ Funds retrieved:', funds.length);

    const response = formatPaginatedResponse(
      funds,
      total,
      page,
      limit,
      'Funds retrieved successfully'
    );

    // Cache first page for 1 hour (if Redis available)
    if (page === 1 && !query && !type && !category && !subCategory && !top) {
      const cacheKey = `funds:all:page1:limit${limit}`;
      try {
        await redis.set(cacheKey, response, 3600); // 1 hour cache
        console.log('📦 Cached first page for faster subsequent loads');
      } catch (cacheError) {
        console.log('⚠️  Redis unavailable, skipping cache');
      }
    }

    return res.json(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Validation error:', error.errors);
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors,
      });
    }

    console.error('❌ Get funds error:', error);
    return res
      .status(500)
      .json({ error: 'Internal server error', message: String(error) });
  }
};

/**
 * GET /funds/:id
 * Return complete fund details
 * Returns: Basic info, Manager info, NAV, Top holdings, Sectors, AUM
 * Replaces static detail pages
 */
export const getFundById = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const { id } = req.params;
    console.log('📥 GET /funds/:id request received for id:', id);

    // 1. Check Redis cache
    const cacheKey = `fund:meta:${id}`;
    await redis.connect();
    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
      console.log('⚡ Cache hit for fund', id);
      return res.json(cachedData);
    }

    // 2. Check MongoDB
    const fundModel = FundModel.getInstance();
    let fund = await fundModel.findById(id);
    if (fund) {
      // Save to Redis for future
      await redis.set(cacheKey, fund, 3600);
      return res.json(formatResponse(fund, 'Fund details retrieved from DB'));
    }

    // 3. Fund not found in database - return 404 immediately
    // No external API calls - data must be pre-populated by background jobs
    console.log('❌ Fund not found in database:', id);
    return res.status(404).json({
      error: 'Data not found',
      message: 'This fund is not available in our database.',
      fundId: id,
    });
  } catch (error) {
    console.error('❌ Get fund by ID error:', error);
    return res
      .status(500)
      .json({ error: 'Internal server error', message: String(error) });
  }
};

/**
 * GET /funds/:id/price-history
 * Return chart data for different periods
 * Supports: 1M, 3M, 1Y, 5Y, ALL
 */
export const getFundNavs = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const { id } = req.params;
    const { period, from, to } = getFundNavsSchema.parse(req.query);
    console.log('📥 GET /funds/:id/price-history request received for id:', id);

    // Calculate date range based on period
    let startDate: Date;
    const endDate = new Date();

    if (from && to) {
      // Custom date range
      startDate = new Date(from);
    } else {
      // Period-based date range
      switch (period) {
        case '1M':
          startDate = new Date();
          startDate.setMonth(startDate.getMonth() - 1);
          break;
        case '3M':
          startDate = new Date();
          startDate.setMonth(startDate.getMonth() - 3);
          break;
        case '1Y':
          startDate = new Date();
          startDate.setFullYear(startDate.getFullYear() - 1);
          break;
        case '5Y':
          startDate = new Date();
          startDate.setFullYear(startDate.getFullYear() - 5);
          break;
        case 'ALL':
        default:
          startDate = new Date('2000-01-01'); // Get all available data
          break;
      }
    }

    // Get price history from MongoDB
    const pricesCollection = mongodb.getCollection('fundPrices');

    const priceHistory = await pricesCollection
      .find({
        fundId: id,
        date: {
          $gte: startDate,
          $lte: endDate,
        },
      })
      .sort({ date: 1 })
      .toArray();

    // Format for chart data
    const chartData = priceHistory.map((p: any) => ({
      date: p.date,
      nav: p.close || p.nav,
      open: p.open,
      high: p.high,
      low: p.low,
      close: p.close,
      volume: p.volume,
    }));

    console.log('✅ Price history retrieved:', chartData.length, 'data points');

    const response = formatResponse(
      {
        fundId: id,
        period,
        startDate,
        endDate,
        dataPoints: chartData.length,
        data: chartData,
      },
      'Price history retrieved successfully'
    );

    return res.json(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Validation error:', error.errors);
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors,
      });
    }

    console.error('❌ Get fund price history error:', error);
    return res
      .status(500)
      .json({ error: 'Internal server error', message: String(error) });
  }
};

/**
 * GET /suggest?q=nip
 * Fuzzy search for autocomplete - searches ALL funds
 * Used in: Fund Compare, Fund Overlap, Search bar
 * Example: typing "nip" returns Nippon funds, typing "sb" returns SBI funds
 */
export const getSuggestions = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const { q } = req.query;

    if (!q || typeof q !== 'string' || q.trim().length < 1) {
      return res.status(400).json({
        error:
          'Query parameter "q" is required and must be at least 1 character',
      });
    }

    const query = q.trim();
    console.log('📥 GET /suggest request received for query:', query);

    const fundModel = FundModel.getInstance();
    const collection = mongodb.getCollection('funds');

    // Search across ALL funds with comprehensive matching
    const searchResults = await collection
      .find({
        $or: [
          { name: { $regex: `^${query}`, $options: 'i' } }, // Starts with (priority)
          { name: { $regex: query, $options: 'i' } }, // Contains anywhere
          { fundHouse: { $regex: `^${query}`, $options: 'i' } }, // Fund house starts with
          { category: { $regex: query, $options: 'i' } }, // Category match
        ],
        isActive: true,
      })
      .limit(15) // Increased limit for better suggestions
      .sort({ popularity: -1, aum: -1 })
      .toArray();

    // Format suggestions for autocomplete
    const suggestions = searchResults.map((fund: any) => ({
      id: fund._id || fund.fundId,
      fundId: fund.fundId,
      name: fund.name,
      category: fund.category,
      subCategory: fund.subCategory,
      fundType: fund.fundType,
      fundHouse: fund.fundHouse,
      currentNav: fund.currentNav || 0,
      returns: {
        oneYear: fund.returns?.oneYear || 0,
        threeYear: fund.returns?.threeYear || 0,
      },
      aum: fund.aum || 0,
    }));

    console.log('✅ Suggestions retrieved:', suggestions.length);

    const response = formatResponse(
      {
        query,
        count: suggestions.length,
        suggestions,
      },
      'Suggestions retrieved successfully'
    );

    return res.json(response);
  } catch (error) {
    console.error('❌ Get suggestions error:', error);
    return res
      .status(500)
      .json({ error: 'Internal server error', message: String(error) });
  }
};
