/**
 * ═══════════════════════════════════════════════════════════════════════
 * MARKET INDICES API ROUTES
 * ═══════════════════════════════════════════════════════════════════════
 */

const express = require('express');
const router = express.Router();
const MarketIndices = require('../models/MarketIndices.model');

/**
 * GET /api/indices
 * Get all market indices
 */
router.get('/', async (req, res) => {
  try {
    const indices = await MarketIndices.find().lean();

    // Define custom order (most important indices first for Indian market)
    const indexOrder = [
      'nifty50',
      'sensex',
      'banknifty',
      'midcap100',
      'commodity',
      'smallcap250',
      'niftyit',
      'niftypharma',
      'niftyauto',
      'niftymetal',
      'niftyfmcg',
      'giftnifty',
    ];

    // Sort indices by custom order
    const sortedIndices = indices.sort((a, b) => {
      const indexA = indexOrder.indexOf(a.name.toLowerCase());
      const indexB = indexOrder.indexOf(b.name.toLowerCase());

      // If both are in the order array, sort by their position
      if (indexA !== -1 && indexB !== -1) {
        return indexA - indexB;
      }
      // If only A is in the order array, it comes first
      if (indexA !== -1) return -1;
      // If only B is in the order array, it comes first
      if (indexB !== -1) return 1;
      // If neither is in the order array, sort alphabetically
      return a.name.localeCompare(b.name);
    });

    res.json({
      success: true,
      count: sortedIndices.length,
      data: sortedIndices,
      updated_at: sortedIndices[0]?.updated_at || null,
    });
  } catch (error) {
    console.error('Error fetching indices:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch market indices',
      error: error.message,
    });
  }
});

/**
 * GET /api/indices/:name
 * Get specific index (nifty50, sensex, giftnifty)
 */
router.get('/:name', async (req, res) => {
  try {
    const index = await MarketIndices.findOne({ name: req.params.name }).lean();

    if (!index) {
      return res.status(404).json({
        success: false,
        message: 'Index not found',
      });
    }

    res.json({
      success: true,
      data: index,
    });
  } catch (error) {
    console.error('Error fetching index:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch index',
      error: error.message,
    });
  }
});

module.exports = router;
