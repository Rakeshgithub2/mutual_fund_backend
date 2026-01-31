/**
 * AI Routes
 * Endpoints for AI chat functionality
 */

const express = require('express');
const router = express.Router();
const AIController = require('../controllers/ai.controller');
const AuthMiddleware = require('../middleware/auth.middleware');
const RateLimiterMiddleware = require('../middleware/rateLimiter.middleware');

/**
 * POST /api/ai/chat
 * Send a chat message to AI assistant
 * Body: { message: string, conversationHistory?: array }
 */
router.post(
  '/chat',
  RateLimiterMiddleware.apiLimiter, // Rate limit AI requests
  AIController.chat
);

/**
 * GET /api/ai/status
 * Get AI service status and configuration
 */
router.get('/status', AIController.getStatus);

module.exports = router;
