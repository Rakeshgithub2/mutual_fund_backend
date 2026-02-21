"use strict";
/**
 * Job Scheduler using BullMQ
 * Manages all automated jobs with retry logic and monitoring
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.weeklyGraphQueue = exports.dailyNAVQueue = exports.marketIndicesQueue = void 0;
exports.initializeScheduler = initializeScheduler;
exports.getJobStats = getJobStats;
exports.triggerMarketIndicesJob = triggerMarketIndicesJob;
exports.triggerDailyNAVJob = triggerDailyNAVJob;
exports.triggerWeeklyGraphJob = triggerWeeklyGraphJob;
exports.cleanupScheduler = cleanupScheduler;
const bullmq_1 = require("bullmq");
const ioredis_1 = __importDefault(require("ioredis"));
const market_indices_job_1 = __importDefault(require("../jobs/market-indices.job"));
const daily_nav_job_1 = __importDefault(require("../jobs/daily-nav.job"));
const weekly_graph_job_1 = __importDefault(require("../jobs/weekly-graph.job"));
// Redis connection
const connection = new ioredis_1.default({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    maxRetriesPerRequest: null,
});
// Define queues
exports.marketIndicesQueue = new bullmq_1.Queue('market-indices', { connection });
exports.dailyNAVQueue = new bullmq_1.Queue('daily-nav', { connection });
exports.weeklyGraphQueue = new bullmq_1.Queue('weekly-graph', { connection });
// Note: QueueScheduler is deprecated in BullMQ v3+
// Schedulers are now built into Queue and Worker classes
/**
 * Initialize all scheduled jobs
 */
async function initializeScheduler() {
    console.log('🚀 Initializing Job Scheduler...');
    // 1. Market Indices - Every 5 minutes
    await exports.marketIndicesQueue.add('update-indices', {}, {
        repeat: {
            pattern: '*/5 * * * *', // Every 5 minutes
        },
        removeOnComplete: 10,
        removeOnFail: 50,
    });
    console.log('✅ Market Indices Job: Every 5 minutes');
    // 2. Daily NAV Update - Every day at 10:30 PM IST
    await exports.dailyNAVQueue.add('update-nav', {}, {
        repeat: {
            pattern: '30 22 * * *', // 10:30 PM IST (if server is in IST)
            tz: 'Asia/Kolkata',
        },
        removeOnComplete: 7,
        removeOnFail: 30,
    });
    console.log('✅ Daily NAV Job: 10:30 PM IST daily');
    // 3. Weekly Graph Aggregation - Every Sunday at 2:00 AM
    await exports.weeklyGraphQueue.add('aggregate-graphs', {}, {
        repeat: {
            pattern: '0 2 * * 0', // Sunday 2:00 AM
            tz: 'Asia/Kolkata',
        },
        removeOnComplete: 4,
        removeOnFail: 10,
    });
    console.log('✅ Weekly Graph Job: Sunday 2:00 AM');
    console.log('🎯 All jobs scheduled successfully!');
}
/**
 * Market Indices Worker
 */
const marketIndicesWorker = new bullmq_1.Worker('market-indices', async (job) => {
    console.log(`[Worker] Processing Market Indices Job #${job.id}`);
    return await market_indices_job_1.default.execute();
}, {
    connection,
    concurrency: 1,
});
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
const dailyNAVWorker = new bullmq_1.Worker('daily-nav', async (job) => {
    console.log(`[Worker] Processing Daily NAV Job #${job.id}`);
    return await daily_nav_job_1.default.execute();
}, {
    connection,
    concurrency: 1,
    limiter: {
        max: 1,
        duration: 60000, // Max 1 job per minute
    },
});
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
const weeklyGraphWorker = new bullmq_1.Worker('weekly-graph', async (job) => {
    console.log(`[Worker] Processing Weekly Graph Job #${job.id}`);
    return await weekly_graph_job_1.default.execute();
}, {
    connection,
    concurrency: 1,
});
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
async function getJobStats() {
    const [marketIndicesStats, dailyNAVStats, weeklyGraphStats] = await Promise.all([
        exports.marketIndicesQueue.getJobCounts(),
        exports.dailyNAVQueue.getJobCounts(),
        exports.weeklyGraphQueue.getJobCounts(),
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
async function triggerMarketIndicesJob() {
    return await exports.marketIndicesQueue.add('manual-trigger', {}, { priority: 1 });
}
async function triggerDailyNAVJob() {
    return await exports.dailyNAVQueue.add('manual-trigger', {}, { priority: 1 });
}
async function triggerWeeklyGraphJob() {
    return await exports.weeklyGraphQueue.add('manual-trigger', {}, { priority: 1 });
}
/**
 * Cleanup: Remove all jobs and schedulers
 */
async function cleanupScheduler() {
    await exports.marketIndicesQueue.obliterate({ force: true });
    await exports.dailyNAVQueue.obliterate({ force: true });
    await exports.weeklyGraphQueue.obliterate({ force: true });
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
exports.default = {
    initializeScheduler,
    getJobStats,
    triggerMarketIndicesJob,
    triggerDailyNAVJob,
    triggerWeeklyGraphJob,
    cleanupScheduler,
};
