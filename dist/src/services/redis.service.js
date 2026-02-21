/**
 * Redis Cache Service
 * Fast access layer for live NAV and market data
 */

const Redis = require('ioredis');

class RedisCache {
  constructor() {
    this.client = null;
    this.isConnected = false;
  }

  /**
   * Initialize Redis connection
   */
  async connect() {
    try {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

      this.client = new Redis(redisUrl, {
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        maxRetriesPerRequest: 3,
      });

      this.client.on('connect', () => {
        console.log('✅ Redis connected');
        this.isConnected = true;
      });

      this.client.on('error', (err) => {
        console.error('❌ Redis error:', err);
        this.isConnected = false;
      });

      return this.client;
    } catch (error) {
      console.error('❌ Redis connection failed:', error);
      this.isConnected = false;
      return null;
    }
  }

  /**
   * Set NAV in cache
   */
  async setNAV(fundCode, nav, ttl = 86400) {
    if (!this.isConnected) return false;

    try {
      const key = `NAV:${fundCode}`;
      await this.client.set(key, nav, 'EX', ttl);
      return true;
    } catch (error) {
      console.error(`Failed to cache NAV for ${fundCode}:`, error);
      return false;
    }
  }

  /**
   * Get NAV from cache
   */
  async getNAV(fundCode) {
    if (!this.isConnected) return null;

    try {
      const key = `NAV:${fundCode}`;
      const nav = await this.client.get(key);
      return nav ? parseFloat(nav) : null;
    } catch (error) {
      console.error(`Failed to get NAV for ${fundCode}:`, error);
      return null;
    }
  }

  /**
   * Set multiple NAVs in batch
   */
  async setNAVBatch(navData) {
    if (!this.isConnected) return false;

    try {
      const pipeline = this.client.pipeline();

      for (const { fundCode, nav } of navData) {
        const key = `NAV:${fundCode}`;
        pipeline.set(key, nav, 'EX', 86400);
      }

      await pipeline.exec();
      return true;
    } catch (error) {
      console.error('Failed to batch cache NAVs:', error);
      return false;
    }
  }

  /**
   * Set Market Index value
   */
  async setIndex(indexCode, value, ttl = 3600) {
    if (!this.isConnected) return false;

    try {
      const key = `INDEX:${indexCode}`;
      const data = JSON.stringify(value);
      await this.client.set(key, data, 'EX', ttl);
      return true;
    } catch (error) {
      console.error(`Failed to cache index ${indexCode}:`, error);
      return false;
    }
  }

  /**
   * Get Market Index value
   */
  async getIndex(indexCode) {
    if (!this.isConnected) return null;

    try {
      const key = `INDEX:${indexCode}`;
      const data = await this.client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error(`Failed to get index ${indexCode}:`, error);
      return null;
    }
  }

  /**
   * Get all market indices
   */
  async getAllIndices() {
    if (!this.isConnected) return null;

    try {
      const keys = await this.client.keys('INDEX:*');
      if (!keys || keys.length === 0) return {};

      const values = await this.client.mget(keys);
      const indices = {};

      keys.forEach((key, index) => {
        const indexCode = key.replace('INDEX:', '');
        try {
          indices[indexCode] = JSON.parse(values[index]);
        } catch (e) {
          console.error(`Failed to parse index ${indexCode}`);
        }
      });

      return indices;
    } catch (error) {
      console.error('Failed to get all indices:', error);
      return null;
    }
  }

  /**
   * Check if market is open
   */
  async isMarketOpen() {
    if (!this.isConnected) return false;

    try {
      const status = await this.client.get('MARKET:STATUS');
      return status === 'OPEN';
    } catch (error) {
      console.error('Failed to get market status:', error);
      return false;
    }
  }

  /**
   * Set market status
   */
  async setMarketStatus(status) {
    if (!this.isConnected) return false;

    try {
      await this.client.set('MARKET:STATUS', status, 'EX', 3600);
      return true;
    } catch (error) {
      console.error('Failed to set market status:', error);
      return false;
    }
  }

  /**
   * Clear all cache
   */
  async clearAll() {
    if (!this.isConnected) return false;

    try {
      await this.client.flushall();
      console.log('✅ Redis cache cleared');
      return true;
    } catch (error) {
      console.error('Failed to clear cache:', error);
      return false;
    }
  }

  /**
   * Disconnect Redis
   */
  async disconnect() {
    if (this.client) {
      await this.client.quit();
      this.isConnected = false;
      console.log('✅ Redis disconnected');
    }
  }
}

// Singleton instance
const redisCache = new RedisCache();

module.exports = { redisCache, RedisCache };
