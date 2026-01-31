/**
 * Server Initialization
 * Starts all cron jobs and services
 */

const { redisCache } = require('./services/redis.service');
const { navSyncService } = require('./services/nav-sync.service');
const { indicesSyncService } = require('./services/indices-sync.service');

/**
 * Initialize all services
 */
async function initializeServices() {
  console.log('\n🚀 Initializing services...\n');

  try {
    // 1. Connect to Redis
    console.log('📡 Connecting to Redis...');
    await redisCache.connect();

    if (redisCache.isConnected) {
      console.log('✅ Redis connected successfully\n');
    } else {
      console.warn(
        '⚠️ Redis connection failed, will continue without caching\n'
      );
    }

    // 2. Start NAV sync cron job (Daily 6 PM IST)
    console.log('⏰ Starting NAV sync cron job...');
    navSyncService.startCron();
    console.log('✅ NAV sync cron started (Daily 6 PM IST, Mon-Fri)\n');

    // 3. Start Market Indices sync cron job (Hourly during trading)
    console.log('⏰ Starting Market Indices sync cron job...');
    indicesSyncService.startCron();
    console.log(
      '✅ Indices sync cron started (Hourly 9 AM-4 PM IST, Mon-Fri)\n'
    );

    // 4. Run initial sync if market is open
    const now = new Date();
    const istHours = parseInt(
      now.toLocaleString('en-US', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        hour12: false,
      })
    );

    if (istHours >= 9 && istHours <= 16) {
      console.log('🔄 Market hours detected, running initial sync...');

      // Run indices sync immediately
      setTimeout(() => {
        indicesSyncService.manualSync();
      }, 5000);
    }

    console.log('✅ All services initialized successfully\n');
    console.log('📊 Service Status:');
    console.log(
      `   - Redis: ${redisCache.isConnected ? 'Connected' : 'Disconnected'}`
    );
    console.log(
      `   - NAV Sync: Active (Next run: ${navSyncService.getNextSyncTime().toLocaleString()})`
    );
    console.log(
      `   - Indices Sync: Active (Next run: ${indicesSyncService.getNextSyncTime().toLocaleString()})`
    );
    console.log('\n✨ Backend ready to serve requests\n');
  } catch (error) {
    console.error('❌ Service initialization failed:', error);
    throw error;
  }
}

/**
 * Graceful shutdown
 */
async function shutdown() {
  console.log('\n🛑 Shutting down services...\n');

  try {
    // Disconnect Redis
    await redisCache.disconnect();
    console.log('✅ Redis disconnected');

    console.log('✅ All services shut down gracefully\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Shutdown error:', error);
    process.exit(1);
  }
}

// Handle shutdown signals
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

module.exports = {
  initializeServices,
  shutdown,
};
