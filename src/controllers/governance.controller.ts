import { Request, Response } from 'express';
import { dataGovernanceService } from '../services/dataGovernance.service';
import { Fund } from '../db/schemas';

/**
 * Data Governance Controller
 *
 * Provides transparency into data quality and trust indicators
 *
 * Endpoints:
 * - GET /api/governance/validate/:fundId - Validate specific fund
 * - GET /api/governance/validate-all - Validate all funds
 * - GET /api/governance/outliers/:category - Detect outliers in category
 * - GET /api/governance/freshness - Data freshness report
 * - POST /api/governance/auto-hide - Enforce Zero-NA policy
 */

/**
 * GET /api/governance/validate/:fundId
 * Validate a specific fund
 */
export const validateFund = async (req: Request, res: Response) => {
  try {
    const { fundId } = req.params;

    const result = await dataGovernanceService.validateFund(fundId);

    return res.json({
      success: true,
      message: `Validation completed for ${result.fundName}`,
      data: result,
    });
  } catch (error: any) {
    console.error('Error validating fund:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to validate fund',
      error: error.message,
    });
  }
};

/**
 * GET /api/governance/validate-all
 * Validate all funds and return those with issues
 */
export const validateAllFunds = async (req: Request, res: Response) => {
  try {
    const results = await dataGovernanceService.validateAllFunds();

    // Statistics
    const criticalIssues = results.filter((r) =>
      r.issues.some((i) => i.severity === 'critical')
    );
    const warnings = results.filter(
      (r) =>
        r.issues.some((i) => i.severity === 'warning') &&
        !criticalIssues.includes(r)
    );

    return res.json({
      success: true,
      message: `Validated all funds, found ${results.length} with issues`,
      data: results,
      statistics: {
        totalIssues: results.length,
        critical: criticalIssues.length,
        warnings: warnings.length,
        info: results.length - criticalIssues.length - warnings.length,
      },
    });
  } catch (error: any) {
    console.error('Error validating all funds:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to validate funds',
      error: error.message,
    });
  }
};

/**
 * GET /api/governance/outliers/:category
 * Detect outliers in a category
 */
export const detectOutliers = async (req: Request, res: Response) => {
  try {
    const { category } = req.params;

    // Validate category
    const validCategories: Fund['category'][] = [
      'equity',
      'debt',
      'hybrid',
      'commodity',
      'etf',
      'index',
      'elss',
      'solution_oriented',
      'international',
    ];

    if (!validCategories.includes(category as Fund['category'])) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category',
        validCategories,
      });
    }

    const outliers = await dataGovernanceService.detectOutliers(
      category as Fund['category']
    );

    return res.json({
      success: true,
      message: `Outlier detection completed for ${category}`,
      data: outliers,
      metadata: {
        category,
        totalOutliers: outliers.length,
        methodology:
          'Funds with metrics >3 standard deviations from peer median',
      },
    });
  } catch (error: any) {
    console.error('Error detecting outliers:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to detect outliers',
      error: error.message,
    });
  }
};

/**
 * GET /api/governance/freshness
 * Generate data freshness report
 */
export const getFreshnessReport = async (req: Request, res: Response) => {
  try {
    const report = await dataGovernanceService.generateFreshnessReport();

    // Statistics
    const critical = report.filter((r) => r.overallFreshness === 'critical');
    const stale = report.filter((r) => r.overallFreshness === 'stale');

    return res.json({
      success: true,
      message: 'Data freshness report generated',
      data: report,
      statistics: {
        totalStale: report.length,
        critical: critical.length,
        stale: stale.length,
      },
      thresholds: {
        navAge: {
          fresh: '<2 days',
          acceptable: '<7 days',
          critical: '>7 days',
        },
        aumAge: {
          fresh: '<30 days',
          acceptable: '<60 days',
          critical: '>60 days',
        },
        returnsAge: {
          fresh: '<3 days',
          acceptable: '<7 days',
          critical: '>7 days',
        },
      },
    });
  } catch (error: any) {
    console.error('Error generating freshness report:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate freshness report',
      error: error.message,
    });
  }
};

/**
 * POST /api/governance/auto-hide
 * Auto-hide funds with insufficient data quality (Zero-NA policy)
 */
export const autoHideIncompleteFunds = async (req: Request, res: Response) => {
  try {
    const hiddenCount = await dataGovernanceService.autoHideIncompleteFunds();

    return res.json({
      success: true,
      message: `Auto-hidden ${hiddenCount} funds with insufficient data quality`,
      data: {
        hiddenCount,
        criteria: [
          'completenessScore < 60',
          'Incomplete returns history',
          'Invalid or missing AUM data',
          'NAV data >7 days old',
        ],
      },
    });
  } catch (error: any) {
    console.error('Error auto-hiding incomplete funds:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to auto-hide incomplete funds',
      error: error.message,
    });
  }
};

/**
 * GET /api/governance/stats
 * Get overall data governance statistics
 */
export const getGovernanceStats = async (req: Request, res: Response) => {
  try {
    // This would query MongoDB for aggregate statistics
    // For now, return a placeholder
    return res.json({
      success: true,
      message: 'Data governance statistics',
      data: {
        totalFunds: 2500,
        publiclyVisible: 2350,
        hiddenFunds: 150,
        averageCompletenessScore: 87,
        fundsWithCriticalIssues: 12,
        staleFunds: 45,
      },
    });
  } catch (error: any) {
    console.error('Error fetching governance stats:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch governance stats',
      error: error.message,
    });
  }
};
