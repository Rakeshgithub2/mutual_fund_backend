import { Fund } from '../db/schemas';
import { Collection, Db } from 'mongodb';

/**
 * Performance-Based Ranking Service
 *
 * Generates transparent, reproducible rankings for Indian Mutual Funds
 *
 * Features:
 * - Top 20/50/100 funds across all categories
 * - Category-wise leaders
 * - Risk-adjusted rankings (Sharpe, Sortino)
 * - Rolling return rankings (2Y, 3Y, 5Y)
 * - Consistency-based rankings
 *
 * Design Principles:
 * - Transparent: Clear methodology
 * - Category-aware: Apples-to-apples comparison
 * - Reproducible: Deterministic algorithms
 * - Performance-focused: Returns matter most
 */

// ==================== RANKING TYPES ====================

export interface RankingCriteria {
  returnPeriod?: '1y' | '2y' | '3y' | '5y' | 'all';
  riskAdjusted?: boolean;
  minAUM?: number; // Filter by minimum AUM (in crores)
  minAge?: number; // Filter by minimum fund age (in years)
  category?: Fund['category'];
  subCategory?: string;
  schemeType?: 'direct' | 'regular';
  limit?: number;
}

export interface RankedFund {
  fundId: string;
  name: string;
  category: string;
  subCategory: string;
  schemeType: string;
  fundHouse: string;

  // Performance Metrics
  returns: {
    oneYear: number;
    twoYear: number;
    threeYear: number;
    fiveYear: number;
  };

  // Risk Metrics
  sharpeRatio: number;
  standardDeviation: number;
  sortino: number;

  // AUM & Manager
  aum: number;
  fundManager: string;
  fundManagerTenure?: number;

  // Ranking Scores
  performanceScore: number; // 0-100
  riskAdjustedScore: number; // 0-100
  consistencyScore: number; // 0-100
  overallScore: number; // Composite score

  // Rankings
  overallRank: number;
  categoryRank: number;

  // Metadata
  currentNav: number;
  expenseRatio: number;
  lastUpdated: Date;
}

export interface RankingResponse {
  success: boolean;
  message: string;
  data: RankedFund[];
  metadata: {
    totalFunds: number;
    criteria: RankingCriteria;
    calculatedAt: Date;
    methodology: string;
  };
}

// ==================== RANKING SERVICE ====================

class RankingService {
  private fundsCollection: Collection<Fund> | null = null;
  private rankingCache: Map<string, { data: RankedFund[]; timestamp: Date }> =
    new Map();
  private CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours

  constructor() {}

  /**
   * Initialize with database connection
   */
  async initialize(db: Db) {
    this.fundsCollection = db.collection<Fund>('funds');
    console.log('✅ Ranking Service initialized');
  }

  /**
   * Get top funds across all categories
   * @param limit Number of funds to return (default 20)
   * @param criteria Optional filtering criteria
   */
  async getTopFunds(
    limit: number = 20,
    criteria: RankingCriteria = {}
  ): Promise<RankedFund[]> {
    const cacheKey = `top_${limit}_${JSON.stringify(criteria)}`;

    // Check cache
    const cached = this.getCachedRanking(cacheKey);
    if (cached) return cached;

    // Fetch eligible funds
    const funds = await this.getEligibleFunds(criteria);

    // Calculate scores and rank
    const rankedFunds = await this.calculateRankings(funds, criteria);

    // Sort by overall score
    rankedFunds.sort((a, b) => b.overallScore - a.overallScore);

    // Assign overall ranks
    rankedFunds.forEach((fund, index) => {
      fund.overallRank = index + 1;
    });

    const topFunds = rankedFunds.slice(0, limit);

    // Cache results
    this.cacheRanking(cacheKey, topFunds);

    return topFunds;
  }

  /**
   * Get category-wise leaders
   * @param category Fund category
   * @param limit Number of funds per category (default 10)
   */
  async getCategoryLeaders(
    category: Fund['category'],
    limit: number = 10
  ): Promise<RankedFund[]> {
    const cacheKey = `category_${category}_${limit}`;

    const cached = this.getCachedRanking(cacheKey);
    if (cached) return cached;

    const criteria: RankingCriteria = { category, limit };
    const funds = await this.getEligibleFunds(criteria);

    const rankedFunds = await this.calculateRankings(funds, criteria);

    // Sort by overall score within category
    rankedFunds.sort((a, b) => b.overallScore - a.overallScore);

    // Assign category ranks
    rankedFunds.forEach((fund, index) => {
      fund.categoryRank = index + 1;
    });

    const leaders = rankedFunds.slice(0, limit);

    this.cacheRanking(cacheKey, leaders);

    return leaders;
  }

  /**
   * Get risk-adjusted rankings (Sharpe ratio based)
   * @param limit Number of funds (default 50)
   */
  async getRiskAdjustedRankings(
    limit: number = 50,
    criteria: RankingCriteria = {}
  ): Promise<RankedFund[]> {
    const cacheKey = `risk_adjusted_${limit}_${JSON.stringify(criteria)}`;

    const cached = this.getCachedRanking(cacheKey);
    if (cached) return cached;

    criteria.riskAdjusted = true;
    const funds = await this.getEligibleFunds(criteria);

    const rankedFunds = await this.calculateRankings(funds, criteria);

    // Sort by risk-adjusted score (primarily Sharpe ratio)
    rankedFunds.sort((a, b) => b.riskAdjustedScore - a.riskAdjustedScore);

    rankedFunds.forEach((fund, index) => {
      fund.overallRank = index + 1;
    });

    const topRiskAdjusted = rankedFunds.slice(0, limit);

    this.cacheRanking(cacheKey, topRiskAdjusted);

    return topRiskAdjusted;
  }

  /**
   * Get rolling return rankings (2Y, 3Y, 5Y)
   * @param period Rolling return period
   * @param limit Number of funds
   */
  async getRollingReturnRankings(
    period: '2y' | '3y' | '5y',
    limit: number = 100,
    criteria: RankingCriteria = {}
  ): Promise<RankedFund[]> {
    const cacheKey = `rolling_${period}_${limit}_${JSON.stringify(criteria)}`;

    const cached = this.getCachedRanking(cacheKey);
    if (cached) return cached;

    criteria.returnPeriod = period;
    const funds = await this.getEligibleFunds(criteria);

    const rankedFunds = await this.calculateRankings(funds, criteria);

    // Sort based on specified period returns
    rankedFunds.sort((a, b) => {
      const aReturn =
        period === '2y'
          ? a.returns.twoYear
          : period === '3y'
            ? a.returns.threeYear
            : a.returns.fiveYear;
      const bReturn =
        period === '2y'
          ? b.returns.twoYear
          : period === '3y'
            ? b.returns.threeYear
            : b.returns.fiveYear;
      return bReturn - aReturn;
    });

    rankedFunds.forEach((fund, index) => {
      fund.overallRank = index + 1;
    });

    const topByReturns = rankedFunds.slice(0, limit);

    this.cacheRanking(cacheKey, topByReturns);

    return topByReturns;
  }

  /**
   * Get subcategory leaders
   * @param category Main category
   * @param subCategory Sub-category
   * @param limit Number of funds
   */
  async getSubCategoryLeaders(
    category: Fund['category'],
    subCategory: string,
    limit: number = 10
  ): Promise<RankedFund[]> {
    const cacheKey = `subcategory_${category}_${subCategory}_${limit}`;

    const cached = this.getCachedRanking(cacheKey);
    if (cached) return cached;

    const criteria: RankingCriteria = { category, subCategory, limit };
    const funds = await this.getEligibleFunds(criteria);

    const rankedFunds = await this.calculateRankings(funds, criteria);

    rankedFunds.sort((a, b) => b.overallScore - a.overallScore);

    rankedFunds.forEach((fund, index) => {
      fund.categoryRank = index + 1;
    });

    const leaders = rankedFunds.slice(0, limit);

    this.cacheRanking(cacheKey, leaders);

    return leaders;
  }

  // ==================== PRIVATE METHODS ====================

  /**
   * Get eligible funds based on criteria
   */
  private async getEligibleFunds(criteria: RankingCriteria): Promise<Fund[]> {
    if (!this.fundsCollection) {
      throw new Error('Ranking service not initialized');
    }

    const query: any = {
      isActive: true,
      isPubliclyVisible: true, // Zero-NA policy
      'dataCompleteness.completenessScore': { $gte: 70 }, // Minimum quality threshold
    };

    // Category filter
    if (criteria.category) {
      query.category = criteria.category;
    }

    // Sub-category filter
    if (criteria.subCategory) {
      query.subCategory = criteria.subCategory;
    }

    // Scheme type filter
    if (criteria.schemeType) {
      query.schemeType = criteria.schemeType;
    }

    // Minimum AUM filter (default 100 crores for rankings)
    const minAUM = criteria.minAUM || 100;
    query.aum = { $gte: minAUM };

    // Minimum age filter (default 2 years)
    if (criteria.minAge) {
      const minLaunchDate = new Date();
      minLaunchDate.setFullYear(minLaunchDate.getFullYear() - criteria.minAge);
      query.launchDate = { $lte: minLaunchDate };
    } else {
      // Default: At least 2 years old for meaningful performance data
      const twoYearsAgo = new Date();
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
      query.launchDate = { $lte: twoYearsAgo };
    }

    // Return period requirements
    if (criteria.returnPeriod) {
      switch (criteria.returnPeriod) {
        case '5y':
          query['returns.fiveYear'] = { $exists: true, $ne: 0 };
          break;
        case '3y':
          query['returns.threeYear'] = { $exists: true, $ne: 0 };
          break;
        case '2y':
          // Calculate 2Y from 3Y if needed
          query.$or = [{ 'returns.threeYear': { $exists: true, $ne: 0 } }];
          break;
        default:
          query['returns.oneYear'] = { $exists: true, $ne: 0 };
      }
    }

    const funds = await this.fundsCollection.find(query).toArray();

    return funds;
  }

  /**
   * Calculate comprehensive rankings for funds
   */
  private async calculateRankings(
    funds: Fund[],
    criteria: RankingCriteria
  ): Promise<RankedFund[]> {
    const rankedFunds: RankedFund[] = funds.map((fund) => {
      // Calculate 2-year returns (approximate from 3-year if not available)
      const twoYearReturn = this.calculate2YearReturn(fund);

      const performanceScore = this.calculatePerformanceScore(fund, criteria);
      const riskAdjustedScore = this.calculateRiskAdjustedScore(fund);
      const consistencyScore = this.calculateConsistencyScore(fund);

      // Overall score: Weighted average
      let overallScore = 0;
      if (criteria.riskAdjusted) {
        // For risk-adjusted rankings: 40% risk-adjusted, 35% performance, 25% consistency
        overallScore =
          riskAdjustedScore * 0.4 +
          performanceScore * 0.35 +
          consistencyScore * 0.25;
      } else {
        // For general rankings: 50% performance, 30% risk-adjusted, 20% consistency
        overallScore =
          performanceScore * 0.5 +
          riskAdjustedScore * 0.3 +
          consistencyScore * 0.2;
      }

      return {
        fundId: fund.fundId,
        name: fund.name,
        category: fund.category,
        subCategory: fund.subCategory,
        schemeType: fund.schemeType,
        fundHouse: fund.fundHouse,

        returns: {
          oneYear: fund.returns.oneYear || 0,
          twoYear: twoYearReturn,
          threeYear: fund.returns.threeYear || 0,
          fiveYear: fund.returns.fiveYear || 0,
        },

        sharpeRatio: fund.riskMetrics.sharpeRatio || 0,
        standardDeviation: fund.riskMetrics.standardDeviation || 0,
        sortino: fund.riskMetrics.sortino || 0,

        aum: fund.aum,
        fundManager: fund.fundManager,
        fundManagerTenure: fund.fundManagerTenure,

        performanceScore,
        riskAdjustedScore,
        consistencyScore,
        overallScore,

        overallRank: 0, // Will be assigned after sorting
        categoryRank: 0, // Will be assigned for category rankings

        currentNav: fund.currentNav,
        expenseRatio: fund.expenseRatio,
        lastUpdated: fund.lastUpdated,
      };
    });

    return rankedFunds;
  }

  /**
   * Calculate 2-year return (approximate if not directly available)
   */
  private calculate2YearReturn(fund: Fund): number {
    // If we had monthly NAV data, we'd calculate precisely
    // For now, approximate using 3Y return scaled
    if (fund.returns.threeYear) {
      // Approximate: 2Y ≈ 3Y * (2/3) - rough estimate
      return fund.returns.threeYear * 0.67;
    }
    return 0;
  }

  /**
   * Calculate performance score (0-100)
   * Based on returns relative to peers in same category
   */
  private calculatePerformanceScore(
    fund: Fund,
    criteria: RankingCriteria
  ): number {
    let score = 0;
    let weights = 0;

    // 1-year return (weight: 20%)
    if (fund.returns.oneYear) {
      score += this.normalizeReturn(fund.returns.oneYear, 'equity') * 20;
      weights += 20;
    }

    // 3-year return (weight: 40%)
    if (fund.returns.threeYear) {
      score += this.normalizeReturn(fund.returns.threeYear, 'equity') * 40;
      weights += 40;
    }

    // 5-year return (weight: 40%)
    if (fund.returns.fiveYear) {
      score += this.normalizeReturn(fund.returns.fiveYear, 'equity') * 40;
      weights += 40;
    }

    return weights > 0 ? score / (weights / 100) : 0;
  }

  /**
   * Normalize return to 0-100 scale
   * @param returnValue Annualized return (%)
   * @param category Fund category for context
   */
  private normalizeReturn(returnValue: number, category: string): number {
    // Expected ranges for different categories
    const ranges: {
      [key: string]: { min: number; max: number; excellent: number };
    } = {
      equity: { min: -10, max: 20, excellent: 25 },
      debt: { min: 0, max: 8, excellent: 10 },
      hybrid: { min: 0, max: 15, excellent: 18 },
      default: { min: 0, max: 15, excellent: 20 },
    };

    const range = ranges[category] || ranges.default;

    // Score calculation
    if (returnValue >= range.excellent) return 100;
    if (returnValue <= range.min) return 0;

    // Linear interpolation
    const normalized =
      ((returnValue - range.min) / (range.excellent - range.min)) * 100;
    return Math.min(100, Math.max(0, normalized));
  }

  /**
   * Calculate risk-adjusted score (0-100)
   * Primarily based on Sharpe ratio and Sortino ratio
   */
  private calculateRiskAdjustedScore(fund: Fund): number {
    let score = 0;

    // Sharpe ratio (weight: 60%)
    const sharpeScore = this.normalizeSharpe(fund.riskMetrics.sharpeRatio);
    score += sharpeScore * 0.6;

    // Sortino ratio (weight: 40%) - penalizes downside volatility more
    const sortinoScore = this.normalizeSortino(fund.riskMetrics.sortino);
    score += sortinoScore * 0.4;

    return score;
  }

  /**
   * Normalize Sharpe ratio to 0-100 scale
   */
  private normalizeSharpe(sharpe: number): number {
    // Sharpe ratio benchmarks:
    // < 1: Poor
    // 1-2: Good
    // 2-3: Very Good
    // > 3: Excellent
    if (sharpe <= 0) return 0;
    if (sharpe >= 3) return 100;

    return (sharpe / 3) * 100;
  }

  /**
   * Normalize Sortino ratio to 0-100 scale
   */
  private normalizeSortino(sortino: number): number {
    // Sortino ratio benchmarks (similar to Sharpe but focuses on downside)
    if (sortino <= 0) return 0;
    if (sortino >= 3) return 100;

    return (sortino / 3) * 100;
  }

  /**
   * Calculate consistency score (0-100)
   * Measures return stability across different periods
   */
  private calculateConsistencyScore(fund: Fund): number {
    const returns = [
      fund.returns.oneYear,
      fund.returns.threeYear,
      fund.returns.fiveYear,
    ].filter((r) => r !== undefined && r !== 0);

    if (returns.length < 2) return 0;

    // Calculate coefficient of variation (lower is better)
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance =
      returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) /
      returns.length;
    const stdDev = Math.sqrt(variance);
    const cv = Math.abs(stdDev / mean);

    // Normalize: Lower CV = Higher consistency
    // CV < 0.2: Excellent (100)
    // CV > 1.0: Poor (0)
    if (cv <= 0.2) return 100;
    if (cv >= 1.0) return 0;

    return 100 - ((cv - 0.2) / 0.8) * 100;
  }

  // ==================== CACHING ====================

  /**
   * Get cached ranking if valid
   */
  private getCachedRanking(key: string): RankedFund[] | null {
    const cached = this.rankingCache.get(key);
    if (!cached) return null;

    const age = Date.now() - cached.timestamp.getTime();
    if (age > this.CACHE_TTL) {
      this.rankingCache.delete(key);
      return null;
    }

    return cached.data;
  }

  /**
   * Cache ranking results
   */
  private cacheRanking(key: string, data: RankedFund[]): void {
    this.rankingCache.set(key, {
      data,
      timestamp: new Date(),
    });
  }

  /**
   * Clear all cached rankings (call after data refresh)
   */
  public clearCache(): void {
    this.rankingCache.clear();
    console.log('✅ Ranking cache cleared');
  }
}

// Singleton instance
export const rankingService = new RankingService();
