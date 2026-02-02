"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redis = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const environment_1 = require("../config/environment");
/**
 * Redis Cache Client
 *
 * Used for:
 * - Caching fund prices (15 min TTL)
 * - Caching fund metadata (1 hour TTL)
 * - Caching search results (30 min TTL)
 * - Autocomplete suggestions (1 hour TTL)
 * - Rate limiting
 */
class RedisCache {
    constructor() {
        this.client = null;
        this.isConnected = false;
    }
    async connect() {
        if (this.isConnected) {
            return;
        }
        this.client = new ioredis_1.default({
            host: environment_1.config.redis.host,
            port: environment_1.config.redis.port,
            password: environment_1.config.redis.password,
            db: environment_1.config.redis.db,
            retryStrategy: (times) => {
                const delay = Math.min(times * 50, 2000);
                return delay;
            },
            maxRetriesPerRequest: 3,
        });
        this.client.on('connect', () => {
            console.log('Redis client connecting...');
        });
        this.client.on('ready', () => {
            this.isConnected = true;
            console.log('Redis client ready');
        });
        this.client.on('error', (error) => {
            console.error('Redis client error:', error);
        });
        this.client.on('close', () => {
            this.isConnected = false;
            console.log('Redis connection closed');
        });
        // Wait for connection
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Redis connection timeout'));
            }, 5000);
            this.client.once('ready', () => {
                clearTimeout(timeout);
                resolve();
            });
            this.client.once('error', (error) => {
                clearTimeout(timeout);
                reject(error);
            });
        });
    }
    async ping() {
        if (!this.client) {
            throw new Error('Redis client not initialized');
        }
        return await this.client.ping();
    }
    async quit() {
        if (this.client) {
            await this.client.quit();
            this.isConnected = false;
            this.client = null;
        }
    }
    // ==================== GENERIC CACHE METHODS ====================
    async get(key) {
        if (!this.client)
            return null;
        try {
            const value = await this.client.get(key);
            if (!value)
                return null;
            return JSON.parse(value);
        }
        catch (error) {
            console.error(`Redis GET error for key ${key}:`, error);
            return null;
        }
    }
    async set(key, value, ttlSeconds) {
        if (!this.client)
            return;
        try {
            const stringValue = JSON.stringify(value);
            if (ttlSeconds) {
                await this.client.setex(key, ttlSeconds, stringValue);
            }
            else {
                await this.client.set(key, stringValue);
            }
        }
        catch (error) {
            console.error(`Redis SET error for key ${key}:`, error);
        }
    }
    async del(key) {
        if (!this.client)
            return;
        try {
            if (Array.isArray(key)) {
                await this.client.del(...key);
            }
            else {
                await this.client.del(key);
            }
        }
        catch (error) {
            console.error(`Redis DEL error:`, error);
        }
    }
    async exists(key) {
        if (!this.client)
            return false;
        try {
            const result = await this.client.exists(key);
            return result === 1;
        }
        catch (error) {
            console.error(`Redis EXISTS error for key ${key}:`, error);
            return false;
        }
    }
    async ttl(key) {
        if (!this.client)
            return -1;
        try {
            return await this.client.ttl(key);
        }
        catch (error) {
            console.error(`Redis TTL error for key ${key}:`, error);
            return -1;
        }
    }
    // ==================== SPECIALIZED CACHE METHODS ====================
    /**
     * Cache fund price data
     */
    async cacheFundPrice(fundId, priceData) {
        const key = `fund:price:${fundId}`;
        await this.set(key, priceData, environment_1.config.redis.ttl.prices);
    }
    async getFundPrice(fundId) {
        const key = `fund:price:${fundId}`;
        return await this.get(key);
    }
    /**
     * Cache fund metadata
     */
    async cacheFundMetadata(fundId, metadata) {
        const key = `fund:meta:${fundId}`;
        await this.set(key, metadata, environment_1.config.redis.ttl.funds);
    }
    async getFundMetadata(fundId) {
        const key = `fund:meta:${fundId}`;
        return await this.get(key);
    }
    /**
     * Cache search results
     */
    async cacheSearchResults(query, results) {
        const key = `search:${query.toLowerCase()}`;
        await this.set(key, results, environment_1.config.redis.ttl.search);
    }
    async getSearchResults(query) {
        const key = `search:${query.toLowerCase()}`;
        return await this.get(key);
    }
    /**
     * Cache autocomplete suggestions
     */
    async cacheSuggestions(prefix, suggestions) {
        const key = `suggest:${prefix.toLowerCase()}`;
        await this.set(key, suggestions, environment_1.config.redis.ttl.suggestions);
    }
    async getSuggestions(prefix) {
        const key = `suggest:${prefix.toLowerCase()}`;
        return await this.get(key);
    }
    /**
     * Invalidate all fund-related caches
     */
    async invalidateFundCache(fundId) {
        const keys = [`fund:price:${fundId}`, `fund:meta:${fundId}`];
        await this.del(keys);
    }
    /**
     * Invalidate search cache by pattern
     */
    async invalidateSearchCache() {
        if (!this.client)
            return;
        try {
            const keys = await this.client.keys('search:*');
            if (keys.length > 0) {
                await this.del(keys);
            }
        }
        catch (error) {
            console.error('Error invalidating search cache:', error);
        }
    }
    /**
     * Rate limiting
     */
    async checkRateLimit(identifier, maxRequests, windowSeconds) {
        if (!this.client) {
            return { allowed: true, remaining: maxRequests, resetAt: new Date() };
        }
        const key = `ratelimit:${identifier}`;
        try {
            const current = await this.client.incr(key);
            if (current === 1) {
                await this.client.expire(key, windowSeconds);
            }
            const ttl = await this.ttl(key);
            const resetAt = new Date(Date.now() + ttl * 1000);
            return {
                allowed: current <= maxRequests,
                remaining: Math.max(0, maxRequests - current),
                resetAt,
            };
        }
        catch (error) {
            console.error('Rate limit check error:', error);
            return { allowed: true, remaining: maxRequests, resetAt: new Date() };
        }
    }
    /**
     * Get cache statistics
     */
    async getStats() {
        if (!this.client)
            return null;
        try {
            const info = await this.client.info('stats');
            const dbsize = await this.client.dbsize();
            return {
                connected: this.isConnected,
                dbsize,
                info: this.parseRedisInfo(info),
            };
        }
        catch (error) {
            console.error('Error getting Redis stats:', error);
            return null;
        }
    }
    parseRedisInfo(info) {
        const result = {};
        const lines = info.split('\r\n');
        for (const line of lines) {
            if (line && !line.startsWith('#')) {
                const [key, value] = line.split(':');
                if (key && value) {
                    result[key] = value;
                }
            }
        }
        return result;
    }
}
// Export singleton instance
exports.redis = new RedisCache();
