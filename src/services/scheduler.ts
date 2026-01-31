import { CronJob } from 'cron';
import {
  enqueueAMFIIngest,
  enqueueYahooIngest,
  enqueueNewsIngest,
  enqueueReminderCheck,
} from '../queues';

// Helper function to get IST date
function getISTDate(): string {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
  const istTime = new Date(now.getTime() + istOffset);
  return istTime.toISOString().split('T')[0];
}

function getISTDateTime(): Date {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
  return new Date(now.getTime() + istOffset);
}

export class Scheduler {
  private jobs: CronJob[] = [];
  private isRunning = false;

  constructor() {
    this.setupJobs();
  }

  private setupJobs() {
    // AMFI_INGEST - Daily at 03:00 IST
    const amfiJob = new CronJob(
      '0 3 * * *', // 3:00 AM daily
      async () => {
        console.log('Enqueueing AMFI ingestion job...');
        try {
          await enqueueAMFIIngest({
            url: 'https://www.amfiindia.com/spages/NAVAll.txt',
            date: getISTDate(),
          });
          console.log('AMFI ingestion job enqueued successfully');
        } catch (error) {
          console.error('Failed to enqueue AMFI ingestion job:', error);
        }
      },
      null,
      false,
      'Asia/Kolkata'
    );

    // YAHOO_INGEST - Nightly at 01:00 IST (fetch benchmark data)
    const yahooJob = new CronJob(
      '0 1 * * *', // 1:00 AM daily
      async () => {
        console.log('Enqueueing Yahoo Finance ingestion jobs...');
        try {
          const benchmarks = [
            '^NSEI', // NIFTY 50
            '^BSESN', // SENSEX
            '^NSMIDCP', // NIFTY MIDCAP 100
          ];

          const fromDate = new Date();
          fromDate.setDate(fromDate.getDate() - 7);
          const fromDateStr = fromDate.toISOString().split('T')[0];

          const toDateStr = getISTDate();

          for (const symbol of benchmarks) {
            await enqueueYahooIngest({
              symbol,
              from: fromDateStr,
              to: toDateStr,
            });
          }
          console.log(
            `Yahoo Finance ingestion jobs enqueued for ${benchmarks.length} benchmarks`
          );
        } catch (error) {
          console.error(
            'Failed to enqueue Yahoo Finance ingestion jobs:',
            error
          );
        }
      },
      null,
      false,
      'Asia/Kolkata'
    );

    // NEWS_INGEST - Hourly during market hours (9:15 AM to 3:30 PM IST, Mon-Fri)
    const newsJob = new CronJob(
      '0 9-15 * * 1-5', // Every hour from 9 AM to 3 PM, Monday to Friday
      async () => {
        const currentHour = getISTDateTime().getHours();

        // Only run during market hours
        if (currentHour >= 9 && currentHour <= 15) {
          console.log('Enqueueing news ingestion job...');
          try {
            await enqueueNewsIngest({
              category: 'business',
              keywords: [
                'mutual fund',
                'investment',
                'stock market',
                'nifty',
                'sensex',
                'equity',
              ],
            });
            console.log('News ingestion job enqueued successfully');
          } catch (error) {
            console.error('Failed to enqueue news ingestion job:', error);
          }
        }
      },
      null,
      false,
      'Asia/Kolkata'
    );

    // REMINDER_CHECK - Every 5 minutes
    const reminderJob = new CronJob(
      '*/5 * * * *', // Every 5 minutes
      async () => {
        console.log('Enqueueing reminder check job...');
        try {
          await enqueueReminderCheck({});
          console.log('Reminder check job enqueued successfully');
        } catch (error) {
          console.error('Failed to enqueue reminder check job:', error);
        }
      },
      null,
      false,
      'Asia/Kolkata'
    );

    // Daily digest job - 8:00 AM IST on weekdays
    const digestJob = new CronJob(
      '0 8 * * 1-5', // 8:00 AM Monday to Friday
      async () => {
        console.log('Daily digest job would run here...');
        // This would typically enqueue digest email jobs for all users
        // For now, we'll just log it
      },
      null,
      false,
      'Asia/Kolkata'
    );

    this.jobs = [amfiJob, yahooJob, newsJob, reminderJob, digestJob];
  }

  start() {
    if (this.isRunning) {
      console.log('Scheduler is already running');
      return;
    }

    console.log('Starting scheduler...');

    this.jobs.forEach((job, index) => {
      job.start();
      console.log(`Job ${index + 1} started`);
    });

    this.isRunning = true;
    console.log(`Scheduler started with ${this.jobs.length} jobs`);

    // Log next scheduled times
    this.logNextScheduledTimes();
  }

  stop() {
    if (!this.isRunning) {
      console.log('Scheduler is not running');
      return;
    }

    console.log('Stopping scheduler...');

    this.jobs.forEach((job, index) => {
      job.stop();
      console.log(`Job ${index + 1} stopped`);
    });

    this.isRunning = false;
    console.log('Scheduler stopped');
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      jobCount: this.jobs.length,
      nextRuns: this.jobs.map((job, index) => ({
        jobIndex: index,
        nextRun: job.nextDate()?.toString() || 'Not scheduled',
        running: job.running,
      })),
    };
  }

  private logNextScheduledTimes() {
    console.log('\n=== Scheduled Jobs ===');
    console.log('1. AMFI Ingestion: Daily at 3:00 AM IST');
    console.log('2. Yahoo Finance: Daily at 1:00 AM IST');
    console.log('3. News Ingestion: Hourly 9 AM-3 PM IST (weekdays)');
    console.log('4. Reminder Check: Every 5 minutes');
    console.log('5. Daily Digest: 8:00 AM IST (weekdays)');
    console.log('=====================\n');

    this.jobs.forEach((job, index) => {
      const nextRun = job.nextDate();
      if (nextRun) {
        console.log(`Job ${index + 1} next run: ${nextRun.toString()}`);
      }
    });
  }

  // Manual trigger methods for testing
  async triggerAMFIIngestion() {
    console.log('Manually triggering AMFI ingestion...');
    await enqueueAMFIIngest({
      url: 'https://www.amfiindia.com/spages/NAVAll.txt',
      date: getISTDate(),
    });
  }

  async triggerYahooIngestion() {
    console.log('Manually triggering Yahoo Finance ingestion...');
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - 7);
    const fromDateStr = fromDate.toISOString().split('T')[0];

    await enqueueYahooIngest({
      symbol: '^NSEI',
      from: fromDateStr,
      to: getISTDate(),
    });
  }

  async triggerNewsIngestion() {
    console.log('Manually triggering news ingestion...');
    await enqueueNewsIngest({
      category: 'business',
      keywords: ['mutual fund', 'investment', 'stock market'],
    });
  }

  async triggerReminderCheck() {
    console.log('Manually triggering reminder check...');
    await enqueueReminderCheck({});
  }
}

export const scheduler = new Scheduler();
