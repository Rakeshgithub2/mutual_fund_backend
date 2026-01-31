import { CronJob } from 'cron';
import { fundIngestionOrchestrator } from '../importers/orchestrator';
import { FundModel, FundPriceModel } from '../../models';
import { yahooFinanceImporter } from '../importers/yahoo-finance.importer';

// Lazy-initialized models
let fundModel: ReturnType<typeof FundModel.getInstance> | null = null;
let fundPriceModel: ReturnType<typeof FundPriceModel.getInstance> | null = null;

const getFundModel = () => {
  if (!fundModel) fundModel = FundModel.getInstance();
  return fundModel;
};
const getFundPriceModel = () => {
  if (!fundPriceModel) fundPriceModel = FundPriceModel.getInstance();
  return fundPriceModel;
};

/**
 * Daily NAV Update Scheduler
 * Automatically updates NAV and price history for all funds
 */
export class NAVUpdateScheduler {
  private jobs: CronJob[] = [];

  /**
   * Start all scheduled jobs
   */
  start() {
    console.log('📅 Starting NAV Update Scheduler...\n');

    // Job 1: Update NAVs every day at 6 PM IST (after market close)
    const navUpdateJob = new CronJob(
      '0 18 * * 1-5', // 6 PM, Monday to Friday
      async () => {
        console.log('\n⏰ Running scheduled NAV update...');
        await this.updateAllNAVs();
      },
      null,
      true,
      'Asia/Kolkata'
    );

    this.jobs.push(navUpdateJob);
    console.log('✓ Scheduled daily NAV updates at 6:00 PM IST');

    // Job 2: Import historical prices weekly on Sunday at 2 AM
    const priceHistoryJob = new CronJob(
      '0 2 * * 0', // 2 AM, Sunday
      async () => {
        console.log('\n⏰ Running weekly price history update...');
        await this.updatePriceHistory();
      },
      null,
      true,
      'Asia/Kolkata'
    );

    this.jobs.push(priceHistoryJob);
    console.log('✓ Scheduled weekly price history updates at 2:00 AM Sunday');

    // Job 3: Calculate 52-week high/low daily at 7 PM
    const statsUpdateJob = new CronJob(
      '0 19 * * 1-5', // 7 PM, Monday to Friday
      async () => {
        console.log('\n⏰ Running daily statistics update...');
        await this.updateStatistics();
      },
      null,
      true,
      'Asia/Kolkata'
    );

    this.jobs.push(statsUpdateJob);
    console.log('✓ Scheduled daily statistics updates at 7:00 PM IST');

    console.log('\n✅ All NAV update jobs scheduled successfully!\n');
  }

  /**
   * Stop all scheduled jobs
   */
  stop() {
    console.log('🛑 Stopping NAV Update Scheduler...');
    this.jobs.forEach((job) => job.stop());
    console.log('✅ All jobs stopped');
  }

  /**
   * Update NAVs for all funds
   */
  private async updateAllNAVs(): Promise<void> {
    try {
      console.log('\n📊 Fetching latest NAVs...\n');

      const funds = await getFundModel().findAll({ limit: 1000 });
      let updated = 0;
      let failed = 0;

      for (const fund of funds) {
        try {
          // Only update Yahoo Finance sourced funds
          if (fund.dataSource === 'Yahoo Finance') {
            const quote = await yahooFinanceImporter.getQuote(fund.fundId);

            if (quote && quote.regularMarketPrice) {
              // Update fund NAV
              await getFundModel().updateNav(
                fund.fundId,
                quote.regularMarketPrice,
                new Date()
              );

              // Save to price history
              const changePercent = quote.regularMarketChangePercent || 0;
              await getFundPriceModel().upsert({
                fundId: fund.fundId,
                date: new Date(),
                nav: quote.regularMarketPrice,
                open: quote.regularMarketOpen,
                high: quote.regularMarketDayHigh,
                low: quote.regularMarketDayLow,
                close: quote.regularMarketPrice,
                volume: quote.regularMarketVolume,
                changePercent,
              });

              updated++;
              console.log(
                `  ✓ ${fund.name}: ₹${quote.regularMarketPrice} (${changePercent > 0 ? '+' : ''}${changePercent.toFixed(2)}%)`
              );
            } else {
              failed++;
            }

            // Rate limiting
            await this.delay(500);
          }
        } catch (error: any) {
          console.error(`  ✗ Error updating ${fund.name}: ${error.message}`);
          failed++;
        }
      }

      console.log(`\n✅ NAV Update Complete:`);
      console.log(`   • Updated: ${updated}`);
      console.log(`   • Failed: ${failed}`);
      console.log(`   • Total: ${funds.length}\n`);
    } catch (error: any) {
      console.error('❌ NAV update failed:', error.message);
    }
  }

  /**
   * Update price history for all funds
   */
  private async updatePriceHistory(): Promise<void> {
    try {
      console.log('\n📈 Updating price history...\n');

      const funds = await getFundModel().findAll({ limit: 200 });
      const yahooFunds = funds.filter((f) => f.dataSource === 'Yahoo Finance');

      await fundIngestionOrchestrator.importHistoricalPrices(
        yahooFunds.map((f) => f.fundId),
        '3mo' // Last 3 months
      );

      console.log('✅ Price history update complete\n');
    } catch (error: any) {
      console.error('❌ Price history update failed:', error.message);
    }
  }

  /**
   * Calculate 52-week high/low and other statistics
   */
  private async updateStatistics(): Promise<void> {
    try {
      console.log('\n📊 Calculating fund statistics...\n');

      const funds = await getFundModel().findAll({ limit: 1000 });
      let updated = 0;

      for (const fund of funds) {
        try {
          // Get 1 year price history
          const oneYearAgo = new Date();
          oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

          const priceHistory = await getFundPriceModel().getHistory(
            fund.fundId,
            {
              startDate: oneYearAgo,
              endDate: new Date(),
            }
          );

          if (priceHistory.length > 0) {
            // Calculate 52-week high and low
            const navs = priceHistory.map((p) => p.nav);
            const fiftyTwoWeekHigh = Math.max(...navs);
            const fiftyTwoWeekLow = Math.min(...navs);

            // Calculate volatility
            const volatility = await getFundPriceModel().getVolatility(
              fund.fundId,
              oneYearAgo,
              new Date()
            );

            // Calculate moving averages
            const sma50 = await getFundPriceModel().getMovingAverage(
              fund.fundId,
              50
            );
            const sma200 = await getFundPriceModel().getMovingAverage(
              fund.fundId,
              200
            );

            // Update fund with calculated metrics
            await getFundModel().update(fund.fundId, {
              riskMetrics: {
                ...fund.riskMetrics,
                standardDeviation: volatility || 0,
              },
            });

            updated++;
            console.log(
              `  ✓ ${fund.name}: H: ${fiftyTwoWeekHigh}, L: ${fiftyTwoWeekLow}`
            );
          }

          // Rate limiting
          await this.delay(100);
        } catch (error: any) {
          console.error(
            `  ✗ Error calculating stats for ${fund.name}: ${error.message}`
          );
        }
      }

      console.log(`\n✅ Statistics updated for ${updated} funds\n`);
    } catch (error: any) {
      console.error('❌ Statistics update failed:', error.message);
    }
  }

  /**
   * Manual trigger for NAV update (for testing)
   */
  async triggerNAVUpdate(): Promise<void> {
    console.log('🔄 Manually triggering NAV update...');
    await this.updateAllNAVs();
  }

  /**
   * Manual trigger for price history update
   */
  async triggerPriceHistoryUpdate(): Promise<void> {
    console.log('🔄 Manually triggering price history update...');
    await this.updatePriceHistory();
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const navUpdateScheduler = new NAVUpdateScheduler();
