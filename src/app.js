/**
 * Main Application Entry Point
 * Production-ready Express app with all configurations
 */

// Load environment variables first
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const dbConfig = require('./config/db.config');
const redisConfig = require('./config/redis.config');
const cacheClient = require('./cache/redis.client');
const schedulerUtil = require('./utils/scheduler.util');
const masterCronScheduler = require('../cron/scheduler'); // Master cron scheduler for 15K+ funds

// Import jobs
// DISABLED: Missing models - const dailyNavJob = require('./jobs/dailyNav.job');
// DISABLED: Missing models - const marketIndexJob = require('./jobs/marketIndex.job');
const reminderJob = require('./jobs/reminder.job');

// Import middleware
const AuthMiddleware = require('../dist/src/middleware/auth.middleware');
const RateLimiterMiddleware = require('./middleware/rateLimiter.middleware');

// Import routes
const authRoutes = require('../dist/src/routes/auth.routes').default;
const fundRoutes = require('../dist/src/routes/fund.routes').default;
const marketIndexRoutes = require('./routes/marketIndex.routes');
const marketHistoryRoutes = require('./routes/market-history.routes');
const marketProductionRoutes = require('./routes/market.production.routes'); // Production-grade cached routes
const watchlistRoutes = require('./routes/watchlist.routes');
const goalRoutes = require('./routes/goal.routes');
const reminderRoutes = require('./routes/reminder.routes');
const newsRoutes = require('./routes/news.routes');
const indicesRoutes = require('./routes/indices.routes');
const aiRoutes = require('./routes/ai.routes');
const searchRoutes = require('../dist/src/routes/search.routes').default;
// const holdingsRoutes = require('./routes/holdings.routes'); // TypeScript file - needs compilation

const app = express();
const PORT = process.env.PORT || 3000;

// ==================== MIDDLEWARE ====================

// Security
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
      },
    },
  })
);

// CORS - Must specify exact origin when using credentials: 'include'
app.use(
  cors({
    origin:
      process.env.NODE_ENV === 'production'
        ? process.env.FRONTEND_URL
        : ['http://localhost:5001', 'http://localhost:3000'], // Explicit origins for development
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Handle preflight requests explicitly
app.options('*', cors());

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression
app.use(compression());

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Rate limiting logging
app.use(RateLimiterMiddleware.logRateLimitHits);

// ==================== ROUTES ====================

// Health check
app.get('/health', async (req, res) => {
  const dbStatus = dbConfig.getStatus();
  const cacheStatus = redisConfig.getStatus();

  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      database: {
        connected: dbStatus.isConnected,
        database: dbStatus.database,
      },
      cache: {
        connected: cacheStatus.isConnected,
        status: cacheStatus.status,
      },
    },
  });
});

// API info
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Mutual Funds Backend API',
    version: '1.0.0',
    documentation: '/api/docs',
    endpoints: {
      auth: '/api/auth',
      funds: '/api/funds',
      marketIndices: '/api/market',
      watchlist: '/api/watchlist',
      goals: '/api/goals',
      reminders: '/api/reminders',
      news: '/api/news',
      ai: '/api/ai',
    },
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/funds', fundRoutes);
// Production-grade cached routes FIRST (Redis → MongoDB fallback) - handles /indices, /status, /summary
app.use('/api/market', marketProductionRoutes);
// Legacy routes for endpoints not covered by production routes
app.use('/api/market', marketIndexRoutes);
app.use('/api/market', marketHistoryRoutes); // Historical data endpoint
app.use('/api/watchlist', watchlistRoutes);
app.use('/api/goals', goalRoutes);
app.use('/api/reminders', reminderRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/indices', indicesRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/search', searchRoutes); // Mobile-first search API
// app.use('/api/holdings', holdingsRoutes); // Fund portfolio holdings - TypeScript file needs compilation

// ==================== ERROR HANDLING ====================

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('❌ Error:', error);

  const statusCode = error.statusCode || 500;
  const message = error.message || 'Internal Server Error';

  res.status(statusCode).json({
    success: false,
    error: error.name || 'Error',
    message: message,
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
  });
});

// ==================== SCHEDULER SETUP ====================

function setupScheduler() {
  console.log('\n📅 Setting up cron jobs...\n');

  // Initialize Master Cron Scheduler (15K+ funds system)
  console.log('🔄 Initializing Master Cron Scheduler...');
  masterCronScheduler.initializeJobs();
  masterCronScheduler.start();

  // Display schedule information
  const scheduleInfo = masterCronScheduler.getScheduleInfo();
  console.log('\n📋 Master Scheduler - Update Frequencies:');
  console.log('  ├─ NAV Updates:', scheduleInfo.nav);
  console.log('  ├─ Daily Returns:', scheduleInfo.dailyReturns);
  console.log('  ├─ Monthly Updates:', scheduleInfo.monthlyUpdates);
  console.log('  ├─ Holdings:', scheduleInfo.holdings);
  console.log('  ├─ Fund Managers:', scheduleInfo.fundManagers);
  console.log('  └─ Market Indices:', scheduleInfo.marketIndices);

  // Legacy cron jobs (for backward compatibility)
  console.log('\n📅 Setting up legacy cron jobs...\n');

  // DISABLED: Missing models - Daily NAV update @ 9:30 PM IST
  // schedulerUtil.scheduleJob(
  //   'dailyNav',
  //   schedulerUtil.constructor.CRON_EXPRESSIONS.DAILY_9_30_PM,
  //   () => dailyNavJob.execute()
  // );

  // DISABLED: Missing models - Market indices update every 2 hours (market hours only)
  // schedulerUtil.scheduleMarketHoursJob(
  //   'marketIndex',
  //   schedulerUtil.constructor.CRON_EXPRESSIONS.EVERY_2_HOURS_MARKET,
  //   () => marketIndexJob.execute()
  // );

  // Reminder check every 5 minutes
  schedulerUtil.scheduleJob(
    'reminders',
    schedulerUtil.constructor.CRON_EXPRESSIONS.EVERY_5_MINUTES,
    () => reminderJob.execute()
  );

  console.log('\n✅ All cron jobs scheduled successfully\n');

  // Log scheduled jobs
  const jobs = schedulerUtil.getAllJobs();
  jobs.forEach((job) => {
    console.log(`  📋 ${job.name}: ${job.cronExpression}`);
  });
  console.log('');
}

// ==================== SERVER STARTUP ====================

async function startServer() {
  try {
    console.log('\n🚀 Starting Mutual Funds Backend...\n');

    // Step 1: Connect to MongoDB (both Mongoose and native driver)
    console.log('📊 Connecting to MongoDB Atlas...');
    await dbConfig.connect();

    // Also initialize native MongoDB driver for TypeScript routes
    const { mongodb } = require('../dist/src/db/mongodb');
    await mongodb.connect();

    // Step 2: Create database indexes
    console.log('📊 Creating database indexes...');
    await dbConfig.createIndexes();

    // Step 3: Connect to Redis
    console.log('🔥 Connecting to Redis...');
    await cacheClient.init();

    // Step 4: Setup cron jobs
    setupScheduler();

    // Step 5: Start Express server
    app.listen(PORT, () => {
      console.log('✅ Server started successfully');
      console.log(`📡 Listening on port ${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 API URL: http://localhost:${PORT}`);
      console.log('\n✨ Ready to accept requests!\n');
    });
  } catch (error) {
    console.error('\n❌ Failed to start server:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// ==================== GRACEFUL SHUTDOWN ====================

process.on('SIGTERM', async () => {
  console.log('\n🛑 SIGTERM received, shutting down gracefully...');

  // Stop cron jobs
  masterCronScheduler.stop(); // Stop master scheduler
  schedulerUtil.stopAllJobs(); // Stop legacy jobs

  // Close database connections
  await dbConfig.disconnect();
  await redisConfig.disconnect();

  console.log('✅ Graceful shutdown completed');
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('\n🛑 SIGINT received, shutting down gracefully...');

  masterCronScheduler.stop(); // Stop master scheduler
  schedulerUtil.stopAllJobs(); // Stop legacy jobs
  schedulerUtil.stopAllJobs();

  // Close database connections
  await dbConfig.disconnect();
  await redisConfig.disconnect();

  console.log('✅ Graceful shutdown completed');
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the server
if (require.main === module) {
  startServer();
}

module.exports = app;
