"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.refreshIndices = exports.getSpecificIndex = exports.getMarketIndices = void 0;
const productionMarketIndices_service_1 = require("../services/productionMarketIndices.service");
/**
 * Market Indices Controller (Production-Ready)
 *
 * Endpoints:
 * - GET /api/market-indices - Get all major indices
 * - GET /api/market-indices/:indexId - Get specific index
 * - POST /api/market-indices/refresh - Refresh all indices (admin)
 *
 * Data Source: External API only (Yahoo Finance)
 */
/**
 * Get all major Indian market indices
 * @route GET /api/market-indices
 */
const getMarketIndices = async (req, res) => {
    try {
        const startTime = Date.now();
        // Fetch all indices (with caching)
        const indices = await productionMarketIndices_service_1.marketIndicesService.getAllIndices();
        const duration = Date.now() - startTime;
        res.json({
            success: true,
            data: indices,
            metadata: {
                count: indices.length,
                marketOpen: indices[0]?.source !== 'Cache',
                fetchTime: `${duration}ms`,
                dataSource: 'External API (Yahoo Finance)',
                cached: indices.filter((i) => i.source === 'Cache').length,
                fresh: indices.filter((i) => i.source !== 'Cache').length,
            },
            timestamp: new Date().toISOString(),
        });
    }
    catch (error) {
        console.error('❌ [MARKET INDICES] Failed to fetch indices:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch market indices',
            error: error.message,
            timestamp: new Date().toISOString(),
        });
    }
};
exports.getMarketIndices = getMarketIndices;
/**
 * Get specific index by ID
 * @route GET /api/market-indices/:indexId
 */
const getSpecificIndex = async (req, res) => {
    try {
        const { indexId } = req.params;
        const startTime = Date.now();
        const index = await productionMarketIndices_service_1.marketIndicesService.getIndex(indexId);
        if (!index) {
            return res.status(404).json({
                success: false,
                message: `Index ${indexId} not found`,
                timestamp: new Date().toISOString(),
            });
        }
        const duration = Date.now() - startTime;
        return res.json({
            success: true,
            data: index,
            metadata: {
                fetchTime: `${duration}ms`,
                dataSource: index.source,
            },
            timestamp: new Date().toISOString(),
        });
    }
    catch (error) {
        console.error(`❌ [MARKET INDEX] Failed to fetch ${req.params.indexId}:`, error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch index data',
            error: error.message,
            timestamp: new Date().toISOString(),
        });
    }
};
exports.getSpecificIndex = getSpecificIndex;
/**
 * Refresh all indices (admin endpoint - force cache clear)
 * @route POST /api/market-indices/refresh
 */
const refreshIndices = async (req, res) => {
    try {
        const result = await productionMarketIndices_service_1.marketIndicesService.refreshAllIndices();
        return res.json({
            success: true,
            message: 'Market indices refreshed successfully',
            data: result,
            timestamp: new Date().toISOString(),
        });
    }
    catch (error) {
        console.error('❌ [MARKET INDICES] Refresh failed:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to refresh indices',
            error: error.message,
            timestamp: new Date().toISOString(),
        });
    }
};
exports.refreshIndices = refreshIndices;
