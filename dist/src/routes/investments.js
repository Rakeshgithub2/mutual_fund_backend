"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middlewares/auth");
const investments_1 = require("../controllers/investments");
const router = (0, express_1.Router)();
// All routes require authentication
router.use(auth_1.authenticate);
// Get investment statistics
router.get('/stats', investments_1.getInvestmentStats);
// Get all investments
router.get('/', investments_1.getInvestments);
// Get investment by ID
router.get('/:id', investments_1.getInvestmentById);
// Create new investment
router.post('/', investments_1.createInvestment);
// Cancel investment
router.put('/:id/cancel', investments_1.cancelInvestment);
exports.default = router;
