/**
 * Watchlist Controller
 * Handles user watchlist operations
 */

const Watchlist = require('../models/Watchlist.model');
const Fund = require('../models/Fund.model');
const cacheClient = require('../cache/redis.client');

class WatchlistController {
  /**
   * Get user watchlist
   * GET /api/watchlist
   */
  static async getWatchlist(req, res) {
    try {
      const userId = req.user.userId;

      // Check cache
      const cached = await cacheClient.getWatchlist(userId);
      if (cached) {
        return res.json({
          success: true,
          source: 'cache',
          data: cached,
        });
      }

      // Query database
      const watchlist = await Watchlist.findOne({ userId })
        .populate({
          path: 'funds.schemeCode',
          model: 'Fund',
          select: 'schemeCode schemeName amc category nav returns status',
        })
        .lean();

      if (!watchlist) {
        return res.json({
          success: true,
          data: {
            userId,
            funds: [],
          },
        });
      }

      // Cache result
      await cacheClient.cacheWatchlist(userId, watchlist);

      res.json({
        success: true,
        source: 'database',
        data: watchlist,
      });
    } catch (error) {
      console.error('Error fetching watchlist:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch watchlist',
        message: error.message,
      });
    }
  }

  /**
   * Add fund to watchlist
   * POST /api/watchlist
   */
  static async addToWatchlist(req, res) {
    try {
      const userId = req.user.userId;
      const { schemeCode } = req.body;

      if (!schemeCode) {
        return res.status(400).json({
          success: false,
          error: 'Missing scheme code',
          message: 'Scheme code is required',
        });
      }

      // Verify fund exists
      const fund = await Fund.findOne({ schemeCode, status: 'Active' });
      if (!fund) {
        return res.status(404).json({
          success: false,
          error: 'Fund not found',
          message: `No active fund found with scheme code: ${schemeCode}`,
        });
      }

      // Find or create watchlist
      let watchlist = await Watchlist.findOne({ userId });

      if (!watchlist) {
        watchlist = new Watchlist({
          userId,
          funds: [],
        });
      }

      // Check if already in watchlist
      const exists = watchlist.funds.some((f) => f.schemeCode === schemeCode);

      if (exists) {
        return res.status(409).json({
          success: false,
          error: 'Already in watchlist',
          message: 'This fund is already in your watchlist',
        });
      }

      // Add to watchlist
      watchlist.funds.push({
        schemeCode,
        addedAt: new Date(),
      });

      await watchlist.save();

      // Invalidate cache
      await cacheClient.clearWatchlist(userId);

      res.status(201).json({
        success: true,
        message: 'Fund added to watchlist',
        data: watchlist,
      });
    } catch (error) {
      console.error('Error adding to watchlist:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to add to watchlist',
        message: error.message,
      });
    }
  }

  /**
   * Remove fund from watchlist
   * DELETE /api/watchlist/:schemeCode
   */
  static async removeFromWatchlist(req, res) {
    try {
      const userId = req.user.userId;
      const { schemeCode } = req.params;

      const watchlist = await Watchlist.findOne({ userId });

      if (!watchlist) {
        return res.status(404).json({
          success: false,
          error: 'Watchlist not found',
        });
      }

      // Remove from watchlist
      const initialLength = watchlist.funds.length;
      watchlist.funds = watchlist.funds.filter(
        (f) => f.schemeCode !== schemeCode
      );

      if (watchlist.funds.length === initialLength) {
        return res.status(404).json({
          success: false,
          error: 'Fund not in watchlist',
          message: 'This fund is not in your watchlist',
        });
      }

      await watchlist.save();

      // Invalidate cache
      await cacheClient.clearWatchlist(userId);

      res.json({
        success: true,
        message: 'Fund removed from watchlist',
        data: watchlist,
      });
    } catch (error) {
      console.error('Error removing from watchlist:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to remove from watchlist',
        message: error.message,
      });
    }
  }

  /**
   * Clear entire watchlist
   * DELETE /api/watchlist
   */
  static async clearWatchlist(req, res) {
    try {
      const userId = req.user.userId;

      const watchlist = await Watchlist.findOne({ userId });

      if (!watchlist) {
        return res.json({
          success: true,
          message: 'Watchlist already empty',
        });
      }

      watchlist.funds = [];
      await watchlist.save();

      // Invalidate cache
      await cacheClient.clearWatchlist(userId);

      res.json({
        success: true,
        message: 'Watchlist cleared',
      });
    } catch (error) {
      console.error('Error clearing watchlist:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to clear watchlist',
        message: error.message,
      });
    }
  }

  /**
   * Check if fund is in watchlist
   * GET /api/watchlist/check/:schemeCode
   */
  static async checkInWatchlist(req, res) {
    try {
      const userId = req.user.userId;
      const { schemeCode } = req.params;

      const watchlist = await Watchlist.findOne({ userId });

      const inWatchlist = watchlist
        ? watchlist.funds.some((f) => f.schemeCode === schemeCode)
        : false;

      res.json({
        success: true,
        data: {
          schemeCode,
          inWatchlist,
        },
      });
    } catch (error) {
      console.error('Error checking watchlist:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to check watchlist',
        message: error.message,
      });
    }
  }
}

module.exports = WatchlistController;
