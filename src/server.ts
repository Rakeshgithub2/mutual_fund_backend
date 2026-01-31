import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { mongodb } from './db/mongodb';
import { redis } from './cache/redis';
import { config } from './config/environment';

// Import cron jobs
const newsCron = require('../cron/newsCron');
const autoUpdateCron = require('../cron/autoUpdateCron');

// Route imports
import authRoutes from './routes/auth.routes';
import fundRoutes from './routes/fund.routes';
import searchRoutes from './routes/search.routes';
// import portfolioRoutes from './routes/portfolio.routes';
// import watchlistRoutes from './routes/watchlist.routes';
import comparisonRoutes from './routes/comparison.routes';
// import managerRoutes from './routes/manager.routes';
import marketIndicesRoutes from './routes/market-indices';
import aiChatRoutes from './routes/ai.chat.routes';
import chatbotRoutes from '../routes/chatbot';

// Import news routes and other JavaScript routes from old backend structure
const newsRoutes = require('../routes/news');
const goalRoutes = require('./routes/goal.routes');
const reminderRoutes = require('./routes/reminder.routes');

// Middleware imports
// import { errorHandler } from './middleware/error.middleware';
// import { requestLogger } from './middleware/logger.middleware';
import { authenticateToken } from './middleware/auth.middleware';

/**
 * Express Server Setup
 *
 * Architecture:
 * - RESTful API design
 * - JWT-based authentication
 * - Redis caching layer
 * - MongoDB with proper indexes
 * - Rate limiting & security
 * - Background workers (BullMQ)
 */

const app: Application = express();

// ==================== MIDDLEWARE ====================

// Security
app.use(helmet());
app.use(
  cors({
    origin: config.cors.allowedOrigins,
    credentials: true,
  })
);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression
app.use(compression());

// Request logging
// app.use(requestLogger);  // Commented out - middleware file missing

// Rate limiting - Global
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', globalLimiter);

// Rate limiting - Auth endpoints (stricter)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many authentication attempts, please try again later.',
});

// Rate limiting - Search endpoints (more lenient)
const searchLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30,
  message: 'Too many search requests, please try again later.',
});

// ==================== ROUTES ====================

// Health check
app.get('/health', async (req: Request, res: Response) => {
  try {
    // Check MongoDB
    const mongoHealth = mongodb.isConnected();

    // Check Redis
    let redisHealth = false;
    try {
      await redis.ping();
      redisHealth = true;
    } catch (error) {
      console.error('Redis health check failed:', error);
    }

    const status = mongoHealth && redisHealth ? 'healthy' : 'degraded';

    res.status(status === 'healthy' ? 200 : 503).json({
      status,
      timestamp: new Date().toISOString(),
      services: {
        mongodb: mongoHealth ? 'connected' : 'disconnected',
        redis: redisHealth ? 'connected' : 'disconnected',
      },
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
    });
  }
});

// API routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/funds', fundRoutes);
app.use('/api/search', searchLimiter, searchRoutes);
// app.use('/api/portfolio', authenticateToken, portfolioRoutes);  // TODO: Create route file
// app.use('/api/watchlist', authenticateToken, watchlistRoutes);  // TODO: Create route file
app.use('/api/comparison', comparisonRoutes);
app.use('/api/compare', comparisonRoutes); // Alias for /api/comparison
app.use('/api/overlap', comparisonRoutes); // Alias for /api/comparison
app.use('/api/goals', goalRoutes); // Goal planning routes
app.use('/api/reminders', reminderRoutes); // Reminder management routes
// app.use('/api/managers', managerRoutes);  // TODO: Create route file
app.use('/api/market-indices', marketIndicesRoutes);
app.use('/api/indices', marketIndicesRoutes); // Alias for /api/market-indices
app.use('/api/news', newsRoutes); // News routes with cron job
app.use('/api/chat', aiChatRoutes); // AI chatbot routes
app.use('/api/ai/chat', aiChatRoutes); // Alias for frontend compatibility
app.use('/api/chatbot', chatbotRoutes); // Enhanced chatbot with knowledge base

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.path,
  });
});

// Error handler (must be last)
// app.use(errorHandler);  // Commented out - middleware file missing
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
  });
});

// ==================== SERVER STARTUP ====================

const PORT = config.server.port || 3002;

async function startServer() {
  try {
    console.log('🚀 Starting Mutual Funds Backend Server...\n');

    // Connect to MongoDB
    console.log('📊 Connecting to MongoDB...');
    await mongodb.connect();
    console.log('✅ MongoDB connected successfully\n');

    // Connect to Redis
    console.log('🔴 Connecting to Redis...');
    await redis.connect();
    console.log('✅ Redis connected successfully\n');

    // Start Express server
    app.listen(PORT, () => {
      console.log('═'.repeat(60));
      console.log(`✅ Server running on port ${PORT}`);
      console.log(`📍 Health check: http://localhost:${PORT}/health`);
      console.log(`📍 API base: http://localhost:${PORT}/api`);
      console.log('═'.repeat(60));
      console.log('\n📋 Available Endpoints:');
      console.log('  - POST   /api/auth/google');
      console.log('  - POST   /api/auth/refresh');
      console.log('  - GET    /api/funds');
      console.log('  - GET    /api/funds/:id');
      console.log('  - GET    /api/search/suggest');
      console.log('  - GET    /api/search/funds');
      console.log('  - POST   /api/comparison/compare');
      console.log('  - GET    /api/portfolio');
      console.log('  - GET    /api/watchlist');
      console.log('  - GET    /api/managers/:id');
      console.log('  - GET    /api/news');
      console.log('  - GET    /api/news/:id');
      console.log('  - POST   /api/news/refresh');
      console.log('  - POST   /api/chat');
      console.log('  - GET    /api/chat/suggestions');
      console.log('  - POST   /api/chat/analyze-fund');
      console.log('  - POST   /api/chatbot/ask');
      console.log('  - GET    /api/chatbot/popular');
      console.log('  - GET    /api/chatbot/categories');
      console.log('  - POST   /api/chatbot/calculate/sip');
      console.log('  - POST   /api/chatbot/calculate/lumpsum');
      console.log('\n🎯 Ready to accept requests!\n');

      // Initialize cron jobs after server starts
      console.log('\n⏰ Initializing scheduled tasks...');
      newsCron.scheduleNewsFetch();
      autoUpdateCron.scheduleAutoUpdates();
      autoUpdateCron.scheduleMarketHoursUpdates();
      console.log('✅ All scheduled tasks initialized\n');
    });

    // Graceful shutdown
    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

async function gracefulShutdown() {
  console.log('\n\n🛑 Received shutdown signal, closing server gracefully...');

  try {
    // Close Redis
    await redis.quit();
    console.log('✅ Redis connection closed');

    // Close MongoDB
    await mongodb.disconnect();
    console.log('✅ MongoDB connection closed');

    console.log('👋 Server shut down successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
}

// Start the server
startServer();

export default app;
