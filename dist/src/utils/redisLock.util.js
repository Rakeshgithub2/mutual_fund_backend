/**
 * ═══════════════════════════════════════════════════════════════════════
 * REDIS DISTRIBUTED LOCK FOR MARKET INDICES
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Prevents multiple servers/workers from fetching indices simultaneously.
 * Uses Redis SET NX with TTL for atomic lock acquisition.
 *
 * Features:
 * - Atomic lock acquisition (SET NX)
 * - Automatic expiry (prevents deadlocks)
 * - Lock extension for long operations
 * - Owner verification for safe release
 */

const Redis = require('ioredis');
const crypto = require('crypto');

class RedisLock {
  constructor(redisClient) {
    this.redis = redisClient;
    this.lockId = crypto.randomBytes(16).toString('hex'); // Unique identifier for this instance
  }

  /**
   * Acquire a distributed lock
   * @param {string} lockKey - The key to lock
   * @param {number} ttlSeconds - Lock timeout in seconds
   * @returns {Promise<boolean>} - True if lock acquired
   */
  async acquireLock(lockKey, ttlSeconds = 240) {
    try {
      // SET key value NX EX ttl - Only sets if key doesn't exist
      const result = await this.redis.set(
        lockKey,
        this.lockId,
        'NX',
        'EX',
        ttlSeconds
      );

      return result === 'OK';
    } catch (error) {
      console.error('❌ Failed to acquire lock:', error.message);
      return false;
    }
  }

  /**
   * Release a distributed lock (only if we own it)
   * @param {string} lockKey - The key to unlock
   * @returns {Promise<boolean>} - True if lock released
   */
  async releaseLock(lockKey) {
    try {
      // Lua script to atomically check and delete
      const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `;

      const result = await this.redis.eval(script, 1, lockKey, this.lockId);
      return result === 1;
    } catch (error) {
      console.error('❌ Failed to release lock:', error.message);
      return false;
    }
  }

  /**
   * Extend lock TTL (only if we own it)
   * @param {string} lockKey - The key to extend
   * @param {number} ttlSeconds - New TTL in seconds
   * @returns {Promise<boolean>} - True if extended
   */
  async extendLock(lockKey, ttlSeconds = 240) {
    try {
      const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("expire", KEYS[1], ARGV[2])
        else
          return 0
        end
      `;

      const result = await this.redis.eval(
        script,
        1,
        lockKey,
        this.lockId,
        ttlSeconds
      );
      return result === 1;
    } catch (error) {
      console.error('❌ Failed to extend lock:', error.message);
      return false;
    }
  }

  /**
   * Check if lock exists
   * @param {string} lockKey - The key to check
   * @returns {Promise<boolean>} - True if lock exists
   */
  async isLocked(lockKey) {
    try {
      const exists = await this.redis.exists(lockKey);
      return exists === 1;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get lock TTL
   * @param {string} lockKey - The key to check
   * @returns {Promise<number>} - TTL in seconds, -1 if no TTL, -2 if not exists
   */
  async getLockTTL(lockKey) {
    try {
      return await this.redis.ttl(lockKey);
    } catch (error) {
      return -2;
    }
  }
}

// Lock keys for market indices
const LOCK_KEYS = {
  MARKET_INDICES_UPDATE: 'lock:market:indices:update',
  MARKET_INDICES_HISTORY: 'lock:market:indices:history',
};

// Cache keys for market indices
const CACHE_KEYS = {
  INDICES_LATEST: 'market:indices:latest',
  INDICES_SNAPSHOT: 'market:indices:snapshot',
  MARKET_STATUS: 'market:status',
};

// TTL configuration
const TTL_CONFIG = {
  LOCK_TTL: 240, // 4 minutes (less than 5-minute interval)
  CACHE_TTL_OPEN: 300, // 5 minutes during market hours
  CACHE_TTL_CLOSED: 3600, // 1 hour when market closed
  HISTORY_TTL: 86400, // 24 hours for historical snapshots
};

module.exports = {
  RedisLock,
  LOCK_KEYS,
  CACHE_KEYS,
  TTL_CONFIG,
};
