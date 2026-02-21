/**
 * Rate Limiter Middleware
 * Protect APIs from abuse and ensure fair usage
 */

const rateLimit = require('express-rate-limit');
const { AUTH_CONFIG } = require('../config/auth.config');

class RateLimiterMiddleware {
  /**
   * General API rate limiter
   */
  static apiLimiter = rateLimit({
    windowMs: AUTH_CONFIG.rateLimit.windowMs,
    max: AUTH_CONFIG.rateLimit.maxRequests.api,
    message: {
      success: false,
      error: 'Too many requests',
      message: 'You have exceeded the rate limit. Please try again later.',
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false,
    keyGenerator: (req) => {
      // Use user ID if authenticated, otherwise IP
      return req.user?.userId || req.ip;
    },
    handler: (req, res) => {
      res.status(429).json({
        success: false,
        error: 'Rate limit exceeded',
        message: 'Too many requests from this user/IP. Please try again later.',
        retryAfter: Math.ceil(AUTH_CONFIG.rateLimit.windowMs / 1000 / 60),
      });
    },
  });

  /**
   * Strict rate limiter for authentication endpoints
   */
  static authLimiter = rateLimit({
    windowMs: AUTH_CONFIG.rateLimit.windowMs,
    max: AUTH_CONFIG.rateLimit.maxRequests.login,
    message: {
      success: false,
      error: 'Too many authentication attempts',
      message: 'Too many login attempts. Please try again later.',
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true, // Don't count successful logins
    keyGenerator: (req) => {
      // Use email if provided, otherwise IP
      return req.body?.email || req.ip;
    },
    handler: (req, res) => {
      res.status(429).json({
        success: false,
        error: 'Too many login attempts',
        message:
          'Account temporarily locked. Please try again after 15 minutes.',
        retryAfter: 15,
      });
    },
  });

  /**
   * Rate limiter for registration
   */
  static registerLimiter = rateLimit({
    windowMs: AUTH_CONFIG.rateLimit.windowMs,
    max: AUTH_CONFIG.rateLimit.maxRequests.register,
    message: {
      success: false,
      error: 'Too many registration attempts',
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.ip,
    handler: (req, res) => {
      res.status(429).json({
        success: false,
        error: 'Too many registration attempts',
        message: 'Please wait before creating another account.',
        retryAfter: 15,
      });
    },
  });

  /**
   * Lenient rate limiter for fund queries (read-only operations)
   * Supports high-concurrency scenarios (500+ users)
   */
  static fundQueryLimiter = rateLimit({
    windowMs: AUTH_CONFIG.rateLimit.windowMs,
    max: AUTH_CONFIG.rateLimit.maxRequests.fundQueries || 5000,
    message: {
      success: false,
      error: 'Too many fund queries',
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false,
    keyGenerator: (req) => {
      // Use IP-based limiting for public read operations
      return req.ip;
    },
    handler: (req, res) => {
      res.status(429).json({
        success: false,
        error: 'Rate limit exceeded',
        message: 'Too many fund queries. Please try again shortly.',
        retryAfter: 1,
      });
    },
  });

  /**
   * Premium user rate limiter (higher limits)
   */
  static premiumLimiter = rateLimit({
    windowMs: AUTH_CONFIG.rateLimit.windowMs,
    max: AUTH_CONFIG.rateLimit.maxRequests.apiPremium,
    message: {
      success: false,
      error: 'Rate limit exceeded',
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.user?.userId || req.ip,
  });

  /**
   * Role-based dynamic rate limiter
   */
  static dynamicLimiter = rateLimit({
    windowMs: AUTH_CONFIG.rateLimit.windowMs,
    max: (req) => {
      // Get limit based on user role
      if (req.user) {
        if (req.user.role === 'admin') {
          return 10000; // Very high limit for admins
        } else if (req.user.role === 'premium') {
          return AUTH_CONFIG.rateLimit.maxRequests.apiPremium;
        }
      }
      return AUTH_CONFIG.rateLimit.maxRequests.api;
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.user?.userId || req.ip,
    skip: (req) => {
      // Skip rate limiting for admins
      return req.user?.role === 'admin';
    },
    handler: (req, res) => {
      const role = req.user?.role || 'guest';
      res.status(429).json({
        success: false,
        error: 'Rate limit exceeded',
        message: `Rate limit exceeded for ${role} users.`,
        retryAfter: Math.ceil(AUTH_CONFIG.rateLimit.windowMs / 1000 / 60),
      });
    },
  });

  /**
   * Search endpoint rate limiter (prevent abuse)
   */
  static searchLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 20, // 20 searches per minute
    message: {
      success: false,
      error: 'Too many search requests',
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.user?.userId || req.ip,
  });

  /**
   * Export data rate limiter (resource intensive)
   */
  static exportLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // 5 exports per hour
    message: {
      success: false,
      error: 'Too many export requests',
      message: 'Export limit reached. Please try again later.',
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.user?.userId || req.ip,
  });

  /**
   * Create custom rate limiter
   */
  static createLimiter(options) {
    return rateLimit({
      windowMs: options.windowMs || AUTH_CONFIG.rateLimit.windowMs,
      max: options.max || 100,
      message: options.message || {
        success: false,
        error: 'Rate limit exceeded',
      },
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator:
        options.keyGenerator || ((req) => req.user?.userId || req.ip),
      skip: options.skip || undefined,
      handler: options.handler || undefined,
    });
  }

  /**
   * Conditional rate limiter based on endpoint sensitivity
   */
  static conditionalLimiter(req, res, next) {
    // Determine which limiter to use based on path
    const path = req.path;

    if (path.startsWith('/auth')) {
      return RateLimiterMiddleware.authLimiter(req, res, next);
    } else if (path.includes('/search')) {
      return RateLimiterMiddleware.searchLimiter(req, res, next);
    } else if (path.includes('/export')) {
      return RateLimiterMiddleware.exportLimiter(req, res, next);
    } else if (req.user?.role === 'premium' || req.user?.role === 'admin') {
      return RateLimiterMiddleware.premiumLimiter(req, res, next);
    } else {
      return RateLimiterMiddleware.apiLimiter(req, res, next);
    }
  }

  /**
   * Slow down middleware (gradual delay instead of blocking)
   */
  static slowDown = require('express-slow-down')({
    windowMs: 15 * 60 * 1000, // 15 minutes
    delayAfter: 50, // Allow 50 requests per window at full speed
    delayMs: () => 500, // Fixed 500ms delay per request after delayAfter
    maxDelayMs: 20000, // Maximum delay of 20 seconds
    skipSuccessfulRequests: false,
    validate: {
      delayMs: false, // Disable warning
      keyGeneratorIpFallback: false, // Disable IPv6 warning
    },
  });

  /**
   * Log rate limit hits
   */
  static logRateLimitHits(req, res, next) {
    const originalJson = res.json.bind(res);

    res.json = function (data) {
      if (res.statusCode === 429) {
        console.warn(`⚠️ Rate limit hit: ${req.ip} - ${req.path}`);
      }
      return originalJson(data);
    };

    next();
  }
}

module.exports = RateLimiterMiddleware;
