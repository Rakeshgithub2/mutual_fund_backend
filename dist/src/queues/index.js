"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.closeQueues = exports.enqueueSendEmail = exports.enqueueReminderCheck = exports.enqueueNewsIngest = exports.enqueueYahooIngest = exports.enqueueAMFIIngest = exports.emailQueue = exports.reminderQueue = exports.ingestionQueue = void 0;
const bullmq_1 = require("bullmq");
const jobs_1 = require("../types/jobs");
// Redis connection configuration
const redisConnection = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    maxRetriesPerRequest: 3,
    retryDelayOnFailover: 100,
    enableReadyCheck: false,
};
// Create job queues
exports.ingestionQueue = new bullmq_1.Queue('ingestion', {
    connection: redisConnection,
    defaultJobOptions: {
        removeOnComplete: 10,
        removeOnFail: 50,
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 2000,
        },
    },
});
exports.reminderQueue = new bullmq_1.Queue('reminders', {
    connection: redisConnection,
    defaultJobOptions: {
        removeOnComplete: 5,
        removeOnFail: 25,
        attempts: 2,
        backoff: {
            type: 'exponential',
            delay: 1000,
        },
    },
});
exports.emailQueue = new bullmq_1.Queue('email', {
    connection: redisConnection,
    defaultJobOptions: {
        removeOnComplete: 20,
        removeOnFail: 100,
        attempts: 5,
        backoff: {
            type: 'exponential',
            delay: 3000,
        },
    },
});
// Job enqueue functions
const enqueueAMFIIngest = async (data = {}) => {
    return exports.ingestionQueue.add(jobs_1.JobType.AMFI_INGEST, data, {
        priority: 1,
    });
};
exports.enqueueAMFIIngest = enqueueAMFIIngest;
const enqueueYahooIngest = async (data) => {
    return exports.ingestionQueue.add(jobs_1.JobType.YAHOO_INGEST, data, {
        priority: 2,
    });
};
exports.enqueueYahooIngest = enqueueYahooIngest;
const enqueueNewsIngest = async (data = {}) => {
    return exports.ingestionQueue.add(jobs_1.JobType.NEWS_INGEST, data, {
        priority: 3,
    });
};
exports.enqueueNewsIngest = enqueueNewsIngest;
const enqueueReminderCheck = async (data = {}) => {
    return exports.reminderQueue.add(jobs_1.JobType.REMINDER_CHECK, data);
};
exports.enqueueReminderCheck = enqueueReminderCheck;
const enqueueSendEmail = async (data) => {
    return exports.emailQueue.add(jobs_1.JobType.SEND_EMAIL, data, {
        priority: 1,
    });
};
exports.enqueueSendEmail = enqueueSendEmail;
// Graceful shutdown
const closeQueues = async () => {
    await Promise.all([
        exports.ingestionQueue.close(),
        exports.reminderQueue.close(),
        exports.emailQueue.close(),
    ]);
};
exports.closeQueues = closeQueues;
