const cron = require('node-cron');
const newsService = require('../services/newsService');

/**
 * Schedule news fetching daily at 6:00 AM IST
 * Fetches 20 fresh articles and deletes old ones to save memory
 */
const scheduleNewsFetch = () => {
  console.log('\n🕐 ============================================');
  console.log('🕐 INITIALIZING NEWS CRON SCHEDULER');
  console.log('🕐 ============================================');

  // Schedule cron job: Every day at 6:00 AM IST
  // Cron format: '0 6 * * *' = minute hour day month dayOfWeek
  const job = cron.schedule(
    '0 6 * * *',
    async () => {
      console.log('\n🕐 ============================================');
      console.log('🕐 DAILY NEWS FETCH TRIGGERED AT 6:00 AM IST');
      console.log('🕐 ============================================');
      try {
        await newsService.fetchAndStoreNews(true); // isScheduled = true, fetches 20 articles
        console.log('\n✅ Daily news fetch completed successfully!');
      } catch (error) {
        console.error('\n❌ Error in scheduled news fetch:', error.message);
      }
    },
    {
      scheduled: true,
      timezone: 'Asia/Kolkata', // IST timezone
    }
  );

  console.log('✅ News Cron Job Scheduled: DAILY at 6:00 AM IST');
  console.log('📋 Schedule Details:');
  console.log('   - Frequency: Once per day');
  console.log('   - Time: 6:00 AM IST');
  console.log('   - Articles: 20 fresh news (scheduled mode)');
  console.log('   - Memory: Old articles deleted automatically');
  console.log('   - Timezone: Asia/Kolkata (IST)');
  console.log('🕐 ============================================\n');

  // Fetch news immediately on server start (testing mode - 8 articles)
  setTimeout(async () => {
    console.log('\n📰 ============================================');
    console.log('📰 FETCHING INITIAL NEWS ON SERVER STARTUP (TESTING MODE)');
    console.log('📰 ============================================');
    try {
      await newsService.fetchAndStoreNews(false); // isScheduled = false, fetches 8 articles for testing
      console.log('\n✅ Initial news fetch completed successfully!');
    } catch (error) {
      console.error('\n❌ Error fetching initial news:', error.message);
    }
  }, 10000); // Wait 10 seconds after server start for DB to be ready

  return job;
};

/**
 * Schedule hourly news refresh (optional - for more frequent updates)
 */
const scheduleHourlyRefresh = () => {
  // Update news every 4 hours during market hours
  const job = cron.schedule(
    '0 */4 * * *',
    async () => {
      const hour = new Date().getHours();
      // Only refresh during market hours (9 AM - 6 PM)
      if (hour >= 9 && hour <= 18) {
        console.log('🔄 Hourly news refresh started');
        try {
          await newsService.fetchAndStoreNews(true); // isScheduled = true, fetches 20 articles
          console.log('✅ Hourly news refresh completed');
        } catch (error) {
          console.error('❌ Error in hourly news refresh:', error);
        }
      }
    },
    {
      scheduled: true,
      timezone: 'Asia/Kolkata',
    }
  );

  console.log(
    '📅 Hourly news refresh scheduler initialized (Every 4 hours during market hours)'
  );
  return job;
};

module.exports = {
  scheduleNewsFetch,
  scheduleHourlyRefresh,
};
