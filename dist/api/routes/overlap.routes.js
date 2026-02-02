"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const overlap_controller_1 = require("../controllers/overlap.controller");
const router = (0, express_1.Router)();
// POST / - Calculate portfolio overlap
router.post('/', overlap_controller_1.calculateOverlap);
exports.default = router;
