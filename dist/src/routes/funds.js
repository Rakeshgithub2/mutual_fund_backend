"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const funds_simple_1 = require("../controllers/funds.simple");
const funds_search_controller_1 = require("../controllers/funds.search.controller");
const fundDetails_controller_1 = require("../controllers/fundDetails.controller");
const router = (0, express_1.Router)();
// GET /funds/search - Search funds by name (autocomplete)
// MUST be before /:id routes to avoid matching 'search' as an id
router.get('/search', funds_search_controller_1.searchFunds);
// GET /funds - Search, filter, paginate funds
router.get('/', funds_simple_1.getFunds);
// GET /funds/:fundId/manager - Get fund manager for a specific fund
// MUST be before /:id route to avoid matching 'manager' as part of id
router.get('/:fundId/manager', funds_search_controller_1.getFundManagerByFundId);
// GET /funds/:fundId/price-history - Get historical NAV/price data
// MUST be before /:id route
router.get('/:fundId/price-history', funds_simple_1.getFundNavs);
// GET /funds/:fundId/details - Get complete fund details with sectors, holdings, etc.
// MUST be before /:id route
router.get('/:fundId/details', fundDetails_controller_1.getFundDetails);
// GET /funds/:fundId/sectors - Get sector allocation only
router.get('/:fundId/sectors', fundDetails_controller_1.getFundSectors);
// GET /funds/:fundId/holdings - Get top holdings only
router.get('/:fundId/holdings', fundDetails_controller_1.getFundHoldings);
// GET /funds/:id - Get complete fund details
// This MUST be last among parameterized routes
router.get('/:id', funds_simple_1.getFundById);
exports.default = router;
