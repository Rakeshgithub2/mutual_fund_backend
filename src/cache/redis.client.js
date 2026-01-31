/**
 * Redis Cache Client
 * High-performance caching with TTL management and helper functions
 */

const redisConfig = require('../config/redis.config');

class RedisCacheClient {
  constructor() {
    this.redis = null;
    this.isEnabled = false;
  }

  /**
   * Initialize Redis connection
   */
  async init() {
    try {
      this.redis = await redisConfig.connect();
      this.isEnabled = this.redis !== null;

      if (this.isEnabled) {
        console.log('✅ Redis cache initialized');
      } else {
        console.warn('⚠️ Running without cache (Redis unavailable)');
      }
    } catch (error) {
      console.error('❌ Redis initialization error:', error.message);
      this.isEnabled = false;
    }
  }

  /**
   * Get value from cache
   */
  async get(key) {
    if (!this.isEnabled) return null;

    try {
      const value = await this.redis.get(key);
      if (!value) return null;

      // Try to parse JSON
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    } catch (error) {
      console.error(`Redis GET error for key ${key}:`, error.message);
      return null;
    }
  }

  /**
   * Set value in cache with TTL
   */
  async set(key, value, ttl = null) {
    if (!this.isEnabled) return false;

    try {
      const stringValue =
        typeof value === 'string' ? value : JSON.stringify(value);

      if (ttl) {
        await this.redis.setex(key, ttl, stringValue);
      } else {
        await this.redis.set(key, stringValue);
      }

      return true;
    } catch (error) {
      console.error(`Redis SET error for key ${key}:`, error.message);
      return false;
    }
  }

  /**
   * Delete key from cache
   */
  async del(key) {
    if (!this.isEnabled) return false;

    try {
      await this.redis.del(key);
      return true;
    } catch (error) {
      console.error(`Redis DEL error for key ${key}:`, error.message);
      return false;
    }
  }

  /**
   * Delete multiple keys
   */
  async delMultiple(keys) {
    if (!this.isEnabled || !keys || keys.length === 0) return false;

    try {
      await this.redis.del(...keys);
      return true;
    } catch (error) {
      console.error('Redis DEL multiple error:', error.message);
      return false;
    }
  }

  /**
   * Check if key exists
   */
  async exists(key) {
    if (!this.isEnabled) return false;

    try {
      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error) {
      console.error(`Redis EXISTS error for key ${key}:`, error.message);
      return false;
    }
  }

  /**
   * Get remaining TTL for a key
   */
  async ttl(key) {
    if (!this.isEnabled) return -1;

    try {
      return await this.redis.ttl(key);
    } catch (error) {
      console.error(`Redis TTL error for key ${key}:`, error.message);
      return -1;
    }
  }

  /**
   * Clear cache by pattern
   */
  async clearPattern(pattern) {
    if (!this.isEnabled) return false;

    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
        console.log(`🗑️ Cleared ${keys.length} keys matching: ${pattern}`);
      }
      return true;
    } catch (error) {
      console.error(`Redis clear pattern error for ${pattern}:`, error.message);
      return false;
    }
  }

  /**
   * Clear all cache
   */
  async clearAll() {
    if (!this.isEnabled) return false;
    return await redisConfig.clearAll();
  }

  // ==================== FUND CACHE HELPERS ====================

  /**
   * Cache fund by ID
   */
  async cacheFund(fundId, fundData) {
    const key = redisConfig.constructor.KEYS.FUND_BY_ID(fundId);
    return await this.set(key, fundData, redisConfig.constructor.TTL.FUND_DATA);
  }

  /**
   * Get cached fund by ID
   */
  async getFund(fundId) {
    const key = redisConfig.constructor.KEYS.FUND_BY_ID(fundId);
    return await this.get(key);
  }

  /**
   * Cache funds by category
   */
  async cacheFundsByCategory(category, funds) {
    const key = redisConfig.constructor.KEYS.FUND_BY_CATEGORY(category);
    return await this.set(key, funds, redisConfig.constructor.TTL.FUND_DATA);
  }

  /**
   * Get cached funds by category
   */
  async getFundsByCategory(category) {
    const key = redisConfig.constructor.KEYS.FUND_BY_CATEGORY(category);
    return await this.get(key);
  }

  /**
   * Cache funds by subcategory
   */
  async cacheFundsBySubcategory(subcategory, funds) {
    const key = redisConfig.constructor.KEYS.FUND_BY_SUBCATEGORY(subcategory);
    return await this.set(key, funds, redisConfig.constructor.TTL.FUND_DATA);
  }

  /**
   * Get cached funds by subcategory
   */
  async getFundsBySubcategory(subcategory) {
    const key = redisConfig.constructor.KEYS.FUND_BY_SUBCATEGORY(subcategory);
    return await this.get(key);
  }

  /**
   * Cache fund NAV
   */
  async cacheFundNav(fundId, navData) {
    const key = redisConfig.constructor.KEYS.FUND_NAV(fundId);
    return await this.set(key, navData, redisConfig.constructor.TTL.FUND_NAV);
  }

  /**
   * Get cached fund NAV
   */
  async getFundNav(fundId) {
    const key = redisConfig.constructor.KEYS.FUND_NAV(fundId);
    return await this.get(key);
  }

  /**
   * Cache fund holdings
   */
  async cacheFundHoldings(fundId, holdingsData) {
    const key = redisConfig.constructor.KEYS.FUND_HOLDINGS(fundId);
    return await this.set(
      key,
      holdingsData,
      redisConfig.constructor.TTL.FUND_HOLDINGS
    );
  }

  /**
   * Get cached fund holdings
   */
  async getFundHoldings(fundId) {
    const key = redisConfig.constructor.KEYS.FUND_HOLDINGS(fundId);
    return await this.get(key);
  }

  /**
   * Cache search results
   */
  async cacheSearchResults(query, results) {
    const key = redisConfig.constructor.KEYS.FUND_SEARCH(query);
    return await this.set(
      key,
      results,
      redisConfig.constructor.TTL.SEARCH_RESULTS
    );
  }

  /**
   * Get cached search results
   */
  async getSearchResults(query) {
    const key = redisConfig.constructor.KEYS.FUND_SEARCH(query);
    return await this.get(key);
  }

  // ==================== MARKET INDEX CACHE HELPERS ====================

  /**
   * Cache market index
   */
  async cacheMarketIndex(symbol, indexData) {
    const key = redisConfig.constructor.KEYS.MARKET_INDEX(symbol);
    return await this.set(
      key,
      indexData,
      redisConfig.constructor.TTL.MARKET_INDEX
    );
  }

  /**
   * Get cached market index
   */
  async getMarketIndex(symbol) {
    const key = redisConfig.constructor.KEYS.MARKET_INDEX(symbol);
    return await this.get(key);
  }

  /**
   * Cache all market indices
   */
  async cacheAllIndices(indices) {
    const key = redisConfig.constructor.KEYS.MARKET_ALL_INDICES();
    return await this.set(
      key,
      indices,
      redisConfig.constructor.TTL.MARKET_INDEX
    );
  }

  /**
   * Get all cached market indices
   */
  async getAllIndices() {
    const key = redisConfig.constructor.KEYS.MARKET_ALL_INDICES();
    return await this.get(key);
  }

  // ==================== USER DATA CACHE HELPERS ====================

  /**
   * Cache user watchlist
   */
  async cacheWatchlist(userId, watchlist) {
    const key = redisConfig.constructor.KEYS.USER_WATCHLIST(userId);
    return await this.set(
      key,
      watchlist,
      redisConfig.constructor.TTL.USER_DATA
    );
  }

  /**
   * Get cached watchlist
   */
  async getWatchlist(userId) {
    const key = redisConfig.constructor.KEYS.USER_WATCHLIST(userId);
    return await this.get(key);
  }

  /**
   * Clear user watchlist cache
   */
  async clearWatchlist(userId) {
    const key = redisConfig.constructor.KEYS.USER_WATCHLIST(userId);
    return await this.del(key);
  }

  /**
   * Cache user goals
   */
  async cacheGoals(userId, goals) {
    const key = redisConfig.constructor.KEYS.USER_GOALS(userId);
    return await this.set(key, goals, redisConfig.constructor.TTL.USER_DATA);
  }

  /**
   * Get cached goals
   */
  async getGoals(userId) {
    const key = redisConfig.constructor.KEYS.USER_GOALS(userId);
    return await this.get(key);
  }

  /**
   * Clear user goals cache
   */
  async clearGoals(userId) {
    const key = redisConfig.constructor.KEYS.USER_GOALS(userId);
    return await this.del(key);
  }

  // ==================== CACHE INVALIDATION ====================

  /**
   * Invalidate all fund caches
   */
  async invalidateFundCaches() {
    await this.clearPattern('fund:*');
    await this.clearPattern('funds:*');
    console.log('🗑️ All fund caches invalidated');
  }

  /**
   * Invalidate specific fund cache
   */
  async invalidateFundCache(fundId) {
    await this.del(redisConfig.constructor.KEYS.FUND_BY_ID(fundId));
    await this.del(redisConfig.constructor.KEYS.FUND_NAV(fundId));
    await this.del(redisConfig.constructor.KEYS.FUND_HOLDINGS(fundId));
  }

  /**
   * Invalidate market index caches
   */
  async invalidateMarketCaches() {
    await this.clearPattern('market:*');
    console.log('🗑️ All market index caches invalidated');
  }

  /**
   * Invalidate user caches
   */
  async invalidateUserCaches(userId) {
    await this.clearWatchlist(userId);
    await this.clearGoals(userId);
    await this.del(redisConfig.constructor.KEYS.USER_PORTFOLIO(userId));
  }

  /**
   * Get cache statistics
   */
  async getStats() {
    return await redisConfig.getStats();
  }
}

// Singleton instance
const cacheClient = new RedisCacheClient();

module.exports = cacheClient;
