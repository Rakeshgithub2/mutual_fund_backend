/**
 * UPDATED Search Routes with Text Index + Oracle Fallback
 *
 * CRITICAL FIX #2: Replace $regex with $text search
 * CRITICAL FIX #3: Add force-dynamic export for Vercel
 */

import { Request, Response } from 'express';
import { getDb } from '../lib/mongodb-serverless';
import { oracleFallbackService } from '../services/oracle-mfapi-fallback.service';
import {
  addToMissingFundsQueue,
  getQueueStats,
} from '../services/queue.service';

/**
 * @route   GET /api/search/funds
 * @desc    Search funds with text index + real-time fallback
 * @query   q - search query
 * @query   limit - max results (default: 20)
 */
export async function searchFunds(req: Request, res: Response): Promise<void> {
  try {
    const { q, limit = 20, category, minNav } = req.query;

    if (!q || (q as string).trim().length < 2) {
      res.json({
        success: true,
        data: [],
        message: 'Query too short (min 2 characters)',
      });
      return;
    }

    const searchQuery = (q as string).trim();
    const limitNum = Math.min(parseInt(limit as string) || 20, 100);

    const db = await getDb();
    const collection = db.collection('fund_master');

    // Build filter
    const filter: any = {};

    if (category) {
      filter.category = category;
    }

    if (minNav) {
      filter['nav.value'] = { $gte: parseFloat(minNav as string) };
    }

    // CRITICAL FIX: Use text search instead of regex
    let funds = await collection
      .find(
        {
          ...filter,
          $text: { $search: searchQuery },
        },
        {
          projection: {
            schemeCode: 1,
            schemeName: 1,
            name: 1,
            category: 1,
            subCategory: 1,
            amc: 1,
            'nav.value': 1,
            'nav.date': 1,
            returns: 1,
            riskLevel: 1,
            'aum.value': 1,
            score: { $meta: 'textScore' }, // Text search relevance score
          },
        }
      )
      .sort({ score: { $meta: 'textScore' }, 'aum.value': -1 })
      .limit(limitNum)
      .toArray();

    console.log(`📊 Found ${funds.length} funds in database`);

    // If we have good results from DB, return them
    if (funds.length >= Math.min(5, limitNum)) {
      res.json({
        success: true,
        data: funds,
        source: 'database',
        count: funds.length,
      });
      return;
    }

    // FALLBACK: Search real-time from Oracle VM / MFAPI
    console.log(
      `⚡ DB results insufficient (${funds.length}), querying Oracle/MFAPI...`
    );

    try {
      const realtimeResults =
        await oracleFallbackService.searchFundRealtime(searchQuery);

      if (realtimeResults.length > 0) {
        // Combine DB + real-time results
        const combined = [
          ...funds,
          ...realtimeResults.slice(0, limitNum - funds.length),
        ];

        res.json({
          success: true,
          data: combined,
          source: 'database + realtime',
          count: combined.length,
          realtimeCount: realtimeResults.length,
        });
        return;
      }
    } catch (fallbackError: any) {
      console.error('Real-time fallback failed:', fallbackError.message);
      // Continue with DB results
    }

    // If still not enough results, add to queue for Oracle VM worker
    if (funds.length < Math.min(3, limitNum)) {
      console.log(`📝 Adding "${searchQuery}" to missing funds queue...`);
      await addToMissingFundsQueue(searchQuery);
    }

    // Return whatever we found
    res.json({
      success: true,
      data: funds,
      source: 'database',
      count: funds.length,
      message:
        funds.length === 0
          ? 'Fund not found. We will fetch it and it will be available shortly.'
          : undefined,
    });
  } catch (error: any) {
    // If text index doesn't exist, fall back to regex (temporary)
    if (error.code === 27) {
      console.warn('⚠️ Text index not found! Run: npm run create-indexes');
      return searchFundsRegex(req, res);
    }

    console.error('❌ Search error:', error);
    res.status(500).json({
      success: false,
      message: 'Search failed',
      error: error.message,
    });
  }
}

/**
 * Fallback regex search (slow, only if text index doesn't exist)
 */
async function searchFundsRegex(req: Request, res: Response): Promise<void> {
  const { q, limit = 20 } = req.query;
  const searchQuery = (q as string).trim();
  const limitNum = Math.min(parseInt(limit as string) || 20, 100);

  const db = await getDb();
  const collection = db.collection('fund_master');

  const funds = await collection
    .find({
      $or: [
        { schemeName: { $regex: searchQuery, $options: 'i' } },
        { name: { $regex: searchQuery, $options: 'i' } },
        { amc: { $regex: searchQuery, $options: 'i' } },
      ],
    })
    .sort({ 'aum.value': -1 })
    .limit(limitNum)
    .toArray();

  res.json({
    success: true,
    data: funds,
    source: 'database (regex fallback)',
    count: funds.length,
    warning:
      'Using slow regex search. Create text index for better performance.',
  });
}

/**
 * @route   GET /api/search/suggestions
 * @desc    Quick autocomplete suggestions
 */
export async function searchSuggestions(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { q } = req.query;

    if (!q || (q as string).trim().length < 2) {
      res.json({ success: true, data: [] });
      return;
    }

    const searchQuery = (q as string).trim();
    const db = await getDb();
    const collection = db.collection('fund_master');

    // Use text search for suggestions
    const suggestions = await collection
      .find(
        { $text: { $search: searchQuery } },
        {
          projection: {
            schemeName: 1,
            category: 1,
            amc: 1,
          },
        }
      )
      .sort({ score: { $meta: 'textScore' } })
      .limit(8)
      .toArray();

    res.json({
      success: true,
      data: suggestions.map((s) => ({
        text: s.schemeName,
        category: s.category,
        amc: s.amc,
      })),
    });
  } catch (error: any) {
    console.error('Suggestions error:', error);
    res.json({ success: true, data: [] });
  }
}

/**
 * @route   GET /api/funds/:schemeCode
 * @desc    Get fund by scheme code with real-time fallback
 */
export async function getFundBySchemeCode(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { schemeCode } = req.params;

    const db = await getDb();
    const collection = db.collection('fund_master');

    // Try to find in database first
    let fund = await collection.findOne({ schemeCode });

    if (fund) {
      res.json({
        success: true,
        data: fund,
        source: 'database',
      });
      return;
    }

    // Not in DB? Fetch from Oracle/MFAPI in real-time
    console.log(`⚡ Scheme ${schemeCode} not in DB, fetching real-time...`);

    const realtimeFund =
      await oracleFallbackService.fetchBySchemeCode(schemeCode);

    if (realtimeFund) {
      res.json({
        success: true,
        data: realtimeFund,
        source: 'realtime',
        message: 'Fund fetched from external API and saved to database',
      });
      return;
    }

    res.status(404).json({
      success: false,
      message: `Fund with scheme code ${schemeCode} not found`,
    });
  } catch (error: any) {
    console.error('Error fetching fund:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch fund',
      error: error.message,
    });
  }
}

/**
 * @route   GET /api/search/health
 * @desc    Check data source health
 */
export async function checkDataSourceHealth(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const health = await oracleFallbackService.healthCheck();

    const db = await getDb();
    const collection = db.collection('fund_master');
    const dbCount = await collection.countDocuments();

    // Get queue stats
    const queueStats = await getQueueStats();

    res.json({
      success: true,
      database: {
        connected: true,
        fundCount: dbCount,
      },
      dataSources: health,
      ingestionQueue: queueStats,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}
