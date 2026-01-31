import { Request, Response } from 'express';
import { mongodb } from '../db/mongodb';

interface CompareFund {
  fundId: string;
  name: string;
  category: string;
  subCategory: string;
  currentNav: number;
  returns: {
    oneYear?: number;
    threeYear?: number;
    fiveYear?: number;
  };
  expenseRatio: number;
  aum: number;
  riskLevel: string;
  fundHouse: string;
}

// POST /api/compare - Compare multiple funds
export async function compareFunds(req: Request, res: Response): Promise<void> {
  try {
    console.log('📥 POST /api/compare - Request received');

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
        message: 'At least 2 fund IDs are required for comparison',
      });
      return;
    }

    if (fundIds.length > 5) {
      res.status(400).json({
        success: false,
        error: 'Invalid request',
        message: 'Maximum 5 funds can be compared at once',
      });
      return;
    }

    await mongodb.connect();
    const collection = mongodb.getCollection('funds');

    // Fetch all funds
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

    // Format comparison data
    const comparison = funds.map((fund: any) => ({
      fundId: fund.fundId,
      name: fund.name,
      category: fund.category,
      subCategory: fund.subCategory,
      fundHouse: fund.fundHouse,
      currentNav: fund.currentNav || 0,
      returns: {
        oneYear: fund.returns?.oneYear || 0,
        threeYear: fund.returns?.threeYear || 0,
        fiveYear: fund.returns?.fiveYear || 0,
      },
      expenseRatio: fund.expenseRatio || 0,
      aum: fund.aum || 0,
      riskLevel: fund.riskLevel || 'MEDIUM',
    }));

    // Calculate comparison metrics
    const metrics = {
      bestOneYearReturn: Math.max(
        ...comparison.map((f) => f.returns.oneYear || 0)
      ),
      bestThreeYearReturn: Math.max(
        ...comparison.map((f) => f.returns.threeYear || 0)
      ),
      bestFiveYearReturn: Math.max(
        ...comparison.map((f) => f.returns.fiveYear || 0)
      ),
      lowestExpenseRatio: Math.min(
        ...comparison.map((f) => f.expenseRatio).filter((e) => e > 0)
      ),
      highestAUM: Math.max(...comparison.map((f) => f.aum)),
    };

    // Rank funds
    const rankings = comparison
      .map((fund) => {
        let score = 0;

        // Returns score (40% weight)
        if (fund.returns.oneYear === metrics.bestOneYearReturn) score += 15;
        if (fund.returns.threeYear === metrics.bestThreeYearReturn) score += 15;
        if (fund.returns.fiveYear === metrics.bestFiveYearReturn) score += 10;

        // Expense ratio score (30% weight) - lower is better
        if (fund.expenseRatio === metrics.lowestExpenseRatio) score += 30;

        // AUM score (20% weight)
        if (fund.aum === metrics.highestAUM) score += 20;

        // Risk score (10% weight)
        if (fund.riskLevel === 'LOW') score += 10;
        else if (fund.riskLevel === 'MEDIUM') score += 7;
        else if (fund.riskLevel === 'HIGH') score += 4;

        return {
          ...fund,
          comparisonScore: score,
          isTopPerformer: score >= 50,
        };
      })
      .sort((a, b) => b.comparisonScore - a.comparisonScore);

    console.log(`✅ Compared ${comparison.length} funds successfully`);

    res.json({
      success: true,
      data: {
        funds: rankings,
        metrics,
        summary: {
          totalFunds: comparison.length,
          topPerformer: rankings[0].name,
          averageExpenseRatio: (
            comparison.reduce((sum, f) => sum + f.expenseRatio, 0) /
            comparison.length
          ).toFixed(2),
          averageOneYearReturn: (
            comparison.reduce((sum, f) => sum + (f.returns.oneYear || 0), 0) /
            comparison.length
          ).toFixed(2),
        },
      },
    });
  } catch (error: any) {
    console.error('❌ Error in compareFunds:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to compare funds',
      message: error.message,
    });
  }
}
