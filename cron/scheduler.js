/**
 * ═══════════════════════════════════════════════════════════════════════
 * CRON JOB SCHEDULER - MASTER PIPELINE
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Schedules automatic updates for different data types:
 * - NAV: Every 1 hour
 * - Daily returns: Daily at 6 PM IST
 * - News: Daily at 6 AM IST (20 latest articles)
 * - Market Indices: Every 5 minutes
 * - Monthly updates: Long-term returns, AUM, expense ratio
 * - Quarterly: Holdings, Sectors
 * - Semi-annual: Fund managers
 */

const cron = require('node-cron');
const { updateAllNAV } = require('../jobs/update-nav.job');
const { updateDailyReturns } = require('../jobs/update-returns.job');
const { updateHoldings } = require('../jobs/update-holdings.job');
const { updateFundManagers } = require('../jobs/update-managers.job');
// DISABLED: Missing models - const { updateMarketIndices } = require('../jobs/update-indices.job');
// DISABLED: Missing models - const { updateNews } = require('../jobs/update-news.job');
const autoFundExpansionJob = require('../jobs/auto-fund-expansion.job');

// Production-grade market indices worker (with Redis lock + market hours check)
const marketIndicesWorker = require('../workers/market-indices.worker');

class CronScheduler {
  constructor() {
    this.tasks = [];
  }

  /**
   * Initialize all cron jobs
   */
  initializeJobs() {
    console.log('🕐 Initializing cron jobs...\n');

    // NAV Update: Every 1 hour
    this.tasks.push(
      cron.schedule(
        '0 * * * *',
        async () => {
          console.log('⏰ Running hourly NAV update...');
          await updateAllNAV();
        },
        {
          scheduled: true,
          timezone: 'Asia/Kolkata',
        }
      )
    );
    console.log('✅ Scheduled: NAV update every 1 hour');

    // Daily Returns: Every day at 6 PM IST
    this.tasks.push(
      cron.schedule(
        '0 18 * * *',
        async () => {
          console.log('⏰ Running daily returns update...');
          await updateDailyReturns();
        },
        {
          scheduled: true,
          timezone: 'Asia/Kolkata',
        }
      )
    );
    console.log('✅ Scheduled: Daily returns at 6 PM IST');

    // DISABLED: News Update (missing MarketNews model)
    // // News Update: Every day at 6 AM IST
    // this.tasks.push(
    //   cron.schedule(
    //     '0 6 * * *',
    //     async () => {
    //       console.log('⏰ Running daily news update...');
    //       await updateNews();
    //     },
    //     {
    //       scheduled: true,
    //       timezone: 'Asia/Kolkata',
    //     }
    //   )
    // );
    // console.log('✅ Scheduled: News update daily at 6 AM IST');

    // Auto Fund Expansion: Every day at 3 AM IST
    this.tasks.push(
      cron.schedule(
        '0 3 * * *',
        async () => {
          console.log('⏰ Running auto fund expansion...');
          await autoFundExpansionJob.execute();
        },
        {
          scheduled: true,
          timezone: 'Asia/Kolkata',
        }
      )
    );
    console.log('✅ Scheduled: Auto fund expansion daily at 3 AM IST');

    // Market Indices: Every 5 minutes (PRODUCTION - with Redis lock + market hours)
    // Uses: Redis distributed lock, market hours check, MongoDB history, Redis cache
    this.tasks.push(
      cron.schedule(
        '*/5 * * * *',
        async () => {
          console.log('⏰ Running market indices worker (production)...');
          await marketIndicesWorker.execute();
        },
        {
          scheduled: true,
          timezone: 'Asia/Kolkata',
        }
      )
    );
    console.log(
      '✅ Scheduled: Market indices every 5 minutes (production worker)'
    );

    // Monthly Updates: 1st of every month at 2 AM
    this.tasks.push(
      cron.schedule(
        '0 2 1 * *',
        async () => {
          console.log(
            '⏰ Running monthly updates (AUM, Expense Ratio, Long-term Returns)...'
          );
          await updateDailyReturns(); // Will update all returns including long-term
        },
        {
          scheduled: true,
          timezone: 'Asia/Kolkata',
        }
      )
    );
    console.log('✅ Scheduled: Monthly updates on 1st at 2 AM IST');

    // Quarterly Holdings: 1st of Jan, Apr, Jul, Oct at 3 AM
    this.tasks.push(
      cron.schedule(
        '0 3 1 1,4,7,10 *',
        async () => {
          console.log('⏰ Running quarterly holdings update...');
          await updateHoldings();
        },
        {
          scheduled: true,
          timezone: 'Asia/Kolkata',
        }
      )
    );
    console.log('✅ Scheduled: Holdings update quarterly at 3 AM IST');

    // Semi-annual Fund Managers: 1st of Jan and Jul at 4 AM
    this.tasks.push(
      cron.schedule(
        '0 4 1 1,7 *',
        async () => {
          console.log('⏰ Running semi-annual fund manager update...');
          await updateFundManagers();
        },
        {
          scheduled: true,
          timezone: 'Asia/Kolkata',
        }
      )
    );
    console.log('✅ Scheduled: Fund manager update semi-annually at 4 AM IST');

    console.log('\n✅ All cron jobs initialized successfully\n');
  }

  /**
   * Start all cron jobs
   */
  start() {
    console.log('▶️  Starting cron scheduler...\n');
    this.tasks.forEach((task) => task.start());
    console.log('✅ Cron scheduler started\n');
  }

  /**
   * Stop all cron jobs
   */
  stop() {
    console.log('⏸️  Stopping cron scheduler...\n');
    this.tasks.forEach((task) => task.stop());
    console.log('✅ Cron scheduler stopped\n');
  }

  /**
   * Get schedule information
   */
  getScheduleInfo() {
    return {
      nav: 'Every 1 hour',
      dailyReturns: 'Daily at 6 PM IST',
      news: 'Daily at 6 AM IST',
      marketIndices: 'Every 5 minutes',
      monthlyUpdates: '1st of every month at 2 AM IST',
      holdings: 'Quarterly (Jan, Apr, Jul, Oct) at 3 AM IST',
      fundManagers: 'Semi-annually (Jan, Jul) at 4 AM IST',
    };
  }
}

module.exports = new CronScheduler();
