/**
 * Market Index Update Job
 * Updates market indices every 2 hours during market hours
 */

const MarketIndex = require('../models/MarketIndex.model');
const cacheClient = require('../cache/redis.client');
const MarketHoursUtil = require('../utils/marketHours.util');
const DateUtil = require('../utils/date.util');
const axios = require('axios');

class MarketIndexJob {
  constructor() {
    // Define indices to track
    this.indices = [
      {
        symbol: 'NIFTY50',
        name: 'NIFTY 50',
        category: 'BROAD_MARKET',
        exchange: 'NSE',
        displayOrder: 1,
      },
      {
        symbol: 'SENSEX',
        name: 'BSE SENSEX',
        category: 'BROAD_MARKET',
        exchange: 'BSE',
        displayOrder: 2,
      },
      {
        symbol: 'BANKNIFTY',
        name: 'NIFTY BANK',
        category: 'SECTORAL',
        exchange: 'NSE',
        displayOrder: 3,
      },
      {
        symbol: 'FINNIFTY',
        name: 'NIFTY FINANCIAL',
        category: 'SECTORAL',
        exchange: 'NSE',
        displayOrder: 4,
      },
      {
        symbol: 'NIFTYMIDCAP',
        name: 'NIFTY MIDCAP 100',
        category: 'BROAD_MARKET',
        exchange: 'NSE',
        displayOrder: 5,
      },
      {
        symbol: 'NIFTYSMALLCAP',
        name: 'NIFTY SMALLCAP 100',
        category: 'BROAD_MARKET',
        exchange: 'NSE',
        displayOrder: 6,
      },
      {
        symbol: 'NIFTYIT',
        name: 'NIFTY IT',
        category: 'SECTORAL',
        exchange: 'NSE',
        displayOrder: 7,
      },
      {
        symbol: 'NIFTYPHARMA',
        name: 'NIFTY PHARMA',
        category: 'SECTORAL',
        exchange: 'NSE',
        displayOrder: 8,
      },
      {
        symbol: 'NIFTYAUTO',
        name: 'NIFTY AUTO',
        category: 'SECTORAL',
        exchange: 'NSE',
        displayOrder: 9,
      },
      {
        symbol: 'NIFTYFMCG',
        name: 'NIFTY FMCG',
        category: 'SECTORAL',
        exchange: 'NSE',
        displayOrder: 10,
      },
    ];
  }

  /**
   * Check if should run
   */
  shouldRun() {
    if (!MarketHoursUtil.isMarketOpen()) {
      console.log('⏸️ Market is closed, skipping index update');
      return false;
    }
    return true;
  }

  /**
   * Fetch index data from NSE/BSE
   * Note: In production, use official APIs or data providers
   */
  async fetchIndexData() {
    try {
      console.log('📊 Fetching market index data...');

      // This is a placeholder - in production, use:
      // - NSE API
      // - BSE API
      // - Financial data providers (Alpha Vantage, Yahoo Finance, etc.)

      const mockData = this.generateMockData();
      return mockData;
    } catch (error) {
      console.error('❌ Error fetching index data:', error.message);
      throw error;
    }
  }

  /**
   * Generate mock data for demonstration
   * Replace with real API calls in production
   */
  generateMockData() {
    const marketStatus = MarketHoursUtil.getMarketStatus();

    return this.indices.map((index) => {
      const baseValue = this.getBaseValue(index.symbol);
      const change = (Math.random() - 0.5) * 2; // -1% to +1%
      const changeValue = baseValue * (change / 100);

      return {
        symbol: index.symbol,
        name: index.name,
        value: parseFloat((baseValue + changeValue).toFixed(2)),
        change: {
          value: parseFloat(changeValue.toFixed(2)),
          percent: parseFloat(change.toFixed(2)),
        },
        open: parseFloat((baseValue - Math.random() * 100).toFixed(2)),
        high: parseFloat((baseValue + Math.random() * 200).toFixed(2)),
        low: parseFloat((baseValue - Math.random() * 150).toFixed(2)),
        close: baseValue,
        previousClose: baseValue,
        volume: Math.floor(Math.random() * 10000000),
        marketStatus: marketStatus,
        category: index.category,
        exchange: index.exchange,
        displayOrder: index.displayOrder,
        isActive: true,
      };
    });
  }

  /**
   * Get base value for index (for mock data)
   */
  getBaseValue(symbol) {
    const baseValues = {
      NIFTY50: 21500,
      SENSEX: 71000,
      BANKNIFTY: 46000,
      FINNIFTY: 20000,
      NIFTYMIDCAP: 45000,
      NIFTYSMALLCAP: 13000,
      NIFTYIT: 32000,
      NIFTYPHARMA: 16000,
      NIFTYAUTO: 18000,
      NIFTYFMCG: 52000,
    };
    return baseValues[symbol] || 10000;
  }

  /**
   * Update indices in database
   */
  async updateIndices(indicesData) {
    try {
      console.log(`📊 Updating ${indicesData.length} indices...`);

      const bulkOps = indicesData.map((data) => ({
        updateOne: {
          filter: { symbol: data.symbol },
          update: {
            $set: {
              ...data,
              lastUpdated: new Date(),
            },
          },
          upsert: true,
        },
      }));

      const result = await MarketIndex.bulkWrite(bulkOps);
      console.log(
        `✅ Updated ${result.upsertedCount + result.modifiedCount} indices`
      );

      return result;
    } catch (error) {
      console.error('❌ Error updating indices:', error.message);
      throw error;
    }
  }

  /**
   * Update cache
   */
  async updateCache(indicesData) {
    try {
      console.log('🔄 Updating cache...');

      // Cache all indices
      await cacheClient.cacheAllIndices(indicesData);

      // Cache individual indices
      for (const index of indicesData) {
        await cacheClient.cacheMarketIndex(index.symbol, index);
      }

      console.log('✅ Cache updated');
    } catch (error) {
      console.error('⚠️ Error updating cache:', error.message);
    }
  }

  /**
   * Main job execution
   */
  async execute() {
    const startTime = Date.now();
    console.log('🚀 Starting market index update job...');
    console.log(`⏰ Time: ${DateUtil.formatDateTime(new Date())}`);

    try {
      // Check if should run
      if (!this.shouldRun()) {
        return {
          success: true,
          skipped: true,
          reason: 'Market closed',
        };
      }

      // Step 1: Fetch index data
      const indicesData = await this.fetchIndexData();

      // Step 2: Update database
      const result = await this.updateIndices(indicesData);

      // Step 3: Update cache
      await this.updateCache(indicesData);

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      console.log('✅ Market index update completed');
      console.log(`📊 Stats: ${indicesData.length} indices updated`);
      console.log(`⏱️ Duration: ${duration}s`);

      return {
        success: true,
        indicesUpdated: indicesData.length,
        duration: duration,
      };
    } catch (error) {
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      console.error('❌ Market index update failed');
      console.error(`Error: ${error.message}`);
      console.error(`⏱️ Duration: ${duration}s`);

      return {
        success: false,
        error: error.message,
        duration: duration,
      };
    }
  }
}

// Export singleton instance
const marketIndexJob = new MarketIndexJob();

module.exports = marketIndexJob;
