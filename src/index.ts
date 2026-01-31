import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { createServer } from 'http';
import routes from './routes';
import { errorHandler } from './middlewares/error';
import { generalRateLimit } from './middleware/rateLimiter';
import { mongodb } from './db/mongodb';
// Import Socket.IO and Change Streams (will handle gracefully if not available)
// import { initializeSocket } from './services/socket';
// import { startWatchlistChangeStream } from './services/changeStreams';

// Import Market Indices Service for auto-update
import { marketIndicesService } from './services/marketIndices.service';
import marketHistoryRoutes from './routes/market-history';

// Import new professional data sync services
const { initializeServices } = require('./init');

// Import Reminder Scheduler for real-time user reminders
const { startReminderScheduler } = require('./schedulers/reminder.scheduler');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3002;

// Initialize database connection
async function initializeDatabase() {
  try {
    await mongodb.connect();
    console.log('✅ Database initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize database:', error);
    process.exit(1);
  }
}

// Initialize market indices with force update
async function initializeMarketIndices() {
  try {
    console.log('📈 Initializing market indices...');
    await marketIndicesService.refreshAllIndices();
    console.log('✅ Market indices initialized');
  } catch (error) {
    console.error('⚠️  Failed to initialize market indices:', error);
    console.log('📊 Will use cached/default values');
  }
}

// Security middleware
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

// Rate limiting - DISABLED FOR DEBUGGING
// app.use(generalRateLimit);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '2.0.0', // Complete fund details with holdings and sectors
  });
});

// Test endpoint
app.get('/api/test', (req, res) => {
  console.log('Test endpoint hit');
  res.json({ message: 'API is working!' });
});

// API routes
app.use('/api', routes);

// Market history routes (historical data for charts)
app.use('/api/market', marketHistoryRoutes);

// Market Indices endpoint (live auto-updating data)
app.get('/api/market/summary', async (req, res) => {
  try {
    const indices = await marketIndicesService.getAllIndices();
    res.json({
      success: true,
      data: indices,
      lastUpdated: new Date().toISOString(),
      marketOpen: true, // TODO: implement market status check
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
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl,
  });
});

// Error handling middleware
app.use(errorHandler);

// Global error handlers
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  console.error('Stack:', error.stack);
  console.error('⚠️ Server will continue running to help debug');
  // Don't exit to see what's happening
  // process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  console.error('⚠️ Server will continue running to help debug');
  // Don't exit to see what's happening
  // process.exit(1);
});

// Log successful initialization
console.log('🎯 All error handlers registered');

// Start server
if (process.env.NODE_ENV !== 'test') {
  const httpServer = createServer(app);

  // Initialize Socket.IO (commented out until socket.io is installed)
  // const io = initializeSocket(httpServer);
  // console.log('✅ Socket.IO initialized');

  // Start MongoDB Change Streams (optional - requires replica set)
  // startWatchlistChangeStream().catch(err => {
  //   console.log('ℹ️ Change Streams not started:', err.message);
  // });

  // Initialize database first, then start server
  initializeDatabase()
    .then(async () => {
      // Initialize market indices data
      await initializeMarketIndices();

      // Initialize professional data sync services (NAV + Market Indices)
      await initializeServices();

      // Start real-time reminder scheduler
      console.log('⏰ Starting reminder scheduler...');
      startReminderScheduler();
      console.log('✅ Reminder scheduler active - checking every 5 minutes');

      const server = httpServer.listen(Number(PORT), '0.0.0.0', () => {
        console.log(`✅ Server is running on http://0.0.0.0:${PORT}`);
        console.log(`✅ Server is running on http://localhost:${PORT}`);
        console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(
          `📡 WebSocket ready for real-time updates (after npm install)`
        );
        console.log('🎯 Server is alive and listening for requests');

        // Professional data services now active
        console.log('📈 Professional data sync services active');
        console.log('💡 NAV: Daily 6 PM IST | Indices: Hourly during trading');

        // Keep the process alive - multiple strategies
        process.stdin.resume();

        // Add keepalive interval to keep event loop active
        setInterval(() => {
          // Log to confirm server is alive
          console.log(
            `🔄 Server alive check at ${new Date().toLocaleTimeString()}`
          );
        }, 1000 * 60); // Every minute

        console.log('✅ Server keepalive configured - will stay running');
      });

      server.on('error', (error: any) => {
        if (error.code === 'EADDRINUSE') {
          console.error(`❌ Port ${PORT} is already in use`);
        } else {
          console.error('❌ Server error:', error);
        }
        process.exit(1);
      });

      // Add listeners for unhandled errors
      process.on('unhandledRejection', (reason, promise) => {
        console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
      });

      process.on('uncaughtException', (error) => {
        console.error('💥 Uncaught Exception:', error);
      });

      // Prevent process exit with signal handlers
      process.on('SIGTERM', () => {
        console.log('\n⚠️  SIGTERM received, shutting down gracefully...');
        server.close(() => {
          console.log('✅ Server closed');
          process.exit(0);
        });
      });

      process.on('SIGINT', () => {
        console.log('\n⚠️  SIGINT received, shutting down gracefully...');
        server.close(() => {
          console.log('✅ Server closed');
          process.exit(0);
        });
      });
    })
    .catch((error) => {
      console.error('❌ Failed to start server:', error);
      process.exit(1);
    });
}

export default app;
