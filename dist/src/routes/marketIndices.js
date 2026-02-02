"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const marketIndices_1 = require("../controllers/marketIndices");
const router = express_1.default.Router();
// GET /api/market-indices - Get all market indices
router.get('/', marketIndices_1.getMarketIndices);
// GET /api/market/indices - Alias for frontend compatibility
router.get('/indices', marketIndices_1.getMarketIndices);
// GET /api/market-indices/:indexId - Get specific index
router.get('/:indexId', marketIndices_1.getSpecificIndex);
// POST /api/market-indices/refresh - Refresh all indices (admin)
router.post('/refresh', marketIndices_1.refreshIndices);
exports.default = router;
