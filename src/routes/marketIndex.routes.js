/**
 * Market Index Routes
 */

const express = require('express');
const router = express.Router();
const MarketIndexController = require('../controllers/marketIndex.controller');
const rateLimiter = require('../middleware/rateLimiter.middleware');

// Public routes (with lenient rate limiting for market data queries)
router.get(
  '/indices',
  rateLimiter.fundQueryLimiter,
  MarketIndexController.getAllIndices
);

router.get(
  '/indices/broad',
  rateLimiter.fundQueryLimiter,
  MarketIndexController.getBroadMarketIndices
);

router.get(
  '/indices/sectoral',
  rateLimiter.fundQueryLimiter,
  MarketIndexController.getSectoralIndices
);

router.get(
  '/indices/:symbol',
  rateLimiter.fundQueryLimiter,
  MarketIndexController.getIndexBySymbol
);

router.get(
  '/status',
  rateLimiter.fundQueryLimiter,
  MarketIndexController.getMarketStatus
);

router.get(
  '/summary',
  rateLimiter.fundQueryLimiter,
  MarketIndexController.getMarketSummary
);

module.exports = router;
