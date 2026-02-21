"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const funds_simple_1 = require("../controllers/funds.simple");
const router = (0, express_1.Router)();
// GET /suggest?q=sb - Autocomplete/fuzzy search
// Used in: Fund Compare, Fund Overlap, Search bar autocomplete
router.get('/', funds_simple_1.getSuggestions);
exports.default = router;
