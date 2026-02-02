"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const comparison_controller_1 = require("../controllers/comparison.controller");
const router = (0, express_1.Router)();
// POST /compare - Compare multiple funds with detailed analysis
router.post('/compare', comparison_controller_1.compareFunds);
// POST /overlap - Calculate holdings overlap between funds
router.post('/overlap', comparison_controller_1.calculateOverlap);
exports.default = router;
