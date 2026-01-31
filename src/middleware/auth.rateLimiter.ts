import rateLimit from 'express-rate-limit';

/**
 * Rate limiter for authentication endpoints
 * Prevents brute force attacks
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: {
    success: false,
    message: 'Too many login attempts. Please try again after 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
});

/**
 * Stricter rate limiter for registration
 */
export const registrationRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 registrations per hour per IP
  message: {
    success: false,
    message: 'Too many accounts created. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
