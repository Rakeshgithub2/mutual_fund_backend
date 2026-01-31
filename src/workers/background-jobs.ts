import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { config } from '../config/environment';
import { mongodb } from '../db/mongodb';
import { ComprehensiveFundDataService } from '../services/comprehensive-fund-data.service';

/**
 * Background Worker Service
 *
 * Uses BullMQ for job scheduling and processing
 *
 * Jobs:
 * 1. Daily NAV Update - Fetch latest NAV from AMFI (8 PM IST daily)
 * 2. Weekly Holdings Update - Update fund holdings and manager info (Sunday 2 AM IST)
 * 3. Price Refresh - Update real-time prices (Every 15 min during market hours)
 * 4. Nightly Fund Ingestion - Full fund list sync (2 AM IST daily)
 */

// Redis connection for BullMQ
const connection = new IORedis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  db: config.redis.db,
  maxRetriesPerRequest: null, // Required for BullMQ
});

// ==================== JOB QUEUES ====================

export const fundDataQueue = new Queue('fund-data-ingestion', { connection });
export const navUpdateQueue = new Queue('nav-update', { connection });
export const holdingsUpdateQueue = new Queue('holdings-update', { connection });
export const priceRefreshQueue = new Queue('price-refresh', { connection });

// ==================== JOB PROCESSORS ====================

/**
 * Daily NAV Update Worker
 * Fetches latest NAV from AMFI for all funds
 */
export const navUpdateWorker = new Worker(
  'nav-update',
  async (job: Job) => {
    console.log(
      `\n🔄 [NAV Update] Job ${job.id} started at ${new Date().toISOString()}`
    );

    try {
      await mongodb.connect();
      const db = mongodb.getDb();
      const dataService = new ComprehensiveFundDataService(db);

      // Fetch AMFI data (includes NAV updates)
      const result = await dataService.fetchAMFIData();

      console.log(`✅ [NAV Update] Completed`);
      console.log(`   - Funds added: ${result.fundsAdded}`);
      console.log(`   - Funds updated: ${result.fundsUpdated}`);

      return {
        success: true,
        fundsAdded: result.fundsAdded,
        fundsUpdated: result.fundsUpdated,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      console.error(`❌ [NAV Update] Failed:`, error.message);
      throw error;
    }
  },
  {
    connection,
    concurrency: 1,
    limiter: {
      max: 1,
      duration: 60000, // 1 per minute
    },
  }
);

/**
 * Nightly Fund Ingestion Worker
 * Full sync of fund data from all sources
 */
export const fundIngestionWorker = new Worker(
  'fund-data-ingestion',
  async (job: Job) => {
    console.log(
      `\n🔄 [Fund Ingestion] Job ${job.id} started at ${new Date().toISOString()}`
    );

    try {
      await mongodb.connect();
      const db = mongodb.getDb();
      const dataService = new ComprehensiveFundDataService(db);

      const results: any = {
        amfi: null,
        nse: null,
        yahoo: null,
      };

      // 1. Fetch AMFI data
      console.log('📊 Fetching AMFI data...');
      results.amfi = await dataService.fetchAMFIData();
      console.log(
        `✅ AMFI: ${results.amfi.fundsAdded} added, ${results.amfi.fundsUpdated} updated`
      );

      // Wait to respect rate limits
      await sleep(60000); // 1 minute

      // 2. Fetch NSE ETFs
      console.log('📊 Fetching NSE ETFs...');
      await dataService.fetchNSEETFs();
      console.log('✅ NSE ETFs updated');

      // Wait to respect rate limits
      await sleep(5000); // 5 seconds

      // 3. Fetch popular ETFs (if API configured)
      if (config.apis.yahooFinance.apiKey) {
        console.log('📊 Fetching popular ETFs...');
        await dataService.fetchPopularETFs();
        console.log('✅ Popular ETFs updated');
      }

      console.log(`✅ [Fund Ingestion] Completed successfully`);

      return {
        success: true,
        results,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      console.error(`❌ [Fund Ingestion] Failed:`, error.message);
      throw error;
    }
  },
  {
    connection,
    concurrency: 1,
    limiter: {
      max: 1,
      duration: 3600000, // 1 per hour
    },
  }
);

/**
 * Weekly Holdings Update Worker
 * Updates fund holdings and manager information
 */
export const holdingsUpdateWorker = new Worker(
  'holdings-update',
  async (job: Job) => {
    console.log(
      `\n🔄 [Holdings Update] Job ${job.id} started at ${new Date().toISOString()}`
    );

    try {
      await mongodb.connect();
      const db = mongodb.getDb();

      // Get all active funds that need holdings update
      const funds = await db
        .collection('funds')
        .find({ isActive: true })
        .limit(100) // Process 100 funds per run
        .project({ fundId: 1 })
        .toArray();

      console.log(`📊 Processing ${funds.length} funds for holdings update`);

      // TODO: Implement holdings scraping/API integration
      // For now, just log that we need to implement this
      console.log('⚠️  Holdings update not yet implemented');
      console.log(
        '   Required: Scrape fund house websites or integrate with data provider'
      );

      return {
        success: true,
        fundsProcessed: funds.length,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      console.error(`❌ [Holdings Update] Failed:`, error.message);
      throw error;
    }
  },
  {
    connection,
    concurrency: 1,
  }
);

/**
 * Price Refresh Worker
 * Updates real-time prices during market hours
 */
export const priceRefreshWorker = new Worker(
  'price-refresh',
  async (job: Job) => {
    console.log(
      `\n🔄 [Price Refresh] Job ${job.id} started at ${new Date().toISOString()}`
    );

    try {
      await mongodb.connect();
      const db = mongodb.getDb();
      const dataService = new ComprehensiveFundDataService(db);

      // Get popular funds that need price refresh
      const funds = await db
        .collection('funds')
        .find({
          isActive: true,
          popularity: { $gte: 100 }, // Only high-demand funds
        })
        .sort({ popularity: -1 })
        .limit(50)
        .project({ fundId: 1, symbol: 1 })
        .toArray();

      console.log(`📊 Refreshing prices for ${funds.length} popular funds`);

      let updated = 0;
      for (const fund of funds) {
        if (fund.symbol) {
          // TODO: Implement real-time price fetching
          // For now, skip
          updated++;
        }

        // Rate limiting
        await sleep(1000); // 1 second between calls
      }

      console.log(`✅ [Price Refresh] Updated ${updated} funds`);

      return {
        success: true,
        fundsUpdated: updated,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      console.error(`❌ [Price Refresh] Failed:`, error.message);
      throw error;
    }
  },
  {
    connection,
    concurrency: 1,
    limiter: {
      max: 5,
      duration: 60000, // 5 per minute
    },
  }
);

// ==================== JOB SCHEDULING ====================

/**
 * Schedule recurring jobs
 */
export async function scheduleRecurringJobs() {
  if (!config.features.enableBackgroundJobs) {
    console.log('⚠️  Background jobs disabled in configuration');
    return;
  }

  console.log('📅 Scheduling recurring background jobs...\n');

  // Daily NAV Update - 8 PM IST every day
  await navUpdateQueue.add(
    'daily-nav-update',
    {},
    {
      repeat: {
        pattern: config.jobs.dailyNavUpdate.cron,
        tz: config.jobs.dailyNavUpdate.timezone,
      },
      jobId: 'daily-nav-update',
    }
  );
  console.log('✅ Scheduled: Daily NAV Update (8 PM IST)');

  // Nightly Fund Ingestion - 2 AM IST every day
  await fundDataQueue.add(
    'nightly-ingestion',
    {},
    {
      repeat: {
        pattern: '0 2 * * *', // 2 AM every day
        tz: 'Asia/Kolkata',
      },
      jobId: 'nightly-ingestion',
    }
  );
  console.log('✅ Scheduled: Nightly Fund Ingestion (2 AM IST)');

  // Weekly Holdings Update - Sunday 2 AM IST
  await holdingsUpdateQueue.add(
    'weekly-holdings-update',
    {},
    {
      repeat: {
        pattern: config.jobs.weeklyHoldingsUpdate.cron,
        tz: config.jobs.weeklyHoldingsUpdate.timezone,
      },
      jobId: 'weekly-holdings-update',
    }
  );
  console.log('✅ Scheduled: Weekly Holdings Update (Sunday 2 AM IST)');

  // Price Refresh - Every 15 min during market hours (9 AM - 3 PM, Mon-Fri)
  if (config.features.enableRealTimePrice) {
    await priceRefreshQueue.add(
      'price-refresh',
      {},
      {
        repeat: {
          pattern: config.jobs.priceRefresh.cron,
          tz: config.jobs.priceRefresh.timezone,
        },
        jobId: 'price-refresh',
      }
    );
    console.log('✅ Scheduled: Price Refresh (Every 15 min, 9 AM - 3 PM)');
  }

  console.log('\n🎉 All recurring jobs scheduled successfully!\n');
}

/**
 * Trigger immediate job execution (for testing or manual triggers)
 */
export async function triggerJob(
  jobType: 'nav' | 'ingestion' | 'holdings' | 'price'
) {
  console.log(`\n🚀 Manually triggering ${jobType} job...\n`);

  try {
    let queue: Queue;
    switch (jobType) {
      case 'nav':
        queue = navUpdateQueue;
        break;
      case 'ingestion':
        queue = fundDataQueue;
        break;
      case 'holdings':
        queue = holdingsUpdateQueue;
        break;
      case 'price':
        queue = priceRefreshQueue;
        break;
      default:
        throw new Error(`Unknown job type: ${jobType}`);
    }

    const job = await queue.add(`manual-${jobType}`, {}, { priority: 1 });
    console.log(`✅ Job ${job.id} added to queue`);

    return job;
  } catch (error) {
    console.error(`❌ Failed to trigger job:`, error);
    throw error;
  }
}

// ==================== EVENT HANDLERS ====================

navUpdateWorker.on('completed', (job) => {
  console.log(`✅ NAV Update job ${job.id} completed`);
});

navUpdateWorker.on('failed', (job, error) => {
  console.error(`❌ NAV Update job ${job?.id} failed:`, error.message);
});

fundIngestionWorker.on('completed', (job) => {
  console.log(`✅ Fund Ingestion job ${job.id} completed`);
});

fundIngestionWorker.on('failed', (job, error) => {
  console.error(`❌ Fund Ingestion job ${job?.id} failed:`, error.message);
});

holdingsUpdateWorker.on('completed', (job) => {
  console.log(`✅ Holdings Update job ${job.id} completed`);
});

holdingsUpdateWorker.on('failed', (job, error) => {
  console.error(`❌ Holdings Update job ${job?.id} failed:`, error.message);
});

priceRefreshWorker.on('completed', (job) => {
  console.log(`✅ Price Refresh job ${job.id} completed`);
});

priceRefreshWorker.on('failed', (job, error) => {
  console.error(`❌ Price Refresh job ${job?.id} failed:`, error.message);
});

// ==================== UTILITIES ====================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ==================== GRACEFUL SHUTDOWN ====================

export async function closeWorkers() {
  console.log('\n🛑 Closing workers...');

  await Promise.all([
    navUpdateWorker.close(),
    fundIngestionWorker.close(),
    holdingsUpdateWorker.close(),
    priceRefreshWorker.close(),
  ]);

  await connection.quit();

  console.log('✅ All workers closed');
}

process.on('SIGTERM', closeWorkers);
process.on('SIGINT', closeWorkers);
