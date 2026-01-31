/**
 * Production-Grade Server with Automated Financial Data Pipeline
 * Integrates: Market Indices (5-min), Daily NAV, Weekly Graphs, WebSocket
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { createServer } from 'http';
import mongoose from 'mongoose';

// Import existing routes
import routes from './routes';
import { errorHandler } from './middlewares/error';
import { generalRateLimit } from './middleware/rateLimiter';
import { mongodb } from './db/mongodb';
import marketHistoryRoutes from './routes/market-history';

// Import NEW automated system
import marketDataRoutes from './routes/market-data.routes';
import { initializeWebSocket } from './websocket/market-websocket';
import { initializeScheduler } from './schedulers/job-scheduler';
import { initializeSystem } from './scripts/initialize-system';

// Import existing services
const { initializeServices } = require('./init');
const { startReminderScheduler } = require('./schedulers/reminder.scheduler');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3002;

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

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '3.0.0 - Fully Automated',
    features: [
      'Real-time Market Indices (5-min)',
      'Daily NAV Updates (10:30 PM)',
      'Weekly Graph Aggregation',
      'WebSocket Live Updates',
      'Automated Job Scheduler',
    ],
  });
});

// API routes
app.use('/api', routes);
app.use('/api/market', marketHistoryRoutes);

// NEW: Automated market data routes
app.use('/api/market-data', marketDataRoutes);

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
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start server with automated systems
if (process.env.NODE_ENV !== 'test') {
  const httpServer = createServer(app);

  // Initialize everything
  async function startServer() {
    try {
      console.log('🚀 Starting Production Server...\n');

      // Step 1: Connect to databases
      console.log('📦 Connecting to databases...');
      await mongodb.connect();

      if (mongoose.connection.readyState !== 1) {
        await mongoose.connect(process.env.DATABASE_URL || '');
      }
      console.log('✅ Databases connected\n');

      // Step 2: Initialize system (holidays, indices, etc.)
      await initializeSystem();

      // Step 3: Initialize WebSocket
      console.log('🔌 Starting WebSocket server...');
      initializeWebSocket(httpServer);
      console.log('✅ WebSocket ready\n');

      // Step 4: Initialize job scheduler
      console.log('⏰ Starting automated job scheduler...');
      await initializeScheduler();
      console.log('✅ All jobs scheduled\n');

      // Step 5: Start existing services
      console.log('📡 Starting existing services...');
      await initializeServices();
      startReminderScheduler();
      console.log('✅ Legacy services active\n');

      // Step 6: Start HTTP server
      const server = httpServer.listen(Number(PORT), '0.0.0.0', () => {
        console.log('\n╔════════════════════════════════════════════╗');
        console.log('║   🚀 PRODUCTION SERVER RUNNING             ║');
        console.log('╠════════════════════════════════════════════╣');
        console.log(`║   📍 URL: http://localhost:${PORT}         ║`);
        console.log(`║   🌍 External: http://0.0.0.0:${PORT}      ║`);
        console.log(
          '║   ⚡ Environment: ' +
            (process.env.NODE_ENV || 'development').padEnd(24) +
            '║'
        );
        console.log('╠════════════════════════════════════════════╣');
        console.log('║   AUTOMATED JOBS ACTIVE:                   ║');
        console.log('║   📈 Market Indices: Every 5 minutes       ║');
        console.log('║   💰 Daily NAV: 10:30 PM IST              ║');
        console.log('║   📊 Graph Aggregation: Weekly Sunday     ║');
        console.log('║   🔔 WebSocket: Real-time updates         ║');
        console.log('╚════════════════════════════════════════════╝\n');
      });

      // Graceful shutdown
      const shutdown = async () => {
        console.log('\n⚠️  Shutting down gracefully...');
        server.close(() => {
          console.log('✅ Server closed');
          process.exit(0);
        });
      };

      process.on('SIGTERM', shutdown);
      process.on('SIGINT', shutdown);
    } catch (error) {
      console.error('❌ Failed to start server:', error);
      process.exit(1);
    }
  }

  startServer();
}

export default app;
