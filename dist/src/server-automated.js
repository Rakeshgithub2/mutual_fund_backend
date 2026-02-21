"use strict";
/**
 * Production-Grade Server with Automated Financial Data Pipeline
 * Integrates: Market Indices (5-min), Daily NAV, Weekly Graphs, WebSocket
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const dotenv_1 = __importDefault(require("dotenv"));
const http_1 = require("http");
const mongoose_1 = __importDefault(require("mongoose"));
// Import existing routes
const routes_1 = __importDefault(require("./routes"));
const error_1 = require("./middlewares/error");
const mongodb_1 = require("./db/mongodb");
const market_history_1 = __importDefault(require("./routes/market-history"));
// Import NEW automated system
const market_data_routes_1 = __importDefault(require("./routes/market-data.routes"));
const market_websocket_1 = require("./websocket/market-websocket");
const job_scheduler_1 = require("./schedulers/job-scheduler");
const initialize_system_1 = require("./scripts/initialize-system");
// Import existing services
const { initializeServices } = require('./init');
const { startReminderScheduler } = require('./schedulers/reminder.scheduler');
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3002;
// Security middleware
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
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));
// Body parsing middleware
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true }));
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
app.use('/api', routes_1.default);
app.use('/api/market', market_history_1.default);
// NEW: Automated market data routes
app.use('/api/market-data', market_data_routes_1.default);
// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Route not found',
        path: req.originalUrl,
    });
});
// Error handling middleware
app.use(error_1.errorHandler);
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
    const httpServer = (0, http_1.createServer)(app);
    // Initialize everything
    async function startServer() {
        try {
            console.log('🚀 Starting Production Server...\n');
            // Step 1: Connect to databases
            console.log('📦 Connecting to databases...');
            await mongodb_1.mongodb.connect();
            if (mongoose_1.default.connection.readyState !== 1) {
                await mongoose_1.default.connect(process.env.DATABASE_URL || '');
            }
            console.log('✅ Databases connected\n');
            // Step 2: Initialize system (holidays, indices, etc.)
            await (0, initialize_system_1.initializeSystem)();
            // Step 3: Initialize WebSocket
            console.log('🔌 Starting WebSocket server...');
            (0, market_websocket_1.initializeWebSocket)(httpServer);
            console.log('✅ WebSocket ready\n');
            // Step 4: Initialize job scheduler
            console.log('⏰ Starting automated job scheduler...');
            await (0, job_scheduler_1.initializeScheduler)();
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
                console.log('║   ⚡ Environment: ' +
                    (process.env.NODE_ENV || 'development').padEnd(24) +
                    '║');
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
        }
        catch (error) {
            console.error('❌ Failed to start server:', error);
            process.exit(1);
        }
    }
    startServer();
}
exports.default = app;
