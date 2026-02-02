"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const fundManagers_controller_1 = require("../controllers/fundManagers.controller");
const router = (0, express_1.Router)();
// GET /fund-managers - Get all fund managers with filters
router.get('/', fundManagers_controller_1.getFundManagers);
// GET /fund-managers/:id - Get fund manager details
router.get('/:id', fundManagers_controller_1.getFundManagerById);
exports.default = router;
