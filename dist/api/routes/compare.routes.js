"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const compare_controller_1 = require("../controllers/compare.controller");
const router = (0, express_1.Router)();
// POST / - Compare multiple funds
router.post('/', compare_controller_1.compareFunds);
exports.default = router;
