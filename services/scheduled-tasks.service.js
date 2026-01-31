/**
 * Scheduled Tasks Service
 * Handles automatic updates for:
 * 1. Fund NAV & Returns (daily during market hours)
 * 2. Market Indices (every 2 hours during market hours)
 */

const cron = require('node-cron');
const fundReturnsService = require('./fetch-fund-returns.service');
const marketIndicesService = require('../src/services/marketIndices.service');

class ScheduledTasksService {
  constructor() {
    this.tasks = [];
  }

  /**
   * Check if market is open (9:15 AM - 3:30 PM IST, Mon-Fri)
   */
  isMarketOpen() {
    const now = new Date();
    const istTime = new Date(
      now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })
    );

    const day = istTime.getDay(); // 0 = Sunday, 6 = Saturday
    const hour = istTime.getHours();
    const minute = istTime.getMinutes();

    // Weekend check
    if (day === 0 || day === 6) {
      return false;
    }

    // Market hours: 9:15 AM - 3:30 PM
    const currentMinutes = hour * 60 + minute;
    const marketOpen = 9 * 60 + 15; // 9:15 AM
    const marketClose = 15 * 60 + 30; // 3:30 PM

    return currentMinutes >= marketOpen && currentMinutes <= marketClose;
  }

  /**
   * Update market indices
   */
  async updateMarketIndices() {
    console.log('\n📊 [SCHEDULED] Updating market indices...');

    try {
      const isOpen = this.isMarketOpen();

      if (isOpen) {
        console.log('✅ Market is OPEN - Fetching live data');
        await marketIndicesService.updateAllIndices();
      } else {
        console.log(
          '⏸️  Market is CLOSED - Skipping update (showing last values)'
        );
      }
    } catch (error) {
      console.error('❌ Error updating market indices:', error.message);
    }
  }

  /**
   * Update fund NAV and returns (daily)
   */
  async updateFundReturns() {
    console.log('\n📈 [SCHEDULED] Updating fund returns...');

    try {
      // Update top 1000 most popular funds first
      await fundReturnsService.updateAllFunds({
        limit: 1000,
        skipExisting: false,
      });

      console.log('✅ Fund returns updated successfully');
    } catch (error) {
      console.error('❌ Error updating fund returns:', error.message);
    }
  }

  /**
   * Start all scheduled tasks
   */
  start() {
    console.log('\n🚀 Starting scheduled tasks...\n');

    // ========================================
    // TASK 1: Update Market Indices
    // Runs every 2 hours during market hours
    // ========================================
    const marketIndicesTask = cron.schedule(
      '0 */2 * * 1-5',
      async () => {
        await this.updateMarketIndices();
      },
      {
        timezone: 'Asia/Kolkata',
      }
    );

    this.tasks.push({
      name: 'Market Indices Update',
      schedule: 'Every 2 hours (Mon-Fri)',
      task: marketIndicesTask,
    });

    console.log('✅ Scheduled: Market Indices Update (Every 2 hours, Mon-Fri)');

    // ========================================
    // TASK 2: Update Fund NAV & Returns
    // Runs daily at 6:00 PM IST (after market close)
    // ========================================
    const fundReturnsTask = cron.schedule(
      '0 18 * * 1-5',
      async () => {
        await this.updateFundReturns();
      },
      {
        timezone: 'Asia/Kolkata',
      }
    );

    this.tasks.push({
      name: 'Fund Returns Update',
      schedule: '6:00 PM daily (Mon-Fri)',
      task: fundReturnsTask,
    });

    console.log('✅ Scheduled: Fund Returns Update (6:00 PM daily, Mon-Fri)');

    // ========================================
    // TASK 3: Quick NAV Update during market hours
    // Runs every hour during market hours
    // ========================================
    const quickNavTask = cron.schedule(
      '0 * * * 1-5',
      async () => {
        if (this.isMarketOpen()) {
          console.log('\n📊 [SCHEDULED] Quick NAV update (market hours)');
          await fundReturnsService.updateAllFunds({
            limit: 100, // Top 100 popular funds
            skipExisting: false,
          });
        }
      },
      {
        timezone: 'Asia/Kolkata',
      }
    );

    this.tasks.push({
      name: 'Quick NAV Update',
      schedule: 'Every hour during market (Mon-Fri)',
      task: quickNavTask,
    });

    console.log(
      '✅ Scheduled: Quick NAV Update (Every hour during market, Mon-Fri)'
    );

    // ========================================
    // Initial update on startup
    // ========================================
    console.log('\n🔄 Running initial update...');
    this.updateMarketIndices();

    console.log('\n✅ All scheduled tasks started!\n');
    this.printSchedule();
  }

  /**
   * Stop all scheduled tasks
   */
  stop() {
    console.log('\n⏹️  Stopping scheduled tasks...');

    this.tasks.forEach((task) => {
      task.task.stop();
      console.log(`✅ Stopped: ${task.name}`);
    });

    console.log('✅ All tasks stopped\n');
  }

  /**
   * Print schedule summary
   */
  printSchedule() {
    console.log('📅 SCHEDULE SUMMARY:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    this.tasks.forEach((task) => {
      console.log(`   ${task.name}: ${task.schedule}`);
    });
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const isOpen = this.isMarketOpen();
    console.log(`📈 Market Status: ${isOpen ? '🟢 OPEN' : '🔴 CLOSED'}`);
    console.log(
      `⏰ Current Time (IST): ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}\n`
    );
  }
}

module.exports = new ScheduledTasksService();
