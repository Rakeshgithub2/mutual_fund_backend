import { Router, Request, Response } from 'express';
import { mongodb } from '../db/mongodb';
import { redis } from '../cache/redis';
import { SearchService } from '../services/search.service';

/**
 * Search Routes
 *
 * Endpoints:
 * - GET /api/search/suggest - Autocomplete suggestions (debounced)
 * - GET /api/search/funds - Full-text fuzzy search
 * - GET /api/search/by-tags - Tag-based search
 *
 * Features:
 * - Multi-layered search (exact, prefix, fuzzy, intent-based)
 * - Levenshtein distance for fuzzy matching (1-2 edits)
 * - N-gram tokenization for partial matching
 * - Boosting by AUM, popularity, recency
 * - Intent detection for tag-based search
 * - Server-side debouncing (300ms)
 * - Throttling for rate limiting
 * - Redis caching for performance
 */

const router = Router();

// Debounce map for search requests
const debounceMap = new Map<string, NodeJS.Timeout>();
const DEBOUNCE_DELAY = 300; // ms

// Throttle map for rate limiting
const throttleMap = new Map<string, number>();
const THROTTLE_WINDOW = 1000; // 1 second
const THROTTLE_MAX_REQUESTS = 10; // max 10 requests per second

/**
 * Throttle middleware
 */
function throttle(req: Request, res: Response, next: Function) {
  const key = req.ip || 'unknown';
  const now = Date.now();
  const requests = throttleMap.get(key) || 0;

  // Clean old entries
  if (now % 10000 === 0) {
    throttleMap.clear();
  }

  if (requests >= THROTTLE_MAX_REQUESTS) {
    return res.status(429).json({
      success: false,
      message: 'Too many requests. Please slow down.',
    });
  }

  throttleMap.set(key, requests + 1);
  setTimeout(() => {
    const current = throttleMap.get(key) || 0;
    throttleMap.set(key, Math.max(0, current - 1));
  }, THROTTLE_WINDOW);

  next();
}

// ==================== AUTOCOMPLETE SUGGESTIONS (DEBOUNCED) ====================
/**
 * GET /api/search/suggest
 *
 * Query params:
 * - q: Search query (2+ characters)
 * - limit: Max suggestions (default: 10, max: 20)
 *
 * Features:
 * - Server-side debouncing (300ms)
 * - N-gram tokenization
 * - Prefix matching
 * - Boosting by popularity
 */
router.get('/suggest', throttle, async (req: Request, res: Response) => {
  try {
    const { q, limit = '10' } = req.query;

    if (!q || typeof q !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Query parameter "q" is required',
      });
    }

    const query = q.trim();
    if (query.length < 2) {
      return res.json({
        success: true,
        data: {
          query,
          suggestions: [],
          count: 0,
        },
      });
    }

    const limitNum = Math.min(20, Math.max(1, parseInt(limit as string)));

    // Server-side debouncing
    const debounceKey = `${req.ip}-${query}`;
    const existingTimeout = debounceMap.get(debounceKey);

    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Wait for debounce delay
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        debounceMap.delete(debounceKey);
        resolve();
      }, DEBOUNCE_DELAY);
      debounceMap.set(debounceKey, timeout);
    });

    // Check cache
    const cached = await redis.getSuggestions(query);
    if (cached) {
      return res.json({
        success: true,
        data: cached,
        cached: true,
      });
    }

    const db = mongodb.getDb();
    const searchService = new SearchService(db);

    // Get suggestions using enhanced autocomplete
    const suggestions = await searchService.suggest(query, limitNum);

    const response = {
      query,
      suggestions: suggestions.map((s) => ({
        fundId: s.fundId,
        name: s.name,
        fundHouse: s.fundHouse,
        category: s.category,
        subCategory: s.subCategory,
        fundType: s.fundType,
        currentNav: s.currentNav,
        shortDescription: `${s.fundHouse} | ${s.category}`,
        similarityScore: Math.round(s.score * 100) / 100,
        confidence: s.confidence
          ? Math.round(s.confidence * 100) / 100
          : undefined,
        highlightedName: s.highlightedName,
        matchedTokens: s.matchedTokens,
      })),
      count: suggestions.length,
    };

    // Cache for 1 hour
    await redis.cacheSuggestions(query, response);

    res.json({
      success: true,
      data: response,
      cached: false,
    });
  } catch (error: any) {
    console.error('Error in suggest endpoint:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get suggestions',
      error: error.message,
    });
  }
});

// ==================== FULL-TEXT SEARCH WITH FUZZY MATCHING ====================
/**
 * GET /api/search/funds
 *
 * Query params:
 * - q: Search query (required, 2+ characters)
 * - category: Filter by category (equity|debt|hybrid|commodity|etf)
 * - minAum: Minimum AUM filter
 * - fuzzy: Enable fuzzy matching (default: true)
 * - boost: Enable boosting by AUM/popularity (default: true)
 * - limit: Max results (default: 20, max: 15000)
 *
 * Features:
 * - Multi-layered search (exact → prefix → fuzzy → tag-based)
 * - Levenshtein distance (1-2 edits)
 * - Intent detection (gold, equity, debt, etc.)
 * - Boosting by AUM and popularity
 * - Deduplication with score preservation
 */
router.get('/funds', throttle, async (req: Request, res: Response) => {
  try {
    const {
      q,
      category,
      minAum,
      fuzzy = 'true',
      boost = 'true',
      limit = '20',
    } = req.query;

    if (!q || typeof q !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Query parameter "q" is required',
      });
    }

    const query = q.trim();
    if (query.length < 2) {
      return res.json({
        success: true,
        data: {
          query,
          results: [],
          count: 0,
          layers: [],
        },
      });
    }

    const limitNum = Math.min(15000, Math.max(1, parseInt(limit as string)));
    const enableFuzzy = fuzzy === 'true';
    const enableBoost = boost === 'true';
    const minAumNum = minAum ? parseFloat(minAum as string) : undefined;

    // Check cache
    const cacheKey = `search:funds:${query}:${category}:${minAum}:${fuzzy}:${boost}:${limitNum}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        data: cached,
        cached: true,
      });
    }

    const db = mongodb.getDb();
    const searchService = new SearchService(db);

    // Perform multi-layered search
    const results = await searchService.search(query, {
      limit: limitNum,
      category: category as string,
      minAum: minAumNum,
      enableFuzzy,
      boostPopular: enableBoost,
    });

    // Group by match type for analytics
    const layerStats = results.reduce(
      (acc, r) => {
        acc[r.matchType] = (acc[r.matchType] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const response = {
      query,
      category: category || null,
      minAum: minAumNum || null,
      fuzzy: enableFuzzy,
      boost: enableBoost,
      results: results.map((r) => ({
        fundId: r.fundId,
        name: r.name,
        fundHouse: r.fundHouse,
        category: r.category,
        subCategory: r.subCategory,
        fundType: r.fundType,
        currentNav: r.currentNav,
        aum: r.aum,
        tags: r.tags,
        score: Math.round(r.score * 100) / 100,
        matchType: r.matchType,
        shortDescription: `${r.fundHouse} | ${r.category} | ${r.subCategory}`,
        similarityScore: Math.round(r.score * 100) / 100,
      })),
      count: results.length,
      layers: Object.entries(layerStats).map(([type, count]) => ({
        type,
        count,
      })),
    };

    // Cache for 30 minutes
    await redis.set(cacheKey, response, 30 * 60);

    res.json({
      success: true,
      data: response,
      cached: false,
    });
  } catch (error: any) {
    console.error('Error in search endpoint:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search funds',
      error: error.message,
    });
  }
});

// ==================== SEARCH BY TAGS ====================
/**
 * GET /api/search/by-tags
 *
 * Query params:
 * - tags: Comma-separated tags
 * - limit: Max results (default: 20)
 */
router.get('/by-tags', throttle, async (req: Request, res: Response) => {
  try {
    const { tags, limit = '20' } = req.query;

    if (!tags || typeof tags !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Query parameter "tags" is required',
      });
    }

    const tagList = tags
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t);
    const limitNum = Math.min(15000, Math.max(1, parseInt(limit as string)));

    const db = mongodb.getDb();
    const results = await db
      .collection('funds')
      .find({
        tags: { $in: tagList },
        isActive: true,
      })
      .sort({ _id: -1 }) // Use _id to prevent 32MB error
      .limit(limitNum)
      .project({
        fundId: 1,
        name: 1,
        fundHouse: 1,
        category: 1,
        subCategory: 1,
        currentNav: 1,
        returns: 1,
        tags: 1,
        _id: 0,
      })
      .toArray();

    res.json({
      success: true,
      data: {
        tags: tagList,
        results,
        count: results.length,
      },
    });
  } catch (error: any) {
    console.error('Error in tag search:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search by tags',
      error: error.message,
    });
  }
});

export default router;
