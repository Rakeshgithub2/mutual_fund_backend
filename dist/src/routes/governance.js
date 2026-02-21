"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const governance_controller_1 = require("../controllers/governance.controller");
const router = (0, express_1.Router)();
/**
 * @route   GET /api/governance/validate/:fundId
 * @desc    Validate a specific fund
 * @access  Public
 */
router.get('/validate/:fundId', governance_controller_1.validateFund);
/**
 * @route   GET /api/governance/validate-all
 * @desc    Validate all funds and return those with issues
 * @access  Admin
 */
router.get('/validate-all', governance_controller_1.validateAllFunds);
/**
 * @route   GET /api/governance/outliers/:category
 * @desc    Detect outliers in a category
 * @access  Public
 */
router.get('/outliers/:category', governance_controller_1.detectOutliers);
/**
 * @route   GET /api/governance/freshness
 * @desc    Generate data freshness report
 * @access  Public
 */
router.get('/freshness', governance_controller_1.getFreshnessReport);
/**
 * @route   POST /api/governance/auto-hide
 * @desc    Auto-hide funds with insufficient data quality
 * @access  Admin
 */
router.post('/auto-hide', governance_controller_1.autoHideIncompleteFunds);
/**
 * @route   GET /api/governance/stats
 * @desc    Get overall data governance statistics
 * @access  Public
 */
router.get('/stats', governance_controller_1.getGovernanceStats);
exports.default = router;
