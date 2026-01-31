/**
 * Market Indices Schema & Service
 * Stores ONLY latest snapshot of market indices (no history)
 */

import mongoose from 'mongoose';

// Market Indices Schema - Only latest values
const marketIndicesSchema = new mongoose.Schema(
  {
    indexName: { type: String, required: true, unique: true },
    symbol: { type: String, required: true, unique: true },
    value: { type: Number, required: true },
    change: { type: Number, required: true },
    percentChange: { type: Number, required: true },
    high: Number,
    low: Number,
    open: Number,
    previousClose: Number,
    lastUpdated: { type: Date, default: Date.now },
    isMarketOpen: { type: Boolean, default: false },
  },
  {
    collection: 'market_indices_latest',
    timestamps: false, // We manage lastUpdated manually
  }
);

marketIndicesSchema.index({ symbol: 1 });
marketIndicesSchema.index({ lastUpdated: -1 });

const MarketIndices = mongoose.model('MarketIndices', marketIndicesSchema);

export interface IndexData {
  indexName: string;
  symbol: string;
  value: number;
  change: number;
  percentChange: number;
  high?: number;
  low?: number;
  open?: number;
  previousClose?: number;
}

export class MarketIndicesService {
  /**
   * Update or insert index data (overwrites previous value)
   */
  static async updateIndex(data: IndexData, isMarketOpen: boolean) {
    return await MarketIndices.findOneAndUpdate(
      { symbol: data.symbol },
      {
        $set: {
          ...data,
          lastUpdated: new Date(),
          isMarketOpen,
        },
      },
      { upsert: true, new: true }
    );
  }

  /**
   * Bulk update multiple indices (atomic operation)
   */
  static async updateMultiple(indices: IndexData[], isMarketOpen: boolean) {
    const operations = indices.map((index) => ({
      updateOne: {
        filter: { symbol: index.symbol },
        update: {
          $set: {
            ...index,
            lastUpdated: new Date(),
            isMarketOpen,
          },
        },
        upsert: true,
      },
    }));

    return await MarketIndices.bulkWrite(operations);
  }

  /**
   * Get all latest indices
   */
  static async getAllIndices() {
    return await MarketIndices.find({}).sort({ indexName: 1 });
  }

  /**
   * Get specific index by symbol
   */
  static async getIndexBySymbol(symbol: string) {
    return await MarketIndices.findOne({ symbol });
  }

  /**
   * Get major indices (Nifty, Sensex, etc.)
   */
  static async getMajorIndices() {
    const majorSymbols = [
      'NIFTY50',
      'SENSEX',
      'NIFTYBANK',
      'NIFTYNEXT50',
      'NIFTYMIDCAP',
    ];
    return await MarketIndices.find({ symbol: { $in: majorSymbols } });
  }

  /**
   * Initialize indices with default values (one-time setup)
   */
  static async initializeIndices() {
    const defaultIndices: IndexData[] = [
      {
        indexName: 'NIFTY 50',
        symbol: 'NIFTY50',
        value: 0,
        change: 0,
        percentChange: 0,
      },
      {
        indexName: 'SENSEX',
        symbol: 'SENSEX',
        value: 0,
        change: 0,
        percentChange: 0,
      },
      {
        indexName: 'NIFTY BANK',
        symbol: 'NIFTYBANK',
        value: 0,
        change: 0,
        percentChange: 0,
      },
      {
        indexName: 'NIFTY NEXT 50',
        symbol: 'NIFTYNEXT50',
        value: 0,
        change: 0,
        percentChange: 0,
      },
      {
        indexName: 'NIFTY MIDCAP 100',
        symbol: 'NIFTYMIDCAP',
        value: 0,
        change: 0,
        percentChange: 0,
      },
      {
        indexName: 'NIFTY IT',
        symbol: 'NIFTYIT',
        value: 0,
        change: 0,
        percentChange: 0,
      },
      {
        indexName: 'NIFTY PHARMA',
        symbol: 'NIFTYPHARMA',
        value: 0,
        change: 0,
        percentChange: 0,
      },
    ];

    return await this.updateMultiple(defaultIndices, false);
  }

  /**
   * Check if data is stale (older than X minutes)
   */
  static async isDataStale(maxAgeMinutes: number = 10): Promise<boolean> {
    const latestIndex = await MarketIndices.findOne().sort({ lastUpdated: -1 });

    if (!latestIndex) return true;

    const ageMinutes =
      (Date.now() - latestIndex.lastUpdated.getTime()) / (1000 * 60);
    return ageMinutes > maxAgeMinutes;
  }
}

export default MarketIndicesService;
