"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_routes_1 = __importDefault(require("./auth.routes"));
const funds_1 = __importDefault(require("./funds"));
const funds_quick_1 = __importDefault(require("./funds-quick"));
const fundManagers_1 = __importDefault(require("./fundManagers"));
const users_1 = __importDefault(require("./users"));
const watchlist_1 = __importDefault(require("./watchlist"));
const portfolio_1 = __importDefault(require("./portfolio"));
const investments_1 = __importDefault(require("./investments"));
const kyc_1 = __importDefault(require("./kyc"));
const marketIndices_1 = __importDefault(require("./marketIndices"));
const news_1 = __importDefault(require("./news"));
const rankings_1 = __importDefault(require("./rankings"));
const governance_1 = __importDefault(require("./governance"));
const admin_1 = __importDefault(require("./admin"));
const calculator_1 = __importDefault(require("./calculator"));
const comparison_1 = __importDefault(require("./comparison"));
const tax_1 = __importDefault(require("./tax"));
const ai_1 = __importDefault(require("./ai"));
const suggest_1 = __importDefault(require("./suggest"));
const feedback_1 = __importDefault(require("./feedback"));
const v2_routes_1 = __importDefault(require("./v2.routes"));
const search_routes_1 = __importDefault(require("./search.routes"));
const holdings_routes_1 = __importDefault(require("./holdings.routes"));
const router = (0, express_1.Router)();
// Core routes
router.use('/auth', auth_routes_1.default);
router.use('/funds', funds_quick_1.default); // Quick load routes BEFORE main funds routes
router.use('/funds', funds_1.default);
router.use('/fund-managers', fundManagers_1.default);
router.use('/suggest', suggest_1.default); // Autocomplete endpoint
router.use('/search', search_routes_1.default); // Full-text search
// User & Portfolio routes
router.use('/users', users_1.default);
router.use('/watchlist', watchlist_1.default);
router.use('/portfolio', portfolio_1.default);
router.use('/investments', investments_1.default);
router.use('/kyc', kyc_1.default);
// Market Data routes
router.use('/market-indices', marketIndices_1.default);
router.use('/market', marketIndices_1.default); // Alias for /api/market/indices compatibility
router.use('/holdings', holdings_routes_1.default);
router.use('/news', news_1.default);
router.use('/rankings', rankings_1.default);
// Analysis & Tools routes
router.use('/comparison', comparison_1.default);
router.use('/calculator', calculator_1.default);
router.use('/tax', tax_1.default);
router.use('/governance', governance_1.default);
// Advanced routes
router.use('/ai', ai_1.default);
router.use('/feedback', feedback_1.default);
router.use('/admin', admin_1.default);
// V2 Professional routes
router.use('/v2', v2_routes_1.default); // Professional architecture routes
exports.default = router;
