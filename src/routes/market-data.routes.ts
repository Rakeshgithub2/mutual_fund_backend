/**
 * Market Data API Routes
 * Endpoints for market indices, NAV, returns, and graph data
 */

import { Router, Request, Response } from 'express';
import MarketIndicesService from '../services/market-indices.service';
import MarketCalendarService from '../services/market-calendar.service';
import NAVService from '../services/nav.service';
import GraphDataService from '../services/graph-data.service';
import {
  triggerMarketIndicesJob,
  triggerDailyNAVJob,
  triggerWeeklyGraphJob,
  getJobStats,
} from '../schedulers/job-scheduler';

const router = Router();

/**
 * GET /api/market/status
 * Get market open/closed status
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const status = await MarketCalendarService.getMarketStatus();
    res.json({ success: true, data: status });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/market/indices
 * Get all market indices (latest values)
 */
router.get('/indices', async (req: Request, res: Response) => {
  try {
    const indices = await MarketIndicesService.getAllIndices();
    res.json({ success: true, data: indices, count: indices.length });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/market/indices/major
 * Get major indices only (Nifty, Sensex, etc.)
 */
router.get('/indices/major', async (req: Request, res: Response) => {
  try {
    const indices = await MarketIndicesService.getMajorIndices();
    res.json({ success: true, data: indices });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/market/indices/:symbol
 * Get specific index by symbol
 */
router.get('/indices/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const index = await MarketIndicesService.getIndexBySymbol(symbol);

    if (!index) {
      return res.status(404).json({ success: false, error: 'Index not found' });
    }

    res.json({ success: true, data: index });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/funds/:fundId/returns
 * Get calculated returns (1Y, 3Y, 5Y) for a fund
 */
router.get('/funds/:fundId/returns', async (req: Request, res: Response) => {
  try {
    const { fundId } = req.params;
    const returns = await NAVService.getReturns(fundId);

    if (!returns) {
      return res
        .status(404)
        .json({ success: false, error: 'Returns not available' });
    }

    res.json({ success: true, data: returns });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/funds/:fundId/nav/latest
 * Get latest NAV for a fund
 */
router.get('/funds/:fundId/nav/latest', async (req: Request, res: Response) => {
  try {
    const { fundId } = req.params;
    const nav = await NAVService.getLatestNAV(fundId);

    if (!nav) {
      return res
        .status(404)
        .json({ success: false, error: 'NAV not available' });
    }

    res.json({ success: true, data: nav });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/funds/:fundId/nav/history
 * Get NAV history for a fund
 */
router.get(
  '/funds/:fundId/nav/history',
  async (req: Request, res: Response) => {
    try {
      const { fundId } = req.params;
      const days = parseInt(req.query.days as string) || 365;

      const history = await NAVService.getNAVHistory(fundId, days);

      res.json({ success: true, data: history, count: history.length });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * GET /api/funds/:fundId/graph/:period
 * Get graph data for a fund (1Y, 3Y, 5Y)
 */
router.get(
  '/funds/:fundId/graph/:period',
  async (req: Request, res: Response) => {
    try {
      const { fundId, period } = req.params;

      if (!['1Y', '3Y', '5Y'].includes(period)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid period. Must be 1Y, 3Y, or 5Y',
        });
      }

      const graphData = await GraphDataService.getGraphData(
        fundId,
        period as '1Y' | '3Y' | '5Y'
      );

      if (!graphData) {
        return res
          .status(404)
          .json({ success: false, error: 'Graph data not available' });
      }

      res.json({ success: true, data: graphData });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * GET /api/funds/:fundId/graph/all
 * Get all graph periods for a fund
 */
router.get('/funds/:fundId/graph/all', async (req: Request, res: Response) => {
  try {
    const { fundId } = req.params;
    const graphData = await GraphDataService.getAllGraphData(fundId);

    res.json({ success: true, data: graphData });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/jobs/trigger/:jobName
 * Manual job trigger (admin only)
 */
router.post(
  '/admin/jobs/trigger/:jobName',
  async (req: Request, res: Response) => {
    try {
      const { jobName } = req.params;

      let job;
      switch (jobName) {
        case 'market-indices':
          job = await triggerMarketIndicesJob();
          break;
        case 'daily-nav':
          job = await triggerDailyNAVJob();
          break;
        case 'weekly-graph':
          job = await triggerWeeklyGraphJob();
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
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * GET /api/admin/jobs/stats
 * Get job statistics (admin only)
 */
router.get('/admin/jobs/stats', async (req: Request, res: Response) => {
  try {
    const stats = await getJobStats();
    res.json({ success: true, data: stats });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/health
 * Health check endpoint
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const isDataStale = await MarketIndicesService.isDataStale(15);
    const marketStatus = await MarketCalendarService.getMarketStatus();

    res.json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      market: marketStatus,
      dataStatus: isDataStale ? 'stale' : 'fresh',
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
