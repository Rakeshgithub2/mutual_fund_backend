/**
 * Fund Holdings Model
 * Stores portfolio holdings data scraped from AMFI PDFs
 */

import mongoose, { Model, Document } from 'mongoose';

// Define interface for static methods
interface IFundHoldingsStatics {
  getLatestHoldings(schemeCode: string): Promise<any[]>;
  getTopHoldings(schemeCode: string, limit?: number): Promise<any[]>;
  getSectorAllocation(schemeCode: string): Promise<any[]>;
}

// Combine document with statics
interface IFundHoldingsModel extends Model<any>, IFundHoldingsStatics {}

const fundHoldingsSchema = new mongoose.Schema(
  {
    // Fund Identification
    schemeCode: {
      type: String,
      index: true,
    },
    fundName: {
      type: String,
      required: true,
      index: true,
    },

    // Holding Details
    security: {
      type: String,
      required: true,
    },
    weight: {
      type: Number, // Percentage (e.g., 9.42 for 9.42%)
      min: 0,
      max: 100,
    },
    marketValue: {
      type: Number, // In rupees
      min: 0,
    },

    // Metadata
    reportDate: {
      type: Date,
      required: true,
      index: true,
    },
    importedAt: {
      type: Date,
      default: Date.now,
    },
    source: {
      type: String,
      default: 'AMFI_PDF',
      enum: ['AMFI_PDF', 'MANUAL', 'API', 'SAMPLE'],
    },

    // Optional: Sector classification
    sector: {
      type: String,
      index: true,
    },
    industry: String,

    // Optional: Security details
    isin: String,
    securityType: {
      type: String,
      enum: ['EQUITY', 'DEBT', 'CASH', 'OTHER'],
    },
  },
  {
    timestamps: true,
    collection: 'fund_holdings',
  }
);

// Compound indexes for efficient queries
fundHoldingsSchema.index({ schemeCode: 1, reportDate: -1 });
fundHoldingsSchema.index({ fundName: 1, reportDate: -1 });
fundHoldingsSchema.index({ security: 1, reportDate: -1 });
fundHoldingsSchema.index({ weight: -1 }); // For top holdings queries

// Statics
fundHoldingsSchema.statics.getLatestHoldings = function (schemeCode) {
  return this.aggregate([
    { $match: { schemeCode } },
    { $sort: { reportDate: -1 } },
    {
      $group: {
        _id: '$schemeCode',
        latestDate: { $first: '$reportDate' },
        holdings: { $push: '$$ROOT' },
      },
    },
    { $unwind: '$holdings' },
    {
      $match: {
        $expr: { $eq: ['$holdings.reportDate', '$latestDate'] },
      },
    },
    { $replaceRoot: { newRoot: '$holdings' } },
    { $sort: { weight: -1 } },
  ]);
};

fundHoldingsSchema.statics.getTopHoldings = function (schemeCode, limit = 10) {
  return this.find({ schemeCode })
    .sort({ reportDate: -1, weight: -1 })
    .limit(limit)
    .lean();
};

fundHoldingsSchema.statics.getSectorAllocation = function (schemeCode) {
  return this.aggregate([
    { $match: { schemeCode, sector: { $exists: true } } },
    { $sort: { reportDate: -1 } },
    {
      $group: {
        _id: { schemeCode: '$schemeCode', reportDate: '$reportDate' },
        sectors: {
          $push: {
            sector: '$sector',
            weight: '$weight',
          },
        },
      },
    },
    { $sort: { '_id.reportDate': -1 } },
    { $limit: 1 },
    { $unwind: '$sectors' },
    {
      $group: {
        _id: '$sectors.sector',
        totalWeight: { $sum: '$sectors.weight' },
      },
    },
    { $sort: { totalWeight: -1 } },
  ]);
};

const FundHoldings = mongoose.model<any, IFundHoldingsModel>(
  'FundHoldings',
  fundHoldingsSchema,
  'fund_holdings'
);

export default FundHoldings;
