/**
 * Watchlist Routes
 */

const express = require('express');
const router = express.Router();
const WatchlistController = require('../controllers/watchlist.controller');
const authMiddleware = require('../middleware/auth.middleware');
const rateLimiter = require('../middleware/rateLimiter.middleware');

// All watchlist routes require authentication
router.use(authMiddleware.verifyToken);

router.get('/', rateLimiter.apiLimiter, WatchlistController.getWatchlist);

router.post('/', rateLimiter.apiLimiter, WatchlistController.addToWatchlist);

router.delete(
  '/:schemeCode',
  rateLimiter.apiLimiter,
  WatchlistController.removeFromWatchlist
);

router.delete('/', rateLimiter.apiLimiter, WatchlistController.clearWatchlist);

router.get(
  '/check/:schemeCode',
  rateLimiter.apiLimiter,
  WatchlistController.checkInWatchlist
);

module.exports = router;
