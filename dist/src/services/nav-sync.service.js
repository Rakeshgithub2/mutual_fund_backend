/**
 * Daily NAV Sync Service
 * Runs: Every day at 6 PM (Trading days only)
 * Fetches latest NAV from AMFI and updates MongoDB + Redis
 */

const cron = require('node-cron');
const axios = require('axios');
const FundStaticMaster = require('../models/FundStaticMaster.model');
const FundNavDaily = require('../models/FundNavDaily.model');
const { redisCache } = require('./redis.service');
const { isMarketHoliday, getLastTradingDay } = require('../utils/market.utils');

class NAVSyncService {
  constructor() {
    this.isRunning = false;
    this.lastSync = null;
  }

  /**
   * Start NAV sync cron job
   * Runs at 6:00 PM IST on weekdays (Mon-Fri)
   */
  startCron() {
    // Run at 6:00 PM IST (18:00) Monday to Friday
    cron.schedule(
      '0 18 * * 1-5',
      async () => {
        console.log('🕐 NAV Sync Cron triggered at', new Date().toISOString());
        await this.syncNAV();
      },
      {
        timezone: 'Asia/Kolkata',
      }
    );

    console.log('✅ NAV Sync cron job started (Daily 6 PM IST, Mon-Fri)');
  }

  /**
   * Main sync function
   */
  async syncNAV() {
    if (this.isRunning) {
      console.log('⚠️ NAV sync already in progress');
      return;
    }

    try {
      this.isRunning = true;
      console.log('🔄 Starting NAV sync...');

      // Check if market is open today
      const today = new Date();
      const isHoliday = await isMarketHoliday(today);

      if (isHoliday) {
        console.log('📅 Market is closed today (Holiday/Weekend)');
        const lastTradingDay = await getLastTradingDay(today);
        console.log(
          `Using last trading day data: ${lastTradingDay.toDateString()}`
        );
        return;
      }

      // Fetch all active funds
      const activeFunds = await FundStaticMaster.find({
        fundStatus: 'Active',
        isActive: true,
      }).select('fundCode schemeCode fundName');

      console.log(`📊 Found ${activeFunds.length} active funds`);

      // Fetch NAV data from AMFI
      const navData = await this.fetchAMFINAV();

      if (!navData || navData.length === 0) {
        console.error('❌ No NAV data received from AMFI');
        return;
      }

      console.log(`📥 Received ${navData.length} NAV records`);

      // Process and update NAVs
      let updated = 0;
      let cached = 0;
      const batchSize = 100;
      const navBatch = [];

      for (const fund of activeFunds) {
        const navRecord = navData.find(
          (n) =>
            n.schemeCode === fund.schemeCode || n.fundCode === fund.fundCode
        );

        if (navRecord) {
          // Update MongoDB
          await this.updateNAVInDB(fund.fundCode, navRecord);
          updated++;

          // Prepare for Redis batch
          navBatch.push({
            fundCode: fund.fundCode,
            nav: navRecord.nav,
          });

          // Batch update Redis
          if (navBatch.length >= batchSize) {
            await redisCache.setNAVBatch(navBatch);
            cached += navBatch.length;
            navBatch.length = 0;
          }
        }
      }

      // Update remaining batch
      if (navBatch.length > 0) {
        await redisCache.setNAVBatch(navBatch);
        cached += navBatch.length;
      }

      this.lastSync = new Date();
      console.log(`✅ NAV Sync complete: ${updated} updated, ${cached} cached`);
    } catch (error) {
      console.error('❌ NAV Sync failed:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Fetch NAV data from AMFI
   */
  async fetchAMFINAV() {
    try {
      const url = 'https://www.amfiindia.com/spages/NAVAll.txt';
      const response = await axios.get(url, { timeout: 30000 });

      const lines = response.data.split('\n');
      const navData = [];

      for (const line of lines) {
        const parts = line.split(';');

        if (parts.length >= 5) {
          const schemeCode = parts[0]?.trim();
          const nav = parseFloat(parts[4]?.trim());
          const navDate = this.parseAMFIDate(parts[7]?.trim());

          if (schemeCode && !isNaN(nav) && navDate) {
            navData.push({
              schemeCode,
              fundCode: schemeCode,
              nav,
              navDate,
            });
          }
        }
      }

      return navData;
    } catch (error) {
      console.error('Failed to fetch AMFI NAV:', error);
      return [];
    }
  }

  /**
   * Parse AMFI date format (DD-MMM-YYYY)
   */
  parseAMFIDate(dateStr) {
    if (!dateStr) return null;

    try {
      const [day, month, year] = dateStr.split('-');
      const months = {
        Jan: 0,
        Feb: 1,
        Mar: 2,
        Apr: 3,
        May: 4,
        Jun: 5,
        Jul: 6,
        Aug: 7,
        Sep: 8,
        Oct: 9,
        Nov: 10,
        Dec: 11,
      };

      return new Date(year, months[month], day);
    } catch (error) {
      return null;
    }
  }

  /**
   * Update NAV in database
   */
  async updateNAVInDB(fundCode, navRecord) {
    try {
      // Get previous NAV for comparison
      const previousNav = await FundNavDaily.findOne({ fundCode })
        .sort({ navDate: -1 })
        .limit(1);

      const navChange = previousNav ? navRecord.nav - previousNav.nav : 0;

      const navChangePercent =
        previousNav && previousNav.nav > 0
          ? (navChange / previousNav.nav) * 100
          : 0;

      // Insert new NAV record
      await FundNavDaily.findOneAndUpdate(
        { fundCode, navDate: navRecord.navDate },
        {
          $set: {
            nav: navRecord.nav,
            previousNav: previousNav?.nav || null,
            navChange,
            navChangePercent,
            isVerified: true,
            dataSource: 'AMFI',
            updatedAt: new Date(),
          },
        },
        { upsert: true }
      );

      return true;
    } catch (error) {
      console.error(`Failed to update NAV for ${fundCode}:`, error);
      return false;
    }
  }

  /**
   * Manual sync trigger (for testing)
   */
  async manualSync() {
    console.log('🔧 Manual NAV sync triggered');
    await this.syncNAV();
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
    const today6PM = new Date(now);
    today6PM.setHours(18, 0, 0, 0);

    if (now < today6PM) {
      return today6PM;
    } else {
      const tomorrow6PM = new Date(today6PM);
      tomorrow6PM.setDate(tomorrow6PM.getDate() + 1);
      return tomorrow6PM;
    }
  }
}

// Singleton instance
const navSyncService = new NAVSyncService();

module.exports = { navSyncService, NAVSyncService };
