/**
 * Search Routes - MongoDB-first search with API fallback
 * Implements mobile-first search with live suggestions
 */

const express = require('express');
const router = express.Router();
const Fund = require('../models/Fund.model');
const axios = require('axios');

/**
 * @route   GET /api/search/funds
 * @desc    Search mutual funds with MongoDB-first approach
 * @query   q - search query
 * @query   limit - max results (default: 8 for mobile)
 * @access  Public
 */
router.get('/funds', async (req, res) => {
  try {
    const { q, limit = 8 } = req.query;

    if (!q || q.trim().length < 2) {
      return res.json({
        success: true,
        data: [],
        message: 'Query too short',
      });
    }

    const searchQuery = q.trim();
    const limitNum = parseInt(limit);

    // STEP 1: Search in MongoDB first using text index
    let funds = await Fund.find(
      {
        $or: [
          { schemeName: { $regex: searchQuery, $options: 'i' } },
          { name: { $regex: searchQuery, $options: 'i' } },
          { 'amc.name': { $regex: searchQuery, $options: 'i' } },
          { category: { $regex: searchQuery, $options: 'i' } },
          { subCategory: { $regex: searchQuery, $options: 'i' } },
        ],
      },
      {
        schemeCode: 1,
        schemeName: 1,
        name: 1,
        category: 1,
        subCategory: 1,
        'amc.name': 1,
        'nav.value': 1,
        returns: 1,
        riskLevel: 1,
      }
    )
      .sort({ 'aum.value': -1 }) // Sort by AUM - larger funds first
      .limit(limitNum)
      .lean();

    // Normalize fund data
    funds = funds.map((fund) => ({
      _id: fund._id,
      schemeCode: fund.schemeCode || fund._id,
      schemeName: fund.schemeName || fund.name || 'Unknown Fund',
      category: fund.category,
      subcategory: fund.subCategory,
      amc: fund.amc?.name,
      nav: fund.nav?.value,
      returns: fund.returns,
      riskLevel: fund.riskLevel,
    }));

    // If we found enough results, return them
    if (funds.length >= limitNum / 2) {
      return res.json({
        success: true,
        data: funds,
        source: 'database',
        count: funds.length,
      });
    }

    // STEP 2: If not enough results, fetch from external API
    console.log(
      `⚠️ Only ${funds.length} results found in DB, fetching from API...`
    );

    try {
      // Fetch from RapidAPI MF API
      const rapidApiKey = process.env.RAPIDAPI_KEY;
      if (!rapidApiKey) {
        console.warn('RapidAPI key not configured, returning DB results only');
        return res.json({
          success: true,
          data: funds,
          source: 'database',
          count: funds.length,
        });
      }

      const apiResponse = await axios.get(
        'https://latest-mutual-fund-nav.p.rapidapi.com/fetchAllMutualFund',
        {
          headers: {
            'X-RapidAPI-Key': rapidApiKey,
            'X-RapidAPI-Host': 'latest-mutual-fund-nav.p.rapidapi.com',
          },
          timeout: 5000,
        }
      );

      if (apiResponse.data && Array.isArray(apiResponse.data)) {
        // Filter API results by search query
        const apiResults = apiResponse.data
          .filter(
            (f) =>
              f.schemeName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
              f.fundHouse?.toLowerCase().includes(searchQuery.toLowerCase())
          )
          .slice(0, limitNum - funds.length)
          .map((f) => ({
            schemeCode: f.schemeCode,
            schemeName: f.schemeName,
            category: f.schemeType || 'Other',
            subcategory: f.schemeCategory,
            amc: f.fundHouse,
            nav: parseFloat(f.nav),
            returns: {},
            riskLevel: 'moderate',
          }));

        // STEP 3: Save new funds to database for future searches
        if (apiResults.length > 0) {
          console.log(
            `💾 Saving ${apiResults.length} new funds to database...`
          );

          const bulkOps = apiResults.map((fund) => ({
            updateOne: {
              filter: { schemeCode: fund.schemeCode },
              update: {
                $setOnInsert: {
                  schemeCode: fund.schemeCode,
                  schemeName: fund.schemeName,
                  category: fund.category,
                  subCategory: fund.subcategory,
                  'amc.name': fund.amc,
                  'nav.value': fund.nav,
                  'nav.date': new Date(),
                  returns: fund.returns,
                  riskLevel: fund.riskLevel,
                  createdAt: new Date(),
                },
              },
              upsert: true,
            },
          }));

          await Fund.bulkWrite(bulkOps);
          console.log('✅ New funds saved to database');
        }

        // Combine DB + API results
        const combinedResults = [...funds, ...apiResults].slice(0, limitNum);

        return res.json({
          success: true,
          data: combinedResults,
          source: 'database + api',
          count: combinedResults.length,
        });
      }
    } catch (apiError) {
      console.error('API fallback failed:', apiError.message);
      // Return DB results even if API fails
    }

    // Return whatever we found from DB
    return res.json({
      success: true,
      data: funds,
      source: 'database',
      count: funds.length,
    });
  } catch (error) {
    console.error('❌ Search error:', error);
    res.status(500).json({
      success: false,
      message: 'Search failed',
      error: error.message,
    });
  }
});

/**
 * @route   GET /api/search/suggestions
 * @desc    Get quick suggestions for autocomplete
 * @query   q - search query
 * @access  Public
 */
router.get('/suggestions', async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.trim().length < 2) {
      return res.json({
        success: true,
        data: [],
      });
    }

    const searchQuery = q.trim();

    // Quick aggregation for suggestions
    const suggestions = await Fund.aggregate([
      {
        $match: {
          $or: [
            { schemeName: { $regex: searchQuery, $options: 'i' } },
            { name: { $regex: searchQuery, $options: 'i' } },
            { 'amc.name': { $regex: searchQuery, $options: 'i' } },
          ],
        },
      },
      {
        $limit: 5,
      },
      {
        $project: {
          text: { $ifNull: ['$schemeName', '$name'] },
          category: 1,
        },
      },
    ]);

    res.json({
      success: true,
      data: suggestions.map((s) => s.text),
    });
  } catch (error) {
    console.error('❌ Suggestions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get suggestions',
    });
  }
});

/**
 * @route   GET /api/search/popular
 * @desc    Get popular/trending search terms
 * @access  Public
 */
router.get('/popular', async (req, res) => {
  try {
    // Get top AMCs by fund count
    const popularAMCs = await Fund.aggregate([
      {
        $group: {
          _id: '$amc.name',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 8 },
      {
        $project: {
          term: '$_id',
          _id: 0,
        },
      },
    ]);

    res.json({
      success: true,
      data: popularAMCs.map((p) => p.term).filter(Boolean),
    });
  } catch (error) {
    console.error('❌ Popular search error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get popular searches',
    });
  }
});

module.exports = router;
