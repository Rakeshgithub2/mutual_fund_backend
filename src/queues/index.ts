import { Queue, Worker, Job } from 'bullmq';
import { JobType, JobData } from '../types/jobs';

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
export const ingestionQueue = new Queue('ingestion', {
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

export const reminderQueue = new Queue('reminders', {
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

export const emailQueue = new Queue('email', {
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
export const enqueueAMFIIngest = async (data: any = {}) => {
  return ingestionQueue.add(JobType.AMFI_INGEST, data, {
    priority: 1,
  });
};

export const enqueueYahooIngest = async (data: any) => {
  return ingestionQueue.add(JobType.YAHOO_INGEST, data, {
    priority: 2,
  });
};

export const enqueueNewsIngest = async (data: any = {}) => {
  return ingestionQueue.add(JobType.NEWS_INGEST, data, {
    priority: 3,
  });
};

export const enqueueReminderCheck = async (data: any = {}) => {
  return reminderQueue.add(JobType.REMINDER_CHECK, data);
};

export const enqueueSendEmail = async (data: any) => {
  return emailQueue.add(JobType.SEND_EMAIL, data, {
    priority: 1,
  });
};

// Graceful shutdown
export const closeQueues = async () => {
  await Promise.all([
    ingestionQueue.close(),
    reminderQueue.close(),
    emailQueue.close(),
  ]);
};
