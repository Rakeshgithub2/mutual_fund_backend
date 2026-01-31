import { Request, Response } from 'express';
import { mongodb } from '../db/mongodb';

interface Holding {
  name: string;
  ticker?: string;
  percentage: number;
  sector: string;
}

// POST /api/overlap - Calculate portfolio overlap
export async function calculateOverlap(
  req: Request,
  res: Response
): Promise<void> {
  try {
    console.log('📥 POST /api/overlap - Request received');

    const { fundIds } = req.body;

    // Validation
    if (!fundIds || !Array.isArray(fundIds)) {
      res.status(400).json({
        success: false,
        error: 'Invalid request',
        message: 'fundIds must be an array',
      });
      return;
    }

    if (fundIds.length < 2) {
      res.status(400).json({
        success: false,
        error: 'Invalid request',
        message: 'At least 2 fund IDs are required for overlap calculation',
      });
      return;
    }

    if (fundIds.length > 5) {
      res.status(400).json({
        success: false,
        error: 'Invalid request',
        message: 'Maximum 5 funds can be analyzed at once',
      });
      return;
    }

    await mongodb.connect();
    const collection = mongodb.getCollection('funds');

    // Fetch all funds with holdings
    const funds = await collection
      .find({
        $or: fundIds.map((id: string) => ({
          $or: [{ fundId: id }, { amfiCode: id }, { _id: id as any }],
        })),
      })
      .toArray();

    if (funds.length === 0) {
      res.status(404).json({
        success: false,
        error: 'Funds not found',
        message: 'No funds found with the provided IDs',
      });
      return;
    }

    // Extract holdings from each fund
    const fundHoldings = funds.map((fund: any) => ({
      fundId: fund.fundId,
      name: fund.name,
      category: fund.category,
      holdings: fund.holdings || [],
      sectorAllocation: fund.sectorAllocation || [],
    }));

    // Calculate holdings overlap
    const overlapAnalysis = calculateHoldingsOverlap(fundHoldings);

    // Calculate sector overlap
    const sectorOverlap = calculateSectorOverlap(fundHoldings);

    // Generate recommendations
    const recommendations = generateRecommendations(
      overlapAnalysis,
      sectorOverlap
    );

    console.log(`✅ Calculated overlap for ${funds.length} funds`);

    res.json({
      success: true,
      data: {
        funds: fundHoldings.map((f) => ({
          fundId: f.fundId,
          name: f.name,
          category: f.category,
          holdingsCount: f.holdings.length,
        })),
        holdingsOverlap: overlapAnalysis,
        sectorOverlap,
        recommendations,
        summary: {
          totalFunds: funds.length,
          averageOverlap: overlapAnalysis.averageOverlap,
          overlapLevel: getOverlapLevel(overlapAnalysis.averageOverlap),
          diversificationScore: calculateDiversificationScore(
            overlapAnalysis.averageOverlap
          ),
        },
      },
    });
  } catch (error: any) {
    console.error('❌ Error in calculateOverlap:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to calculate overlap',
      message: error.message,
    });
  }
}

function calculateHoldingsOverlap(fundHoldings: any[]): any {
  if (fundHoldings.length < 2) {
    return {
      overlapPercentage: 0,
      commonHoldings: [],
      uniqueHoldings: {},
      averageOverlap: 0,
    };
  }

  const allHoldings = new Map<string, Set<number>>();

  // Build a map of holdings to fund indices
  fundHoldings.forEach((fund, fundIndex) => {
    fund.holdings.forEach((holding: Holding) => {
      const key = holding.ticker || holding.name;
      if (!allHoldings.has(key)) {
        allHoldings.set(key, new Set());
      }
      allHoldings.get(key)!.add(fundIndex);
    });
  });

  // Find common holdings (appear in at least 2 funds)
  const commonHoldings: any[] = [];
  const uniqueHoldings: any = {};

  fundHoldings.forEach((fund, index) => {
    uniqueHoldings[fund.fundId] = [];
  });

  allHoldings.forEach((fundIndices, holdingKey) => {
    if (fundIndices.size > 1) {
      // Common holding
      const holdingDetails = fundHoldings
        .filter((_, idx) => fundIndices.has(idx))
        .map((fund) => {
          const holding = fund.holdings.find(
            (h: Holding) => (h.ticker || h.name) === holdingKey
          );
          return {
            fundId: fund.fundId,
            fundName: fund.name,
            percentage: holding?.percentage || 0,
          };
        });

      commonHoldings.push({
        name: holdingKey,
        appearsIn: fundIndices.size,
        funds: holdingDetails,
      });
    } else {
      // Unique holding
      const fundIndex = Array.from(fundIndices)[0];
      const fund = fundHoldings[fundIndex];
      uniqueHoldings[fund.fundId].push(holdingKey);
    }
  });

  // Calculate overlap percentage
  const totalHoldings = Array.from(allHoldings.keys()).length;
  const overlapPercentage =
    totalHoldings > 0
      ? ((commonHoldings.length / totalHoldings) * 100).toFixed(2)
      : 0;

  // Calculate pairwise overlaps
  const pairwiseOverlaps: any[] = [];
  for (let i = 0; i < fundHoldings.length; i++) {
    for (let j = i + 1; j < fundHoldings.length; j++) {
      const fund1Holdings = new Set(
        fundHoldings[i].holdings.map((h: Holding) => h.ticker || h.name)
      );
      const fund2Holdings = new Set(
        fundHoldings[j].holdings.map((h: Holding) => h.ticker || h.name)
      );

      const intersection = new Set(
        [...fund1Holdings].filter((x) => fund2Holdings.has(x))
      );
      const union = new Set([...fund1Holdings, ...fund2Holdings]);

      const jaccardIndex =
        union.size > 0
          ? ((intersection.size / union.size) * 100).toFixed(2)
          : 0;

      pairwiseOverlaps.push({
        fund1: fundHoldings[i].name,
        fund2: fundHoldings[j].name,
        overlapPercentage: jaccardIndex,
        commonStocks: intersection.size,
      });
    }
  }

  const averageOverlap =
    pairwiseOverlaps.length > 0
      ? (
          pairwiseOverlaps.reduce(
            (sum, p) => sum + parseFloat(p.overlapPercentage),
            0
          ) / pairwiseOverlaps.length
        ).toFixed(2)
      : 0;

  return {
    overlapPercentage,
    commonHoldings: commonHoldings.sort((a, b) => b.appearsIn - a.appearsIn),
    uniqueHoldings,
    pairwiseOverlaps,
    averageOverlap: parseFloat(averageOverlap as string),
  };
}

function calculateSectorOverlap(fundHoldings: any[]): any {
  const sectorMap = new Map<string, number[]>();

  fundHoldings.forEach((fund, fundIndex) => {
    fund.sectorAllocation.forEach((sector: any) => {
      if (!sectorMap.has(sector.sector)) {
        sectorMap.set(sector.sector, new Array(fundHoldings.length).fill(0));
      }
      sectorMap.get(sector.sector)![fundIndex] = sector.percentage;
    });
  });

  const sectorOverlap: any[] = [];
  sectorMap.forEach((allocations, sector) => {
    const avgAllocation =
      allocations.reduce((sum, val) => sum + val, 0) / allocations.length;
    const fundsWithSector = allocations.filter((val) => val > 0).length;

    sectorOverlap.push({
      sector,
      averageAllocation: avgAllocation.toFixed(2),
      fundsWithSector,
      allocations: allocations.map((val, idx) => ({
        fundName: fundHoldings[idx].name,
        percentage: val,
      })),
    });
  });

  return sectorOverlap.sort((a, b) => b.fundsWithSector - a.fundsWithSector);
}

function generateRecommendations(
  overlapAnalysis: any,
  sectorOverlap: any
): string[] {
  const recommendations: string[] = [];
  const avgOverlap = overlapAnalysis.averageOverlap;

  if (avgOverlap > 50) {
    recommendations.push(
      '⚠️ High overlap detected (>50%). Consider diversifying across different funds or categories.'
    );
  } else if (avgOverlap > 30) {
    recommendations.push(
      '⚡ Moderate overlap (30-50%). Your portfolio has some redundancy but is reasonably diversified.'
    );
  } else {
    recommendations.push(
      '✅ Low overlap (<30%). Your portfolio is well-diversified across different holdings.'
    );
  }

  if (overlapAnalysis.commonHoldings.length > 10) {
    recommendations.push(
      `📊 You have ${overlapAnalysis.commonHoldings.length} common holdings. Review if this concentration aligns with your risk profile.`
    );
  }

  const topSector = sectorOverlap[0];
  if (topSector && topSector.fundsWithSector === sectorOverlap.length) {
    recommendations.push(
      `🏭 All funds have exposure to ${topSector.sector}. Consider adding funds from other sectors for better diversification.`
    );
  }

  return recommendations;
}

function getOverlapLevel(overlap: number): string {
  if (overlap > 50) return 'HIGH';
  if (overlap > 30) return 'MODERATE';
  return 'LOW';
}

function calculateDiversificationScore(overlap: number): number {
  // Lower overlap = higher diversification score
  return Math.max(0, Math.min(100, 100 - overlap));
}
