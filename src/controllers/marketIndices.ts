import { Request, Response } from 'express';
import { marketIndicesService } from '../services/productionMarketIndices.service';

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
export const getMarketIndices = async (req: Request, res: Response) => {
  try {
    const startTime = Date.now();

    // Fetch all indices (with caching)
    const indices = await marketIndicesService.getAllIndices();

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
  } catch (error: any) {
    console.error('❌ [MARKET INDICES] Failed to fetch indices:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to fetch market indices',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * Get specific index by ID
 * @route GET /api/market-indices/:indexId
 */
export const getSpecificIndex = async (req: Request, res: Response) => {
  try {
    const { indexId } = req.params;
    const startTime = Date.now();

    const index = await marketIndicesService.getIndex(indexId);

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
  } catch (error: any) {
    console.error(
      `❌ [MARKET INDEX] Failed to fetch ${req.params.indexId}:`,
      error
    );
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch index data',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * Refresh all indices (admin endpoint - force cache clear)
 * @route POST /api/market-indices/refresh
 */
export const refreshIndices = async (req: Request, res: Response) => {
  try {
    const result = await marketIndicesService.refreshAllIndices();

    return res.json({
      success: true,
      message: 'Market indices refreshed successfully',
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('❌ [MARKET INDICES] Refresh failed:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to refresh indices',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
};
