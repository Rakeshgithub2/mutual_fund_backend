"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const dotenv_1 = __importDefault(require("dotenv"));
const routes_1 = __importDefault(require("./routes"));
const mongodb_1 = require("./db/mongodb");
const Feedback_model_1 = require("./models/Feedback.model");
const ranking_service_1 = require("./services/ranking.service");
const dataGovernance_service_1 = require("./services/dataGovernance.service");
// Import cron jobs
const newsCron = require('../cron/newsCron');
const rankingCron = require('../cron/rankingCron');
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3002;
// Middleware
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: [
        'http://localhost:5001',
        'http://localhost:3000',
        'http://localhost:3001',
        'https://mf-frontend-coral.vercel.app',
        'https://mutual-fun-frontend-osed.vercel.app',
        process.env.FRONTEND_URL || 'http://localhost:5001',
    ],
    credentials: true,
}));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});
// API routes
app.use('/api', routes_1.default);
// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Route not found', path: req.originalUrl });
});
// Error handler
app.use((err, req, res, next) => {
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
        await mongodb_1.mongodb.connect();
        console.log('✅ MongoDB connected');
        // Initialize feedback collection indexes
        await Feedback_model_1.feedbackModel.ensureIndexes();
        console.log('✅ Feedback indexes initialized');
        // Initialize ranking service
        const db = mongodb_1.mongodb.getDb();
        await ranking_service_1.rankingService.initialize(db);
        await dataGovernance_service_1.dataGovernanceService.initialize(db);
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
        server.on('error', (error) => {
            if (error.code === 'EADDRINUSE') {
                console.error(`❌ Port ${PORT} is already in use`);
            }
            else {
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
            await mongodb_1.mongodb.disconnect();
            console.log('✅ MongoDB disconnected');
            process.exit(0);
        });
    }
    catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}
start();
