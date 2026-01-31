/**
 * Holdings Routes
 * API endpoints for fund portfolio holdings
 */

import express from 'express';
import HoldingsController from '../controllers/holdings.controller';
import rateLimiter from '../middleware/rateLimiter.middleware';

const router = express.Router();

// Public routes with lenient rate limiting (read-only operations)
router.get(
  '/stats',
  rateLimiter.fundQueryLimiter,
  HoldingsController.getHoldingsStats
);

router.get(
  '/:schemeCode',
  rateLimiter.fundQueryLimiter,
  HoldingsController.getHoldingsBySchemeCode
);

router.get(
  '/:schemeCode/top',
  rateLimiter.fundQueryLimiter,
  HoldingsController.getTopHoldings
);

router.get(
  '/:schemeCode/sectors',
  rateLimiter.fundQueryLimiter,
  HoldingsController.getSectorAllocation
);

// Comparison endpoint
router.post(
  '/compare',
  rateLimiter.apiLimiter,
  HoldingsController.compareHoldings
);

export default router;
