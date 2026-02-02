"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFundNavs = exports.getFundById = exports.getFunds = void 0;
const zod_1 = require("zod");
const db_1 = require("../db");
const response_1 = require("../utils/response");
const fundMetrics_1 = require("../utils/fundMetrics");
const redis_1 = require("../cache/redis");
// import { cacheService, CacheService } from '../services/cacheService';
const getFundsSchema = zod_1.z.object({
    type: zod_1.z.string().optional(),
    category: zod_1.z.string().optional(),
    subCategory: zod_1.z.string().optional(),
    q: zod_1.z.string().optional(), // search query
    page: zod_1.z.coerce.number().min(1).default(1),
    limit: zod_1.z.coerce.number().min(1).max(2500).default(10),
    sort: zod_1.z.string().optional(), // field:direction (e.g., name:asc, createdAt:desc)
});
const getFundNavsSchema = zod_1.z.object({
    from: zod_1.z.string().datetime().optional(),
    to: zod_1.z.string().datetime().optional(),
});
const getFunds = async (req, res) => {
    try {
        console.log('📥 GET /funds request received');
        const { type, category, subCategory, q, page, limit, sort } = getFundsSchema.parse(req.query);
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
        const { skip, take } = (0, response_1.pagination)(page, limit);
        const orderBy = (0, response_1.buildSortOrder)(sort);
        // Build where clause
        const where = {
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
        const total = await db_1.prisma.fund.count({ where });
        // Get funds
        const funds = await db_1.prisma.fund.findMany({
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
            enrichedFunds = await Promise.all(funds.map(async (fund) => {
                try {
                    // Get 1 year of performance data for calculations
                    const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
                    const performances = await db_1.prisma.fundPerformance.findMany({
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
                        return (0, fundMetrics_1.enrichFundData)(fund, performances);
                    }
                }
                catch (error) {
                    console.error(`Error enriching fund ${fund.id}:`, error);
                }
                return fund;
            }));
            console.log('✅ Funds enriched with metrics');
        }
        const response = (0, response_1.formatPaginatedResponse)(enrichedFunds, total, page, limit, 'Funds retrieved successfully');
        // Cache the response
        // await cacheService.setJSON(cacheKey, response, CacheService.TTL.FUNDS_LIST);
        return res.json(response);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({
                error: 'Validation error',
                details: error.errors,
            });
        }
        console.error('Get funds error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getFunds = getFunds;
const getFundById = async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`📥 GET /funds/${id} request received`);
        // Redis cache key for fund details
        const cacheKey = `fund:meta:${id}`;
        await redis_1.redis.connect();
        const cachedData = await redis_1.redis.get(cacheKey);
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
        const fund = await db_1.prisma.fund.findUnique({
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
        const allPerformances = await db_1.prisma.fundPerformance.findMany({
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
        console.log(`📈 Calculating metrics from ${allPerformances.length} data points...`);
        const enrichedFund = (0, fundMetrics_1.enrichFundData)(fund, allPerformances);
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
        const response = (0, response_1.formatResponse)(fundWithPerformances, 'Fund details retrieved successfully');
        // Save to Redis cache
        await redis_1.redis.set(cacheKey, response, 3600); // 1 hour TTL
        // Cache the response
        // await cacheService.setJSON(
        //   cacheKey,
        //   response,
        //   CacheService.TTL.FUND_DETAIL
        // );
        return res.json(response);
    }
    catch (error) {
        console.error('❌ Get fund by ID error:', error);
        return res.status(500).json({
            error: 'Internal server error',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
exports.getFundById = getFundById;
const getFundNavs = async (req, res) => {
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
        const dateFilter = {};
        if (from) {
            dateFilter.gte = new Date(from);
        }
        if (to) {
            dateFilter.lte = new Date(to);
        }
        const navs = await db_1.prisma.fundPerformance.findMany({
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
        const response = (0, response_1.formatResponse)(navs, 'Fund NAVs retrieved successfully');
        // Cache the NAV data
        // await cacheService.setJSON(cacheKey, response, CacheService.TTL.FUND_NAVS);
        return res.json(response);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({
                error: 'Validation error',
                details: error.errors,
            });
        }
        console.error('Get fund NAVs error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getFundNavs = getFundNavs;
