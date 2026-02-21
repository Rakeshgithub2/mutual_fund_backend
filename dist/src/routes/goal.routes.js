/**
 * Goal Routes
 */

const express = require('express');
const router = express.Router();
const GoalController = require('../controllers/goal.controller');
const authMiddleware = require('../middleware/auth.middleware');
const rateLimiter = require('../middleware/rateLimiter.middleware');

// All goal routes require authentication
router.use(authMiddleware.verifyToken);

router.get('/', rateLimiter.apiLimiter, GoalController.getGoals);

router.get('/stats', rateLimiter.apiLimiter, GoalController.getGoalStats);

router.get('/:id', rateLimiter.apiLimiter, GoalController.getGoalById);

router.post('/', rateLimiter.apiLimiter, GoalController.createGoal);

router.put('/:id', rateLimiter.apiLimiter, GoalController.updateGoal);

router.patch(
  '/:id/progress',
  rateLimiter.apiLimiter,
  GoalController.updateProgress
);

router.delete('/:id', rateLimiter.apiLimiter, GoalController.deleteGoal);

module.exports = router;
