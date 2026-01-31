/**
 * Fund Metrics Calculator
 * Calculates returns, risk metrics, and enriches fund data
 */

interface NAVData {
  date: Date;
  nav: number;
}

interface PerformanceData {
  date: Date;
  nav: number;
}

interface RiskMetrics {
  sharpeRatio: number;
  beta: number;
  alpha: number;
  standardDeviation: number;
  volatility: number;
}

interface Returns {
  oneYear: number;
  threeYear: number;
  fiveYear: number;
  tenYear: number;
  ytd: number;
  oneMonth: number;
  sixMonth: number;
}

/**
 * Calculate returns between two NAV values
 */
function calculateReturn(startNav: number, endNav: number): number {
  if (!startNav || startNav === 0) return 0;
  return ((endNav - startNav) / startNav) * 100;
}

/**
 * Calculate annualized return
 */
function calculateAnnualizedReturn(
  startNav: number,
  endNav: number,
  years: number
): number {
  if (!startNav || startNav === 0 || years === 0) return 0;
  const totalReturn = (endNav - startNav) / startNav;
  return (Math.pow(1 + totalReturn, 1 / years) - 1) * 100;
}

/**
 * Get NAV from specific date or closest date
 */
function getNavAtDate(
  performances: PerformanceData[],
  targetDate: Date
): number | null {
  if (!performances || performances.length === 0) return null;

  const sorted = [...performances].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  let closest = sorted[0];
  let minDiff = Math.abs(
    new Date(sorted[0].date).getTime() - targetDate.getTime()
  );

  for (const perf of sorted) {
    const diff = Math.abs(new Date(perf.date).getTime() - targetDate.getTime());
    if (diff < minDiff) {
      minDiff = diff;
      closest = perf;
    }
  }

  return closest.nav;
}

/**
 * Calculate all return periods
 */
export function calculateReturns(
  performances: PerformanceData[],
  currentNav?: number
): Returns {
  if (!performances || performances.length === 0) {
    return {
      oneYear: 0,
      threeYear: 0,
      fiveYear: 0,
      tenYear: 0,
      ytd: 0,
      oneMonth: 0,
      sixMonth: 0,
    };
  }

  const now = new Date();
  const latestNav =
    currentNav ||
    performances[0]?.nav ||
    performances.find((p) => p.nav)?.nav ||
    0;

  const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
  const threeYearsAgo = new Date(now.getTime() - 3 * 365 * 24 * 60 * 60 * 1000);
  const fiveYearsAgo = new Date(now.getTime() - 5 * 365 * 24 * 60 * 60 * 1000);
  const tenYearsAgo = new Date(now.getTime() - 10 * 365 * 24 * 60 * 60 * 1000);
  const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
  const startOfYear = new Date(now.getFullYear(), 0, 1);

  const nav1YAgo = getNavAtDate(performances, oneYearAgo);
  const nav3YAgo = getNavAtDate(performances, threeYearsAgo);
  const nav5YAgo = getNavAtDate(performances, fiveYearsAgo);
  const nav10YAgo = getNavAtDate(performances, tenYearsAgo);
  const nav1MAgo = getNavAtDate(performances, oneMonthAgo);
  const nav6MAgo = getNavAtDate(performances, sixMonthsAgo);
  const navYTD = getNavAtDate(performances, startOfYear);

  return {
    oneYear: nav1YAgo ? calculateReturn(nav1YAgo, latestNav) : 0,
    threeYear: nav3YAgo ? calculateAnnualizedReturn(nav3YAgo, latestNav, 3) : 0,
    fiveYear: nav5YAgo ? calculateAnnualizedReturn(nav5YAgo, latestNav, 5) : 0,
    tenYear: nav10YAgo
      ? calculateAnnualizedReturn(nav10YAgo, latestNav, 10)
      : 0,
    oneMonth: nav1MAgo ? calculateReturn(nav1MAgo, latestNav) : 0,
    sixMonth: nav6MAgo ? calculateReturn(nav6MAgo, latestNav) : 0,
    ytd: navYTD ? calculateReturn(navYTD, latestNav) : 0,
  };
}

/**
 * Calculate standard deviation (volatility)
 */
function calculateStandardDeviation(returns: number[]): number {
  if (returns.length === 0) return 0;

  const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const squaredDiffs = returns.map((r) => Math.pow(r - mean, 2));
  const variance =
    squaredDiffs.reduce((sum, sd) => sum + sd, 0) / returns.length;

  return Math.sqrt(variance);
}

/**
 * Calculate daily returns from NAV data
 */
function calculateDailyReturns(performances: PerformanceData[]): number[] {
  if (performances.length < 2) return [];

  const sorted = [...performances].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const dailyReturns: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prevNav = sorted[i - 1].nav;
    const currNav = sorted[i].nav;
    if (prevNav && currNav && prevNav > 0) {
      const dailyReturn = ((currNav - prevNav) / prevNav) * 100;
      dailyReturns.push(dailyReturn);
    }
  }

  return dailyReturns;
}

/**
 * Calculate Sharpe Ratio (risk-adjusted return)
 */
function calculateSharpeRatio(
  portfolioReturn: number,
  standardDeviation: number,
  riskFreeRate: number = 6.5
): number {
  if (standardDeviation === 0) return 0;
  return (portfolioReturn - riskFreeRate) / standardDeviation;
}

/**
 * Calculate Beta (market sensitivity)
 */
function calculateBeta(
  fundVolatility: number,
  benchmarkVolatility: number = 15
): number {
  if (benchmarkVolatility === 0) return 1;
  return fundVolatility / benchmarkVolatility;
}

/**
 * Calculate Alpha (excess return over benchmark)
 */
function calculateAlpha(
  portfolioReturn: number,
  beta: number,
  riskFreeRate: number = 6.5,
  marketReturn: number = 12
): number {
  const expectedReturn = riskFreeRate + beta * (marketReturn - riskFreeRate);
  return portfolioReturn - expectedReturn;
}

/**
 * Calculate all risk metrics
 */
export function calculateRiskMetrics(
  performances: PerformanceData[],
  returns: Returns
): RiskMetrics {
  if (!performances || performances.length < 30) {
    return {
      sharpeRatio: 0,
      beta: 1,
      alpha: 0,
      standardDeviation: 0,
      volatility: 0,
    };
  }

  const dailyReturns = calculateDailyReturns(performances);
  const dailyStdDev = calculateStandardDeviation(dailyReturns);
  const annualizedStdDev = dailyStdDev * Math.sqrt(252);

  const sharpeRatio = calculateSharpeRatio(returns.oneYear, annualizedStdDev);
  const beta = calculateBeta(annualizedStdDev);
  const alpha = calculateAlpha(returns.oneYear, beta);

  return {
    sharpeRatio: parseFloat(sharpeRatio.toFixed(2)),
    beta: parseFloat(beta.toFixed(2)),
    alpha: parseFloat(alpha.toFixed(2)),
    standardDeviation: parseFloat(annualizedStdDev.toFixed(2)),
    volatility: parseFloat(annualizedStdDev.toFixed(2)),
  };
}

/**
 * Determine risk level based on volatility and category
 */
export function determineRiskLevel(
  volatility: number,
  category: string
): string {
  const categoryLower = category?.toLowerCase() || '';

  if (categoryLower.includes('equity') || categoryLower.includes('stock')) {
    if (volatility < 12) return 'Moderately Low';
    if (volatility < 18) return 'Moderate';
    if (volatility < 25) return 'Moderately High';
    return 'High';
  }

  if (categoryLower.includes('debt') || categoryLower.includes('bond')) {
    if (volatility < 3) return 'Low';
    if (volatility < 6) return 'Moderately Low';
    if (volatility < 10) return 'Moderate';
    return 'Moderately High';
  }

  if (volatility < 8) return 'Low';
  if (volatility < 12) return 'Moderately Low';
  if (volatility < 18) return 'Moderate';
  if (volatility < 25) return 'Moderately High';
  return 'High';
}

/**
 * Calculate rating based on returns and risk metrics
 */
export function calculateRating(
  returns: Returns,
  riskMetrics: RiskMetrics
): number {
  let score = 0;

  // Return contribution (max 1.6 points)
  if (returns.oneYear > 20) score += 1.6;
  else if (returns.oneYear > 15) score += 1.2;
  else if (returns.oneYear > 10) score += 0.8;
  else if (returns.oneYear > 5) score += 0.4;

  // Sharpe ratio contribution (max 1.5 points)
  if (riskMetrics.sharpeRatio > 1.5) score += 1.5;
  else if (riskMetrics.sharpeRatio > 1) score += 1.2;
  else if (riskMetrics.sharpeRatio > 0.5) score += 0.9;
  else if (riskMetrics.sharpeRatio > 0) score += 0.3;

  // Alpha contribution (max 1.0 point)
  if (riskMetrics.alpha > 5) score += 1.0;
  else if (riskMetrics.alpha > 2) score += 0.8;
  else if (riskMetrics.alpha > 0) score += 0.4;

  // Consistency bonus (max 0.5 points)
  if (
    returns.threeYear > 0 &&
    returns.oneYear > 0 &&
    Math.abs(returns.oneYear - returns.threeYear) < 10
  ) {
    score += 0.5;
  }

  // Ensure rating is between 1 and 5
  const rating = Math.min(Math.max(score, 1), 5);
  return parseFloat(rating.toFixed(1));
}

/**
 * Enrich fund data with calculated metrics
 */
export function enrichFundData(
  fund: any,
  performances: PerformanceData[]
): any {
  const returns = calculateReturns(performances, fund.currentNav);
  const riskMetrics = calculateRiskMetrics(performances, returns);
  const riskLevel = determineRiskLevel(
    riskMetrics.volatility,
    fund.category || ''
  );
  const rating = fund.rating || calculateRating(returns, riskMetrics);

  return {
    ...fund,
    returns,
    riskMetrics,
    riskLevel,
    rating,
  };
}
