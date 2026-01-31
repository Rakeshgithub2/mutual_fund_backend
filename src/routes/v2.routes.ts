/**
 * Professional V2 API Routes
 * Uses Redis caching and 4-tier data architecture
 */

import { Router } from 'express';
const {
  getFundDetails,
  getFundNAV,
  searchFunds,
  getSuggestions,
  getMarketIndices,
  triggerNAVSync,
  triggerIndicesSync,
  getSyncStatus,
} = require('../controllers/fund-v2.controller');

const router = Router();

// Fund endpoints
router.get('/funds/:fundCode', getFundDetails); // Complete fund data
router.get('/funds/:fundCode/nav', getFundNAV); // Live NAV (cached)
router.get('/funds', searchFunds); // Search with pagination
router.get('/suggest', getSuggestions); // Fast autocomplete

// Market endpoints
router.get('/market/indices', getMarketIndices); // Live market indices

export default router;
