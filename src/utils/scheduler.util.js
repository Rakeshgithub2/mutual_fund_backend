/**
 * Scheduler Utility
 * Helper functions for cron job scheduling
 */

const cron = require('node-cron');
const MarketHoursUtil = require('./marketHours.util');

class SchedulerUtil {
  constructor() {
    this.jobs = new Map();
  }

  /**
   * Schedule a job
   */
  scheduleJob(name, cronExpression, callback, options = {}) {
    if (this.jobs.has(name)) {
      console.warn(`⚠️ Job "${name}" already exists. Stopping existing job.`);
      this.stopJob(name);
    }

    try {
      const job = cron.schedule(cronExpression, callback, {
        scheduled: true,
        timezone: 'Asia/Kolkata',
        ...options,
      });

      this.jobs.set(name, {
        job,
        cronExpression,
        createdAt: new Date(),
        lastRun: null,
        runCount: 0,
      });

      console.log(
        `✅ Scheduled job: ${name} with expression: ${cronExpression}`
      );
      return job;
    } catch (error) {
      console.error(`❌ Error scheduling job "${name}":`, error.message);
      throw error;
    }
  }

  /**
   * Schedule job that runs only during market hours
   */
  scheduleMarketHoursJob(name, cronExpression, callback, options = {}) {
    const wrappedCallback = async () => {
      if (MarketHoursUtil.isMarketOpen()) {
        console.log(`📊 Running market hours job: ${name}`);
        await callback();
        this.updateJobRunInfo(name);
      } else {
        console.log(`⏸️ Skipping job "${name}" - Market is closed`);
      }
    };

    return this.scheduleJob(name, cronExpression, wrappedCallback, options);
  }

  /**
   * Schedule job that runs only on trading days
   */
  scheduleTradingDayJob(name, cronExpression, callback, options = {}) {
    const wrappedCallback = async () => {
      if (MarketHoursUtil.isTradingDay()) {
        console.log(`📊 Running trading day job: ${name}`);
        await callback();
        this.updateJobRunInfo(name);
      } else {
        console.log(`⏸️ Skipping job "${name}" - Not a trading day`);
      }
    };

    return this.scheduleJob(name, cronExpression, wrappedCallback, options);
  }

  /**
   * Stop a job
   */
  stopJob(name) {
    const jobInfo = this.jobs.get(name);
    if (jobInfo) {
      jobInfo.job.stop();
      this.jobs.delete(name);
      console.log(`🛑 Stopped job: ${name}`);
      return true;
    }
    console.warn(`⚠️ Job "${name}" not found`);
    return false;
  }

  /**
   * Start a stopped job
   */
  startJob(name) {
    const jobInfo = this.jobs.get(name);
    if (jobInfo) {
      jobInfo.job.start();
      console.log(`▶️ Started job: ${name}`);
      return true;
    }
    console.warn(`⚠️ Job "${name}" not found`);
    return false;
  }

  /**
   * Get job info
   */
  getJobInfo(name) {
    return this.jobs.get(name);
  }

  /**
   * Get all jobs
   */
  getAllJobs() {
    return Array.from(this.jobs.entries()).map(([name, info]) => ({
      name,
      cronExpression: info.cronExpression,
      createdAt: info.createdAt,
      lastRun: info.lastRun,
      runCount: info.runCount,
    }));
  }

  /**
   * Update job run information
   */
  updateJobRunInfo(name) {
    const jobInfo = this.jobs.get(name);
    if (jobInfo) {
      jobInfo.lastRun = new Date();
      jobInfo.runCount++;
    }
  }

  /**
   * Stop all jobs
   */
  stopAllJobs() {
    console.log(`🛑 Stopping all ${this.jobs.size} jobs...`);
    for (const [name, info] of this.jobs.entries()) {
      info.job.stop();
      console.log(`  ✓ Stopped: ${name}`);
    }
    this.jobs.clear();
  }

  /**
   * Validate cron expression
   */
  validateCronExpression(expression) {
    return cron.validate(expression);
  }

  /**
   * Get standard cron expressions
   */
  static CRON_EXPRESSIONS = {
    // Daily jobs
    DAILY_9_30_PM: '0 30 21 * * *', // 9:30 PM IST daily
    DAILY_MIDNIGHT: '0 0 0 * * *', // Midnight IST
    DAILY_6_AM: '0 0 6 * * *', // 6:00 AM IST

    // Market hours
    EVERY_2_HOURS_MARKET: '0 */2 9-15 * * 1-5', // Every 2 hours, 9 AM to 3 PM, Mon-Fri
    EVERY_HOUR_MARKET: '0 0 9-15 * * 1-5', // Every hour during market, Mon-Fri
    EVERY_30_MIN_MARKET: '*/30 * 9-15 * * 1-5', // Every 30 min during market, Mon-Fri

    // Monthly jobs
    FIRST_OF_MONTH: '0 0 2 1 * *', // 2 AM on 1st of each month

    // Quarterly (approximate)
    QUARTERLY: '0 0 2 1 */3 *', // 2 AM on 1st of Jan, Apr, Jul, Oct

    // Yearly
    YEARLY: '0 0 2 1 1 *', // 2 AM on January 1st

    // Frequent
    EVERY_5_MINUTES: '*/5 * * * *', // Every 5 minutes
    EVERY_15_MINUTES: '*/15 * * * *', // Every 15 minutes
    EVERY_HOUR: '0 * * * *', // Every hour
  };

  /**
   * Create a one-time delayed job
   */
  scheduleOneTime(name, delayMs, callback) {
    const timeout = setTimeout(async () => {
      console.log(`⏰ Running one-time job: ${name}`);
      await callback();
      this.jobs.delete(name);
    }, delayMs);

    this.jobs.set(name, {
      job: { stop: () => clearTimeout(timeout) },
      cronExpression: `One-time (${delayMs}ms)`,
      createdAt: new Date(),
      lastRun: null,
      runCount: 0,
    });

    console.log(`⏰ Scheduled one-time job: ${name} (runs in ${delayMs}ms)`);
    return timeout;
  }

  /**
   * Run job immediately (bypass schedule)
   */
  async runJobNow(name, callback) {
    console.log(`▶️ Running job immediately: ${name}`);
    try {
      await callback();
      this.updateJobRunInfo(name);
      console.log(`✅ Completed: ${name}`);
    } catch (error) {
      console.error(`❌ Error running job "${name}":`, error.message);
      throw error;
    }
  }

  /**
   * Get cron expression description
   */
  describeExpression(expression) {
    // Simple description mapper
    const descriptions = {
      '0 30 21 * * *': 'Daily at 9:30 PM',
      '0 0 2 1 * *': 'Monthly on 1st at 2:00 AM',
      '0 */2 9-15 * * 1-5': 'Every 2 hours during market (Mon-Fri)',
      '*/5 * * * *': 'Every 5 minutes',
    };

    return descriptions[expression] || expression;
  }
}

// Singleton instance
const schedulerUtil = new SchedulerUtil();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down scheduler...');
  schedulerUtil.stopAllJobs();
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down scheduler...');
  schedulerUtil.stopAllJobs();
});

module.exports = schedulerUtil;
module.exports.SchedulerUtil = SchedulerUtil;
