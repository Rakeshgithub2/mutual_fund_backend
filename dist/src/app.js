"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const routes_1 = __importDefault(require("./routes"));
const error_1 = require("./middlewares/error");
const app = (0, express_1.default)();
// Get allowed origins from environment or use defaults
const getAllowedOrigins = () => {
    const defaultOrigins = [
        'http://localhost:5001',
        'http://localhost:3000',
        'http://localhost:3001',
        'https://mf-frontend-coral.vercel.app',
        'https://mutual-fun-frontend-osed.vercel.app',
        process.env.FRONTEND_URL,
    ].filter(Boolean);
    const envOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
    return [...new Set([...defaultOrigins, ...envOrigins])];
};
// Security middleware
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        const allowedOrigins = getAllowedOrigins();
        // Allow requests with no origin (like mobile apps or Postman)
        if (!origin)
            return callback(null, true);
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        }
        else {
            console.warn('CORS blocked origin:', origin);
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
    exposedHeaders: ['Set-Cookie'],
}));
// Body parsing middleware
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
    });
});
// Diagnostic endpoint for debugging
app.get('/api/debug', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        config: {
            hasDatabaseUrl: !!process.env.DATABASE_URL,
            hasJwtSecret: !!process.env.JWT_SECRET,
            hasJwtRefreshSecret: !!process.env.JWT_REFRESH_SECRET,
            nodeEnv: process.env.NODE_ENV,
        },
    });
});
// API routes - mounted at /api prefix
app.use('/api', routes_1.default);
// Error handling
app.use(error_1.errorHandler);
// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: `Cannot ${req.method} ${req.path}`,
        timestamp: new Date().toISOString(),
    });
});
exports.default = app;
