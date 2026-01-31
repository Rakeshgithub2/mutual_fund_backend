import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import {
  formatResponse,
  formatPaginatedResponse,
  pagination,
  buildSortOrder,
} from '../utils/response';
import { enrichFundData } from '../utils/fundMetrics';
import { redis } from '../cache/redis';

// import { cacheService, CacheService } from '../services/cacheService';

const getFundsSchema = z.object({
  type: z.string().optional(),
  category: z.string().optional(),
  subCategory: z.string().optional(),
  q: z.string().optional(), // search query
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(2500).default(10),
  sort: z.string().optional(), // field:direction (e.g., name:asc, createdAt:desc)
});

const getFundNavsSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export const getFunds = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    console.log('📥 GET /funds request received');
    const { type, category, subCategory, q, page, limit, sort } =
      getFundsSchema.parse(req.query);
    console.log('✅ Request params validated:', {
      type,
      category,
      subCategory,
      q,
      page,
      limit,
      sort,
    });

    // Create cache key for this query
    // const cacheKey = CacheService.keys.fundsList(
    //   JSON.stringify({ type, category, q, page, limit, sort })
    // );

    // Try to get from cache first
    // const cachedData = await cacheService.getJSON(cacheKey);
    // if (cachedData) {
    //   return res.json(cachedData);
    // }

    const { skip, take } = pagination(page, limit);
    const orderBy = buildSortOrder(sort);

    // Build where clause
    const where: any = {
      isActive: true,
    };

    if (type) {
      where.type = type;
    }

    if (category) {
      where.category = category;
    }

    if (subCategory) {
      where.subCategory = subCategory;
    }

    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { amfiCode: { contains: q, mode: 'insensitive' } },
      ];
    }

    // Get total count
    const total = await prisma.fund.count({ where });

    // Get funds
    const funds = await prisma.fund.findMany({
      where,
      orderBy: orderBy || { createdAt: 'desc' },
      skip,
      take,
      select: {
        id: true,
        amfiCode: true,
        name: true,
        type: true,
        category: true,
        subCategory: true,
        benchmark: true,
        expenseRatio: true,
        inceptionDate: true,
        description: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Enrich funds with calculated metrics (only for first page to improve performance)
    let enrichedFunds = funds;
    if (page === 1 && funds.length > 0) {
      console.log('📊 Enriching first page funds with metrics...');
      enrichedFunds = await Promise.all(
        funds.map(async (fund) => {
          try {
            // Get 1 year of performance data for calculations
            const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
            const performances = await prisma.fundPerformance.findMany({
              where: {
                fundId: fund.id,
                date: { gte: oneYearAgo },
              },
              orderBy: { date: 'desc' },
              select: {
                date: true,
                nav: true,
              },
            });

            if (performances.length > 30) {
              return enrichFundData(fund, performances);
            }
          } catch (error) {
            console.error(`Error enriching fund ${fund.id}:`, error);
          }
          return fund;
        })
      );
      console.log('✅ Funds enriched with metrics');
    }

    const response = formatPaginatedResponse(
      enrichedFunds,
      total,
      page,
      limit,
      'Funds retrieved successfully'
    );

    // Cache the response
    // await cacheService.setJSON(cacheKey, response, CacheService.TTL.FUNDS_LIST);

    return res.json(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors,
      });
    }

    console.error('Get funds error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const getFundById = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const { id } = req.params;
    console.log(`📥 GET /funds/${id} request received`);

    // Redis cache key for fund details
    const cacheKey = `fund:meta:${id}`;
    await redis.connect();
    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
      console.log('⚡ Cache hit for fund', id);
      return res.json(cachedData);
    }

    // Check cache first for unauthenticated requests
    // const cacheKey = CacheService.keys.fundDetail(id);
    // const cachedData = await cacheService.getJSON(cacheKey);
    // if (cachedData) {
    //   return res.json(cachedData);
    // }

    const fund = await prisma.fund.findUnique({
      where: { id },
      include: {
        holdings: {
          orderBy: { percent: 'desc' },
          take: 15, // Top 15 holdings (real companies)
        },
        managedBy: {
          select: {
            id: true,
            name: true,
            experience: true,
            qualification: true,
          },
        },
      },
    });

    if (!fund) {
      console.log(`❌ Fund with ID ${id} not found`);
      return res.status(404).json({ error: 'Fund not found' });
    }

    // Get extended performance data for accurate calculations (up to 10 years)
    console.log(`📊 Fetching performance data for fund ${fund.name}...`);
    const tenYearsAgo = new Date(Date.now() - 10 * 365 * 24 * 60 * 60 * 1000);
    const allPerformances = await prisma.fundPerformance.findMany({
      where: {
        fundId: fund.id,
        date: { gte: tenYearsAgo },
      },
      orderBy: { date: 'desc' },
      select: {
        date: true,
        nav: true,
      },
    });

    // Enrich fund data with calculated metrics
    console.log(
      `📈 Calculating metrics from ${allPerformances.length} data points...`
    );
    const enrichedFund = enrichFundData(fund, allPerformances);

    // Add performance data for chart (last 1 year)
    const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    const fundWithPerformances = {
      ...enrichedFund,
      performances: allPerformances
        .filter((p) => new Date(p.date) >= oneYearAgo)
        .slice(0, 365),
      performanceHistory: allPerformances
        .filter((p) => new Date(p.date) >= oneYearAgo)
        .slice(0, 365),
    };

    console.log(`✅ Fund ${fund.name} retrieved with metrics:`, {
      returns: fundWithPerformances.returns,
      riskMetrics: fundWithPerformances.riskMetrics,
      riskLevel: fundWithPerformances.riskLevel,
      rating: fundWithPerformances.rating,
    });

    const response = formatResponse(
      fundWithPerformances,
      'Fund details retrieved successfully'
    );

    // Save to Redis cache
    await redis.set(cacheKey, response, 3600); // 1 hour TTL

    // Cache the response
    // await cacheService.setJSON(
    //   cacheKey,
    //   response,
    //   CacheService.TTL.FUND_DETAIL
    // );

    return res.json(response);
  } catch (error) {
    console.error('❌ Get fund by ID error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

export const getFundNavs = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const { id } = req.params;
    const { from, to } = getFundNavsSchema.parse(req.query);

    // Create cache key for NAV data
    // const cacheKey = CacheService.keys.fundNavs(
    //   id + JSON.stringify({ from, to })
    // );
    // const cachedData = await cacheService.getJSON(cacheKey);
    // if (cachedData) {
    //   return res.json(cachedData);
    // }

    // Build date filter
    const dateFilter: any = {};
    if (from) {
      dateFilter.gte = new Date(from);
    }
    if (to) {
      dateFilter.lte = new Date(to);
    }

    const navs = await prisma.fundPerformance.findMany({
      where: {
        fundId: id,
        ...(Object.keys(dateFilter).length > 0 && { date: dateFilter }),
      },
      orderBy: { date: 'asc' },
      select: {
        date: true,
        nav: true,
      },
    });

    const response = formatResponse(navs, 'Fund NAVs retrieved successfully');

    // Cache the NAV data
    // await cacheService.setJSON(cacheKey, response, CacheService.TTL.FUND_NAVS);

    return res.json(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors,
      });
    }

    console.error('Get fund NAVs error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
