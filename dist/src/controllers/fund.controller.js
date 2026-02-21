/**
 * Fund Controller
 * Handles all fund-related operations with caching
 */

const Fund = require('../models/Fund.model');
const FundNav = require('../models/FundNav.model');
const FundHolding = require('../models/FundHolding.model');
const cacheClient = require('../cache/redis.client');
const PaginationUtil = require('../utils/pagination.util');
const DateUtil = require('../utils/date.util');
const FundEnrichmentService = require('../services/fund-enrichment.service');
const DynamicFundSearchService = require('../services/dynamic-fund-search.service');

/**
 * Transform fund returns format from 1Y, 3Y to oneYear, threeYear
 * @param {Object} fund - Fund object
 * @returns {Object} - Transformed fund object
 */
function transformFundReturns(fund) {
  const transformed = { ...fund };

  // Extract NAV value if it's an object
  if (
    fund.currentNav &&
    typeof fund.currentNav === 'object' &&
    fund.currentNav.value
  ) {
    transformed.currentNav = fund.currentNav.value;
  } else if (fund.nav && typeof fund.nav === 'object' && fund.nav.value) {
    transformed.currentNav = fund.nav.value;
  }

  // Use name field, fallback to schemeName
  if (!transformed.name && fund.schemeName) {
    transformed.name = fund.schemeName;
  }

  // Transform returns format
  if (fund && fund.returns) {
    transformed.returns = {
      day: fund.returns['1D'],
      week: fund.returns['1W'],
      month: fund.returns['1M'],
      threeMonth: fund.returns['3M'],
      sixMonth: fund.returns['6M'],
      oneYear: fund.returns['1Y'],
      threeYear: fund.returns['3Y'],
      fiveYear: fund.returns['5Y'],
      sinceInception: fund.returns.sinceInception,
      // Keep original format for backward compatibility
      '1D': fund.returns['1D'],
      '1W': fund.returns['1W'],
      '1M': fund.returns['1M'],
      '3M': fund.returns['3M'],
      '6M': fund.returns['6M'],
      '1Y': fund.returns['1Y'],
      '3Y': fund.returns['3Y'],
      '5Y': fund.returns['5Y'],
    };
  }

  return transformed;
}

class FundController {
  /**
   * Get all funds (paginated)
   * GET /api/funds?page=1&limit=20&category=equity&subcategory=largecap
   *
   * SUPPORTS BOTH NAMING CONVENTIONS:
   * - New: category, subcategory (lowercase)
   * - Old: category, subCategory (mixed case)
   */
  static async getAllFunds(req, res) {
    try {
      const { page, limit, skip } = PaginationUtil.parsePaginationParams(req);
      const { category, subcategory, subCategory, amc, status } = req.query;

      // Build cache key
      const cacheKey = `funds:list:${page}:${limit}:${category || 'all'}:${subcategory || subCategory || 'all'}:${amc || 'all'}`;

      // Check cache
      const cached = await cacheClient.get(cacheKey);
      if (cached) {
        return res.json({
          success: true,
          source: 'cache',
          ...cached,
        });
      }

      // Build query - support both field names
      const query = {};
      const andConditions = [];

      // Category filter (case-insensitive)
      if (category) {
        query.category = new RegExp(`^${category}$`, 'i');
      }

      // Subcategory filter (support both subcategory and subCategory fields, case-insensitive)
      const subCat = subcategory || subCategory;
      if (subCat) {
        andConditions.push({
          $or: [
            { subcategory: new RegExp(`^${subCat}$`, 'i') },
            { subCategory: new RegExp(`^${subCat}$`, 'i') },
          ],
        });
      }

      // AMC filter
      if (amc) {
        query['amc.name'] = new RegExp(amc, 'i');
      }

      // Status filter - Include Active status OR null status (imported funds)
      if (!status) {
        // Default: only active or null status
        andConditions.push({
          $or: [
            { status: 'Active' },
            { status: null },
            { status: { $exists: false } },
          ],
        });
      } else {
        query.status = status;
      }

      // Combine all AND conditions
      if (andConditions.length > 0) {
        query.$and = andConditions;
      }

      // Debug logging
      console.log('📊 Query:', JSON.stringify(query, null, 2));

      // Execute query with pagination
      const [funds, total] = await Promise.all([
        Fund.find(query)
          .select('-__v')
          .skip(skip)
          .limit(limit)
          .sort({ 'returns.oneYear': -1, 'returns.1Y': -1 })
          .lean(),
        Fund.countDocuments(query),
      ]);

      // Transform returns format for frontend compatibility
      const transformedFunds = funds.map(transformFundReturns);

      const response = PaginationUtil.buildResponse(
        transformedFunds,
        page,
        limit,
        total
      );

      // Cache result
      await cacheClient.set(cacheKey, response, 86400); // 24h

      res.json({
        success: true,
        source: 'database',
        ...response,
      });
    } catch (error) {
      console.error('Error fetching funds:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch funds',
        message: error.message,
      });
    }
  }

  /**
   * Get fund by ID (MongoDB ObjectId)
   * GET /api/funds/id/:id
   */
  static async getFundById(req, res) {
    try {
      const { id } = req.params;

      // Validate MongoDB ObjectId
      if (!id.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid fund ID format',
        });
      }

      // Check cache
      const cacheKey = `fund:id:${id}`;
      const cached = await cacheClient.get(cacheKey);
      if (cached) {
        return res.json({
          success: true,
          source: 'cache',
          data: cached,
        });
      }

      // Query database by _id
      const fund = await Fund.findById(id).select('-__v').lean();

      if (!fund) {
        return res.status(404).json({
          success: false,
          error: 'Fund not found',
          message: `No fund found with ID: ${id}`,
        });
      }

      // Cache result
      await cacheClient.set(cacheKey, transformFundReturns(fund), 86400); // 24h

      // Enrich fund data with missing information
      const enrichedFund = FundEnrichmentService.enrichFundData(fund);

      res.json({
        success: true,
        source: 'database',
        data: transformFundReturns(enrichedFund),
      });
    } catch (error) {
      console.error('Error fetching fund by ID:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch fund',
        message: error.message,
      });
    }
  }

  /**
   * Get fund by scheme code or MongoDB ID
   * GET /api/funds/scheme/:schemeCode OR GET /api/funds/:schemeCode
   *
   * ENHANCED:
   * - Accepts both schemeCode (e.g., 140539) and MongoDB ObjectId
   * - Fetches from DB first, if not found fetches from API and stores in DB
   */
  static async getFundBySchemeCode(req, res) {
    try {
      const { schemeCode } = req.params;

      // Check if it's a MongoDB ObjectId
      const isMongoId = schemeCode.match(/^[0-9a-fA-F]{24}$/);

      // Check cache
      const cacheKey = isMongoId
        ? `fund:id:${schemeCode}`
        : `fund:scheme:${schemeCode}`;
      const cached = await cacheClient.get(cacheKey);
      if (cached) {
        return res.json({
          success: true,
          source: 'cache',
          data: cached,
        });
      }

      // Query database - by _id if MongoDB ObjectId, otherwise by schemeCode
      let fund;
      if (isMongoId) {
        fund = await Fund.findById(schemeCode).select('-__v').lean();
      } else {
        fund = await Fund.findOne({ schemeCode }).select('-__v').lean();
      }

      // If not found in database, fetch from external API (only for schemeCode, not for _id)
      if (!fund && !isMongoId) {
        console.log(
          `🔍 Fund ${schemeCode} not in database, fetching from API...`
        );

        try {
          // Dynamically import MFAPI service
          const MFAPIService = require('../services/mfapi.service.js');
          const mfapiService = new MFAPIService();

          // Fetch from API
          const apiFundData =
            await mfapiService.fetchFundBySchemeCode(schemeCode);

          if (apiFundData) {
            // Store in database for future requests
            console.log(
              `💾 Storing new fund in database: ${apiFundData.schemeName}`
            );
            fund = await Fund.create(apiFundData);
            fund = fund.toObject();
            delete fund.__v;

            // Cache the newly fetched fund
            await cacheClient.set(cacheKey, transformFundReturns(fund), 86400);

            return res.json({
              success: true,
              source: 'api-realtime',
              message: 'Fund fetched from external API and stored in database',
              data: transformFundReturns(fund),
            });
          }
        } catch (apiError) {
          console.error(`❌ Error fetching from API: ${apiError.message}`);
          // Continue to 404 response below
        }
      }

      // If still not found
      if (!fund) {
        return res.status(404).json({
          success: false,
          error: 'Fund not found',
          message: `No fund found with identifier: ${schemeCode}`,
        });
      }

      // Cache result
      await cacheClient.set(cacheKey, transformFundReturns(fund), 86400);

      // Enrich fund data with missing information
      const enrichedFund = FundEnrichmentService.enrichFundData(fund);

      res.json({
        success: true,
        source: 'database',
        data: transformFundReturns(enrichedFund),
      });
    } catch (error) {
      console.error('Error fetching fund:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch fund',
        message: error.message,
      });
    }
  }

  /**
   * Get funds by category
   * GET /api/funds/category/:category
   */
  static async getFundsByCategory(req, res) {
    try {
      const { category } = req.params;
      const { page, limit, skip } = PaginationUtil.parsePaginationParams(req);

      // Check cache
      const cacheKey = `funds:category:${category}:${page}:${limit}`;
      const cached = await cacheClient.get(cacheKey);
      if (cached) {
        return res.json({
          success: true,
          source: 'cache',
          ...cached,
        });
      }

      // Query database with status filter that includes null
      const statusFilter = {
        $or: [
          { status: 'Active' },
          { status: null },
          { status: { $exists: false } },
        ],
      };
      const [funds, total] = await Promise.all([
        Fund.find({ category, ...statusFilter })
          .select('-__v')
          .skip(skip)
          .limit(limit)
          .sort({ 'returns.oneYear': -1, 'returns.1Y': -1 })
          .lean(),
        Fund.countDocuments({ category, ...statusFilter }),
      ]);

      const transformedFunds = funds.map(transformFundReturns);
      const response = PaginationUtil.buildResponse(
        transformedFunds,
        page,
        limit,
        total
      );

      // Cache result
      await cacheClient.set(cacheKey, response, 86400); // 24h

      res.json({
        success: true,
        source: 'database',
        ...response,
      });
    } catch (error) {
      console.error('Error fetching funds by category:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch funds',
        message: error.message,
      });
    }
  }

  /**
   * Get funds by subcategory
   * GET /api/funds/subcategory/:subcategory
   */
  static async getFundsBySubcategory(req, res) {
    try {
      const { subcategory } = req.params;
      const { page, limit, skip } = PaginationUtil.parsePaginationParams(req);

      // Check cache
      const cached = await cacheClient.getFundsBySubcategory(subcategory);
      if (cached && !req.query.page) {
        return res.json({
          success: true,
          source: 'cache',
          data: cached,
        });
      }

      // Query database
      const query = { subCategory: subcategory };
      // Only filter by Active status if status field exists
      const statusFilter = {
        $or: [
          { status: 'Active' },
          { status: null },
          { status: { $exists: false } },
        ],
      };

      const [funds, total] = await Promise.all([
        Fund.find({ ...query, ...statusFilter })
          .select('-__v')
          .skip(skip)
          .limit(limit)
          .sort({ 'returns.oneYear': -1, 'returns.1Y': -1 })
          .lean(),
        Fund.countDocuments({ ...query, ...statusFilter }),
      ]);

      const transformedFunds = funds.map(transformFundReturns);
      const response = PaginationUtil.buildResponse(
        transformedFunds,
        page,
        limit,
        total
      );

      // Cache result
      await cacheClient.cacheFundsBySubcategory(subcategory, response);

      res.json({
        success: true,
        source: 'database',
        ...response,
      });
    } catch (error) {
      console.error('Error fetching funds by subcategory:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch funds',
        message: error.message,
      });
    }
  }

  /**
   * Search funds
   * GET /api/funds/search?q=hdfc
   */
  static async searchFunds(req, res) {
    try {
      const { q: searchQuery } = req.query;
      const { page, limit, skip } = PaginationUtil.parsePaginationParams(req);

      if (!searchQuery || searchQuery.trim().length < 2) {
        return res.status(400).json({
          success: false,
          error: 'Invalid search query',
          message: 'Search query must be at least 2 characters',
        });
      }

      // Check cache
      const cacheKey = `funds:search:${searchQuery}:${page}:${limit}`;
      const cached = await cacheClient.get(cacheKey);
      if (cached) {
        return res.json({
          success: true,
          source: 'cache',
          ...cached,
        });
      }

      // Text search
      const [funds, total] = await Promise.all([
        Fund.find(
          {
            $text: { $search: searchQuery },
            status: 'Active',
          },
          { score: { $meta: 'textScore' } }
        )
          .select('-__v')
          .sort({ score: { $meta: 'textScore' } })
          .skip(skip)
          .limit(limit)
          .lean(),
        Fund.countDocuments({
          $text: { $search: searchQuery },
          status: 'Active',
        }),
      ]);

      const transformedFunds = funds.map(transformFundReturns);
      const response = PaginationUtil.buildResponse(
        transformedFunds,
        page,
        limit,
        total
      );

      // Cache result
      await cacheClient.set(cacheKey, response, 21600); // 6h

      res.json({
        success: true,
        source: 'database',
        query: searchQuery,
        ...response,
      });
    } catch (error) {
      console.error('Error searching funds:', error);
      res.status(500).json({
        success: false,
        error: 'Search failed',
        message: error.message,
      });
    }
  }

  /**
   * Get fund NAV history
   * GET /api/funds/:schemeCode/nav?days=365
   */
  static async getFundNavHistory(req, res) {
    try {
      const { schemeCode } = req.params;
      const days = parseInt(req.query.days) || 365;

      // Check cache
      const cacheKey = `fund:nav:history:${schemeCode}:${days}`;
      const cached = await cacheClient.get(cacheKey);
      if (cached) {
        return res.json({
          success: true,
          source: 'cache',
          data: cached,
        });
      }

      // Get NAV history
      const navHistory = await FundNav.getNavHistory(schemeCode, days);

      if (!navHistory || navHistory.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'NAV history not found',
          message: `No NAV history found for scheme code: ${schemeCode}`,
        });
      }

      // Cache result
      await cacheClient.set(cacheKey, navHistory, 43200); // 12h

      res.json({
        success: true,
        source: 'database',
        data: navHistory,
        meta: {
          schemeCode,
          days,
          count: navHistory.length,
        },
      });
    } catch (error) {
      console.error('Error fetching NAV history:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch NAV history',
        message: error.message,
      });
    }
  }

  /**
   * Get fund holdings
   * GET /api/funds/:schemeCode/holdings
   */
  static async getFundHoldings(req, res) {
    try {
      const { schemeCode } = req.params;

      // Check cache
      const cached = await cacheClient.getFundHoldings(schemeCode);
      if (cached) {
        return res.json({
          success: true,
          source: 'cache',
          data: cached,
        });
      }

      // Get latest holdings
      const holdings = await FundHolding.getLatestHoldings(schemeCode);

      if (!holdings) {
        return res.status(404).json({
          success: false,
          error: 'Holdings not found',
          message: `No holdings found for scheme code: ${schemeCode}`,
        });
      }

      // Cache result
      await cacheClient.cacheFundHoldings(schemeCode, holdings);

      res.json({
        success: true,
        source: 'database',
        data: holdings,
      });
    } catch (error) {
      console.error('Error fetching holdings:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch holdings',
        message: error.message,
      });
    }
  }

  /**
   * Get top performing funds
   * GET /api/funds/top-performers?period=1Y&category=Equity&limit=10
   */
  static async getTopPerformers(req, res) {
    try {
      const { period = '1Y', category, limit = 10 } = req.query;

      // Check cache
      const cacheKey = `funds:top:${period}:${category || 'all'}:${limit}`;
      const cached = await cacheClient.get(cacheKey);
      if (cached) {
        return res.json({
          success: true,
          source: 'cache',
          data: cached,
        });
      }

      // Build query
      const query = {
        status: 'Active',
        [`returns.${period}`]: { $exists: true, $ne: null },
      };
      if (category) query.category = category;

      // Get top performers
      const funds = await Fund.find(query)
        .select('schemeCode schemeName amc category returns nav')
        .sort({ [`returns.${period}`]: -1 })
        .limit(parseInt(limit))
        .lean();

      const transformedFunds = funds.map(transformFundReturns);

      // Cache result
      await cacheClient.set(cacheKey, transformedFunds, 86400); // 24h

      res.json({
        success: true,
        source: 'database',
        data: transformedFunds,
        meta: {
          period,
          category: category || 'all',
          count: transformedFunds.length,
        },
      });
    } catch (error) {
      console.error('Error fetching top performers:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch top performers',
        message: error.message,
      });
    }
  }

  /**
   * Get fund categories
   * GET /api/funds/categories
   */
  static async getCategories(req, res) {
    try {
      // Check cache
      const cacheKey = 'funds:categories';
      const cached = await cacheClient.get(cacheKey);
      if (cached) {
        return res.json({
          success: true,
          source: 'cache',
          data: cached,
        });
      }

      // Get categories with counts
      const categories = await Fund.aggregate([
        { $match: { status: 'Active' } },
        {
          $group: {
            _id: '$category',
            count: { $sum: 1 },
            subcategories: { $addToSet: '$subCategory' },
          },
        },
        {
          $project: {
            category: '$_id',
            count: 1,
            subcategories: 1,
            _id: 0,
          },
        },
        { $sort: { category: 1 } },
      ]);

      // Cache result
      await cacheClient.set(cacheKey, categories, 86400); // 24h

      res.json({
        success: true,
        source: 'database',
        data: categories,
      });
    } catch (error) {
      console.error('Error fetching categories:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch categories',
        message: error.message,
      });
    }
  }

  /**
   * 🔥 SMART SEARCH - Search with fallback to external API
   * GET /api/funds/smart-search?q=hdfc&schemeCode=119551
   *
   * Flow:
   * 1. Search in local MongoDB database
   * 2. If not found, fetch from MFAPI.in in real-time
   * 3. Save fetched fund to MongoDB for future
   * 4. Return fund data with source indicator
   */
  static async smartSearch(req, res) {
    try {
      const { q: searchQuery, schemeCode } = req.query;

      // Validate input
      if (!searchQuery && !schemeCode) {
        return res.status(400).json({
          success: false,
          error: 'Missing search parameter',
          message: 'Provide either "q" (search query) or "schemeCode"',
        });
      }

      // Step 1: Search in local database
      console.log(
        `🔍 Smart search initiated: query="${searchQuery}", code="${schemeCode}"`
      );

      let fund = null;

      if (schemeCode) {
        // Direct scheme code search
        fund = await Fund.findOne({
          schemeCode: schemeCode.toString(),
          status: 'Active',
        }).lean();

        if (fund) {
          console.log(`✅ Found in database: ${fund.schemeName}`);
          return res.json({
            success: true,
            source: 'database',
            cached: true,
            data: fund,
          });
        }

        console.log(`❌ Scheme code ${schemeCode} not found in database`);

        // Step 2: Fetch from external API (MFAPI)
        const mfapiService = require('../services/mfapi.service');

        try {
          console.log(`🌐 Fetching from MFAPI: ${schemeCode}`);
          const apiFund = await mfapiService.fetchFundBySchemeCode(schemeCode);

          if (!apiFund) {
            return res.status(404).json({
              success: false,
              error: 'Fund not found',
              message: `No fund found with scheme code: ${schemeCode}`,
              searchedIn: ['database', 'mfapi'],
            });
          }

          // Step 3: Save to MongoDB
          console.log(`💾 Saving new fund to database: ${apiFund.schemeName}`);
          fund = await Fund.create(apiFund);

          // Invalidate relevant caches
          await cacheClient.del('funds:list:*');

          console.log(
            `✅ Fund saved and returned from API: ${fund.schemeName}`
          );

          return res.json({
            success: true,
            source: 'live-api',
            cached: false,
            provider: 'MFAPI',
            data: fund,
            message: 'Fund fetched from external API and saved to database',
          });
        } catch (apiError) {
          console.error('MFAPI fetch failed:', apiError.message);

          return res.status(503).json({
            success: false,
            error: 'External API unavailable',
            message: 'Could not fetch fund from external source',
            details: apiError.message,
          });
        }
      } else if (searchQuery) {
        // Use dynamic search service - NEVER shows "not found"
        console.log(`🔍 Dynamic search for: "${searchQuery}"`);

        const funds = await DynamicFundSearchService.searchFunds(searchQuery, {
          category: category || null,
          limit: 100,
        });

        console.log(`✅ Found ${funds.length} funds for "${searchQuery}"`);

        // Transform returns format
        const transformedFunds = funds.map(transformFundReturns);

        return res.json({
          success: true,
          source: funds[0]?.source || 'database',
          query: searchQuery,
          data: transformedFunds,
          count: transformedFunds.length,
          message:
            funds[0]?.source === 'AMFI'
              ? 'Fetched from external API and saved to database'
              : 'Retrieved from database',
        });
      }
    } catch (error) {
      console.error('Smart search error:', error);
      res.status(500).json({
        success: false,
        error: 'Search failed',
        message: error.message,
      });
    }
  }

  /**
   * 🔄 BATCH IMPORT - Import multiple funds from external API
   * POST /api/funds/batch-import
   * Body: { schemeCodes: ["119551", "119552", "119553"] }
   */
  static async batchImport(req, res) {
    try {
      const { schemeCodes } = req.body;

      if (!Array.isArray(schemeCodes) || schemeCodes.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Invalid input',
          message: 'Provide an array of scheme codes',
        });
      }

      if (schemeCodes.length > 100) {
        return res.status(400).json({
          success: false,
          error: 'Too many codes',
          message: 'Maximum 100 scheme codes per request',
        });
      }

      console.log(`📦 Batch import initiated for ${schemeCodes.length} funds`);

      const mfapiService = require('../services/mfapi.service');
      const results = {
        total: schemeCodes.length,
        successful: 0,
        failed: 0,
        skipped: 0,
        funds: [],
        errors: [],
      };

      for (const schemeCode of schemeCodes) {
        try {
          // Check if already exists
          const existing = await Fund.findOne({ schemeCode });
          if (existing) {
            console.log(`⏭️  Skipping existing fund: ${schemeCode}`);
            results.skipped++;
            continue;
          }

          // Fetch from API
          const apiFund = await mfapiService.fetchFundBySchemeCode(schemeCode);

          if (!apiFund) {
            results.failed++;
            results.errors.push({
              schemeCode,
              error: 'Not found in MFAPI',
            });
            continue;
          }

          // Save to database
          const savedFund = await Fund.create(apiFund);
          results.successful++;
          results.funds.push({
            schemeCode: savedFund.schemeCode,
            name: savedFund.schemeName,
          });

          console.log(`✅ Imported: ${savedFund.schemeName}`);
        } catch (error) {
          results.failed++;
          results.errors.push({
            schemeCode,
            error: error.message,
          });
          console.error(`❌ Failed to import ${schemeCode}:`, error.message);
        }
      }

      // Invalidate caches
      await cacheClient.del('funds:list:*');

      console.log(
        `📦 Batch import complete: ${results.successful} successful, ${results.failed} failed, ${results.skipped} skipped`
      );

      res.json({
        success: true,
        message: 'Batch import completed',
        results,
      });
    } catch (error) {
      console.error('Batch import error:', error);
      res.status(500).json({
        success: false,
        error: 'Batch import failed',
        message: error.message,
      });
    }
  }
  /**
   * Get ALL funds without pagination (for category pages)
   * GET /api/funds/all?category=equity&subcategory=largecap
   * Returns ALL funds matching criteria - no limits
   */
  static async getAllFundsNoPagination(req, res) {
    try {
      const { category, subcategory, subCategory } = req.query;

      console.log(
        `📊 Fetching ALL funds for ${category}/${subcategory || subCategory || 'all'}`
      );

      // Use dynamic search service to get all funds
      const funds = await DynamicFundSearchService.getAllFundsByCategory(
        category,
        subcategory || subCategory
      );

      // Transform returns format
      const transformedFunds = funds.map(transformFundReturns);

      console.log(`✅ Returning ${transformedFunds.length} funds (NO LIMIT)`);

      res.json({
        success: true,
        source: 'database',
        data: transformedFunds,
        count: transformedFunds.length,
        message: `Found ${transformedFunds.length} funds`,
        pagination: false,
      });
    } catch (error) {
      console.error('Error fetching all funds:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch funds',
        message: error.message,
      });
    }
  }

  /**
   * Get unified fund universe for comparison and overlap pages
   * GET /api/funds/universe?category=all&amc=all&limit=5000
   *
   * This is the SINGLE SOURCE OF TRUTH for fund selection
   * Used by: Compare page, Overlap page, Fund selector component
   *
   * Returns lightweight fund data with required fields:
   * - schemeCode, name, category, subCategory, amc, aum, nav, expenseRatio, riskLevel
   */
  static async getFundUniverse(req, res) {
    try {
      const { category, amc, search, limit = 5000 } = req.query;

      // Cache key for fund universe
      const cacheKey = `funds:universe:${category || 'all'}:${amc || 'all'}:${limit}`;

      // Check cache (12 hour TTL - fund universe rarely changes)
      const cached = await cacheClient.get(cacheKey);
      if (cached) {
        console.log('📦 Fund universe served from cache');
        return res.json({
          success: true,
          source: 'cache',
          ...cached,
        });
      }

      console.log('🌐 Building fund universe...');

      // Build query for active funds only
      const query = {
        $or: [
          { status: 'Active' },
          { status: null },
          { status: { $exists: false } },
        ],
      };

      // Category filter (case-insensitive)
      if (category && category !== 'all') {
        query.category = new RegExp(`^${category}$`, 'i');
      }

      // AMC filter
      if (amc && amc !== 'all') {
        query['amc.name'] = new RegExp(amc, 'i');
      }

      // Fetch funds with optimized projection (lightweight)
      const funds = await Fund.find(query)
        .select({
          schemeCode: 1,
          schemeName: 1,
          name: 1,
          category: 1,
          subCategory: 1,
          subcategory: 1,
          'amc.name': 1,
          aum: 1,
          currentNav: 1,
          nav: 1,
          expenseRatio: 1,
          riskLevel: 1,
          benchmark: 1,
          returns: 1,
          rating: 1,
        })
        .sort({ 'returns.oneYear': -1, 'returns.1Y': -1, aum: -1 })
        .limit(parseInt(limit))
        .lean();

      // Transform to unified format for frontend
      const universe = funds.map((fund, index) => ({
        id: fund.schemeCode || fund._id?.toString() || `fund-${index}`,
        schemeCode: fund.schemeCode,
        name: fund.schemeName || fund.name || 'Unnamed Fund',
        fundHouse: fund.amc?.name || 'Unknown AMC',
        category: fund.category || 'Other',
        subCategory: fund.subCategory || fund.subcategory || '',
        nav:
          typeof fund.currentNav === 'object'
            ? fund.currentNav?.value || 0
            : fund.currentNav || fund.nav?.value || fund.nav || 0,
        aum:
          typeof fund.aum === 'object' ? fund.aum?.value || 0 : fund.aum || 0,
        expenseRatio:
          typeof fund.expenseRatio === 'object'
            ? fund.expenseRatio?.value || 0
            : fund.expenseRatio || 0,
        riskLevel: fund.riskLevel || 'Moderate',
        benchmark: fund.benchmark || fund.category || 'N/A',
        returns1Y: fund.returns?.['1Y'] || fund.returns?.oneYear || 0,
        returns3Y: fund.returns?.['3Y'] || fund.returns?.threeYear || 0,
        returns5Y: fund.returns?.['5Y'] || fund.returns?.fiveYear || 0,
        rating: fund.rating || 0,
      }));

      // Filter out any funds missing critical fields
      const validUniverse = universe.filter(
        (fund) => fund.schemeCode && fund.name && fund.name !== 'Unnamed Fund'
      );

      console.log(
        `✅ Fund universe: ${validUniverse.length} valid funds out of ${funds.length} total`
      );

      const response = {
        data: validUniverse,
        count: validUniverse.length,
        totalInDb: funds.length,
        message: `Fund universe with ${validUniverse.length} funds`,
        pagination: false,
      };

      // Cache for 12 hours (fund universe rarely changes)
      await cacheClient.set(cacheKey, response, 43200);

      res.json({
        success: true,
        source: 'database',
        ...response,
      });
    } catch (error) {
      console.error('Error fetching fund universe:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch fund universe',
        message: error.message,
      });
    }
  }
}

module.exports = FundController;
