import { Router } from 'express';
import {
  validateFund,
  validateAllFunds,
  detectOutliers,
  getFreshnessReport,
  autoHideIncompleteFunds,
  getGovernanceStats,
} from '../controllers/governance.controller';

const router = Router();

/**
 * @route   GET /api/governance/validate/:fundId
 * @desc    Validate a specific fund
 * @access  Public
 */
router.get('/validate/:fundId', validateFund);

/**
 * @route   GET /api/governance/validate-all
 * @desc    Validate all funds and return those with issues
 * @access  Admin
 */
router.get('/validate-all', validateAllFunds);

/**
 * @route   GET /api/governance/outliers/:category
 * @desc    Detect outliers in a category
 * @access  Public
 */
router.get('/outliers/:category', detectOutliers);

/**
 * @route   GET /api/governance/freshness
 * @desc    Generate data freshness report
 * @access  Public
 */
router.get('/freshness', getFreshnessReport);

/**
 * @route   POST /api/governance/auto-hide
 * @desc    Auto-hide funds with insufficient data quality
 * @access  Admin
 */
router.post('/auto-hide', autoHideIncompleteFunds);

/**
 * @route   GET /api/governance/stats
 * @desc    Get overall data governance statistics
 * @access  Public
 */
router.get('/stats', getGovernanceStats);

export default router;
