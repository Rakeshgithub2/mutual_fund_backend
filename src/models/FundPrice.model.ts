import { Collection, Filter } from 'mongodb';
import { mongodb } from '../db/mongodb';
import { FundPrice } from '../db/schemas';
import { z } from 'zod';

/**
 * Zod validation schema for FundPrice
 */
export const FundPriceSchema = z.object({
  fundId: z.string().min(1, 'Fund ID is required'),
  date: z.date(),
  nav: z.number().positive(),
  open: z.number().positive().optional(),
  high: z.number().positive().optional(),
  low: z.number().positive().optional(),
  close: z.number().positive().optional(),
  volume: z.number().min(0).optional(),
  changePercent: z.number(),
  createdAt: z.date(),
});

export type FundPriceInput = z.infer<typeof FundPriceSchema>;

/**
 * FundPrice Model Class
 * Manages historical NAV/price data for funds
 */
export class FundPriceModel {
  private static instance: FundPriceModel | null = null;
  private collection: Collection<FundPrice>;

  private constructor() {
    this.collection = mongodb.getCollection<FundPrice>('fundPrices');
  }

  static getInstance(): FundPriceModel {
    if (!FundPriceModel.instance) {
      FundPriceModel.instance = new FundPriceModel();
    }
    return FundPriceModel.instance;
  }

  /**
   * Add new price entry
   */
  async create(priceData: Partial<FundPrice>): Promise<FundPrice> {
    const price: FundPrice = {
      ...priceData,
      createdAt: priceData.createdAt || new Date(),
    } as FundPrice;

    const result = await this.collection.insertOne(price as any);
    return { ...price, _id: result.insertedId.toString() };
  }

  /**
   * Bulk insert price data
   */
  async bulkCreate(prices: Partial<FundPrice>[]): Promise<number> {
    const priceData = prices.map((p) => ({
      ...p,
      createdAt: p.createdAt || new Date(),
    }));

    const result = await this.collection.insertMany(priceData as any);
    return result.insertedCount;
  }

  /**
   * Get latest price for a fund
   */
  async getLatest(fundId: string): Promise<FundPrice | null> {
    return await this.collection
      .find({ fundId })
      .sort({ date: -1 })
      .limit(1)
      .next();
  }

  /**
   * Get price history for a fund
   */
  async getHistory(
    fundId: string,
    options: {
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      skip?: number;
    } = {}
  ): Promise<FundPrice[]> {
    const filter: Filter<FundPrice> = { fundId };

    if (options.startDate || options.endDate) {
      filter.date = {};
      if (options.startDate) {
        filter.date.$gte = options.startDate;
      }
      if (options.endDate) {
        filter.date.$lte = options.endDate;
      }
    }

    return await this.collection
      .find(filter)
      .sort({ date: -1 })
      .limit(options.limit || 365)
      .skip(options.skip || 0)
      .toArray();
  }

  /**
   * Get price for specific date
   */
  async getByDate(fundId: string, date: Date): Promise<FundPrice | null> {
    // Normalize date to start of day
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return await this.collection.findOne({
      fundId,
      date: { $gte: startOfDay, $lte: endOfDay },
    });
  }

  /**
   * Get price range
   */
  async getPriceRange(
    fundId: string,
    startDate: Date,
    endDate: Date
  ): Promise<FundPrice[]> {
    return await this.collection
      .find({
        fundId,
        date: { $gte: startDate, $lte: endDate },
      })
      .sort({ date: 1 })
      .toArray();
  }

  /**
   * Calculate returns for a period
   */
  async calculateReturns(
    fundId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    startPrice: number;
    endPrice: number;
    returns: number;
    returnsPercent: number;
  } | null> {
    const startPrice = await this.getByDate(fundId, startDate);
    const endPrice = await this.getByDate(fundId, endDate);

    if (!startPrice || !endPrice) {
      return null;
    }

    const returns = endPrice.nav - startPrice.nav;
    const returnsPercent = (returns / startPrice.nav) * 100;

    return {
      startPrice: startPrice.nav,
      endPrice: endPrice.nav,
      returns,
      returnsPercent,
    };
  }

  /**
   * Get OHLC data for charting
   */
  async getOHLC(
    fundId: string,
    options: {
      startDate?: Date;
      endDate?: Date;
      interval?: 'daily' | 'weekly' | 'monthly';
    } = {}
  ): Promise<
    Array<{
      date: Date;
      open: number;
      high: number;
      low: number;
      close: number;
      volume?: number;
    }>
  > {
    const filter: any = { fundId };

    if (options.startDate || options.endDate) {
      filter.date = {};
      if (options.startDate) {
        filter.date.$gte = options.startDate;
      }
      if (options.endDate) {
        filter.date.$lte = options.endDate;
      }
    }

    const prices = await this.collection
      .find(filter)
      .sort({ date: 1 })
      .toArray();

    // For daily, return as-is
    if (options.interval === 'daily' || !options.interval) {
      return prices.map((p) => ({
        date: p.date,
        open: p.open || p.nav,
        high: p.high || p.nav,
        low: p.low || p.nav,
        close: p.close || p.nav,
        volume: p.volume,
      }));
    }

    // For weekly/monthly, aggregate
    // TODO: Implement aggregation logic
    return prices.map((p) => ({
      date: p.date,
      open: p.open || p.nav,
      high: p.high || p.nav,
      low: p.low || p.nav,
      close: p.close || p.nav,
      volume: p.volume,
    }));
  }

  /**
   * Get latest prices for multiple funds
   */
  async getLatestBatch(fundIds: string[]): Promise<Map<string, FundPrice>> {
    const prices = await this.collection
      .aggregate([
        { $match: { fundId: { $in: fundIds } } },
        { $sort: { date: -1 } },
        {
          $group: {
            _id: '$fundId',
            latestPrice: { $first: '$$ROOT' },
          },
        },
      ])
      .toArray();

    const priceMap = new Map<string, FundPrice>();
    prices.forEach((p: any) => {
      priceMap.set(p._id, p.latestPrice);
    });

    return priceMap;
  }

  /**
   * Upsert price (update if exists, insert if not)
   */
  async upsert(priceData: Partial<FundPrice>): Promise<FundPrice> {
    const { fundId, date, ...updateData } = priceData;

    if (!fundId || !date) {
      throw new Error('fundId and date are required for upsert');
    }

    // Normalize date to start of day
    const normalizedDate = new Date(date);
    normalizedDate.setHours(0, 0, 0, 0);

    const result = await this.collection.findOneAndUpdate(
      { fundId, date: normalizedDate },
      {
        $set: {
          ...updateData,
          fundId,
          date: normalizedDate,
          createdAt: new Date(),
        },
      },
      { upsert: true, returnDocument: 'after' }
    );

    return result as FundPrice;
  }

  /**
   * Delete price data for a fund
   */
  async deleteByFund(fundId: string): Promise<number> {
    const result = await this.collection.deleteMany({ fundId });
    return result.deletedCount;
  }

  /**
   * Delete old price data (cleanup)
   */
  async deleteOlderThan(date: Date): Promise<number> {
    const result = await this.collection.deleteMany({ date: { $lt: date } });
    return result.deletedCount;
  }

  /**
   * Get volatility (standard deviation of returns)
   */
  async getVolatility(
    fundId: string,
    startDate: Date,
    endDate: Date
  ): Promise<number | null> {
    const prices = await this.getPriceRange(fundId, startDate, endDate);

    if (prices.length < 2) {
      return null;
    }

    // Calculate daily returns
    const returns: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      const dailyReturn =
        (prices[i].nav - prices[i - 1].nav) / prices[i - 1].nav;
      returns.push(dailyReturn);
    }

    // Calculate standard deviation
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance =
      returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) /
      returns.length;
    const stdDev = Math.sqrt(variance);

    // Annualize (assuming 252 trading days)
    return stdDev * Math.sqrt(252);
  }

  /**
   * Get moving average
   */
  async getMovingAverage(
    fundId: string,
    days: number,
    endDate?: Date
  ): Promise<number | null> {
    const end = endDate || new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - days);

    const prices = await this.getPriceRange(fundId, start, end);

    if (prices.length === 0) {
      return null;
    }

    const sum = prices.reduce((total, p) => total + p.nav, 0);
    return sum / prices.length;
  }
}
