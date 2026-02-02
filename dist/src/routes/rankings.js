"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const rankings_controller_1 = require("../controllers/rankings.controller");
const router = (0, express_1.Router)();
/**
 * @route   GET /api/rankings/top
 * @desc    Get top funds across all categories
 * @query   limit (default: 20), category, schemeType, minAUM, details
 * @access  Public
 */
router.get('/top', rankings_controller_1.getTopFunds);
/**
 * @route   GET /api/rankings/category/:category
 * @desc    Get category-wise leaders
 * @query   limit (default: 10), details
 * @access  Public
 */
router.get('/category/:category', rankings_controller_1.getCategoryLeaders);
/**
 * @route   GET /api/rankings/subcategory/:category/:subcategory
 * @desc    Get sub-category leaders
 * @query   limit (default: 10), details
 * @access  Public
 */
router.get('/subcategory/:category/:subcategory', rankings_controller_1.getSubCategoryLeaders);
/**
 * @route   GET /api/rankings/risk-adjusted
 * @desc    Get risk-adjusted rankings (Sharpe/Sortino based)
 * @query   limit (default: 50), category, details
 * @access  Public
 */
router.get('/risk-adjusted', rankings_controller_1.getRiskAdjustedRankings);
/**
 * @route   GET /api/rankings/rolling/:period
 * @desc    Get rolling return rankings (2y, 3y, 5y)
 * @query   limit (default: 100), category, details
 * @access  Public
 */
router.get('/rolling/:period', rankings_controller_1.getRollingReturnRankings);
/**
 * @route   GET /api/rankings/all-categories
 * @desc    Get leaders from all categories (dashboard view)
 * @query   limit (per category, default: 5), details
 * @access  Public
 */
router.get('/all-categories', rankings_controller_1.getAllCategoryLeaders);
/**
 * @route   POST /api/rankings/refresh
 * @desc    Clear ranking cache and force recalculation
 * @access  Admin
 */
router.post('/refresh', rankings_controller_1.refreshRankings);
exports.default = router;
