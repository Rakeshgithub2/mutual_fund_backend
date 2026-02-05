import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import mongoose from 'mongoose';

import routes from './routes';
import marketHistoryRoutes from './routes/market-history';
import { errorHandler } from './middlewares/error';
import { generalRateLimit } from './middleware/rateLimiter';
import { mongodb } from './db/mongodb';
import { marketIndicesService } from './services/marketIndices.service';

const { initializeServices } = require('./init');
const { startReminderScheduler } = require('./schedulers/reminder.scheduler');

const app = express();
const PORT: number = Number(process.env.PORT) || 3002;

/* ===================== MIDDLEWARE ===================== */
app.use(helmet());
app.use(
  cors({
    origin: [
      'http://localhost:5001',
      'http://localhost:3000',
      'http://localhost:3001',
      'https://mf-frontend-coral.vercel.app',
      'https://mutual-fun-frontend-osed.vercel.app',
      process.env.FRONTEND_URL || 'http://localhost:5001',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
// app.use(generalRateLimit); // Uncomment to enable rate limiting

/* ======================= ROUTES ======================= */
app.get('/', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'Mutual Funds Backend API is running',
    port: PORT,
    timestamp: new Date().toISOString(),
    version: '2.0.0',
  });
});

app.get('/health', (_req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '2.0.0',
  });
});

app.get('/api/test', (_req, res) => {
  console.log('✅ Test endpoint hit');
  res.json({
    success: true,
    message: 'API is working!',
    timestamp: new Date().toISOString(),
  });
});

// API routes - Main router
app.use('/api', routes);

// Market history routes
app.use('/api/market-history', marketHistoryRoutes);

// Market summary endpoint
app.get('/api/market/summary', async (_req, res) => {
  try {
    const indices = await marketIndicesService.getAllIndices();
    res.json({
      success: true,
      data: indices,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error fetching market indices:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch market indices',
    });
  }
});

// 404 handler
app.use('*', (req, res) => {
  console.log(`❌ 404 - Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method,
  });
});

/* =================== ERROR HANDLER ==================== */
app.use(errorHandler);

/* ================= INITIALIZATION ==================== */
async function initializeDatabase() {
  try {
    // Connect native MongoDB driver
    await mongodb.connect();
    console.log('✅ Native MongoDB driver connected');

    // Connect Mongoose (for models using Mongoose schemas)
    const DATABASE_URL =
      process.env.DATABASE_URL || 'mongodb://localhost:27017/mutual_funds_db';
    await mongoose.connect(DATABASE_URL, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.log('✅ Mongoose connected successfully');
    console.log('✅ Database fully initialized');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }
}

async function initializeMarketIndices() {
  try {
    console.log('📈 Initializing market indices...');
    await marketIndicesService.refreshAllIndices();
    console.log('✅ Market indices initialized');
  } catch (error) {
    console.log('⚠️ Using cached/default market indices');
  }
}

/* =================== START SERVER ==================== */
async function startServer() {
  try {
    // Initialize database
    await initializeDatabase();

    // Initialize market indices
    await initializeMarketIndices();

    // Initialize services
    console.log('🔧 Initializing services...');
    await initializeServices();
    console.log('✅ Services initialized');

    // Start reminder scheduler
    console.log('⏰ Starting reminder scheduler...');
    startReminderScheduler();
    console.log('✅ Reminder scheduler active');

    // Create HTTP server
    const server = createServer(app);

    // Start listening
    server.listen(PORT, '0.0.0.0', () => {
      console.log('');
      console.log('='.repeat(60));
      console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log('='.repeat(60));
      console.log('');
      console.log('Available Routes:');
      console.log('  GET  /              - API status');
      console.log('  GET  /health        - Health check');
      console.log('  GET  /api/test      - API test');
      console.log('  *    /api/auth/*    - Authentication routes');
      console.log('  *    /api/funds/*   - Mutual funds routes');
      console.log('  *    /api/users/*   - User routes');
      console.log('  *    /api/portfolio/* - Portfolio routes');
      console.log('  *    /api/watchlist/* - Watchlist routes');
      console.log('');
      console.log('✅ All systems operational');
      console.log('='.repeat(60));
    });

    // Error handling for server
    server.on('error', (error: any) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use`);
        console.log(`💡 Try: kill -9 $(lsof -ti:${PORT})`);
      } else {
        console.error('❌ Server error:', error);
      }
      process.exit(1);
    });

    // Graceful shutdown handlers
    process.on('SIGTERM', () => {
      console.log('\n⚠️ SIGTERM received, shutting down gracefully...');
      server.close(() => {
        console.log('✅ Server closed');
        Promise.all([mongodb.disconnect(), mongoose.disconnect()]).then(() => {
          console.log('✅ Database connections closed');
          process.exit(0);
        });
      });
    });

    process.on('SIGINT', () => {
      console.log('\n⚠️ SIGINT received, shutting down gracefully...');
      server.close(() => {
        console.log('✅ Server closed');
        Promise.all([mongodb.disconnect(), mongoose.disconnect()]).then(() => {
          console.log('✅ Database connections closed');
          process.exit(0);
        });
      });
    });

    // Global error handlers
    process.on('unhandledRejection', (reason, promise) => {
      console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
    });

    process.on('uncaughtException', (error) => {
      console.error('💥 Uncaught Exception:', error);
      console.error('Stack:', error.stack);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start server only if not in test mode
if (process.env.NODE_ENV !== 'test') {
  startServer();
}

export default app;
