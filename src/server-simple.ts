import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import routes from './routes';
import { mongodb } from './db/mongodb';
import { feedbackModel } from './models/Feedback.model';
import { rankingService } from './services/ranking.service';
import { dataGovernanceService } from './services/dataGovernance.service';

// Import cron jobs
const newsCron = require('../cron/newsCron');
const rankingCron = require('../cron/rankingCron');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
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
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api', routes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found', path: req.originalUrl });
});

// Error handler
app.use((err: any, req: any, res: any, next: any) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
  });
});

// Start server
async function start() {
  try {
    console.log('🚀 Starting server...');

    // Connect to MongoDB
    await mongodb.connect();
    console.log('✅ MongoDB connected');

    // Initialize feedback collection indexes
    await feedbackModel.ensureIndexes();
    console.log('✅ Feedback indexes initialized');

    // Initialize ranking service
    const db = mongodb.getDb();
    await rankingService.initialize(db);
    await dataGovernanceService.initialize(db);
    console.log('✅ Ranking and data governance services initialized');

    // Start Express
    const server = app.listen(PORT, () => {
      console.log('\n' + '='.repeat(60));
      console.log(`✅ Server running on http://localhost:${PORT}`);
      console.log(`✅ Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log('='.repeat(60));
      console.log('\n📋 Endpoints:');
      console.log('  GET    /health');
      console.log('  POST   /api/auth/register');
      console.log('  POST   /api/auth/login');
      console.log('  POST   /api/auth/google');
      console.log('  POST   /api/feedback');
      console.log('  GET    /api/funds');
      console.log('  GET    /api/news');
      console.log('  POST   /api/news/refresh');
      console.log('  GET    /api/rankings/top');
      console.log('  GET    /api/rankings/category/:category');
      console.log('  GET    /api/rankings/risk-adjusted');
      console.log('  GET    /api/market-indices');
      console.log('  GET    /api/portfolio/:userId');
      console.log('  GET    /api/portfolio/:userId/summary');
      console.log('  GET    /api/portfolio/:userId/transactions');
      console.log('  POST   /api/portfolio/:userId/transaction');
      console.log('  PUT    /api/portfolio/:userId/update');
      console.log('\n🎯 Ready to accept requests!\n');

      // Initialize news cron job after server starts
      console.log('⏰ Initializing scheduled tasks...');
      newsCron.scheduleNewsFetch();
      rankingCron.initializeRankingCronJobs();
      console.log('✅ All scheduled tasks initialized\n');
    });

    server.on('error', (error: any) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use`);
      } else {
        console.error('❌ Server error:', error);
      }
      process.exit(1);
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n🛑 Shutting down gracefully...');
      server.close(() => {
        console.log('✅ Server closed');
      });
      await mongodb.disconnect();
      console.log('✅ MongoDB disconnected');
      process.exit(0);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

start();
