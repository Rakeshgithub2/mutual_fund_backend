/**
 * Ranking Calculation Cron Job
 *
 * Schedules:
 * - Daily ranking recalculation (1:00 AM IST)
 * - Weekly data governance checks (Sunday 2:00 AM IST)
 *
 * Ensures fresh, accurate rankings for mobile users
 */

const cron = require('node-cron');
const { rankingService } = require('../src/services/ranking.service');
const {
  dataGovernanceService,
} = require('../src/services/dataGovernance.service');

/**
 * Schedule daily ranking recalculation
 * Runs at 1:00 AM IST (after NAV updates at midnight)
 */
function scheduleDailyRankingCalculation() {
  // Cron expression: 0 1 * * * (1:00 AM every day)
  // Adjusted for IST timezone
  cron.schedule(
    '0 1 * * *',
    async () => {
      try {
        console.log(
          '\n⏰ [CRON] Daily ranking recalculation started at',
          new Date().toISOString()
        );

        // Clear cache to force fresh calculations
        rankingService.clearCache();
        console.log('✅ [CRON] Ranking cache cleared');

        // Pre-calculate top rankings (warm up cache)
        console.log('🔄 [CRON] Pre-calculating top rankings...');

        await rankingService.getTopFunds(20);
        console.log('  ✅ Top 20 funds calculated');

        await rankingService.getTopFunds(50);
        console.log('  ✅ Top 50 funds calculated');

        await rankingService.getTopFunds(100);
        console.log('  ✅ Top 100 funds calculated');

        // Calculate category leaders
        const categories = [
          'equity',
          'debt',
          'hybrid',
          'elss',
          'commodity',
          'index',
          'etf',
        ];
        for (const category of categories) {
          await rankingService.getCategoryLeaders(category, 10);
          console.log(`  ✅ ${category} category leaders calculated`);
        }

        // Calculate risk-adjusted rankings
        await rankingService.getRiskAdjustedRankings(50);
        console.log('  ✅ Risk-adjusted rankings calculated');

        // Calculate rolling return rankings
        await rankingService.getRollingReturnRankings('3y', 100);
        console.log('  ✅ 3Y rolling return rankings calculated');

        await rankingService.getRollingReturnRankings('5y', 100);
        console.log('  ✅ 5Y rolling return rankings calculated');

        console.log('✅ [CRON] Daily ranking recalculation completed\n');
      } catch (error) {
        console.error('❌ [CRON] Error during ranking recalculation:', error);
      }
    },
    {
      timezone: 'Asia/Kolkata',
    }
  );

  console.log('✅ Daily ranking recalculation scheduled (1:00 AM IST)');
}

/**
 * Schedule weekly data governance checks
 * Runs every Sunday at 2:00 AM IST
 */
function scheduleWeeklyDataGovernance() {
  // Cron expression: 0 2 * * 0 (2:00 AM every Sunday)
  cron.schedule(
    '0 2 * * 0',
    async () => {
      try {
        console.log(
          '\n⏰ [CRON] Weekly data governance check started at',
          new Date().toISOString()
        );

        // Validate all funds
        console.log('🔍 [CRON] Validating all funds...');
        const validationResults =
          await dataGovernanceService.validateAllFunds();
        console.log(
          `  ℹ️  Found ${validationResults.length} funds with issues`
        );

        // Log critical issues
        const criticalIssues = validationResults.filter((r) =>
          r.issues.some((i) => i.severity === 'critical')
        );
        if (criticalIssues.length > 0) {
          console.log(
            `  ⚠️  ${criticalIssues.length} funds have critical issues`
          );
          criticalIssues.slice(0, 5).forEach((r) => {
            console.log(
              `     - ${r.fundName}: ${r.issues
                .filter((i) => i.severity === 'critical')
                .map((i) => i.message)
                .join(', ')}`
            );
          });
        }

        // Generate freshness report
        console.log('📊 [CRON] Generating data freshness report...');
        const freshnessReport =
          await dataGovernanceService.generateFreshnessReport();
        const criticalFreshness = freshnessReport.filter(
          (r) => r.overallFreshness === 'critical'
        );
        console.log(`  ℹ️  ${freshnessReport.length} funds have stale data`);
        console.log(
          `  ⚠️  ${criticalFreshness.length} funds have critically stale data`
        );

        // Auto-hide incomplete funds (Zero-NA policy enforcement)
        console.log('🔒 [CRON] Enforcing zero-NA policy...');
        const hiddenCount =
          await dataGovernanceService.autoHideIncompleteFunds();
        console.log(`  ✅ Auto-hidden ${hiddenCount} incomplete funds`);

        console.log('✅ [CRON] Weekly data governance check completed\n');
      } catch (error) {
        console.error('❌ [CRON] Error during data governance check:', error);
      }
    },
    {
      timezone: 'Asia/Kolkata',
    }
  );

  console.log('✅ Weekly data governance check scheduled (Sunday 2:00 AM IST)');
}

/**
 * Schedule hourly cache refresh for top rankings
 * Keeps mobile dashboard data fresh
 */
function scheduleHourlyCacheRefresh() {
  // Cron expression: 0 * * * * (Every hour at :00)
  cron.schedule(
    '0 * * * *',
    async () => {
      try {
        console.log(
          '⏰ [CRON] Hourly cache refresh started at',
          new Date().toISOString()
        );

        // Refresh most-accessed rankings
        await rankingService.getTopFunds(20);
        await rankingService.getCategoryLeaders('equity', 10);
        await rankingService.getCategoryLeaders('debt', 10);
        await rankingService.getRiskAdjustedRankings(50);

        console.log('✅ [CRON] Hourly cache refresh completed');
      } catch (error) {
        console.error('❌ [CRON] Error during cache refresh:', error);
      }
    },
    {
      timezone: 'Asia/Kolkata',
    }
  );

  console.log('✅ Hourly cache refresh scheduled (every hour)');
}

/**
 * Initialize all ranking-related cron jobs
 */
function initializeRankingCronJobs() {
  scheduleDailyRankingCalculation();
  scheduleWeeklyDataGovernance();
  scheduleHourlyCacheRefresh();

  console.log('✅ All ranking cron jobs initialized');
}

module.exports = {
  initializeRankingCronJobs,
  scheduleDailyRankingCalculation,
  scheduleWeeklyDataGovernance,
  scheduleHourlyCacheRefresh,
};
