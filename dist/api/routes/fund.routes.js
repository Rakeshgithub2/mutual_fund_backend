"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const fund_controller_1 = require("../controllers/fund.controller");
const router = (0, express_1.Router)();
// GET / - Get all funds with pagination and filters
router.get('/', fund_controller_1.getAllFunds);
// GET /:id - Get fund details by ID
router.get('/:id', fund_controller_1.getFundById);
exports.default = router;
