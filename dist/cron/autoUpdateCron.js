/**
 * Auto Update Cron Job
 * Fetches and updates funds and market indices every 2 hours
 */

const cron = require('node-cron');

/**
 * Schedule auto updates every 2 hours
 * Cron expression: '0 */2 * * *' = minute hour day month dayOfWeek
 * Runs at: 12:00 AM, 2:00 AM, 4:00 AM, 6:00 AM, 8:00 AM, 10:00 AM, 12:00 PM, 2:00 PM, 4:00 PM, 6:00 PM, 8:00 PM, 10:00 PM
 */
const scheduleAutoUpdates = () => {
  console.log('\n⏰ ============================================');
  console.log('⏰ INITIALIZING AUTO-UPDATE CRON SCHEDULER');
  console.log('⏰ ============================================');

  // Schedule cron job: Every 2 hours
  const job = cron.schedule(
    '0 */2 * * *',
    async () => {
      console.log('\n⏰ ============================================');
      console.log('⏰ AUTO-UPDATE TRIGGERED');
      console.log(`⏰ Time: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
      console.log('⏰ ============================================');

      try {
        // Update Funds Data
        console.log('\n📊 Updating funds data...');
        // Dynamic import to avoid circular dependencies
        const { fetchAndUpdateFunds } = require('../src/services/fund-data.service');
        await fetchAndUpdateFunds();
        console.log('✅ Funds data updated successfully!');

        // Update Market Indices
        console.log('\n📈 Updating market indices...');
        const { MarketIndicesService } = require('../src/services/marketIndices.service');
        const marketService = MarketIndicesService.getInstance();
        await marketService.fetchAndUpdateAllIndices();
        console.log('✅ Market indices updated successfully!');

        console.log('\n✅ Auto-update completed successfully!');
      } catch (error) {
        console.error('\n❌ Error in auto-update:', error.message);
      }
    },
    {
      scheduled: true,
      timezone: 'Asia/Kolkata', // IST timezone
    }
  );

  console.log('✅ Auto-Update Cron Job Scheduled: Every 2 hours');
  console.log('📋 Schedule Details:');
  console.log('   - Frequency: Every 2 hours');
  console.log('   - Tasks: Funds + Market Indices');
  console.log('   - Timezone: Asia/Kolkata (IST)');
  console.log('⏰ ============================================\n');

  return job;
};

/**
 * Schedule market hours updates (more frequent during trading hours)
 * Runs every 15 minutes from 9:15 AM to 3:30 PM on weekdays
 */
const scheduleMarketHoursUpdates = () => {
  const job = cron.schedule(
    '*/15 9-15 * * 1-5', // Every 15 minutes between 9 AM - 3 PM on Mon-Fri
    async () => {
      const hour = new Date().getHours();
      const minutes = new Date().getMinutes();

      // Only update during market hours (9:15 AM - 3:30 PM)
      if ((hour === 9 && minutes >= 15) || (hour >= 10 && hour <= 14) || (hour === 15 && minutes <= 30)) {
        console.log('\n📈 Market hours update started');
        try {
          const { MarketIndicesService } = require('../src/services/marketIndices.service');
          const marketService = MarketIndicesService.getInstance();
          await marketService.fetchAndUpdateAllIndices();
          console.log('✅ Market indices updated');
        } catch (error) {
          console.error('❌ Error updating market indices:', error);
        }
      }
    },
    {
      scheduled: true,
      timezone: 'Asia/Kolkata',
    }
  );

  console.log('📅 Market hours update scheduler initialized (Every 15 min during trading hours)\n');
  return job;
};

module.exports = {
  scheduleAutoUpdates,
  scheduleMarketHoursUpdates,
};
