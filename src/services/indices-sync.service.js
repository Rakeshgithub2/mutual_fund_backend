/**
 * Market Indices Sync Service
 * Runs: Hourly during trading hours (9 AM - 4 PM IST, Mon-Fri)
 * Fetches NIFTY50, SENSEX, GIFTNIFTY, etc.
 */

const cron = require('node-cron');
const axios = require('axios');
const MarketIndicesHourly = require('../models/MarketIndicesHourly.model');
const { redisCache } = require('./redis.service');
const { isMarketHoliday, isTradingHours } = require('../utils/market.utils');

class IndicesSyncService {
  constructor() {
    this.isRunning = false;
    this.lastSync = null;
  }

  /**
   * Start indices sync cron job
   * Runs every hour during trading hours (9 AM - 4 PM IST)
   */
  startCron() {
    // Run every hour from 9 AM to 4 PM IST, Monday to Friday
    cron.schedule(
      '0 9-16 * * 1-5',
      async () => {
        console.log(
          '🕐 Indices Sync Cron triggered at',
          new Date().toISOString()
        );
        await this.syncIndices();
      },
      {
        timezone: 'Asia/Kolkata',
      }
    );

    console.log(
      '✅ Indices Sync cron job started (Hourly 9 AM-4 PM IST, Mon-Fri)'
    );
  }

  /**
   * Main sync function
   */
  async syncIndices() {
    if (this.isRunning) {
      console.log('⚠️ Indices sync already in progress');
      return;
    }

    try {
      this.isRunning = true;
      console.log('🔄 Starting market indices sync...');

      const now = new Date();

      // Check if market is open
      const isHoliday = await isMarketHoliday(now);
      const isTradingTime = await isTradingHours(now);

      if (isHoliday) {
        console.log('📅 Market is closed today (Holiday/Weekend)');
        await redisCache.setMarketStatus('CLOSED');
        return;
      }

      if (!isTradingTime) {
        console.log('⏰ Outside trading hours');
        await redisCache.setMarketStatus('CLOSED');
        return;
      }

      await redisCache.setMarketStatus('OPEN');

      // Fetch indices data
      const indicesData = await this.fetchIndicesData();

      if (!indicesData || indicesData.length === 0) {
        console.error('❌ No indices data received');
        return;
      }

      console.log(`📥 Received ${indicesData.length} indices records`);

      // Update MongoDB and Redis
      let updated = 0;
      for (const indexData of indicesData) {
        await this.updateIndexInDB(indexData);
        await redisCache.setIndex(indexData.indexCode, indexData);
        updated++;
      }

      this.lastSync = new Date();
      console.log(`✅ Indices Sync complete: ${updated} indices updated`);
    } catch (error) {
      console.error('❌ Indices Sync failed:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Fetch all market indices data
   */
  async fetchIndicesData() {
    try {
      const indices = [
        {
          code: 'NIFTY50',
          url: 'https://www.nseindia.com/api/equity-stockIndices?index=NIFTY%2050',
        },
        {
          code: 'SENSEX',
          url: 'https://www.bseindia.com/stockinfo/json/indices.aspx?index_code=16',
        },
        {
          code: 'BANKNIFTY',
          url: 'https://www.nseindia.com/api/equity-stockIndices?index=NIFTY%20BANK',
        },
        {
          code: 'NIFTY_IT',
          url: 'https://www.nseindia.com/api/equity-stockIndices?index=NIFTY%20IT',
        },
      ];

      const results = await Promise.all(
        indices.map((index) => this.fetchIndexData(index))
      );

      return results.filter((r) => r !== null);
    } catch (error) {
      console.error('Failed to fetch indices data:', error);
      return [];
    }
  }

  /**
   * Fetch individual index data
   */
  async fetchIndexData(index) {
    try {
      const response = await axios.get(index.url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0',
          Accept: 'application/json',
        },
      });

      const data = response.data;

      // Parse based on index source
      if (index.code.startsWith('NIFTY') || index.code === 'BANKNIFTY') {
        return this.parseNSEData(index.code, data);
      } else if (index.code === 'SENSEX') {
        return this.parseBSEData(index.code, data);
      }

      return null;
    } catch (error) {
      console.error(`Failed to fetch ${index.code}:`, error.message);
      return null;
    }
  }

  /**
   * Parse NSE index data
   */
  parseNSEData(indexCode, data) {
    try {
      const indexData = data.data?.[0];

      if (!indexData) return null;

      const currentValue = parseFloat(
        indexData.last || indexData.lastPrice || 0
      );
      const openValue = parseFloat(indexData.open || 0);
      const highValue = parseFloat(indexData.high || 0);
      const lowValue = parseFloat(indexData.low || 0);
      const change = parseFloat(indexData.change || 0);
      const changePercent = parseFloat(indexData.pChange || 0);

      return {
        indexCode,
        indexName: indexData.index || indexCode,
        currentValue,
        openValue,
        highValue,
        lowValue,
        previousClose: parseFloat(indexData.previousClose || 0),
        change,
        changePercent,
        volume: indexData.totalTradedVolume || 0,
        marketStatus: 'OPEN',
        timestamp: new Date(),
        dataSource: 'NSE',
      };
    } catch (error) {
      console.error(`Failed to parse NSE data for ${indexCode}:`, error);
      return null;
    }
  }

  /**
   * Parse BSE index data
   */
  parseBSEData(indexCode, data) {
    try {
      const indexData = data.Table?.[0];

      if (!indexData) return null;

      const currentValue = parseFloat(indexData.CurrentValue || 0);
      const openValue = parseFloat(indexData.OpenValue || 0);
      const highValue = parseFloat(indexData.HighValue || 0);
      const lowValue = parseFloat(indexData.LowValue || 0);
      const change = parseFloat(indexData.Change || 0);
      const changePercent = parseFloat(indexData.PerChange || 0);

      return {
        indexCode,
        indexName: 'SENSEX',
        currentValue,
        openValue,
        highValue,
        lowValue,
        previousClose: currentValue - change,
        change,
        changePercent,
        marketStatus: 'OPEN',
        timestamp: new Date(),
        dataSource: 'BSE',
      };
    } catch (error) {
      console.error(`Failed to parse BSE data for ${indexCode}:`, error);
      return null;
    }
  }

  /**
   * Update index in database
   */
  async updateIndexInDB(indexData) {
    try {
      await MarketIndicesHourly.findOneAndUpdate(
        {
          indexCode: indexData.indexCode,
          timestamp: {
            $gte: new Date(Date.now() - 3600000), // Within last hour
          },
        },
        {
          $set: {
            ...indexData,
            isVerified: true,
            updatedAt: new Date(),
          },
        },
        { upsert: true }
      );

      return true;
    } catch (error) {
      console.error(`Failed to update index ${indexData.indexCode}:`, error);
      return false;
    }
  }

  /**
   * Manual sync trigger
   */
  async manualSync() {
    console.log('🔧 Manual indices sync triggered');
    await this.syncIndices();
  }

  /**
   * Get sync status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      lastSync: this.lastSync,
      nextSync: this.getNextSyncTime(),
    };
  }

  /**
   * Get next scheduled sync time
   */
  getNextSyncTime() {
    const now = new Date();
    const nextHour = new Date(now);
    nextHour.setHours(now.getHours() + 1, 0, 0, 0);

    // If outside trading hours, set to next day 9 AM
    if (now.getHours() >= 16 || now.getHours() < 9) {
      const tomorrow9AM = new Date(now);
      tomorrow9AM.setDate(tomorrow9AM.getDate() + 1);
      tomorrow9AM.setHours(9, 0, 0, 0);
      return tomorrow9AM;
    }

    return nextHour;
  }
}

// Singleton instance
const indicesSyncService = new IndicesSyncService();

module.exports = { indicesSyncService, IndicesSyncService };
