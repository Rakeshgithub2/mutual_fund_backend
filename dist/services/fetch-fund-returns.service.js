/**
 * Service to fetch fund returns and NAV data from MFAPI
 * Updates dynamic data: NAV, returns (1D, 1W, 1M, 3M, 6M, 1Y, 3Y, 5Y)
 */

const axios = require('axios');
const Fund = require('../src/models/Fund.model');

class FundReturnsService {
  constructor() {
    this.MFAPI_BASE = 'https://api.mfapi.in/mf';
    this.batchSize = 10; // Process 10 funds at a time
    this.delayBetweenBatches = 2000; // 2 seconds delay between batches
  }

  /**
   * Calculate returns from NAV history
   * @param {Array} navHistory - Array of {date, nav} objects sorted by date descending
   * @returns {Object} - Returns object with 1D, 1W, 1M, 3M, 6M, 1Y, 3Y, 5Y
   */
  calculateReturns(navHistory) {
    if (!navHistory || navHistory.length === 0) {
      return {};
    }

    const latestNav = parseFloat(navHistory[0].nav);
    const returns = {};

    // Define periods in days
    const periods = {
      '1D': 1,
      '1W': 7,
      '1M': 30,
      '3M': 90,
      '6M': 180,
      '1Y': 365,
      '3Y': 365 * 3,
      '5Y': 365 * 5,
    };

    // Calculate returns for each period
    for (const [period, days] of Object.entries(periods)) {
      const historicalNav = this.getNavAtDaysAgo(navHistory, days);
      if (historicalNav) {
        const returnPct = ((latestNav - historicalNav) / historicalNav) * 100;
        returns[period] = parseFloat(returnPct.toFixed(2));
      }
    }

    return returns;
  }

  /**
   * Get NAV value from X days ago
   * @param {Array} navHistory - NAV history array
   * @param {Number} daysAgo - Number of days to look back
   * @returns {Number|null} - NAV value or null
   */
  getNavAtDaysAgo(navHistory, daysAgo) {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() - daysAgo);

    // Find closest NAV to target date
    let closestNav = null;
    let closestDiff = Infinity;

    for (const entry of navHistory) {
      const entryDate = new Date(entry.date);
      const diff = Math.abs(entryDate - targetDate);

      if (diff < closestDiff) {
        closestDiff = diff;
        closestNav = parseFloat(entry.nav);
      }

      // If we've gone past the target date, stop
      if (entryDate < targetDate) break;
    }

    return closestNav;
  }

  /**
   * Fetch NAV and returns data for a single fund
   * @param {String} schemeCode - AMFI scheme code
   * @returns {Object|null} - Fund data with NAV and returns
   */
  async fetchFundData(schemeCode) {
    try {
      const response = await axios.get(`${this.MFAPI_BASE}/${schemeCode}`, {
        timeout: 10000,
      });

      if (!response.data || !response.data.data) {
        return null;
      }

      const fundData = response.data;
      const navHistory = fundData.data;

      if (!navHistory || navHistory.length === 0) {
        return null;
      }

      // Get latest NAV
      const latestNav = parseFloat(navHistory[0].nav);
      const navDate = new Date(navHistory[0].date);

      // Calculate returns
      const returns = this.calculateReturns(navHistory);

      return {
        currentNav: latestNav,
        navDate: navDate,
        returns: returns,
        lastUpdated: new Date(),
      };
    } catch (error) {
      if (error.code === 'ECONNABORTED') {
        console.log(`⏱️  Timeout for scheme ${schemeCode}`);
      } else if (error.response?.status === 404) {
        console.log(`❌ Not found: ${schemeCode}`);
      } else {
        console.log(`❌ Error fetching ${schemeCode}: ${error.message}`);
      }
      return null;
    }
  }

  /**
   * Update returns data for all funds in batches
   * @param {Object} options - Update options
   * @returns {Object} - Update statistics
   */
  async updateAllFunds(options = {}) {
    const { limit = null, skipExisting = false } = options;

    console.log('\n🚀 Starting fund returns update...\n');

    // Build query
    const query = { status: 'Active' };
    if (skipExisting) {
      query['returns.1Y'] = { $exists: false };
    }

    // Get funds with scheme codes
    const funds = await Fund.find(query)
      .select('_id schemeCode schemeName returns currentNav')
      .limit(limit)
      .lean();

    console.log(`📊 Found ${funds.length} funds to update\n`);

    const stats = {
      total: funds.length,
      updated: 0,
      failed: 0,
      skipped: 0,
      startTime: Date.now(),
    };

    // Process in batches
    for (let i = 0; i < funds.length; i += this.batchSize) {
      const batch = funds.slice(i, i + this.batchSize);

      // Process batch concurrently
      const promises = batch.map(async (fund) => {
        if (!fund.schemeCode) {
          stats.skipped++;
          return;
        }

        const fundData = await this.fetchFundData(fund.schemeCode);

        if (fundData) {
          try {
            await Fund.updateOne(
              { _id: fund._id },
              {
                $set: {
                  currentNav: fundData.currentNav,
                  'nav.value': fundData.currentNav,
                  'nav.date': fundData.navDate,
                  returns: fundData.returns,
                  'metadata.lastUpdated': fundData.lastUpdated,
                },
              }
            );
            stats.updated++;

            if (stats.updated % 50 === 0) {
              const elapsed = ((Date.now() - stats.startTime) / 1000).toFixed(
                1
              );
              console.log(
                `✅ Progress: ${stats.updated}/${funds.length} (${elapsed}s)`
              );
            }
          } catch (error) {
            console.error(`❌ DB update failed for ${fund.schemeName}`);
            stats.failed++;
          }
        } else {
          stats.failed++;
        }
      });

      await Promise.all(promises);

      // Delay between batches to avoid rate limiting
      if (i + this.batchSize < funds.length) {
        await new Promise((resolve) =>
          setTimeout(resolve, this.delayBetweenBatches)
        );
      }
    }

    const totalTime = ((Date.now() - stats.startTime) / 1000).toFixed(1);

    console.log('\n📊 Update Complete!');
    console.log(`   Total: ${stats.total}`);
    console.log(`   ✅ Updated: ${stats.updated}`);
    console.log(`   ❌ Failed: ${stats.failed}`);
    console.log(`   ⏭️  Skipped: ${stats.skipped}`);
    console.log(`   ⏱️  Time: ${totalTime}s\n`);

    return stats;
  }

  /**
   * Update specific fund by scheme code
   * @param {String} schemeCode - AMFI scheme code
   * @returns {Boolean} - Success status
   */
  async updateSingleFund(schemeCode) {
    const fundData = await this.fetchFundData(schemeCode);

    if (!fundData) {
      return false;
    }

    await Fund.updateOne(
      { schemeCode },
      {
        $set: {
          currentNav: fundData.currentNav,
          'nav.value': fundData.currentNav,
          'nav.date': fundData.navDate,
          returns: fundData.returns,
          'metadata.lastUpdated': fundData.lastUpdated,
        },
      }
    );

    return true;
  }
}

module.exports = new FundReturnsService();
