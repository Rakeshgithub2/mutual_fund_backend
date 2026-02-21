"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CacheService = exports.cacheService = void 0;
const ioredis_1 = require("ioredis");
const index_1 = require("../db/index");
class CacheService {
    constructor() {
        this.redis = null;
        this.redisEnabled = false;
        this.mongoFallback = true;
        const redisUrl = process.env.REDIS_URL;
        if (!redisUrl) {
            console.log('⚠️  Redis URL not configured - using MongoDB fallback for cache');
            this.redisEnabled = false;
            this.mongoFallback = true;
            return;
        }
        try {
            this.redis = new ioredis_1.Redis(redisUrl, {
                maxRetriesPerRequest: 3,
                enableReadyCheck: false,
                lazyConnect: true,
            });
            this.redis.on('connect', () => {
                this.redisEnabled = true;
                console.log('✅ Redis connected successfully');
            });
            this.redis.on('error', (error) => {
                this.redisEnabled = false;
                console.log('⚠️  Redis connection failed - using MongoDB fallback for cache');
                // Silently ignore Redis errors and use MongoDB
            });
            // Try to connect
            this.redis.connect().catch(() => {
                this.redisEnabled = false;
                console.log('⚠️  Redis connection failed - using MongoDB fallback for cache');
            });
        }
        catch (error) {
            this.redisEnabled = false;
            console.log('⚠️  Redis initialization failed - using MongoDB fallback for cache');
        }
    }
    async get(key) {
        // Try Redis first
        if (this.redisEnabled && this.redis) {
            try {
                return await this.redis.get(key);
            }
            catch (error) {
                console.error('Cache get error (Redis):', error);
                // Fall through to MongoDB
            }
        }
        // MongoDB fallback
        if (this.mongoFallback) {
            try {
                const cached = await index_1.prisma.cache.findFirst({
                    where: {
                        key,
                        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
                    },
                });
                return cached?.value || null;
            }
            catch (error) {
                console.error('Cache get error (MongoDB):', error);
                return null;
            }
        }
        return null;
    }
    async getJSON(key) {
        try {
            const data = await this.get(key);
            return data ? JSON.parse(data) : null;
        }
        catch (error) {
            console.error('Cache getJSON error:', error);
            return null;
        }
    }
    async set(key, value, ttlSeconds) {
        const expiresAt = ttlSeconds
            ? new Date(Date.now() + ttlSeconds * 1000)
            : null;
        // Try Redis first
        if (this.redisEnabled && this.redis) {
            try {
                if (ttlSeconds) {
                    await this.redis.setex(key, ttlSeconds, value);
                }
                else {
                    await this.redis.set(key, value);
                }
                return;
            }
            catch (error) {
                console.error('Cache set error (Redis):', error);
                // Fall through to MongoDB
            }
        }
        // MongoDB fallback
        if (this.mongoFallback) {
            try {
                await index_1.prisma.cache.upsert({
                    where: { key },
                    update: {
                        value,
                        expiresAt,
                        updatedAt: new Date(),
                    },
                    create: {
                        key,
                        value,
                        expiresAt,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                    },
                });
            }
            catch (error) {
                console.error('Cache set error (MongoDB):', error);
            }
        }
    }
    async setJSON(key, value, ttlSeconds) {
        try {
            const serialized = JSON.stringify(value);
            await this.set(key, serialized, ttlSeconds);
        }
        catch (error) {
            console.error('Cache setJSON error:', error);
        }
    }
    async del(key) {
        // Try Redis first
        if (this.redisEnabled && this.redis) {
            try {
                await this.redis.del(key);
            }
            catch (error) {
                console.error('Cache del error (Redis):', error);
                // Fall through to MongoDB
            }
        }
        // MongoDB fallback
        if (this.mongoFallback) {
            try {
                await index_1.prisma.cache.deleteMany({
                    where: { key },
                });
            }
            catch (error) {
                console.error('Cache del error (MongoDB):', error);
            }
        }
    }
    async delPattern(pattern) {
        // Try Redis first
        if (this.redisEnabled && this.redis) {
            try {
                const keys = await this.redis.keys(pattern);
                if (keys.length > 0) {
                    await this.redis.del(...keys);
                }
                return;
            }
            catch (error) {
                console.error('Cache delPattern error (Redis):', error);
                // Fall through to MongoDB
            }
        }
        // MongoDB fallback - convert Redis pattern to MongoDB regex
        if (this.mongoFallback) {
            try {
                // For MongoDB, use contains for simple pattern matching
                const searchPattern = pattern.replace(/\*/g, '');
                await index_1.prisma.cache.deleteMany({
                    where: {
                        key: {
                            contains: searchPattern,
                        },
                    },
                });
            }
            catch (error) {
                console.error('Cache delPattern error (MongoDB):', error);
            }
        }
    }
    async exists(key) {
        // Try Redis first
        if (this.redisEnabled && this.redis) {
            try {
                const result = await this.redis.exists(key);
                return result === 1;
            }
            catch (error) {
                console.error('Cache exists error (Redis):', error);
                // Fall through to MongoDB
            }
        }
        // MongoDB fallback
        if (this.mongoFallback) {
            try {
                const cached = await index_1.prisma.cache.findFirst({
                    where: {
                        key,
                        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
                    },
                });
                return !!cached;
            }
            catch (error) {
                console.error('Cache exists error (MongoDB):', error);
                return false;
            }
        }
        return false;
    }
    async ttl(key) {
        // Try Redis first
        if (this.redisEnabled && this.redis) {
            try {
                return await this.redis.ttl(key);
            }
            catch (error) {
                console.error('Cache ttl error (Redis):', error);
                // Fall through to MongoDB
            }
        }
        // MongoDB fallback
        if (this.mongoFallback) {
            try {
                const cached = await index_1.prisma.cache.findFirst({
                    where: { key },
                });
                if (!cached || !cached.expiresAt) {
                    return -1; // No expiration
                }
                const now = new Date().getTime();
                const expires = cached.expiresAt.getTime();
                const ttlMs = expires - now;
                return ttlMs > 0 ? Math.floor(ttlMs / 1000) : -2; // -2 means expired
            }
            catch (error) {
                console.error('Cache ttl error (MongoDB):', error);
                return -1;
            }
        }
        return -1;
    }
    // Cleanup expired cache entries from MongoDB
    async cleanup() {
        if (this.mongoFallback) {
            try {
                await index_1.prisma.cache.deleteMany({
                    where: {
                        expiresAt: {
                            lt: new Date(),
                        },
                    },
                });
            }
            catch (error) {
                console.error('Cache cleanup error (MongoDB):', error);
            }
        }
    }
    async close() {
        if (this.redis) {
            await this.redis.quit();
        }
    }
}
exports.CacheService = CacheService;
// Cache keys
CacheService.keys = {
    fundDetail: (id) => `fund:detail:${id}`,
    fundNavs: (id) => `fund:navs:${id}`,
    fundsList: (filters) => `funds:list:${filters}`,
    userWatchlist: (userId) => `user:watchlist:${userId}`,
};
// TTL constants (in seconds)
CacheService.TTL = {
    FUND_DETAIL: 10 * 60, // 10 minutes
    FUND_NAVS: 60 * 60, // 1 hour
    FUNDS_LIST: 5 * 60, // 5 minutes
    USER_WATCHLIST: 2 * 60, // 2 minutes
};
exports.cacheService = new CacheService();
