import { Collection, Filter, UpdateFilter, Document } from 'mongodb';
import { mongodb } from '../db/mongodb';
import { Fund } from '../db/schemas';
import { z } from 'zod';

/**
 * Zod validation schema for Fund
 */
export const FundSchema = z.object({
  fundId: z.string().min(1, 'Fund ID is required'),
  amfiCode: z.string().optional(),
  name: z.string().min(1, 'Fund name is required'),
  category: z.enum([
    'equity',
    'debt',
    'hybrid',
    'commodity',
    'etf',
    'index',
    'elss',
    'solution_oriented',
    'international',
  ]),
  subCategory: z.string(),
  fundType: z.enum(['mutual_fund', 'etf']),

  // SEBI Mandatory Fields
  schemeType: z.enum(['direct', 'regular']),
  planType: z.enum(['growth', 'idcw', 'dividend']),
  riskOMeter: z
    .enum([
      'low',
      'low_to_moderate',
      'moderate',
      'moderately_high',
      'high',
      'very_high',
    ])
    .optional(),

  // Basic Info
  fundHouse: z.string().min(1, 'Fund house is required'),
  benchmark: z.string().optional(),
  launchDate: z.date().optional(),
  aum: z.number().min(0).optional(),
  aumDate: z.date().optional(),
  expenseRatio: z.number().min(0).max(5).optional(),
  exitLoad: z.number().min(0).max(100).optional(),
  minInvestment: z.number().min(0).optional(),
  sipMinAmount: z.number().min(0).optional(),

  // Manager Info
  fundManagerId: z.string().optional(),
  fundManager: z.string().optional(),
  fundManagerExperience: z.number().optional(),
  fundManagerTenure: z.number().optional(),

  // Performance
  returns: z.object({
    day: z.number(),
    week: z.number(),
    month: z.number(),
    threeMonth: z.number(),
    sixMonth: z.number(),
    oneYear: z.number(),
    threeYear: z.number(),
    fiveYear: z.number(),
    sinceInception: z.number(),
  }),

  // Risk Metrics
  riskMetrics: z.object({
    sharpeRatio: z.number(),
    standardDeviation: z.number(),
    beta: z.number(),
    alpha: z.number(),
    rSquared: z.number(),
    sortino: z.number(),
  }),

  // Holdings
  holdings: z.array(
    z.object({
      name: z.string(),
      ticker: z.string().optional(),
      percentage: z.number(),
      sector: z.string(),
      quantity: z.number().optional(),
      value: z.number().optional(),
    })
  ),

  // Sector Allocation
  sectorAllocation: z.array(
    z.object({
      sector: z.string(),
      percentage: z.number(),
    })
  ),

  // Current Price
  currentNav: z.number().positive(),
  previousNav: z.number().positive(),
  navDate: z.date(),

  // Ratings
  ratings: z.object({
    morningstar: z.number().min(1).max(5).optional(),
    crisil: z.number().min(1).max(5).optional(),
    valueResearch: z.number().min(1).max(5).optional(),
  }),

  // Search & Discovery
  tags: z.array(z.string()),
  searchTerms: z.array(z.string()),
  popularity: z.number().min(0).default(0),

  // Metadata
  isActive: z.boolean().default(true),
  dataSource: z.string(),
  lastUpdated: z.date(),
  createdAt: z.date(),
});

export type FundInput = z.infer<typeof FundSchema>;

/**
 * Fund Model Class
 * Provides type-safe methods for interacting with the funds collection
 */
export class FundModel {
  private static instance: FundModel;
  private _collection: Collection<Fund> | null = null;

  constructor() {
    // Don't initialize collection here - do it lazily
  }

  /**
   * Lazy-load collection to avoid initialization order issues
   */
  private get collection(): Collection<Fund> {
    if (!this._collection) {
      this._collection = mongodb.getCollection<Fund>('funds');
    }
    return this._collection;
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): FundModel {
    if (!FundModel.instance) {
      FundModel.instance = new FundModel();
    }
    return FundModel.instance;
  }

  /**
   * Create a new fund
   */
  async create(fundData: Partial<Fund>): Promise<Fund> {
    const now = new Date();
    const fund: Fund = {
      ...fundData,
      createdAt: fundData.createdAt || now,
      lastUpdated: fundData.lastUpdated || now,
      isActive: fundData.isActive ?? true,
      popularity: fundData.popularity || 0,
    } as Fund;

    // Validate with Zod (partial validation)
    const result = await this.collection.insertOne(fund as any);
    return { ...fund, _id: result.insertedId.toString() };
  }

  /**
   * Find fund by fundId, _id, or id field
   * Tries multiple ID formats for compatibility
   * Populates holdings from the holdings collection
   */
  async findById(fundId: string): Promise<Fund | null> {
    const { ObjectId } = require('mongodb');

    // Try fundId first (custom ID)
    let fund = await this.collection.findOne({ fundId });

    // Try as MongoDB ObjectId string representation
    if (!fund) {
      try {
        if (ObjectId.isValid(fundId)) {
          fund = await this.collection.findOne({
            _id: new ObjectId(fundId),
          } as any);
        }
      } catch (e) {
        // Not a valid ObjectId, continue
      }
    }

    // Try as regular id field (converted from _id)
    if (!fund) {
      fund = await this.collection.findOne({ id: fundId } as any);
    }

    if (!fund) return null;

    // Populate holdings from holdings collection ONLY if not already in fund document
    if (!fund.holdings || fund.holdings.length === 0) {
      try {
        const holdingsCollection = mongodb.getCollection('holdings');
        const holdings = await holdingsCollection
          .find({ fundId: fund._id })
          .sort({ percent: -1 })
          .limit(15)
          .toArray();

        // Add holdings to fund object only if found in separate collection
        if (holdings && holdings.length > 0) {
          fund.holdings = holdings.map((h: any) => ({
            name: h.name,
            ticker: h.ticker,
            percentage: h.percent,
            sector: h.sector || 'Unknown',
            value: h.value || 0,
          }));
        }
      } catch (e) {
        console.error('Error populating holdings:', e);
        // Don't override existing holdings on error
      }
    }

    return fund;
  }

  /**
   * Find fund by MongoDB _id
   */
  async findByMongoId(id: string): Promise<Fund | null> {
    return await this.collection.findOne({ _id: id } as Filter<Fund>);
  }

  /**
   * Update fund
   */
  async update(
    fundId: string,
    updateData: Partial<Fund>
  ): Promise<Fund | null> {
    const result = await this.collection.findOneAndUpdate(
      { fundId },
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
   * Update NAV and price data
   */
  async updateNav(
    fundId: string,
    nav: number,
    navDate: Date
  ): Promise<Fund | null> {
    const fund = await this.findById(fundId);
    if (!fund) return null;

    return await this.update(fundId, {
      previousNav: fund.currentNav,
      currentNav: nav,
      navDate,
    });
  }

  /**
   * Delete fund (soft delete)
   */
  async delete(fundId: string): Promise<boolean> {
    const result = await this.collection.updateOne(
      { fundId },
      { $set: { isActive: false, lastUpdated: new Date() } }
    );
    return result.modifiedCount > 0;
  }

  /**
   * Hard delete fund
   */
  async hardDelete(fundId: string): Promise<boolean> {
    const result = await this.collection.deleteOne({ fundId });
    return result.deletedCount > 0;
  }

  /**
   * Search funds by name or tags
   */
  async search(
    query: string,
    options: {
      category?: string;
      fundType?: string;
      limit?: number;
      skip?: number;
    } = {}
  ): Promise<Fund[]> {
    const filter: Filter<Fund> = {
      $text: { $search: query },
      isActive: true,
    };

    if (options.category) {
      filter.category = options.category as any;
    }

    if (options.fundType) {
      filter.fundType = options.fundType as any;
    }

    return await this.collection
      .find(filter)
      .limit(options.limit || 20)
      .skip(options.skip || 0)
      .sort({ score: { $meta: 'textScore' }, _id: -1 }) // Use _id instead of popularity
      .toArray();
  }

  /**
   * Get funds by category (Zero-NA Policy Enforced)
   */
  async findByCategory(
    category: string,
    options: {
      limit?: number;
      skip?: number;
      sortBy?: string;
      enforceVisibility?: boolean; // Zero-NA policy - now defaults to FALSE
    } = {}
  ): Promise<Fund[]> {
    const query: Filter<Fund> = {
      category: category as any,
      isActive: true,
    };

    // Enforce zero-NA policy only if explicitly enabled
    // Default: false to show all active funds
    if (options.enforceVisibility === true) {
      query.isPubliclyVisible = true;
      // @ts-ignore
      query['dataCompleteness.completenessScore'] = { $gte: 60 };
    }

    // CRITICAL: Use ONLY _id for sorting (always indexed, prevents 32MB error)
    const sort: any = { _id: -1 };

    return await this.collection
      .find(query)
      .sort(sort)
      .limit(options.limit || 200)
      .skip(options.skip || 0)
      .toArray();
  }

  /**
   * Get funds by category with specific subcategories filter (Zero-NA Policy)
   */
  async findByCategoryWithSubcategories(
    category: string,
    subcategories: string[],
    options: {
      limit?: number;
      skip?: number;
      sortBy?: string;
      enforceVisibility?: boolean; // Default: false
    } = {}
  ): Promise<Fund[]> {
    const query: Filter<Fund> = {
      category: category as any,
      subCategory: { $in: subcategories } as any,
      isActive: true,
    };

    // Enforce zero-NA policy only if explicitly enabled
    if (options.enforceVisibility === true) {
      query.isPubliclyVisible = true;
      // @ts-ignore
      query['dataCompleteness.completenessScore'] = { $gte: 60 };
    }

    const sort: any = {};

    if (options.sortBy === 'returns') {
      sort['returns.oneYear'] = -1;
    } else if (options.sortBy === 'aum') {
      sort.aum = -1;
    } else {
      // Sort by popularity first, then by recency (newer first)
      sort.popularity = -1;
      sort._id = -1; // Recent funds first when popularity is same
    }

    return await this.collection
      .find(query)
      .sort(sort)
      .limit(options.limit || 20)
      .skip(options.skip || 0)
      .toArray();
  }

  /**
   * Get funds by subcategory (Zero-NA Policy)
   */
  async findBySubCategory(
    subCategory: string,
    options: {
      limit?: number;
      skip?: number;
      sortBy?: string;
      enforceVisibility?: boolean; // Default: false
    } = {}
  ): Promise<Fund[]> {
    const query: Filter<Fund> = {
      subCategory: subCategory as any,
      isActive: true,
    };

    // Enforce zero-NA policy only if explicitly enabled
    if (options.enforceVisibility === true) {
      query.isPubliclyVisible = true;
      // @ts-ignore
      query['dataCompleteness.completenessScore'] = { $gte: 60 };
    }

    // CRITICAL: Use ONLY _id for sorting (always indexed, prevents 32MB error)
    const sort: any = { _id: -1 };

    return await this.collection
      .find(query)
      .sort(sort)
      .limit(options.limit || 200)
      .skip(options.skip || 0)
      .toArray();
  }

  /**
   * Get top performing funds
   */
  async getTopPerformers(
    period: 'oneYear' | 'threeYear' | 'fiveYear' = 'oneYear',
    limit: number = 10
  ): Promise<Fund[]> {
    // CRITICAL: Use _id instead of returns (unindexed) to prevent 32MB error
    return await this.collection
      .find({ isActive: true })
      .sort({ _id: -1 })
      .limit(limit)
      .toArray();
  }

  /**
   * Get funds by fund house
   */
  async findByFundHouse(fundHouse: string): Promise<Fund[]> {
    // CRITICAL: Use _id instead of aum (unindexed) to prevent 32MB error
    return await this.collection
      .find({ fundHouse, isActive: true })
      .sort({ _id: -1 })
      .limit(200) // Add limit for safety
      .toArray();
  }

  /**
   * Get funds by manager
   */
  async findByManager(fundManagerId: string): Promise<Fund[]> {
    return await this.collection
      .find({ fundManagerId, isActive: true })
      .sort({ _id: -1 }) // Use _id to prevent 32MB error
      .toArray();
  }

  /**
   * Bulk update funds
   */
  async bulkUpdate(updates: Array<{ fundId: string; data: Partial<Fund> }>) {
    const bulkOps = updates.map((update) => ({
      updateOne: {
        filter: { fundId: update.fundId },
        update: { $set: { ...update.data, lastUpdated: new Date() } },
        upsert: false,
      },
    }));

    return await this.collection.bulkWrite(bulkOps);
  }

  /**
   * Get funds count by category
   */
  async countByCategory(): Promise<Array<{ category: string; count: number }>> {
    return (await this.collection
      .aggregate([
        { $match: { isActive: true } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $project: { category: '$_id', count: 1, _id: 0 } },
      ])
      .toArray()) as any;
  }

  /**
   * Get all active funds
   */
  async findAll(
    options: {
      limit?: number;
      skip?: number;
      sortBy?: string;
    } = {}
  ): Promise<Fund[]> {
    const query: Filter<Fund> = { isActive: true };

    // CRITICAL: Use ONLY _id for sorting (always indexed, prevents 32MB error)
    const sort: any = { _id: -1 };

    return await this.collection
      .find(query)
      .sort(sort)
      .limit(options.limit || 200) // Safe limit for MongoDB free tier
      .skip(options.skip || 0)
      .toArray();
  }

  /**
   * Increment popularity
   */
  async incrementPopularity(fundId: string): Promise<void> {
    await this.collection.updateOne({ fundId }, { $inc: { popularity: 1 } });
  }
}
