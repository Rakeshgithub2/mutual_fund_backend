import { Collection, Filter, ObjectId } from 'mongodb';
import { mongodb } from '../db/mongodb';
import { FundManager } from '../db/schemas';
import { z } from 'zod';

/**
 * Zod validation schema for FundManager
 */
export const FundManagerSchema = z.object({
  managerId: z.string().min(1, 'Manager ID is required'),
  name: z.string().min(1, 'Manager name is required'),
  bio: z.string(),
  experience: z.number().min(0),
  qualification: z.array(z.string()),

  // Current Role
  currentFundHouse: z.string(),
  designation: z.string(),
  joinedDate: z.date(),

  // Track Record
  fundsManaged: z.array(
    z.object({
      fundId: z.string(),
      fundName: z.string(),
      startDate: z.date(),
      endDate: z.date().optional(),
      aum: z.number(),
      returns: z.object({
        oneYear: z.number(),
        threeYear: z.number(),
        fiveYear: z.number(),
      }),
    })
  ),

  totalAumManaged: z.number().min(0),
  averageReturns: z.object({
    oneYear: z.number(),
    threeYear: z.number(),
    fiveYear: z.number(),
  }),

  // Ratings & Recognition
  awards: z.array(
    z.object({
      title: z.string(),
      year: z.number(),
      organization: z.string(),
    })
  ),

  // Contact & Social
  email: z.string().email().optional(),
  linkedin: z.string().url().optional(),
  twitter: z.string().optional(),

  // Metadata
  isActive: z.boolean().default(true),
  lastUpdated: z.date(),
  createdAt: z.date(),
});

export type FundManagerInput = z.infer<typeof FundManagerSchema>;

/**
 * FundManager Model Class
 * Manages fund manager data and relationships
 */
export class FundManagerModel {
  private static instance: FundManagerModel;
  private collection: Collection<FundManager>;

  constructor() {
    this.collection = mongodb.getCollection<FundManager>('fundManagers');
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): FundManagerModel {
    if (!FundManagerModel.instance) {
      FundManagerModel.instance = new FundManagerModel();
    }
    return FundManagerModel.instance;
  }

  /**
   * Create a new fund manager
   */
  async create(managerData: Partial<FundManager>): Promise<FundManager> {
    const now = new Date();
    const manager: FundManager = {
      ...managerData,
      createdAt: managerData.createdAt || now,
      lastUpdated: managerData.lastUpdated || now,
      isActive: managerData.isActive ?? true,
      fundsManaged: managerData.fundsManaged || [],
      awards: managerData.awards || [],
      qualification: managerData.qualification || [],
    } as FundManager;

    const result = await this.collection.insertOne(manager as any);
    return { ...manager, _id: result.insertedId.toString() };
  }

  /**
   * Find manager by ID
   */
  async findById(managerId: string): Promise<FundManager | null> {
    return await this.collection.findOne({ managerId });
  }

  /**
   * Find manager by MongoDB _id
   */
  async findByMongoId(id: string): Promise<FundManager | null> {
    try {
      // Check if id is a valid ObjectId
      if (!ObjectId.isValid(id)) {
        console.log('❌ Invalid ObjectId format:', id);
        return null;
      }
      return await this.collection.findOne({
        _id: new ObjectId(id),
      } as any);
    } catch (error) {
      console.error('Error in findByMongoId:', error);
      return null;
    }
  }

  /**
   * Find manager by name
   */
  async findByName(name: string): Promise<FundManager | null> {
    return await this.collection.findOne({
      name: { $regex: new RegExp(name, 'i') },
    });
  }

  /**
   * Update manager
   */
  async update(
    managerId: string,
    updateData: Partial<FundManager>
  ): Promise<FundManager | null> {
    const result = await this.collection.findOneAndUpdate(
      { managerId },
      {
        $set: {
          ...updateData,
          lastUpdated: new Date(),
        },
      },
      { returnDocument: 'after' }
    );
    return result || null;
  }

  /**
   * Delete manager (soft delete)
   */
  async delete(managerId: string): Promise<boolean> {
    const result = await this.collection.updateOne(
      { managerId },
      { $set: { isActive: false, lastUpdated: new Date() } }
    );
    return result.modifiedCount > 0;
  }

  /**
   * Hard delete manager
   */
  async hardDelete(managerId: string): Promise<boolean> {
    const result = await this.collection.deleteOne({ managerId });
    return result.deletedCount > 0;
  }

  /**
   * Search managers by name or bio
   */
  async search(
    query: string,
    options: { limit?: number; skip?: number } = {}
  ): Promise<FundManager[]> {
    return await this.collection
      .find({
        $text: { $search: query },
        isActive: true,
      })
      .limit(options.limit || 20)
      .skip(options.skip || 0)
      .sort({ score: { $meta: 'textScore' }, totalAumManaged: -1 })
      .toArray();
  }

  /**
   * Get managers by fund house
   */
  async findByFundHouse(fundHouse: string): Promise<FundManager[]> {
    return await this.collection
      .find({ currentFundHouse: fundHouse, isActive: true })
      .sort({ totalAumManaged: -1 })
      .toArray();
  }

  /**
   * Get top managers by AUM
   */
  async getTopByAUM(limit: number = 10): Promise<FundManager[]> {
    return await this.collection
      .find({ isActive: true })
      .sort({ totalAumManaged: -1 })
      .limit(limit)
      .toArray();
  }

  /**
   * Get top managers by returns
   */
  async getTopByReturns(
    period: 'oneYear' | 'threeYear' | 'fiveYear' = 'threeYear',
    limit: number = 10
  ): Promise<FundManager[]> {
    const sortField = `averageReturns.${period}`;
    return await this.collection
      .find({ isActive: true })
      .sort({ [sortField]: -1 })
      .limit(limit)
      .toArray();
  }

  /**
   * Get managers by experience
   */
  async findByExperience(minYears: number): Promise<FundManager[]> {
    return await this.collection
      .find({ experience: { $gte: minYears }, isActive: true })
      .sort({ experience: -1 })
      .toArray();
  }

  /**
   * Add fund to manager's portfolio
   */
  async addFund(
    managerId: string,
    fundData: {
      fundId: string;
      fundName: string;
      startDate: Date;
      aum: number;
      returns: {
        oneYear: number;
        threeYear: number;
        fiveYear: number;
      };
    }
  ): Promise<FundManager | null> {
    const result = await this.collection.findOneAndUpdate(
      { managerId },
      {
        $push: {
          fundsManaged: fundData as any,
        },
        $set: { lastUpdated: new Date() },
      },
      { returnDocument: 'after' }
    );

    // Recalculate totals
    if (result) {
      await this.recalculateTotals(managerId);
    }

    return result || null;
  }

  /**
   * Update fund in manager's portfolio
   */
  async updateFund(
    managerId: string,
    fundId: string,
    updateData: Partial<FundManager['fundsManaged'][0]>
  ): Promise<FundManager | null> {
    const result = await this.collection.findOneAndUpdate(
      { managerId, 'fundsManaged.fundId': fundId },
      {
        $set: {
          'fundsManaged.$': updateData,
          lastUpdated: new Date(),
        },
      },
      { returnDocument: 'after' }
    );

    // Recalculate totals
    if (result) {
      await this.recalculateTotals(managerId);
    }

    return result || null;
  }

  /**
   * Remove fund from manager's portfolio
   */
  async removeFund(
    managerId: string,
    fundId: string
  ): Promise<FundManager | null> {
    const result = await this.collection.findOneAndUpdate(
      { managerId },
      {
        $pull: {
          fundsManaged: { fundId } as any,
        },
        $set: { lastUpdated: new Date() },
      },
      { returnDocument: 'after' }
    );

    // Recalculate totals
    if (result) {
      await this.recalculateTotals(managerId);
    }

    return result || null;
  }

  /**
   * Add award to manager
   */
  async addAward(
    managerId: string,
    award: {
      title: string;
      year: number;
      organization: string;
    }
  ): Promise<FundManager | null> {
    return await this.collection.findOneAndUpdate(
      { managerId },
      {
        $push: { awards: award as any },
        $set: { lastUpdated: new Date() },
      },
      { returnDocument: 'after' }
    );
  }

  /**
   * Recalculate total AUM and average returns
   */
  async recalculateTotals(managerId: string): Promise<void> {
    const manager = await this.findById(managerId);
    if (!manager || manager.fundsManaged.length === 0) return;

    // Calculate total AUM
    const totalAumManaged = manager.fundsManaged.reduce(
      (sum, fund) => sum + fund.aum,
      0
    );

    // Calculate weighted average returns
    const weightedReturns = {
      oneYear: 0,
      threeYear: 0,
      fiveYear: 0,
    };

    manager.fundsManaged.forEach((fund) => {
      const weight = fund.aum / totalAumManaged;
      weightedReturns.oneYear += fund.returns.oneYear * weight;
      weightedReturns.threeYear += fund.returns.threeYear * weight;
      weightedReturns.fiveYear += fund.returns.fiveYear * weight;
    });

    await this.update(managerId, {
      totalAumManaged,
      averageReturns: weightedReturns,
    });
  }

  /**
   * Get all active managers
   */
  async findAll(
    options: {
      limit?: number;
      skip?: number;
      sortBy?: string;
    } = {}
  ): Promise<FundManager[]> {
    const query: Filter<FundManager> = { isActive: true };
    const sort: any = {};

    if (options.sortBy === 'name') {
      sort.name = 1;
    } else if (options.sortBy === 'aum') {
      sort.totalAumManaged = -1;
    } else if (options.sortBy === 'experience') {
      sort.experience = -1;
    } else {
      sort.totalAumManaged = -1;
    }

    return await this.collection
      .find(query)
      .sort(sort)
      .limit(options.limit || 100)
      .skip(options.skip || 0)
      .toArray();
  }

  /**
   * Get manager statistics
   */
  async getStatistics(managerId: string): Promise<{
    totalFunds: number;
    totalAUM: number;
    averageReturns: {
      oneYear: number;
      threeYear: number;
      fiveYear: number;
    };
    bestPerformingFund: {
      fundName: string;
      returns: number;
    } | null;
    totalAwards: number;
  } | null> {
    const manager = await this.findById(managerId);
    if (!manager) return null;

    const bestFund =
      manager.fundsManaged.length > 0
        ? manager.fundsManaged.reduce((best, current) =>
            current.returns.threeYear > best.returns.threeYear ? current : best
          )
        : null;

    return {
      totalFunds: manager.fundsManaged.length,
      totalAUM: manager.totalAumManaged,
      averageReturns: manager.averageReturns,
      bestPerformingFund: bestFund
        ? {
            fundName: bestFund.fundName,
            returns: bestFund.returns.threeYear,
          }
        : null,
      totalAwards: manager.awards.length,
    };
  }

  /**
   * Bulk update managers
   */
  async bulkUpdate(
    updates: Array<{ managerId: string; data: Partial<FundManager> }>
  ) {
    const bulkOps = updates.map((update) => ({
      updateOne: {
        filter: { managerId: update.managerId },
        update: { $set: { ...update.data, lastUpdated: new Date() } },
        upsert: false,
      },
    }));

    return await this.collection.bulkWrite(bulkOps);
  }
}
