import { Collection, Filter } from 'mongodb';
import { mongodb } from '../db/mongodb';
import { Portfolio } from '../db/schemas';
import { z } from 'zod';

/**
 * Zod validation schema for Portfolio
 */
export const PortfolioSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  portfolioId: z.string().min(1, 'Portfolio ID is required'),
  name: z.string().min(1, 'Portfolio name is required'),

  holdings: z.array(
    z.object({
      fundId: z.string(),
      fundName: z.string(),
      investmentType: z.enum(['sip', 'lumpsum', 'both']),

      // SIP Details
      sipAmount: z.number().optional(),
      sipDate: z.number().min(1).max(31).optional(),
      sipStartDate: z.date().optional(),
      sipCount: z.number().optional(),

      // Lumpsum Details
      lumpsumInvestments: z.array(
        z.object({
          amount: z.number(),
          date: z.date(),
          nav: z.number(),
          units: z.number(),
        })
      ),

      // Totals
      totalInvested: z.number(),
      totalUnits: z.number(),
      currentValue: z.number(),
      currentNav: z.number(),
      returns: z.number(),
      returnsPercent: z.number(),
      xirr: z.number(),

      addedAt: z.date(),
      lastUpdated: z.date(),
    })
  ),

  // Portfolio Summary
  totalInvested: z.number(),
  currentValue: z.number(),
  totalReturns: z.number(),
  returnsPercent: z.number(),
  xirr: z.number(),

  // Allocation
  categoryAllocation: z.array(
    z.object({
      category: z.string(),
      value: z.number(),
      percentage: z.number(),
    })
  ),

  sectorAllocation: z.array(
    z.object({
      sector: z.string(),
      value: z.number(),
      percentage: z.number(),
    })
  ),

  isActive: z.boolean().default(true),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type PortfolioInput = z.infer<typeof PortfolioSchema>;

/**
 * Portfolio Model Class
 * Manages user investment portfolios
 */
export class PortfolioModel {
  private static instance: PortfolioModel | null = null;
  private collection: Collection<Portfolio>;

  private constructor() {
    this.collection = mongodb.getCollection<Portfolio>('portfolios');
  }

  static getInstance(): PortfolioModel {
    if (!PortfolioModel.instance) {
      PortfolioModel.instance = new PortfolioModel();
    }
    return PortfolioModel.instance;
  }

  /**
   * Create a new portfolio
   */
  async create(portfolioData: Partial<Portfolio>): Promise<Portfolio> {
    const now = new Date();
    const portfolio: Portfolio = {
      ...portfolioData,
      holdings: portfolioData.holdings || [],
      categoryAllocation: portfolioData.categoryAllocation || [],
      sectorAllocation: portfolioData.sectorAllocation || [],
      totalInvested: portfolioData.totalInvested || 0,
      currentValue: portfolioData.currentValue || 0,
      totalReturns: portfolioData.totalReturns || 0,
      returnsPercent: portfolioData.returnsPercent || 0,
      xirr: portfolioData.xirr || 0,
      isActive: portfolioData.isActive ?? true,
      createdAt: portfolioData.createdAt || now,
      updatedAt: portfolioData.updatedAt || now,
    } as Portfolio;

    const result = await this.collection.insertOne(portfolio as any);
    return { ...portfolio, _id: result.insertedId.toString() };
  }

  /**
   * Find portfolio by ID
   */
  async findById(
    userId: string,
    portfolioId: string
  ): Promise<Portfolio | null> {
    return await this.collection.findOne({ userId, portfolioId });
  }

  /**
   * Get all user portfolios
   */
  async getUserPortfolios(userId: string): Promise<Portfolio[]> {
    return await this.collection
      .find({ userId, isActive: true })
      .sort({ createdAt: -1 })
      .toArray();
  }

  /**
   * Update portfolio
   */
  async update(
    userId: string,
    portfolioId: string,
    updateData: Partial<Portfolio>
  ): Promise<Portfolio | null> {
    const result = await this.collection.findOneAndUpdate(
      { userId, portfolioId },
      {
        $set: {
          ...updateData,
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after' }
    );
    return result || null;
  }

  /**
   * Add holding to portfolio
   */
  async addHolding(
    userId: string,
    portfolioId: string,
    holding: Portfolio['holdings'][0]
  ): Promise<Portfolio | null> {
    const now = new Date();
    const holdingData = {
      ...holding,
      addedAt: holding.addedAt || now,
      lastUpdated: holding.lastUpdated || now,
    };

    const result = await this.collection.findOneAndUpdate(
      { userId, portfolioId },
      {
        $push: { holdings: holdingData as any },
        $set: { updatedAt: new Date() },
      },
      { returnDocument: 'after' }
    );

    // Recalculate portfolio totals
    if (result) {
      await this.recalculateTotals(userId, portfolioId);
    }

    return result || null;
  }

  /**
   * Update holding
   */
  async updateHolding(
    userId: string,
    portfolioId: string,
    fundId: string,
    updateData: Partial<Portfolio['holdings'][0]>
  ): Promise<Portfolio | null> {
    const portfolio = await this.findById(userId, portfolioId);
    if (!portfolio) return null;

    const holdingIndex = portfolio.holdings.findIndex(
      (h) => h.fundId === fundId
    );
    if (holdingIndex === -1) return null;

    portfolio.holdings[holdingIndex] = {
      ...portfolio.holdings[holdingIndex],
      ...updateData,
      lastUpdated: new Date(),
    };

    const result = await this.collection.findOneAndUpdate(
      { userId, portfolioId },
      {
        $set: {
          holdings: portfolio.holdings,
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after' }
    );

    // Recalculate portfolio totals
    if (result) {
      await this.recalculateTotals(userId, portfolioId);
    }

    return result || null;
  }

  /**
   * Remove holding
   */
  async removeHolding(
    userId: string,
    portfolioId: string,
    fundId: string
  ): Promise<Portfolio | null> {
    const result = await this.collection.findOneAndUpdate(
      { userId, portfolioId },
      {
        $pull: { holdings: { fundId } as any },
        $set: { updatedAt: new Date() },
      },
      { returnDocument: 'after' }
    );

    // Recalculate portfolio totals
    if (result) {
      await this.recalculateTotals(userId, portfolioId);
    }

    return result || null;
  }

  /**
   * Add lumpsum investment
   */
  async addLumpsumInvestment(
    userId: string,
    portfolioId: string,
    fundId: string,
    investment: {
      amount: number;
      date: Date;
      nav: number;
      units: number;
    }
  ): Promise<Portfolio | null> {
    const portfolio = await this.findById(userId, portfolioId);
    if (!portfolio) return null;

    const holdingIndex = portfolio.holdings.findIndex(
      (h) => h.fundId === fundId
    );
    if (holdingIndex === -1) return null;

    portfolio.holdings[holdingIndex].lumpsumInvestments.push(investment);

    const result = await this.collection.findOneAndUpdate(
      { userId, portfolioId },
      {
        $set: {
          holdings: portfolio.holdings,
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after' }
    );

    // Recalculate holding and portfolio totals
    if (result) {
      await this.recalculateHolding(userId, portfolioId, fundId);
      await this.recalculateTotals(userId, portfolioId);
    }

    return result || null;
  }

  /**
   * Recalculate holding totals
   */
  async recalculateHolding(
    userId: string,
    portfolioId: string,
    fundId: string
  ): Promise<void> {
    const portfolio = await this.findById(userId, portfolioId);
    if (!portfolio) return;

    const holdingIndex = portfolio.holdings.findIndex(
      (h) => h.fundId === fundId
    );
    if (holdingIndex === -1) return;

    const holding = portfolio.holdings[holdingIndex];

    // Calculate total invested
    let totalInvested = 0;
    let totalUnits = 0;

    // From lumpsum
    holding.lumpsumInvestments.forEach((inv) => {
      totalInvested += inv.amount;
      totalUnits += inv.units;
    });

    // From SIP (if applicable)
    if (holding.sipAmount && holding.sipCount) {
      totalInvested += holding.sipAmount * holding.sipCount;
      // Units calculation would need historical NAV data
    }

    // Calculate current value
    const currentValue = totalUnits * holding.currentNav;

    // Calculate returns
    const returns = currentValue - totalInvested;
    const returnsPercent =
      totalInvested > 0 ? (returns / totalInvested) * 100 : 0;

    // Update holding
    portfolio.holdings[holdingIndex] = {
      ...holding,
      totalInvested,
      totalUnits,
      currentValue,
      returns,
      returnsPercent,
      lastUpdated: new Date(),
    };

    await this.collection.updateOne(
      { userId, portfolioId },
      {
        $set: {
          holdings: portfolio.holdings,
          updatedAt: new Date(),
        },
      }
    );
  }

  /**
   * Recalculate portfolio totals
   */
  async recalculateTotals(userId: string, portfolioId: string): Promise<void> {
    const portfolio = await this.findById(userId, portfolioId);
    if (!portfolio) return;

    // Calculate totals
    let totalInvested = 0;
    let currentValue = 0;

    portfolio.holdings.forEach((holding) => {
      totalInvested += holding.totalInvested;
      currentValue += holding.currentValue;
    });

    const totalReturns = currentValue - totalInvested;
    const returnsPercent =
      totalInvested > 0 ? (totalReturns / totalInvested) * 100 : 0;

    // Calculate category allocation
    const categoryMap = new Map<string, number>();
    portfolio.holdings.forEach((holding) => {
      // Would need to fetch fund details for category
      // For now, we'll skip this
    });

    await this.collection.updateOne(
      { userId, portfolioId },
      {
        $set: {
          totalInvested,
          currentValue,
          totalReturns,
          returnsPercent,
          updatedAt: new Date(),
        },
      }
    );
  }

  /**
   * Delete portfolio (soft delete)
   */
  async delete(userId: string, portfolioId: string): Promise<boolean> {
    const result = await this.collection.updateOne(
      { userId, portfolioId },
      { $set: { isActive: false, updatedAt: new Date() } }
    );
    return result.modifiedCount > 0;
  }

  /**
   * Hard delete portfolio
   */
  async hardDelete(userId: string, portfolioId: string): Promise<boolean> {
    const result = await this.collection.deleteOne({ userId, portfolioId });
    return result.deletedCount > 0;
  }

  /**
   * Get portfolio summary
   */
  async getSummary(
    userId: string,
    portfolioId: string
  ): Promise<{
    totalInvested: number;
    currentValue: number;
    totalReturns: number;
    returnsPercent: number;
    xirr: number;
    holdingsCount: number;
    topHoldings: Array<{
      fundName: string;
      value: number;
      percentage: number;
    }>;
  } | null> {
    const portfolio = await this.findById(userId, portfolioId);
    if (!portfolio) return null;

    // Sort holdings by value
    const sortedHoldings = [...portfolio.holdings].sort(
      (a, b) => b.currentValue - a.currentValue
    );

    const topHoldings = sortedHoldings.slice(0, 5).map((h) => ({
      fundName: h.fundName,
      value: h.currentValue,
      percentage: (h.currentValue / portfolio.currentValue) * 100,
    }));

    return {
      totalInvested: portfolio.totalInvested,
      currentValue: portfolio.currentValue,
      totalReturns: portfolio.totalReturns,
      returnsPercent: portfolio.returnsPercent,
      xirr: portfolio.xirr,
      holdingsCount: portfolio.holdings.length,
      topHoldings,
    };
  }

  /**
   * Get portfolio with fund details
   */
  async getWithFundDetails(
    userId: string,
    portfolioId: string
  ): Promise<any | null> {
    const result = await this.collection
      .aggregate([
        { $match: { userId, portfolioId } },
        { $unwind: '$holdings' },
        {
          $lookup: {
            from: 'funds',
            localField: 'holdings.fundId',
            foreignField: 'fundId',
            as: 'fundDetails',
          },
        },
        {
          $unwind: { path: '$fundDetails', preserveNullAndEmptyArrays: true },
        },
        {
          $group: {
            _id: '$_id',
            userId: { $first: '$userId' },
            portfolioId: { $first: '$portfolioId' },
            name: { $first: '$name' },
            holdings: {
              $push: {
                holding: '$holdings',
                fundDetails: '$fundDetails',
              },
            },
            totalInvested: { $first: '$totalInvested' },
            currentValue: { $first: '$currentValue' },
            totalReturns: { $first: '$totalReturns' },
            returnsPercent: { $first: '$returnsPercent' },
            xirr: { $first: '$xirr' },
            createdAt: { $first: '$createdAt' },
            updatedAt: { $first: '$updatedAt' },
          },
        },
      ])
      .next();

    return result;
  }
}
