import { Collection, Filter } from 'mongodb';
import { mongodb } from '../db/mongodb';
import { Watchlist } from '../db/schemas';
import { z } from 'zod';

/**
 * Zod validation schema for Watchlist
 */
export const WatchlistSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  fundId: z.string().min(1, 'Fund ID is required'),
  fundName: z.string().min(1, 'Fund name is required'),
  addedAt: z.date(),

  // Price Alerts
  priceAlerts: z.array(
    z.object({
      type: z.enum(['above', 'below', 'change_percent']),
      value: z.number(),
      isActive: z.boolean().default(true),
      triggeredAt: z.date().optional(),
    })
  ),

  notes: z.string().optional(),
});

export type WatchlistInput = z.infer<typeof WatchlistSchema>;

/**
 * Watchlist Model Class
 * Manages user watchlists and price alerts
 */
export class WatchlistModel {
  private static instance: WatchlistModel | null = null;
  private collection: Collection<Watchlist>;

  private constructor() {
    this.collection = mongodb.getCollection<Watchlist>('watchlists');
  }

  static getInstance(): WatchlistModel {
    if (!WatchlistModel.instance) {
      WatchlistModel.instance = new WatchlistModel();
    }
    return WatchlistModel.instance;
  }

  /**
   * Add fund to watchlist
   */
  async add(watchlistData: Partial<Watchlist>): Promise<Watchlist> {
    const watchlist: Watchlist = {
      ...watchlistData,
      addedAt: watchlistData.addedAt || new Date(),
      priceAlerts: watchlistData.priceAlerts || [],
    } as Watchlist;

    const result = await this.collection.insertOne(watchlist as any);
    return { ...watchlist, _id: result.insertedId.toString() };
  }

  /**
   * Remove fund from watchlist
   */
  async remove(userId: string, fundId: string): Promise<boolean> {
    const result = await this.collection.deleteOne({ userId, fundId });
    return result.deletedCount > 0;
  }

  /**
   * Check if fund is in watchlist
   */
  async exists(userId: string, fundId: string): Promise<boolean> {
    const count = await this.collection.countDocuments({ userId, fundId });
    return count > 0;
  }

  /**
   * Get user's watchlist
   */
  async getUserWatchlist(
    userId: string,
    options: { limit?: number; skip?: number; sortBy?: string } = {}
  ): Promise<Watchlist[]> {
    const sort: any = {};

    if (options.sortBy === 'name') {
      sort.fundName = 1;
    } else {
      sort.addedAt = -1;
    }

    return await this.collection
      .find({ userId })
      .sort(sort)
      .limit(options.limit || 100)
      .skip(options.skip || 0)
      .toArray();
  }

  /**
   * Get watchlist count for user
   */
  async getUserWatchlistCount(userId: string): Promise<number> {
    return await this.collection.countDocuments({ userId });
  }

  /**
   * Get all users watching a specific fund
   */
  async getUsersWatchingFund(fundId: string): Promise<Watchlist[]> {
    return await this.collection.find({ fundId }).toArray();
  }

  /**
   * Add price alert
   */
  async addPriceAlert(
    userId: string,
    fundId: string,
    alert: {
      type: 'above' | 'below' | 'change_percent';
      value: number;
    }
  ): Promise<Watchlist | null> {
    const alertData = {
      ...alert,
      isActive: true,
    };

    const result = await this.collection.findOneAndUpdate(
      { userId, fundId },
      {
        $push: { priceAlerts: alertData as any },
      },
      { returnDocument: 'after' }
    );

    return result || null;
  }

  /**
   * Remove price alert
   */
  async removePriceAlert(
    userId: string,
    fundId: string,
    alertIndex: number
  ): Promise<Watchlist | null> {
    const watchlist = await this.collection.findOne({ userId, fundId });
    if (!watchlist || !watchlist.priceAlerts[alertIndex]) {
      return null;
    }

    watchlist.priceAlerts.splice(alertIndex, 1);

    const result = await this.collection.findOneAndUpdate(
      { userId, fundId },
      { $set: { priceAlerts: watchlist.priceAlerts } },
      { returnDocument: 'after' }
    );

    return result || null;
  }

  /**
   * Toggle price alert
   */
  async togglePriceAlert(
    userId: string,
    fundId: string,
    alertIndex: number
  ): Promise<Watchlist | null> {
    const watchlist = await this.collection.findOne({ userId, fundId });
    if (!watchlist || !watchlist.priceAlerts[alertIndex]) {
      return null;
    }

    watchlist.priceAlerts[alertIndex].isActive =
      !watchlist.priceAlerts[alertIndex].isActive;

    const result = await this.collection.findOneAndUpdate(
      { userId, fundId },
      { $set: { priceAlerts: watchlist.priceAlerts } },
      { returnDocument: 'after' }
    );

    return result || null;
  }

  /**
   * Trigger price alert
   */
  async triggerAlert(
    userId: string,
    fundId: string,
    alertIndex: number
  ): Promise<Watchlist | null> {
    const watchlist = await this.collection.findOne({ userId, fundId });
    if (!watchlist || !watchlist.priceAlerts[alertIndex]) {
      return null;
    }

    watchlist.priceAlerts[alertIndex].triggeredAt = new Date();

    const result = await this.collection.findOneAndUpdate(
      { userId, fundId },
      { $set: { priceAlerts: watchlist.priceAlerts } },
      { returnDocument: 'after' }
    );

    return result || null;
  }

  /**
   * Get active price alerts
   */
  async getActiveAlerts(userId?: string): Promise<Watchlist[]> {
    const filter: Filter<Watchlist> = {
      priceAlerts: {
        $elemMatch: { isActive: true },
      },
    };

    if (userId) {
      filter.userId = userId;
    }

    return await this.collection.find(filter).toArray();
  }

  /**
   * Update notes
   */
  async updateNotes(
    userId: string,
    fundId: string,
    notes: string
  ): Promise<Watchlist | null> {
    const result = await this.collection.findOneAndUpdate(
      { userId, fundId },
      { $set: { notes } },
      { returnDocument: 'after' }
    );

    return result || null;
  }

  /**
   * Bulk add funds to watchlist
   */
  async bulkAdd(
    userId: string,
    funds: Array<{ fundId: string; fundName: string }>
  ): Promise<number> {
    const now = new Date();
    const watchlistItems = funds.map((fund) => ({
      userId,
      fundId: fund.fundId,
      fundName: fund.fundName,
      addedAt: now,
      priceAlerts: [],
    }));

    const result = await this.collection.insertMany(watchlistItems as any);
    return result.insertedCount;
  }

  /**
   * Clear user's watchlist
   */
  async clearUserWatchlist(userId: string): Promise<number> {
    const result = await this.collection.deleteMany({ userId });
    return result.deletedCount;
  }

  /**
   * Get watchlist with fund details
   * This would typically join with funds collection
   */
  async getUserWatchlistWithDetails(userId: string): Promise<any[]> {
    return await this.collection
      .aggregate([
        { $match: { userId } },
        {
          $lookup: {
            from: 'funds',
            localField: 'fundId',
            foreignField: 'fundId',
            as: 'fundDetails',
          },
        },
        { $unwind: { path: '$fundDetails', preserveNullAndEmptyArrays: true } },
        { $sort: { addedAt: -1 } },
      ])
      .toArray();
  }

  /**
   * Get most watched funds
   */
  async getMostWatchedFunds(limit: number = 10): Promise<
    Array<{
      fundId: string;
      fundName: string;
      watchCount: number;
    }>
  > {
    const results = await this.collection
      .aggregate([
        {
          $group: {
            _id: '$fundId',
            fundName: { $first: '$fundName' },
            watchCount: { $sum: 1 },
          },
        },
        { $sort: { watchCount: -1 } },
        { $limit: limit },
        {
          $project: {
            fundId: '$_id',
            fundName: 1,
            watchCount: 1,
            _id: 0,
          },
        },
      ])
      .toArray();

    return results as any;
  }
}
