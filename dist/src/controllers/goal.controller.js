/**
 * Goal Controller
 * Handles user investment goals
 */

const Goal = require('../models/Goal.model');
const cacheClient = require('../cache/redis.client');

class GoalController {
  /**
   * Get all user goals
   * GET /api/goals
   */
  static async getGoals(req, res) {
    try {
      const userId = req.user.userId;

      // Check cache
      const cached = await cacheClient.getGoals(userId);
      if (cached) {
        return res.json({
          success: true,
          source: 'cache',
          data: cached,
        });
      }

      // Query database
      const goals = await Goal.find({ userId }).sort({ createdAt: -1 }).lean();

      // Cache result
      await cacheClient.cacheGoals(userId, goals);

      res.json({
        success: true,
        source: 'database',
        data: goals,
      });
    } catch (error) {
      console.error('Error fetching goals:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch goals',
        message: error.message,
      });
    }
  }

  /**
   * Get goal by ID
   * GET /api/goals/:id
   */
  static async getGoalById(req, res) {
    try {
      const userId = req.user.userId;
      const { id } = req.params;

      const goal = await Goal.findOne({ _id: id, userId }).lean();

      if (!goal) {
        return res.status(404).json({
          success: false,
          error: 'Goal not found',
        });
      }

      res.json({
        success: true,
        data: goal,
      });
    } catch (error) {
      console.error('Error fetching goal:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch goal',
        message: error.message,
      });
    }
  }

  /**
   * Create new goal
   * POST /api/goals
   */
  static async createGoal(req, res) {
    try {
      const userId = req.user.userId;
      const {
        name,
        description,
        targetAmount,
        currentAmount = 0,
        targetDate,
        category,
        linkedFunds,
      } = req.body;

      // Validate required fields
      if (!name || !targetAmount || !targetDate) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields',
          message: 'Name, target amount, and target date are required',
        });
      }

      // Create goal
      const goal = new Goal({
        userId,
        name,
        description,
        targetAmount,
        currentAmount,
        targetDate: new Date(targetDate),
        category,
        linkedFunds: linkedFunds || [],
        status: 'ACTIVE',
      });

      await goal.save();

      // Invalidate cache
      await cacheClient.clearGoals(userId);

      res.status(201).json({
        success: true,
        message: 'Goal created successfully',
        data: goal,
      });
    } catch (error) {
      console.error('Error creating goal:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create goal',
        message: error.message,
      });
    }
  }

  /**
   * Update goal
   * PUT /api/goals/:id
   */
  static async updateGoal(req, res) {
    try {
      const userId = req.user.userId;
      const { id } = req.params;
      const updates = req.body;

      // Remove fields that shouldn't be updated directly
      delete updates.userId;
      delete updates._id;
      delete updates.createdAt;

      const goal = await Goal.findOneAndUpdate(
        { _id: id, userId },
        { $set: updates },
        { new: true, runValidators: true }
      );

      if (!goal) {
        return res.status(404).json({
          success: false,
          error: 'Goal not found',
        });
      }

      // Invalidate cache
      await cacheClient.clearGoals(userId);

      res.json({
        success: true,
        message: 'Goal updated successfully',
        data: goal,
      });
    } catch (error) {
      console.error('Error updating goal:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update goal',
        message: error.message,
      });
    }
  }

  /**
   * Update goal progress
   * PATCH /api/goals/:id/progress
   */
  static async updateProgress(req, res) {
    try {
      const userId = req.user.userId;
      const { id } = req.params;
      const { currentAmount } = req.body;

      if (currentAmount === undefined) {
        return res.status(400).json({
          success: false,
          error: 'Missing current amount',
        });
      }

      const goal = await Goal.findOne({ _id: id, userId });

      if (!goal) {
        return res.status(404).json({
          success: false,
          error: 'Goal not found',
        });
      }

      goal.currentAmount = currentAmount;

      // Auto-update status if goal is achieved
      if (currentAmount >= goal.targetAmount) {
        goal.status = 'ACHIEVED';
      }

      await goal.save();

      // Invalidate cache
      await cacheClient.clearGoals(userId);

      res.json({
        success: true,
        message: 'Progress updated successfully',
        data: goal,
      });
    } catch (error) {
      console.error('Error updating progress:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update progress',
        message: error.message,
      });
    }
  }

  /**
   * Delete goal
   * DELETE /api/goals/:id
   */
  static async deleteGoal(req, res) {
    try {
      const userId = req.user.userId;
      const { id } = req.params;

      const goal = await Goal.findOneAndDelete({ _id: id, userId });

      if (!goal) {
        return res.status(404).json({
          success: false,
          error: 'Goal not found',
        });
      }

      // Invalidate cache
      await cacheClient.clearGoals(userId);

      res.json({
        success: true,
        message: 'Goal deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting goal:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete goal',
        message: error.message,
      });
    }
  }

  /**
   * Get goal statistics
   * GET /api/goals/stats
   */
  static async getGoalStats(req, res) {
    try {
      const userId = req.user.userId;

      const stats = await Goal.aggregate([
        { $match: { userId: userId } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalTarget: { $sum: '$targetAmount' },
            totalCurrent: { $sum: '$currentAmount' },
          },
        },
      ]);

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      console.error('Error fetching goal stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch goal statistics',
        message: error.message,
      });
    }
  }
}

module.exports = GoalController;
