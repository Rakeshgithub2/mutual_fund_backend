import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';

// General API rate limit
export const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: 15 * 60, // 15 minutes in seconds
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Strict rate limit for auth endpoints
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs for auth
  message: {
    error: 'Too many authentication attempts, please try again later.',
    retryAfter: 15 * 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
});

// Search rate limit
export const searchRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // Limit each IP to 30 search requests per minute
  message: {
    error: 'Too many search requests, please slow down.',
    retryAfter: 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// More permissive rate limit for fund data
export const fundDataRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute for fund data
  message: {
    error: 'Too many fund data requests, please slow down.',
    retryAfter: 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Custom rate limiter with Redis store (for production)
export const createRedisRateLimit = (
  windowMs: number,
  max: number,
  message: string
) => {
  // Note: In production, you would use a Redis store
  // import RedisStore from 'rate-limit-redis';
  // import { createClient } from 'redis';

  return rateLimit({
    windowMs,
    max,
    message: {
      error: message,
      retryAfter: Math.ceil(windowMs / 1000),
    },
    standardHeaders: true,
    legacyHeaders: false,
    // store: new RedisStore({
    //   sendCommand: (...args: string[]) => redisClient.sendCommand(args),
    // }),
  });
};

// IP whitelist middleware
export const createWhitelistMiddleware = (whitelist: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const clientIP =
      req.ip || req.connection.remoteAddress || req.socket.remoteAddress || '';

    if (whitelist.includes(clientIP)) {
      return next();
    }

    // Apply rate limiting for non-whitelisted IPs
    return generalRateLimit(req, res, next);
  };
};

// Dynamic rate limiter based on user type
export const dynamicRateLimit = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const user = (req as any).user;

  if (!user) {
    // Non-authenticated users get stricter limits
    return generalRateLimit(req, res, next);
  }

  // Authenticated users get more permissive limits
  const authenticatedLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200, // 200 requests per 15 minutes for authenticated users
    message: {
      error: 'Rate limit exceeded for authenticated user.',
      retryAfter: 15 * 60,
    },
    standardHeaders: true,
    legacyHeaders: false,
  });

  return authenticatedLimit(req, res, next);
};
