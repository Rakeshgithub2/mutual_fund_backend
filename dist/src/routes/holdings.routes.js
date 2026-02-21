"use strict";
/**
 * Holdings Routes
 * API endpoints for fund portfolio holdings
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const holdings_controller_1 = __importDefault(require("../controllers/holdings.controller"));
const rateLimiter_middleware_1 = __importDefault(require("../middleware/rateLimiter.middleware"));
const router = express_1.default.Router();
// Public routes with lenient rate limiting (read-only operations)
router.get('/stats', rateLimiter_middleware_1.default.fundQueryLimiter, holdings_controller_1.default.getHoldingsStats);
router.get('/:schemeCode', rateLimiter_middleware_1.default.fundQueryLimiter, holdings_controller_1.default.getHoldingsBySchemeCode);
router.get('/:schemeCode/top', rateLimiter_middleware_1.default.fundQueryLimiter, holdings_controller_1.default.getTopHoldings);
router.get('/:schemeCode/sectors', rateLimiter_middleware_1.default.fundQueryLimiter, holdings_controller_1.default.getSectorAllocation);
// Comparison endpoint
router.post('/compare', rateLimiter_middleware_1.default.apiLimiter, holdings_controller_1.default.compareHoldings);
exports.default = router;
