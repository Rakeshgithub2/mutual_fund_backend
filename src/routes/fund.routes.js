/**
 * Fund Routes
 */

const express = require('express');
const router = express.Router();
const FundController = require('../controllers/fund.controller');
const authMiddleware = require('../middleware/auth.middleware');
const rateLimiter = require('../middleware/rateLimiter.middleware');

// Public routes (with lenient rate limiting for fund queries)
router.get('/', rateLimiter.fundQueryLimiter, FundController.getAllFunds);

// 🆕 Get ALL funds without pagination (for category pages)
router.get(
  '/all',
  rateLimiter.fundQueryLimiter,
  FundController.getAllFundsNoPagination
);

// 🆕 Unified fund universe for comparison/overlap (single source of truth)
router.get(
  '/universe',
  rateLimiter.fundQueryLimiter,
  FundController.getFundUniverse
);

router.get('/search', rateLimiter.searchLimiter, FundController.searchFunds);

// 🔥 NEW: Smart search with external API fallback
router.get(
  '/smart-search',
  rateLimiter.searchLimiter,
  FundController.smartSearch
);

router.get(
  '/categories',
  rateLimiter.fundQueryLimiter,
  FundController.getCategories
);

router.get(
  '/top-performers',
  rateLimiter.fundQueryLimiter,
  FundController.getTopPerformers
);

router.get(
  '/category/:category',
  rateLimiter.fundQueryLimiter,
  FundController.getFundsByCategory
);

router.get(
  '/subcategory/:subcategory',
  rateLimiter.fundQueryLimiter,
  FundController.getFundsBySubcategory
);

// Get fund by MongoDB ID (must come before :schemeCode to avoid conflict)
router.get('/id/:id', rateLimiter.fundQueryLimiter, FundController.getFundById);

router.get(
  '/scheme/:schemeCode',
  rateLimiter.fundQueryLimiter,
  FundController.getFundBySchemeCode
);

router.get(
  '/scheme/:schemeCode/nav',
  rateLimiter.fundQueryLimiter,
  FundController.getFundNavHistory
);

router.get(
  '/scheme/:schemeCode/holdings',
  rateLimiter.fundQueryLimiter,
  FundController.getFundHoldings
);

// Legacy route - keeping for backward compatibility
router.get(
  '/:schemeCode',
  rateLimiter.fundQueryLimiter,
  FundController.getFundBySchemeCode
);

router.get(
  '/:schemeCode/nav',
  rateLimiter.fundQueryLimiter,
  FundController.getFundNavHistory
);

router.get(
  '/:schemeCode/holdings',
  rateLimiter.fundQueryLimiter,
  FundController.getFundHoldings
);

// 🔥 NEW: Batch import from external API (protected if you want)
router.post(
  '/batch-import',
  rateLimiter.apiLimiter,
  FundController.batchImport
);

module.exports = router;
