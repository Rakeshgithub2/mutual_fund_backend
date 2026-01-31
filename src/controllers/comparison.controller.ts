import { Request, Response } from 'express';
import { z } from 'zod';
import { FundModel } from '../models/Fund.model';
import { formatResponse } from '../utils/response';

// Lazy-initialized fund model
let fundModel: ReturnType<typeof FundModel.getInstance> | null = null;
const getFundModel = () => {
  if (!fundModel) fundModel = FundModel.getInstance();
  return fundModel;
};

const compareSchema = z.object({
  fundIds: z
    .array(z.string())
    .min(2, 'At least 2 fund IDs required')
    .max(5, 'Maximum 5 funds can be compared'),
});

const overlapSchema = z.object({
  fundIds: z
    .array(z.string())
    .min(2, 'At least 2 fund IDs required')
    .max(5, 'Maximum 5 funds can be compared'),
});

/**
 * Calculate Jaccard Similarity between two sets of holdings
 * Jaccard = |A ∩ B| / |A ∪ B|
 */
function calculateJaccardSimilarity(
  holdings1: Array<{ ticker?: string; name: string }>,
  holdings2: Array<{ ticker?: string; name: string }>
): number {
  const set1 = new Set(holdings1.map((h) => h.ticker || h.name));
  const set2 = new Set(holdings2.map((h) => h.ticker || h.name));

  const intersection = new Set([...set1].filter((x) => set2.has(x)));
  const union = new Set([...set1, ...set2]);

  if (union.size === 0) return 0;
  return (intersection.size / union.size) * 100;
}

/**
 * Calculate Weighted Overlap (considers percentage allocation)
 */
function calculateWeightedOverlap(
  holdings1: Array<{ ticker?: string; name: string; percentage: number }>,
  holdings2: Array<{ ticker?: string; name: string; percentage: number }>
): number {
  const map1 = new Map(
    holdings1.map((h) => [h.ticker || h.name, h.percentage])
  );
  const map2 = new Map(
    holdings2.map((h) => [h.ticker || h.name, h.percentage])
  );

  let overlapPercentage = 0;

  map1.forEach((pct1, ticker) => {
    if (map2.has(ticker)) {
      const pct2 = map2.get(ticker)!;
      overlapPercentage += Math.min(pct1, pct2);
    }
  });

  return overlapPercentage;
}

/**
 * Calculate common holdings between funds
 */
function findCommonHoldings(
  fundsData: Array<{
    fundId: string;
    name: string;
    holdings: Array<{
      ticker?: string;
      name: string;
      percentage: number;
      sector: string;
    }>;
  }>
) {
  if (fundsData.length < 2) return [];

  // Create a map of ticker -> funds that hold it with percentages
  const holdingsMap = new Map<
    string,
    Array<{
      fundId: string;
      fundName: string;
      percentage: number;
      sector: string;
    }>
  >();

  fundsData.forEach((fund) => {
    fund.holdings.forEach((holding) => {
      const key = holding.ticker || holding.name;
      if (!holdingsMap.has(key)) {
        holdingsMap.set(key, []);
      }
      holdingsMap.get(key)!.push({
        fundId: fund.fundId,
        fundName: fund.name,
        percentage: holding.percentage,
        sector: holding.sector,
      });
    });
  });

  // Filter to only common holdings (held by at least 2 funds)
  const commonHoldings: Array<{
    ticker: string;
    name: string;
    sector: string;
    heldBy: Array<{ fundId: string; fundName: string; percentage: number }>;
    avgPercentage: number;
  }> = [];

  holdingsMap.forEach((funds, ticker) => {
    if (funds.length >= 2) {
      const avgPercentage =
        funds.reduce((sum, f) => sum + f.percentage, 0) / funds.length;
      commonHoldings.push({
        ticker,
        name: ticker,
        sector: funds[0].sector,
        heldBy: funds.map((f) => ({
          fundId: f.fundId,
          fundName: f.fundName,
          percentage: f.percentage,
        })),
        avgPercentage,
      });
    }
  });

  // Sort by average percentage (descending)
  return commonHoldings.sort((a, b) => b.avgPercentage - a.avgPercentage);
}

/**
 * Calculate sector overlap between funds
 */
function calculateSectorOverlap(
  fundsData: Array<{
    fundId: string;
    name: string;
    sectorAllocation: Array<{ sector: string; percentage: number }>;
  }>
) {
  // Get all unique sectors
  const allSectors = new Set<string>();
  fundsData.forEach((fund) => {
    fund.sectorAllocation.forEach((s) => allSectors.add(s.sector));
  });

  // Build sector comparison
  const sectorComparison = Array.from(allSectors).map((sector) => {
    const allocations = fundsData.map((fund) => {
      const allocation = fund.sectorAllocation.find((s) => s.sector === sector);
      return {
        fundId: fund.fundId,
        fundName: fund.name,
        percentage: allocation?.percentage || 0,
      };
    });

    const avgPercentage =
      allocations.reduce((sum, a) => sum + a.percentage, 0) /
      allocations.length;
    const maxDiff =
      Math.max(...allocations.map((a) => a.percentage)) -
      Math.min(...allocations.map((a) => a.percentage));

    return {
      sector,
      allocations,
      avgPercentage,
      maxDifference: maxDiff,
    };
  });

  // Sort by average percentage (descending)
  return sectorComparison.sort((a, b) => b.avgPercentage - a.avgPercentage);
}

/**
 * Calculate return correlation between funds
 */
function calculateReturnCorrelation(
  fund1Returns: {
    day: number;
    week: number;
    month: number;
    threeMonth: number;
    sixMonth: number;
    oneYear: number;
  },
  fund2Returns: {
    day: number;
    week: number;
    month: number;
    threeMonth: number;
    sixMonth: number;
    oneYear: number;
  }
): number {
  const periods = [
    'day',
    'week',
    'month',
    'threeMonth',
    'sixMonth',
    'oneYear',
  ] as const;
  const returns1 = periods.map((p) => fund1Returns[p]);
  const returns2 = periods.map((p) => fund2Returns[p]);

  const n = returns1.length;
  const sum1 = returns1.reduce((a, b) => a + b, 0);
  const sum2 = returns2.reduce((a, b) => a + b, 0);
  const sum1Sq = returns1.reduce((a, b) => a + b * b, 0);
  const sum2Sq = returns2.reduce((a, b) => a + b * b, 0);
  const pSum = returns1.reduce((sum, val, i) => sum + val * returns2[i], 0);

  const num = pSum - (sum1 * sum2) / n;
  const den = Math.sqrt(
    (sum1Sq - (sum1 * sum1) / n) * (sum2Sq - (sum2 * sum2) / n)
  );

  if (den === 0) return 0;
  return num / den;
}

/**
 * POST /compare
 * Compare multiple funds with detailed analysis
 */
export const compareFunds = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    console.log('📥 POST /compare request received');
    const { fundIds } = compareSchema.parse(req.body);
    console.log('✅ Request validated:', { fundIds });

    // Fetch all funds
    const funds = await Promise.all(
      fundIds.map((id) => getFundModel().findById(id))
    );

    // Check if all funds exist
    const missingFunds = funds.filter((f) => !f);
    if (missingFunds.length > 0) {
      return res.status(404).json({
        error: 'One or more funds not found',
        missingCount: missingFunds.length,
      });
    }

    // Build comparison data
    const fundsData = funds.map((fund) => ({
      fundId: fund!.fundId,
      name: fund!.name,
      holdings: fund!.holdings,
      sectorAllocation: fund!.sectorAllocation,
      returns: fund!.returns,
    }));

    // Calculate pairwise comparisons
    const pairwiseComparisons = [];
    for (let i = 0; i < fundsData.length; i++) {
      for (let j = i + 1; j < fundsData.length; j++) {
        const fund1 = fundsData[i];
        const fund2 = fundsData[j];

        const jaccardSimilarity = calculateJaccardSimilarity(
          fund1.holdings,
          fund2.holdings
        );

        const weightedOverlap = calculateWeightedOverlap(
          fund1.holdings,
          fund2.holdings
        );

        const returnCorrelation = calculateReturnCorrelation(
          fund1.returns,
          fund2.returns
        );

        pairwiseComparisons.push({
          fund1: { id: fund1.fundId, name: fund1.name },
          fund2: { id: fund2.fundId, name: fund2.name },
          jaccardSimilarity: Number(jaccardSimilarity.toFixed(2)),
          weightedOverlap: Number(weightedOverlap.toFixed(2)),
          returnCorrelation: Number(returnCorrelation.toFixed(3)),
          similarity: Number(
            ((jaccardSimilarity + weightedOverlap) / 2).toFixed(2)
          ),
        });
      }
    }

    // Find common holdings
    const commonHoldings = findCommonHoldings(fundsData);

    // Calculate sector overlap
    const sectorOverlap = calculateSectorOverlap(fundsData);

    // Build individual fund summaries
    const fundsSummary = funds.map((fund) => ({
      id: fund!.fundId,
      name: fund!.name,
      category: fund!.category,
      fundType: fund!.fundType,
      currentNav: fund!.currentNav,
      returns: fund!.returns,
      riskMetrics: {
        sharpeRatio: fund!.riskMetrics.sharpeRatio,
        standardDeviation: fund!.riskMetrics.standardDeviation,
      },
      topHoldings: fund!.holdings.slice(0, 5),
      expenseRatio: fund!.expenseRatio,
      aum: fund!.aum,
    }));

    // Calculate overall similarity score
    const avgJaccardSimilarity =
      pairwiseComparisons.reduce((sum, p) => sum + p.jaccardSimilarity, 0) /
      pairwiseComparisons.length;
    const avgWeightedOverlap =
      pairwiseComparisons.reduce((sum, p) => sum + p.weightedOverlap, 0) /
      pairwiseComparisons.length;
    const avgReturnCorrelation =
      pairwiseComparisons.reduce((sum, p) => sum + p.returnCorrelation, 0) /
      pairwiseComparisons.length;

    const result = {
      funds: fundsSummary,
      pairwiseComparisons,
      commonHoldings: commonHoldings.slice(0, 20), // Top 20 common holdings
      sectorOverlap: sectorOverlap.slice(0, 15), // Top 15 sectors
      overallMetrics: {
        avgJaccardSimilarity: Number(avgJaccardSimilarity.toFixed(2)),
        avgWeightedOverlap: Number(avgWeightedOverlap.toFixed(2)),
        avgReturnCorrelation: Number(avgReturnCorrelation.toFixed(3)),
        totalCommonHoldings: commonHoldings.length,
      },
      insights: {
        mostSimilarPair: pairwiseComparisons.reduce((max, p) =>
          p.similarity > max.similarity ? p : max
        ),
        leastSimilarPair: pairwiseComparisons.reduce((min, p) =>
          p.similarity < min.similarity ? p : min
        ),
        highestCorrelation: pairwiseComparisons.reduce((max, p) =>
          p.returnCorrelation > max.returnCorrelation ? p : max
        ),
      },
      comparedAt: new Date().toISOString(),
    };

    console.log('✅ Comparison completed:', {
      fundsCount: funds.length,
      pairwiseCount: pairwiseComparisons.length,
      commonHoldingsCount: commonHoldings.length,
    });

    return res.json(formatResponse(result, 'Funds compared successfully'));
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Validation error:', error.errors);
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors,
      });
    }

    console.error('❌ Compare funds error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: String(error),
    });
  }
};

/**
 * POST /overlap
 * Calculate holdings overlap between funds
 * Focuses specifically on portfolio overlap analysis
 */
export const calculateOverlap = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    console.log('📥 POST /overlap request received');
    const { fundIds } = overlapSchema.parse(req.body);
    console.log('✅ Request validated:', { fundIds });

    // Fetch all funds
    const funds = await Promise.all(
      fundIds.map((id) => getFundModel().findById(id))
    );

    // Check if all funds exist
    const missingFunds = funds.filter((f) => !f);
    if (missingFunds.length > 0) {
      return res.status(404).json({
        error: 'One or more funds not found',
        missingCount: missingFunds.length,
      });
    }

    // Build funds data
    const fundsData = funds.map((fund) => ({
      fundId: fund!.fundId,
      name: fund!.name,
      category: fund!.category,
      holdings: fund!.holdings,
      totalHoldings: fund!.holdings.length,
    }));

    // Calculate pairwise overlaps
    const pairwiseOverlaps = [];
    for (let i = 0; i < fundsData.length; i++) {
      for (let j = i + 1; j < fundsData.length; j++) {
        const fund1 = fundsData[i];
        const fund2 = fundsData[j];

        const jaccardSimilarity = calculateJaccardSimilarity(
          fund1.holdings,
          fund2.holdings
        );

        const weightedOverlap = calculateWeightedOverlap(
          fund1.holdings,
          fund2.holdings
        );

        // Find common holdings for this pair
        const commonInPair = findCommonHoldings([
          { fundId: fund1.fundId, name: fund1.name, holdings: fund1.holdings },
          { fundId: fund2.fundId, name: fund2.name, holdings: fund2.holdings },
        ]);

        pairwiseOverlaps.push({
          fund1: { id: fund1.fundId, name: fund1.name },
          fund2: { id: fund2.fundId, name: fund2.name },
          jaccardSimilarity: Number(jaccardSimilarity.toFixed(2)),
          weightedOverlap: Number(weightedOverlap.toFixed(2)),
          commonHoldingsCount: commonInPair.length,
          overlapPercentage: Number(
            (
              (commonInPair.length /
                Math.min(fund1.totalHoldings, fund2.totalHoldings)) *
              100
            ).toFixed(2)
          ),
        });
      }
    }

    // Find all common holdings
    const commonHoldings = findCommonHoldings(fundsData);

    // Calculate unique holdings per fund
    const uniqueHoldings = fundsData.map((fund) => {
      const otherFundsHoldings = new Set(
        fundsData
          .filter((f) => f.fundId !== fund.fundId)
          .flatMap((f) => f.holdings.map((h) => h.ticker || h.name))
      );

      const unique = fund.holdings.filter(
        (h) => !otherFundsHoldings.has(h.ticker || h.name)
      );

      return {
        fundId: fund.fundId,
        fundName: fund.name,
        uniqueCount: unique.length,
        uniquePercentage: Number(
          ((unique.length / fund.totalHoldings) * 100).toFixed(2)
        ),
        topUniqueHoldings: unique.slice(0, 10).map((h) => ({
          name: h.name,
          ticker: h.ticker,
          percentage: h.percentage,
          sector: h.sector,
        })),
      };
    });

    // Build summary for each fund
    const fundsSummary = fundsData.map((fund) => ({
      id: fund.fundId,
      name: fund.name,
      category: fund.category,
      totalHoldings: fund.totalHoldings,
      topHoldings: fund.holdings.slice(0, 10).map((h) => ({
        name: h.name,
        ticker: h.ticker,
        percentage: h.percentage,
        sector: h.sector,
      })),
    }));

    const result = {
      funds: fundsSummary,
      pairwiseOverlaps,
      commonHoldings: commonHoldings.slice(0, 30), // Top 30 common holdings
      uniqueHoldings,
      overallMetrics: {
        totalCommonHoldings: commonHoldings.length,
        avgJaccardSimilarity: Number(
          (
            pairwiseOverlaps.reduce((sum, p) => sum + p.jaccardSimilarity, 0) /
            pairwiseOverlaps.length
          ).toFixed(2)
        ),
        avgWeightedOverlap: Number(
          (
            pairwiseOverlaps.reduce((sum, p) => sum + p.weightedOverlap, 0) /
            pairwiseOverlaps.length
          ).toFixed(2)
        ),
        maxOverlap: Math.max(...pairwiseOverlaps.map((p) => p.weightedOverlap)),
        minOverlap: Math.min(...pairwiseOverlaps.map((p) => p.weightedOverlap)),
      },
      insights: {
        mostOverlappingPair: pairwiseOverlaps.reduce((max, p) =>
          p.weightedOverlap > max.weightedOverlap ? p : max
        ),
        leastOverlappingPair: pairwiseOverlaps.reduce((min, p) =>
          p.weightedOverlap < min.weightedOverlap ? p : min
        ),
        mostDiverseFund: uniqueHoldings.reduce((max, f) =>
          f.uniquePercentage > max.uniquePercentage ? f : max
        ),
      },
      analyzedAt: new Date().toISOString(),
    };

    console.log('✅ Overlap analysis completed:', {
      fundsCount: funds.length,
      pairwiseCount: pairwiseOverlaps.length,
      commonHoldingsCount: commonHoldings.length,
    });

    return res.json(
      formatResponse(result, 'Overlap analysis completed successfully')
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Validation error:', error.errors);
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors,
      });
    }

    console.error('❌ Calculate overlap error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: String(error),
    });
  }
};
