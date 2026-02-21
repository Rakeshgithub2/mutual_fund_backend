/**
 * Daily NAV Update Job
 * Updates NAV for all funds every day at 9:30 PM IST
 */

const FundNav = require('../models/FundNav.model');
const Fund = require('../models/Fund.model');
const cacheClient = require('../cache/redis.client');
const DateUtil = require('../utils/date.util');
const axios = require('axios');

class DailyNavJob {
  /**
   * Fetch NAV data from AMFI
   */
  async fetchAMFIData() {
    try {
      console.log('📊 Fetching NAV data from AMFI...');

      const response = await axios.get(
        'https://www.amfiindia.com/spages/NAVAll.txt',
        {
          timeout: 30000,
        }
      );

      return this.parseAMFIData(response.data);
    } catch (error) {
      console.error('❌ Error fetching AMFI data:', error.message);
      throw error;
    }
  }

  /**
   * Parse AMFI NAV data
   */
  parseAMFIData(data) {
    const lines = data.split('\n');
    const funds = [];

    for (const line of lines) {
      if (!line.trim() || line.includes('Scheme Name')) continue;

      const parts = line.split(';');
      if (parts.length >= 5) {
        funds.push({
          schemeCode: parts[0].trim(),
          schemeName: parts[3].trim(),
          nav: parseFloat(parts[4].trim()),
          date: DateUtil.parseAMFIDate(
            parts[7]?.trim() || DateUtil.formatAMFIDate(new Date())
          ),
        });
      }
    }

    console.log(`✓ Parsed ${funds.length} funds from AMFI`);
    return funds;
  }

  /**
   * Update NAV data in database
   */
  async updateNavData(navData) {
    try {
      console.log(`📊 Updating NAV for ${navData.length} funds...`);

      const bulkOps = navData.map((fund) => ({
        updateOne: {
          filter: {
            schemeCode: fund.schemeCode,
            date: fund.date,
          },
          update: {
            $set: {
              schemeName: fund.schemeName,
              nav: fund.nav,
              source: 'AMFI',
              isTradingDay: true,
            },
          },
          upsert: true,
        },
      }));

      // Batch process (1000 at a time)
      const batchSize = 1000;
      let processed = 0;

      for (let i = 0; i < bulkOps.length; i += batchSize) {
        const batch = bulkOps.slice(i, i + batchSize);
        await FundNav.bulkWrite(batch);
        processed += batch.length;
        console.log(`  ✓ Processed ${processed}/${navData.length} funds`);
      }

      console.log(`✅ Updated NAV for ${processed} funds`);
      return processed;
    } catch (error) {
      console.error('❌ Error updating NAV data:', error.message);
      throw error;
    }
  }

  /**
   * Update Fund collection with latest NAV
   */
  async updateFundCollection(navData) {
    try {
      console.log('📊 Updating Fund collection with latest NAV...');

      const bulkOps = navData.map((fund) => ({
        updateOne: {
          filter: { schemeCode: fund.schemeCode },
          update: {
            $set: {
              'nav.value': fund.nav,
              'nav.date': fund.date,
              'metadata.lastUpdated': new Date(),
            },
          },
        },
      }));

      const batchSize = 1000;
      let processed = 0;

      for (let i = 0; i < bulkOps.length; i += batchSize) {
        const batch = bulkOps.slice(i, i + batchSize);
        const result = await Fund.bulkWrite(batch);
        processed += result.modifiedCount;
        console.log(`  ✓ Updated ${processed} funds in main collection`);
      }

      console.log(`✅ Updated ${processed} funds in main collection`);
      return processed;
    } catch (error) {
      console.error('❌ Error updating Fund collection:', error.message);
      throw error;
    }
  }

  /**
   * Invalidate cache
   */
  async invalidateCache() {
    try {
      console.log('🗑️ Invalidating fund caches...');
      await cacheClient.invalidateFundCaches();
      console.log('✅ Cache invalidated');
    } catch (error) {
      console.error('⚠️ Error invalidating cache:', error.message);
    }
  }

  /**
   * Main job execution
   */
  async execute() {
    const startTime = Date.now();
    console.log('🚀 Starting daily NAV update job...');
    console.log(`⏰ Time: ${DateUtil.formatDateTime(new Date())}`);

    try {
      // Step 1: Fetch AMFI data
      const navData = await this.fetchAMFIData();

      if (!navData || navData.length === 0) {
        throw new Error('No NAV data received from AMFI');
      }

      // Step 2: Update FundNav collection
      const navUpdated = await this.updateNavData(navData);

      // Step 3: Update Fund collection
      const fundsUpdated = await this.updateFundCollection(navData);

      // Step 4: Invalidate cache
      await this.invalidateCache();

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      console.log('✅ Daily NAV update completed successfully');
      console.log(
        `📊 Stats: ${navUpdated} NAVs updated, ${fundsUpdated} funds updated`
      );
      console.log(`⏱️ Duration: ${duration}s`);

      return {
        success: true,
        navsUpdated: navUpdated,
        fundsUpdated: fundsUpdated,
        duration: duration,
      };
    } catch (error) {
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      console.error('❌ Daily NAV update failed');
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
const dailyNavJob = new DailyNavJob();

module.exports = dailyNavJob;
