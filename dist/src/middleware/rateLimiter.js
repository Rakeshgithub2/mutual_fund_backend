"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamicRateLimit = exports.createWhitelistMiddleware = exports.createRedisRateLimit = exports.fundDataRateLimit = exports.searchRateLimit = exports.authRateLimit = exports.generalRateLimit = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
// General API rate limit
exports.generalRateLimit = (0, express_rate_limit_1.default)({
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
exports.authRateLimit = (0, express_rate_limit_1.default)({
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
exports.searchRateLimit = (0, express_rate_limit_1.default)({
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
exports.fundDataRateLimit = (0, express_rate_limit_1.default)({
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
const createRedisRateLimit = (windowMs, max, message) => {
    // Note: In production, you would use a Redis store
    // import RedisStore from 'rate-limit-redis';
    // import { createClient } from 'redis';
    return (0, express_rate_limit_1.default)({
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
exports.createRedisRateLimit = createRedisRateLimit;
// IP whitelist middleware
const createWhitelistMiddleware = (whitelist) => {
    return (req, res, next) => {
        const clientIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress || '';
        if (whitelist.includes(clientIP)) {
            return next();
        }
        // Apply rate limiting for non-whitelisted IPs
        return (0, exports.generalRateLimit)(req, res, next);
    };
};
exports.createWhitelistMiddleware = createWhitelistMiddleware;
// Dynamic rate limiter based on user type
const dynamicRateLimit = (req, res, next) => {
    const user = req.user;
    if (!user) {
        // Non-authenticated users get stricter limits
        return (0, exports.generalRateLimit)(req, res, next);
    }
    // Authenticated users get more permissive limits
    const authenticatedLimit = (0, express_rate_limit_1.default)({
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
exports.dynamicRateLimit = dynamicRateLimit;
