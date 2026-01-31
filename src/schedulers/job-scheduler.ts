/**
 * Job Scheduler using BullMQ
 * Manages all automated jobs with retry logic and monitoring
 */

import { Queue, Worker, QueueScheduler } from 'bullmq';
import IORedis from 'ioredis';
import MarketIndicesJob from '../jobs/market-indices.job';
import DailyNAVJob from '../jobs/daily-nav.job';
import WeeklyGraphJob from '../jobs/weekly-graph.job';

// Redis connection
const connection = new IORedis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null,
});

// Define queues
export const marketIndicesQueue = new Queue('market-indices', { connection });
export const dailyNAVQueue = new Queue('daily-nav', { connection });
export const weeklyGraphQueue = new Queue('weekly-graph', { connection });

// Queue Schedulers (required for delayed/repeated jobs)
const marketIndicesScheduler = new QueueScheduler('market-indices', {
  connection,
});
const dailyNAVScheduler = new QueueScheduler('daily-nav', { connection });
const weeklyGraphScheduler = new QueueScheduler('weekly-graph', { connection });

/**
 * Initialize all scheduled jobs
 */
export async function initializeScheduler() {
  console.log('🚀 Initializing Job Scheduler...');

  // 1. Market Indices - Every 5 minutes
  await marketIndicesQueue.add(
    'update-indices',
    {},
    {
      repeat: {
        pattern: '*/5 * * * *', // Every 5 minutes
      },
      removeOnComplete: 10,
      removeOnFail: 50,
    }
  );
  console.log('✅ Market Indices Job: Every 5 minutes');

  // 2. Daily NAV Update - Every day at 10:30 PM IST
  await dailyNAVQueue.add(
    'update-nav',
    {},
    {
      repeat: {
        pattern: '30 22 * * *', // 10:30 PM IST (if server is in IST)
        tz: 'Asia/Kolkata',
      },
      removeOnComplete: 7,
      removeOnFail: 30,
    }
  );
  console.log('✅ Daily NAV Job: 10:30 PM IST daily');

  // 3. Weekly Graph Aggregation - Every Sunday at 2:00 AM
  await weeklyGraphQueue.add(
    'aggregate-graphs',
    {},
    {
      repeat: {
        pattern: '0 2 * * 0', // Sunday 2:00 AM
        tz: 'Asia/Kolkata',
      },
      removeOnComplete: 4,
      removeOnFail: 10,
    }
  );
  console.log('✅ Weekly Graph Job: Sunday 2:00 AM');

  console.log('🎯 All jobs scheduled successfully!');
}

/**
 * Market Indices Worker
 */
const marketIndicesWorker = new Worker(
  'market-indices',
  async (job) => {
    console.log(`[Worker] Processing Market Indices Job #${job.id}`);
    return await MarketIndicesJob.execute();
  },
  {
    connection,
    concurrency: 1,
  }
);

marketIndicesWorker.on('completed', (job, result) => {
  console.log(`✅ Market Indices Job #${job.id} completed:`, result);
});

marketIndicesWorker.on('failed', (job, err) => {
  console.error(`❌ Market Indices Job #${job?.id} failed:`, err.message);
  // TODO: Send alert to Slack/Email
});

/**
 * Daily NAV Worker
 */
const dailyNAVWorker = new Worker(
  'daily-nav',
  async (job) => {
    console.log(`[Worker] Processing Daily NAV Job #${job.id}`);
    return await DailyNAVJob.execute();
  },
  {
    connection,
    concurrency: 1,
    limiter: {
      max: 1,
      duration: 60000, // Max 1 job per minute
    },
  }
);

dailyNAVWorker.on('completed', (job, result) => {
  console.log(`✅ Daily NAV Job #${job.id} completed:`, result);
});

dailyNAVWorker.on('failed', (job, err) => {
  console.error(`❌ Daily NAV Job #${job?.id} failed:`, err.message);
  // TODO: Send alert
});

/**
 * Weekly Graph Worker
 */
const weeklyGraphWorker = new Worker(
  'weekly-graph',
  async (job) => {
    console.log(`[Worker] Processing Weekly Graph Job #${job.id}`);
    return await WeeklyGraphJob.execute();
  },
  {
    connection,
    concurrency: 1,
  }
);

weeklyGraphWorker.on('completed', (job, result) => {
  console.log(`✅ Weekly Graph Job #${job.id} completed:`, result);
});

weeklyGraphWorker.on('failed', (job, err) => {
  console.error(`❌ Weekly Graph Job #${job?.id} failed:`, err.message);
  // TODO: Send alert
});

/**
 * Get job statistics
 */
export async function getJobStats() {
  const [marketIndicesStats, dailyNAVStats, weeklyGraphStats] =
    await Promise.all([
      marketIndicesQueue.getJobCounts(),
      dailyNAVQueue.getJobCounts(),
      weeklyGraphQueue.getJobCounts(),
    ]);

  return {
    marketIndices: marketIndicesStats,
    dailyNAV: dailyNAVStats,
    weeklyGraph: weeklyGraphStats,
  };
}

/**
 * Manual job triggers
 */
export async function triggerMarketIndicesJob() {
  return await marketIndicesQueue.add('manual-trigger', {}, { priority: 1 });
}

export async function triggerDailyNAVJob() {
  return await dailyNAVQueue.add('manual-trigger', {}, { priority: 1 });
}

export async function triggerWeeklyGraphJob() {
  return await weeklyGraphQueue.add('manual-trigger', {}, { priority: 1 });
}

/**
 * Cleanup: Remove all jobs and schedulers
 */
export async function cleanupScheduler() {
  await marketIndicesQueue.obliterate({ force: true });
  await dailyNAVQueue.obliterate({ force: true });
  await weeklyGraphQueue.obliterate({ force: true });

  await connection.quit();

  console.log('🧹 Scheduler cleanup completed');
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing workers...');
  await marketIndicesWorker.close();
  await dailyNAVWorker.close();
  await weeklyGraphWorker.close();
  await connection.quit();
  process.exit(0);
});

export default {
  initializeScheduler,
  getJobStats,
  triggerMarketIndicesJob,
  triggerDailyNAVJob,
  triggerWeeklyGraphJob,
  cleanupScheduler,
};
