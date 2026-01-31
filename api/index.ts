import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import routes from '../src/routes'; // Import unified routes
import { mongodb } from '../src/db/mongodb'; // Use src/db instead of api/db

// Main Express application for Vercel serverless
const app = express();

// CORS Configuration
const getAllowedOrigins = () => {
  const origins = [
    'http://localhost:3000',
    'http://localhost:5001',
    'http://localhost:5173',
    'https://mf-frontend-coral.vercel.app',
    'https://mutual-fun-frontend-osed.vercel.app',
    process.env.FRONTEND_URL,
  ];

  const envOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
  return [...new Set([...origins, ...envOrigins])].filter(Boolean);
};

app.use(
  cors({
    origin: (origin, callback) => {
      const allowedOrigins = getAllowedOrigins();

      // Allow requests with no origin (mobile apps, Postman)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn('⚠️ CORS blocked origin:', origin);
        // In production, still allow but log for monitoring
        callback(null, true);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin',
    ],
  })
);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// MongoDB connection middleware for serverless
app.use(async (req: Request, res: Response, next: NextFunction) => {
  try {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    await mongodb.connect();
    next();
  } catch (error: any) {
    console.error('❌ MongoDB connection error:', error);
    return res.status(500).json({
      success: false,
      error: 'Database connection failed',
      message: error.message,
    });
  }
});

// Health check route
app.get('/health', (req: Request, res: Response) => {
  res.json({
    success: true,
    status: 'ok',
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    mongodb: mongodb.isConnected(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// Mount all API routes from src/routes
app.use('/api', routes);

// 404 handler - return JSON
app.use((req: Request, res: Response) => {
  console.log(`⚠️ 404 - Route not found: ${req.method} ${req.path}`);
  res.status(404).json({
    success: false,
    error: 'Route not found',
    message: `Cannot ${req.method} ${req.path}`,
    timestamp: new Date().toISOString(),
  });
});

// Global error handler - return JSON
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('❌ Global error handler:', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error',
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    timestamp: new Date().toISOString(),
  });
});

// For Vercel serverless, export the Express app directly
export default app;
