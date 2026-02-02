"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const bullmq_1 = require("bullmq");
const jobs_1 = require("./types/jobs");
const amfiService_1 = require("./services/amfiService");
const yahooFinanceService_1 = require("./services/yahooFinanceService");
const newsService_1 = require("./services/newsService");
const emailService_1 = require("./services/emailService");
// Load environment variables
dotenv_1.default.config();
// Redis connection configuration
const redisConnection = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    maxRetriesPerRequest: 3,
    retryDelayOnFailover: 100,
    enableReadyCheck: false,
};
// Ingestion Worker
const ingestionWorker = new bullmq_1.Worker('ingestion', async (job) => {
    console.log(`Processing ingestion job: ${job.name} (${job.id})`);
    try {
        switch (job.name) {
            case jobs_1.JobType.AMFI_INGEST:
                console.log('Starting AMFI data ingestion...');
                const amfiResult = await amfiService_1.amfiService.ingestNAVData();
                console.log(`AMFI ingestion completed. Processed: ${amfiResult.processed}, Errors: ${amfiResult.errors.length}`);
                return amfiResult;
            case jobs_1.JobType.YAHOO_INGEST:
                console.log('Starting Yahoo Finance data ingestion...');
                const symbols = job.data.symbols || ['NIFTY50', 'SENSEX'];
                const yahooResult = await yahooFinanceService_1.yahooFinanceService.fetchBenchmarkData(symbols);
                console.log(`Yahoo Finance ingestion completed. Processed: ${yahooResult.processed}, Errors: ${yahooResult.errors.length}`);
                return yahooResult;
            case jobs_1.JobType.NEWS_INGEST:
                console.log('Starting news data ingestion...');
                const category = job.data.category || 'business';
                const keywords = job.data.keywords || [
                    'mutual fund',
                    'investment',
                    'portfolio',
                ];
                const newsResult = await newsService_1.newsService.ingestNews(category, keywords);
                console.log(`News ingestion completed. Processed: ${newsResult.processed}, Errors: ${newsResult.errors.length}`);
                return newsResult;
            default:
                throw new Error(`Unknown ingestion job type: ${job.name}`);
        }
    }
    catch (error) {
        console.error(`Ingestion job ${job.name} failed:`, error);
        throw error;
    }
}, {
    connection: redisConnection,
    concurrency: 2, // Process 2 ingestion jobs concurrently
});
// Reminder Worker
const reminderWorker = new bullmq_1.Worker('reminders', async (job) => {
    console.log(`Processing reminder job: ${job.name} (${job.id})`);
    try {
        switch (job.name) {
            case jobs_1.JobType.REMINDER_CHECK:
                console.log('Checking user reminders...');
                // Reminder service is handled by backend cron job
                console.log('Reminder service handled by backend cron');
                return { checked: 0, sent: 0, errors: [] };
            default:
                throw new Error(`Unknown reminder job type: ${job.name}`);
        }
    }
    catch (error) {
        console.error(`Reminder job ${job.name} failed:`, error);
        throw error;
    }
}, {
    connection: redisConnection,
    concurrency: 3, // Process 3 reminder jobs concurrently
});
// Email Worker
const emailWorker = new bullmq_1.Worker('email', async (job) => {
    console.log(`Processing email job: ${job.name} (${job.id})`);
    try {
        switch (job.name) {
            case jobs_1.JobType.SEND_EMAIL:
                const { type, to, data } = job.data;
                console.log(`Sending ${type} email to ${to}...`);
                let result;
                switch (type) {
                    case 'verification':
                        result = await emailService_1.emailService.sendVerificationEmail(to, data);
                        break;
                    case 'reminder':
                        result = await emailService_1.emailService.sendAlertEmail(to, data);
                        break;
                    case 'digest':
                        result = await emailService_1.emailService.sendDigestEmail(to, data);
                        break;
                    default:
                        throw new Error(`Unknown email type: ${type}`);
                }
                console.log(`Email sent successfully to ${to}`);
                return result;
            default:
                throw new Error(`Unknown email job type: ${job.name}`);
        }
    }
    catch (error) {
        console.error(`Email job ${job.name} failed:`, error);
        throw error;
    }
}, {
    connection: redisConnection,
    concurrency: 5, // Process 5 email jobs concurrently
});
// Worker event handlers
const setupWorkerEvents = (worker, name) => {
    worker.on('completed', (job) => {
        console.log(`✅ ${name} job ${job.id} completed successfully`);
    });
    worker.on('failed', (job, err) => {
        console.error(`❌ ${name} job ${job?.id} failed:`, err.message);
    });
    worker.on('error', (err) => {
        console.error(`💥 ${name} worker error:`, err);
    });
    worker.on('stalled', (jobId) => {
        console.warn(`⚠️ ${name} job ${jobId} stalled`);
    });
};
// Setup event handlers for all workers
setupWorkerEvents(ingestionWorker, 'Ingestion');
setupWorkerEvents(reminderWorker, 'Reminder');
setupWorkerEvents(emailWorker, 'Email');
// Graceful shutdown
const gracefulShutdown = async () => {
    console.log('🛑 Shutting down workers gracefully...');
    await Promise.all([
        ingestionWorker.close(),
        reminderWorker.close(),
        emailWorker.close(),
    ]);
    console.log('✅ All workers shut down successfully');
    process.exit(0);
};
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
console.log('🚀 Workers started successfully!');
console.log('Listening for jobs on:');
console.log('  - Ingestion queue (concurrency: 2)');
console.log('  - Reminder queue (concurrency: 3)');
console.log('  - Email queue (concurrency: 5)');
