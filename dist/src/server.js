"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const compression_1 = __importDefault(require("compression"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const mongodb_1 = require("./db/mongodb");
const redis_1 = require("./cache/redis");
const environment_1 = require("./config/environment");
// Import cron jobs
const newsCron = require('../cron/newsCron');
const autoUpdateCron = require('../cron/autoUpdateCron');
// Route imports
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const fund_routes_1 = __importDefault(require("./routes/fund.routes"));
const search_routes_1 = __importDefault(require("./routes/search.routes"));
// import portfolioRoutes from './routes/portfolio.routes';
// import watchlistRoutes from './routes/watchlist.routes';
const comparison_routes_1 = __importDefault(require("./routes/comparison.routes"));
// import managerRoutes from './routes/manager.routes';
const market_indices_1 = __importDefault(require("./routes/market-indices"));
const ai_chat_routes_1 = __importDefault(require("./routes/ai.chat.routes"));
const chatbot_1 = __importDefault(require("../routes/chatbot"));
// Import news routes and other JavaScript routes from old backend structure
const newsRoutes = require('../routes/news');
const goalRoutes = require('./routes/goal.routes');
const reminderRoutes = require('./routes/reminder.routes');
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
const app = (0, express_1.default)();
// ==================== MIDDLEWARE ====================
// Security
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: environment_1.config.cors.allowedOrigins,
    credentials: true,
}));
// Body parsing
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
// Compression
app.use((0, compression_1.default)());
// Request logging
// app.use(requestLogger);  // Commented out - middleware file missing
// Rate limiting - Global
const globalLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api/', globalLimiter);
// Rate limiting - Auth endpoints (stricter)
const authLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: 'Too many authentication attempts, please try again later.',
});
// Rate limiting - Search endpoints (more lenient)
const searchLimiter = (0, express_rate_limit_1.default)({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 30,
    message: 'Too many search requests, please try again later.',
});
// ==================== ROUTES ====================
// Health check
app.get('/health', async (req, res) => {
    try {
        // Check MongoDB
        const mongoHealth = mongodb_1.mongodb.isConnected();
        // Check Redis
        let redisHealth = false;
        try {
            await redis_1.redis.ping();
            redisHealth = true;
        }
        catch (error) {
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
    }
    catch (error) {
        res.status(503).json({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            error: 'Health check failed',
        });
    }
});
// API routes
app.use('/api/auth', authLimiter, auth_routes_1.default);
app.use('/api/funds', fund_routes_1.default);
app.use('/api/search', searchLimiter, search_routes_1.default);
// app.use('/api/portfolio', authenticateToken, portfolioRoutes);  // TODO: Create route file
// app.use('/api/watchlist', authenticateToken, watchlistRoutes);  // TODO: Create route file
app.use('/api/comparison', comparison_routes_1.default);
app.use('/api/compare', comparison_routes_1.default); // Alias for /api/comparison
app.use('/api/overlap', comparison_routes_1.default); // Alias for /api/comparison
app.use('/api/goals', goalRoutes); // Goal planning routes
app.use('/api/reminders', reminderRoutes); // Reminder management routes
// app.use('/api/managers', managerRoutes);  // TODO: Create route file
app.use('/api/market-indices', market_indices_1.default);
app.use('/api/indices', market_indices_1.default); // Alias for /api/market-indices
app.use('/api/news', newsRoutes); // News routes with cron job
app.use('/api/chat', ai_chat_routes_1.default); // AI chatbot routes
app.use('/api/ai/chat', ai_chat_routes_1.default); // Alias for frontend compatibility
app.use('/api/chatbot', chatbot_1.default); // Enhanced chatbot with knowledge base
// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found',
        path: req.path,
    });
});
// Error handler (must be last)
// app.use(errorHandler);  // Commented out - middleware file missing
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal server error',
    });
});
// ==================== SERVER STARTUP ====================
const PORT = environment_1.config.server.port || 3002;
async function startServer() {
    try {
        console.log('🚀 Starting Mutual Funds Backend Server...\n');
        // Connect to MongoDB
        console.log('📊 Connecting to MongoDB...');
        await mongodb_1.mongodb.connect();
        console.log('✅ MongoDB connected successfully\n');
        // Connect to Redis
        console.log('🔴 Connecting to Redis...');
        await redis_1.redis.connect();
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
    }
    catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}
async function gracefulShutdown() {
    console.log('\n\n🛑 Received shutdown signal, closing server gracefully...');
    try {
        // Close Redis
        await redis_1.redis.quit();
        console.log('✅ Redis connection closed');
        // Close MongoDB
        await mongodb_1.mongodb.disconnect();
        console.log('✅ MongoDB connection closed');
        console.log('👋 Server shut down successfully');
        process.exit(0);
    }
    catch (error) {
        console.error('❌ Error during shutdown:', error);
        process.exit(1);
    }
}
// Start the server
startServer();
exports.default = app;
