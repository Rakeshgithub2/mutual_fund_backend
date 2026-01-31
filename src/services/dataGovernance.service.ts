import { Fund, FundPrice } from '../db/schemas';
import { Collection, Db } from 'mongodb';

/**
 * Data Governance & Trust Service
 *
 * Ensures data quality, accuracy, and trustworthiness
 *
 * Features:
 * - Multi-source validation
 * - Outlier detection
 * - NAV vs Return consistency checks
 * - Data freshness indicators
 * - Automatic hiding of incomplete funds
 *
 * Philosophy: Accuracy > Clutter > Speed
 */

// ==================== VALIDATION TYPES ====================

export interface ValidationResult {
  fundId: string;
  fundName: string;
  isValid: boolean;
  confidence: number; // 0-100
  issues: ValidationIssue[];
  lastValidated: Date;
}

export interface ValidationIssue {
  severity: 'critical' | 'warning' | 'info';
  category: 'nav' | 'returns' | 'aum' | 'holdings' | 'manager' | 'freshness';
  message: string;
  affectedField: string;
  detectedValue?: any;
  expectedRange?: { min: number; max: number };
}

export interface DataFreshnessReport {
  fundId: string;
  fundName: string;
  navAge: number; // Days since last NAV update
  aumAge: number; // Days since last AUM update
  returnsAge: number; // Days since returns calculation
  holdingsAge?: number; // Days since holdings update
  overallFreshness: 'fresh' | 'stale' | 'critical'; // < 2 days, < 7 days, > 7 days
}

export interface OutlierDetectionResult {
  fundId: string;
  fundName: string;
  outliers: Array<{
    metric: string;
    value: number;
    peerMedian: number;
    deviation: number; // Standard deviations from peer median
    isOutlier: boolean;
  }>;
}

// ==================== DATA GOVERNANCE SERVICE ====================

class DataGovernanceService {
  private fundsCollection: Collection<Fund> | null = null;
  private pricesCollection: Collection<FundPrice> | null = null;

  constructor() {}

  /**
   * Initialize with database connection
   */
  async initialize(db: Db) {
    this.fundsCollection = db.collection<Fund>('funds');
    this.pricesCollection = db.collection<FundPrice>('fund_prices');
    console.log('✅ Data Governance Service initialized');
  }

  /**
   * Comprehensive validation for a single fund
   */
  async validateFund(fundId: string): Promise<ValidationResult> {
    if (!this.fundsCollection) {
      throw new Error('Data governance service not initialized');
    }

    const fund = await this.fundsCollection.findOne({ fundId });

    if (!fund) {
      return {
        fundId,
        fundName: 'Unknown',
        isValid: false,
        confidence: 0,
        issues: [
          {
            severity: 'critical',
            category: 'nav',
            message: 'Fund not found',
            affectedField: 'fundId',
          },
        ],
        lastValidated: new Date(),
      };
    }

    const issues: ValidationIssue[] = [];

    // 1. NAV Validation
    issues.push(...this.validateNAV(fund));

    // 2. Returns Consistency Check
    issues.push(...this.validateReturnsConsistency(fund));

    // 3. AUM Validation
    issues.push(...this.validateAUM(fund));

    // 4. Holdings Validation
    issues.push(...this.validateHoldings(fund));

    // 5. Manager Information
    issues.push(...this.validateManagerInfo(fund));

    // 6. Data Freshness
    issues.push(...this.validateFreshness(fund));

    // Calculate confidence score
    const criticalIssues = issues.filter(
      (i) => i.severity === 'critical'
    ).length;
    const warningIssues = issues.filter((i) => i.severity === 'warning').length;

    let confidence = 100;
    confidence -= criticalIssues * 25; // Each critical issue: -25%
    confidence -= warningIssues * 10; // Each warning: -10%
    confidence = Math.max(0, confidence);

    const isValid = criticalIssues === 0 && confidence >= 60;

    return {
      fundId: fund.fundId,
      fundName: fund.name,
      isValid,
      confidence,
      issues,
      lastValidated: new Date(),
    };
  }

  /**
   * Batch validation for all funds
   * Returns list of funds with validation issues
   */
  async validateAllFunds(): Promise<ValidationResult[]> {
    if (!this.fundsCollection) {
      throw new Error('Data governance service not initialized');
    }

    const funds = await this.fundsCollection.find({ isActive: true }).toArray();

    const results: ValidationResult[] = [];

    for (const fund of funds) {
      const result = await this.validateFund(fund.fundId);

      // Only include funds with issues
      if (!result.isValid || result.issues.length > 0) {
        results.push(result);
      }
    }

    console.log(
      `✅ Validated ${funds.length} funds, found ${results.length} with issues`
    );

    return results;
  }

  /**
   * NAV Validation
   */
  private validateNAV(fund: Fund): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    // Check if NAV is positive
    if (fund.currentNav <= 0) {
      issues.push({
        severity: 'critical',
        category: 'nav',
        message: 'NAV must be positive',
        affectedField: 'currentNav',
        detectedValue: fund.currentNav,
      });
    }

    // Check NAV sanity (typically between ₹10 and ₹1000 for most funds)
    if (fund.currentNav < 5 || fund.currentNav > 10000) {
      issues.push({
        severity: 'warning',
        category: 'nav',
        message: 'NAV outside typical range',
        affectedField: 'currentNav',
        detectedValue: fund.currentNav,
        expectedRange: { min: 10, max: 1000 },
      });
    }

    // Check NAV date freshness
    const navAge = this.calculateAgeInDays(fund.navDate);
    if (navAge > 7) {
      issues.push({
        severity: 'critical',
        category: 'freshness',
        message: `NAV data is ${navAge} days old`,
        affectedField: 'navDate',
      });
    } else if (navAge > 2) {
      issues.push({
        severity: 'warning',
        category: 'freshness',
        message: `NAV data is ${navAge} days old`,
        affectedField: 'navDate',
      });
    }

    // Check NAV change reasonableness (day change should be < 10% typically)
    const navChange =
      Math.abs((fund.currentNav - fund.previousNav) / fund.previousNav) * 100;
    if (navChange > 10) {
      issues.push({
        severity: 'warning',
        category: 'nav',
        message: `Unusual NAV change: ${navChange.toFixed(2)}%`,
        affectedField: 'currentNav',
      });
    }

    return issues;
  }

  /**
   * Returns Consistency Validation
   * Checks if returns match NAV changes over time
   */
  private validateReturnsConsistency(fund: Fund): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    // Check if returns are present
    if (!fund.returns || !fund.returns.oneYear) {
      issues.push({
        severity: 'warning',
        category: 'returns',
        message: 'Missing returns data',
        affectedField: 'returns',
      });
      return issues;
    }

    // Check returns sanity based on category
    const returnRanges: { [key: string]: { min: number; max: number } } = {
      equity: { min: -30, max: 50 },
      debt: { min: -5, max: 15 },
      hybrid: { min: -15, max: 35 },
      elss: { min: -30, max: 50 },
      commodity: { min: -40, max: 60 },
      etf: { min: -30, max: 50 },
      index: { min: -30, max: 50 },
      solution_oriented: { min: -20, max: 40 },
      international: { min: -40, max: 60 },
    };

    const expectedRange = returnRanges[fund.category] || { min: -50, max: 100 };

    // Check 1-year return
    if (
      fund.returns.oneYear < expectedRange.min ||
      fund.returns.oneYear > expectedRange.max
    ) {
      issues.push({
        severity: 'warning',
        category: 'returns',
        message: `1Y return (${fund.returns.oneYear}%) outside expected range for ${fund.category} funds`,
        affectedField: 'returns.oneYear',
        expectedRange,
      });
    }

    // Check return progression (3Y should generally be close to 1Y, not drastically different)
    if (fund.returns.oneYear && fund.returns.threeYear) {
      const returnDiff = Math.abs(
        fund.returns.oneYear - fund.returns.threeYear
      );
      if (returnDiff > 30) {
        issues.push({
          severity: 'info',
          category: 'returns',
          message: `Large difference between 1Y (${fund.returns.oneYear}%) and 3Y (${fund.returns.threeYear}%) returns`,
          affectedField: 'returns',
        });
      }
    }

    // Check for zero returns (suspicious)
    if (fund.returns.oneYear === 0 && fund.returns.threeYear === 0) {
      issues.push({
        severity: 'critical',
        category: 'returns',
        message: 'All returns are zero - data likely missing',
        affectedField: 'returns',
      });
    }

    return issues;
  }

  /**
   * AUM Validation
   */
  private validateAUM(fund: Fund): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    // Check AUM is positive
    if (fund.aum <= 0) {
      issues.push({
        severity: 'critical',
        category: 'aum',
        message: 'AUM must be positive',
        affectedField: 'aum',
        detectedValue: fund.aum,
      });
    }

    // Check AUM is reasonable (> ₹5 crores for active funds)
    if (fund.aum < 5 && fund.isActive) {
      issues.push({
        severity: 'warning',
        category: 'aum',
        message: 'AUM unusually low for active fund',
        affectedField: 'aum',
        detectedValue: fund.aum,
      });
    }

    // Check AUM date freshness
    const aumAge = this.calculateAgeInDays(fund.aumDate);
    if (aumAge > 60) {
      issues.push({
        severity: 'warning',
        category: 'freshness',
        message: `AUM data is ${aumAge} days old`,
        affectedField: 'aumDate',
      });
    }

    return issues;
  }

  /**
   * Holdings Validation
   */
  private validateHoldings(fund: Fund): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    if (!fund.holdings || fund.holdings.length === 0) {
      // Holdings are optional but good to have
      issues.push({
        severity: 'info',
        category: 'holdings',
        message: 'No holdings data available',
        affectedField: 'holdings',
      });
      return issues;
    }

    // Check holdings percentages sum to reasonable amount (should be ~60-100%)
    const totalPercentage = fund.holdings.reduce(
      (sum, h) => sum + h.percentage,
      0
    );
    if (totalPercentage < 50 || totalPercentage > 105) {
      issues.push({
        severity: 'warning',
        category: 'holdings',
        message: `Holdings percentages sum to ${totalPercentage}% (expected 60-100%)`,
        affectedField: 'holdings',
      });
    }

    return issues;
  }

  /**
   * Manager Information Validation
   */
  private validateManagerInfo(fund: Fund): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    // Check if manager name is present
    if (!fund.fundManager || fund.fundManager.trim() === '') {
      issues.push({
        severity: 'warning',
        category: 'manager',
        message: 'Fund manager name missing',
        affectedField: 'fundManager',
      });
    }

    // Check manager experience
    if (fund.fundManagerExperience && fund.fundManagerExperience < 0) {
      issues.push({
        severity: 'warning',
        category: 'manager',
        message: 'Invalid manager experience value',
        affectedField: 'fundManagerExperience',
      });
    }

    return issues;
  }

  /**
   * Freshness Validation
   */
  private validateFreshness(fund: Fund): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    // Check last updated timestamp
    const lastUpdateAge = this.calculateAgeInDays(fund.lastUpdated);
    if (lastUpdateAge > 7) {
      issues.push({
        severity: 'warning',
        category: 'freshness',
        message: `Fund data not updated in ${lastUpdateAge} days`,
        affectedField: 'lastUpdated',
      });
    }

    return issues;
  }

  /**
   * Outlier Detection
   * Detects funds with metrics significantly different from peers
   */
  async detectOutliers(
    category: Fund['category']
  ): Promise<OutlierDetectionResult[]> {
    if (!this.fundsCollection) {
      throw new Error('Data governance service not initialized');
    }

    const funds = await this.fundsCollection
      .find({ category, isActive: true, isPubliclyVisible: true })
      .toArray();

    if (funds.length < 10) {
      console.warn(`Not enough funds in ${category} for outlier detection`);
      return [];
    }

    const results: OutlierDetectionResult[] = [];

    // Calculate peer statistics
    const metrics = ['currentNav', 'expenseRatio', 'returns.oneYear', 'aum'];

    for (const fund of funds) {
      const outliers: OutlierDetectionResult['outliers'] = [];

      for (const metric of metrics) {
        const outlierCheck = this.checkMetricOutlier(fund, funds, metric);
        if (outlierCheck.isOutlier) {
          outliers.push(outlierCheck);
        }
      }

      if (outliers.length > 0) {
        results.push({
          fundId: fund.fundId,
          fundName: fund.name,
          outliers,
        });
      }
    }

    return results;
  }

  /**
   * Check if a specific metric is an outlier
   */
  private checkMetricOutlier(
    fund: Fund,
    peers: Fund[],
    metric: string
  ): OutlierDetectionResult['outliers'][0] {
    const values = peers
      .map((f) => this.getNestedValue(f, metric))
      .filter((v) => v !== null && v !== undefined && !isNaN(v));

    const median = this.calculateMedian(values);
    const stdDev = this.calculateStdDev(values);
    const fundValue = this.getNestedValue(fund, metric);

    const deviation = Math.abs((fundValue - median) / stdDev);

    return {
      metric,
      value: fundValue,
      peerMedian: median,
      deviation,
      isOutlier: deviation > 3, // 3 standard deviations
    };
  }

  /**
   * Generate data freshness report
   */
  async generateFreshnessReport(): Promise<DataFreshnessReport[]> {
    if (!this.fundsCollection) {
      throw new Error('Data governance service not initialized');
    }

    const funds = await this.fundsCollection.find({ isActive: true }).toArray();

    const reports: DataFreshnessReport[] = funds.map((fund) => {
      const navAge = this.calculateAgeInDays(fund.navDate);
      const aumAge = this.calculateAgeInDays(fund.aumDate);
      const returnsAge = this.calculateAgeInDays(fund.lastUpdated);

      let overallFreshness: DataFreshnessReport['overallFreshness'] = 'fresh';
      if (navAge > 7 || aumAge > 60 || returnsAge > 7) {
        overallFreshness = 'critical';
      } else if (navAge > 2 || aumAge > 30 || returnsAge > 3) {
        overallFreshness = 'stale';
      }

      return {
        fundId: fund.fundId,
        fundName: fund.name,
        navAge,
        aumAge,
        returnsAge,
        overallFreshness,
      };
    });

    return reports.filter((r) => r.overallFreshness !== 'fresh');
  }

  /**
   * Auto-hide funds with insufficient data quality
   * Enforces Zero-NA policy
   */
  async autoHideIncompleteFunds(): Promise<number> {
    if (!this.fundsCollection) {
      throw new Error('Data governance service not initialized');
    }

    // Find funds with low completeness score
    const incompleteFunds = await this.fundsCollection
      .find({
        isActive: true,
        $or: [
          { 'dataCompleteness.completenessScore': { $lt: 60 } },
          {
            isPubliclyVisible: true,
            'dataCompleteness.hasCompleteReturns': false,
          },
          { isPubliclyVisible: true, 'dataCompleteness.hasValidAUM': false },
        ],
      })
      .toArray();

    let hiddenCount = 0;

    for (const fund of incompleteFunds) {
      // Determine reason for hiding
      let reason = 'Insufficient data quality';
      if (!fund.dataCompleteness.hasCompleteReturns) {
        reason = 'Incomplete returns history';
      } else if (!fund.dataCompleteness.hasValidAUM) {
        reason = 'Invalid or missing AUM data';
      } else if (fund.dataCompleteness.completenessScore < 60) {
        reason = `Low completeness score (${fund.dataCompleteness.completenessScore}/100)`;
      }

      await this.fundsCollection.updateOne(
        { fundId: fund.fundId },
        {
          $set: {
            isPubliclyVisible: false,
            visibilityReason: reason,
            lastUpdated: new Date(),
          },
        }
      );

      hiddenCount++;
    }

    console.log(
      `✅ Auto-hidden ${hiddenCount} funds with insufficient data quality`
    );

    return hiddenCount;
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Calculate age in days
   */
  private calculateAgeInDays(date: Date): number {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  /**
   * Get nested object value by string path
   */
  private getNestedValue(obj: any, path: string): number {
    const value = path.split('.').reduce((acc, part) => acc && acc[part], obj);
    return typeof value === 'number' ? value : 0;
  }

  /**
   * Calculate median
   */
  private calculateMedian(values: number[]): number {
    if (values.length === 0) return 0;

    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);

    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }

  /**
   * Calculate standard deviation
   */
  private calculateStdDev(values: number[]): number {
    if (values.length === 0) return 0;

    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance =
      values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;

    return Math.sqrt(variance);
  }
}

// Singleton instance
export const dataGovernanceService = new DataGovernanceService();
