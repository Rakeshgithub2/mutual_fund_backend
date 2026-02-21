/**
 * Reminder Routes
 */

const express = require('express');
const router = express.Router();
const ReminderController = require('../controllers/reminder.controller');
const authMiddleware = require('../middleware/auth.middleware');
const rateLimiter = require('../middleware/rateLimiter.middleware');

// All reminder routes require authentication
router.use(authMiddleware.verifyToken);

router.get('/', rateLimiter.apiLimiter, ReminderController.getReminders);

router.get(
  '/upcoming',
  rateLimiter.apiLimiter,
  ReminderController.getUpcomingReminders
);

router.get('/:id', rateLimiter.apiLimiter, ReminderController.getReminderById);

router.post('/', rateLimiter.apiLimiter, ReminderController.createReminder);

router.put('/:id', rateLimiter.apiLimiter, ReminderController.updateReminder);

router.patch(
  '/:id/complete',
  rateLimiter.apiLimiter,
  ReminderController.completeReminder
);

router.delete(
  '/:id',
  rateLimiter.apiLimiter,
  ReminderController.deleteReminder
);

module.exports = router;
