"use strict";
/**
 * Market Data API Routes
 * Endpoints for market indices, NAV, returns, and graph data
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const market_indices_service_1 = __importDefault(require("../services/market-indices.service"));
const market_calendar_service_1 = __importDefault(require("../services/market-calendar.service"));
const nav_service_1 = __importDefault(require("../services/nav.service"));
const graph_data_service_1 = __importDefault(require("../services/graph-data.service"));
const job_scheduler_1 = require("../schedulers/job-scheduler");
const router = (0, express_1.Router)();
/**
 * GET /api/market/status
 * Get market open/closed status
 */
router.get('/status', async (req, res) => {
    try {
        const status = await market_calendar_service_1.default.getMarketStatus();
        res.json({ success: true, data: status });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
/**
 * GET /api/market/indices
 * Get all market indices (latest values)
 */
router.get('/indices', async (req, res) => {
    try {
        const indices = await market_indices_service_1.default.getAllIndices();
        res.json({ success: true, data: indices, count: indices.length });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
/**
 * GET /api/market/indices/major
 * Get major indices only (Nifty, Sensex, etc.)
 */
router.get('/indices/major', async (req, res) => {
    try {
        const indices = await market_indices_service_1.default.getMajorIndices();
        res.json({ success: true, data: indices });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
/**
 * GET /api/market/indices/:symbol
 * Get specific index by symbol
 */
router.get('/indices/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        const index = await market_indices_service_1.default.getIndexBySymbol(symbol);
        if (!index) {
            return res.status(404).json({ success: false, error: 'Index not found' });
        }
        res.json({ success: true, data: index });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
/**
 * GET /api/funds/:fundId/returns
 * Get calculated returns (1Y, 3Y, 5Y) for a fund
 */
router.get('/funds/:fundId/returns', async (req, res) => {
    try {
        const { fundId } = req.params;
        const returns = await nav_service_1.default.getReturns(fundId);
        if (!returns) {
            return res
                .status(404)
                .json({ success: false, error: 'Returns not available' });
        }
        res.json({ success: true, data: returns });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
/**
 * GET /api/funds/:fundId/nav/latest
 * Get latest NAV for a fund
 */
router.get('/funds/:fundId/nav/latest', async (req, res) => {
    try {
        const { fundId } = req.params;
        const nav = await nav_service_1.default.getLatestNAV(fundId);
        if (!nav) {
            return res
                .status(404)
                .json({ success: false, error: 'NAV not available' });
        }
        res.json({ success: true, data: nav });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
/**
 * GET /api/funds/:fundId/nav/history
 * Get NAV history for a fund
 */
router.get('/funds/:fundId/nav/history', async (req, res) => {
    try {
        const { fundId } = req.params;
        const days = parseInt(req.query.days) || 365;
        const history = await nav_service_1.default.getNAVHistory(fundId, days);
        res.json({ success: true, data: history, count: history.length });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
/**
 * GET /api/funds/:fundId/graph/:period
 * Get graph data for a fund (1Y, 3Y, 5Y)
 */
router.get('/funds/:fundId/graph/:period', async (req, res) => {
    try {
        const { fundId, period } = req.params;
        if (!['1Y', '3Y', '5Y'].includes(period)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid period. Must be 1Y, 3Y, or 5Y',
            });
        }
        const graphData = await graph_data_service_1.default.getGraphData(fundId, period);
        if (!graphData) {
            return res
                .status(404)
                .json({ success: false, error: 'Graph data not available' });
        }
        res.json({ success: true, data: graphData });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
/**
 * GET /api/funds/:fundId/graph/all
 * Get all graph periods for a fund
 */
router.get('/funds/:fundId/graph/all', async (req, res) => {
    try {
        const { fundId } = req.params;
        const graphData = await graph_data_service_1.default.getAllGraphData(fundId);
        res.json({ success: true, data: graphData });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
/**
 * POST /api/admin/jobs/trigger/:jobName
 * Manual job trigger (admin only)
 */
router.post('/admin/jobs/trigger/:jobName', async (req, res) => {
    try {
        const { jobName } = req.params;
        let job;
        switch (jobName) {
            case 'market-indices':
                job = await (0, job_scheduler_1.triggerMarketIndicesJob)();
                break;
            case 'daily-nav':
                job = await (0, job_scheduler_1.triggerDailyNAVJob)();
                break;
            case 'weekly-graph':
                job = await (0, job_scheduler_1.triggerWeeklyGraphJob)();
                break;
            default:
                return res
                    .status(400)
                    .json({ success: false, error: 'Invalid job name' });
        }
        res.json({
            success: true,
            message: `Job ${jobName} triggered successfully`,
            jobId: job.id,
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
/**
 * GET /api/admin/jobs/stats
 * Get job statistics (admin only)
 */
router.get('/admin/jobs/stats', async (req, res) => {
    try {
        const stats = await (0, job_scheduler_1.getJobStats)();
        res.json({ success: true, data: stats });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
/**
 * GET /api/health
 * Health check endpoint
 */
router.get('/health', async (req, res) => {
    try {
        const isDataStale = await market_indices_service_1.default.isDataStale(15);
        const marketStatus = await market_calendar_service_1.default.getMarketStatus();
        res.json({
            success: true,
            status: 'healthy',
            timestamp: new Date().toISOString(),
            market: marketStatus,
            dataStatus: isDataStale ? 'stale' : 'fresh',
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
exports.default = router;
