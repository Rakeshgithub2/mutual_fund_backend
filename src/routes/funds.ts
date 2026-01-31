import { Router } from 'express';
import {
  getFunds,
  getFundById,
  getFundNavs,
} from '../controllers/funds.simple';
import {
  searchFunds,
  getFundManagerByFundId,
} from '../controllers/funds.search.controller';
import {
  getFundDetails,
  getFundSectors,
  getFundHoldings,
} from '../controllers/fundDetails.controller';

const router = Router();

// GET /funds/search - Search funds by name (autocomplete)
// MUST be before /:id routes to avoid matching 'search' as an id
router.get('/search', searchFunds);

// GET /funds - Search, filter, paginate funds
router.get('/', getFunds);

// GET /funds/:fundId/manager - Get fund manager for a specific fund
// MUST be before /:id route to avoid matching 'manager' as part of id
router.get('/:fundId/manager', getFundManagerByFundId);

// GET /funds/:fundId/price-history - Get historical NAV/price data
// MUST be before /:id route
router.get('/:fundId/price-history', getFundNavs);

// GET /funds/:fundId/details - Get complete fund details with sectors, holdings, etc.
// MUST be before /:id route
router.get('/:fundId/details', getFundDetails);

// GET /funds/:fundId/sectors - Get sector allocation only
router.get('/:fundId/sectors', getFundSectors);

// GET /funds/:fundId/holdings - Get top holdings only
router.get('/:fundId/holdings', getFundHoldings);

// GET /funds/:id - Get complete fund details
// This MUST be last among parameterized routes
router.get('/:id', getFundById);

export default router;
