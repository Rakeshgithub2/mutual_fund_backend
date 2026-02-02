"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const routes_1 = __importDefault(require("../src/routes")); // Import unified routes
const mongodb_1 = require("../src/db/mongodb"); // Use src/db instead of api/db
// Main Express application for Vercel serverless
const app = (0, express_1.default)();
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
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        const allowedOrigins = getAllowedOrigins();
        // Allow requests with no origin (mobile apps, Postman)
        if (!origin)
            return callback(null, true);
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        }
        else {
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
}));
// Body parsing middleware
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
// MongoDB connection middleware for serverless
app.use(async (req, res, next) => {
    try {
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
        await mongodb_1.mongodb.connect();
        next();
    }
    catch (error) {
        console.error('❌ MongoDB connection error:', error);
        return res.status(500).json({
            success: false,
            error: 'Database connection failed',
            message: error.message,
        });
    }
});
// Health check route
app.get('/health', (req, res) => {
    res.json({
        success: true,
        status: 'ok',
        message: 'Server is running',
        timestamp: new Date().toISOString(),
        mongodb: mongodb_1.mongodb.isConnected(),
        environment: process.env.NODE_ENV || 'development',
    });
});
// Mount all API routes from src/routes
app.use('/api', routes_1.default);
// 404 handler - return JSON
app.use((req, res) => {
    console.log(`⚠️ 404 - Route not found: ${req.method} ${req.path}`);
    res.status(404).json({
        success: false,
        error: 'Route not found',
        message: `Cannot ${req.method} ${req.path}`,
        timestamp: new Date().toISOString(),
    });
});
// Global error handler - return JSON
app.use((err, req, res, next) => {
    console.error('❌ Global error handler:', err);
    res.status(err.status || 500).json({
        success: false,
        error: err.message || 'Internal server error',
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
        timestamp: new Date().toISOString(),
    });
});
// For Vercel serverless, export the Express app directly
exports.default = app;
