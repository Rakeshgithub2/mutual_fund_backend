import express from 'express';
import {
  getMarketIndices,
  getSpecificIndex,
  refreshIndices,
} from '../controllers/marketIndices';

const router = express.Router();

// GET /api/market-indices - Get all market indices
router.get('/', getMarketIndices);

// GET /api/market/indices - Alias for frontend compatibility
router.get('/indices', getMarketIndices);

// GET /api/market-indices/:indexId - Get specific index
router.get('/:indexId', getSpecificIndex);

// POST /api/market-indices/refresh - Refresh all indices (admin)
router.post('/refresh', refreshIndices);

export default router;
