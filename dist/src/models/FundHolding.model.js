/**
 * FundHolding Model
 * Quarterly portfolio holdings data
 */

const mongoose = require('mongoose');

const fundHoldingSchema = new mongoose.Schema(
  {
    schemeCode: {
      type: String,
      required: true,
      index: true,
    },
    schemeName: {
      type: String,
      required: true,
    },

    // Reporting period
    asOfDate: {
      type: Date,
      required: true,
      index: true,
    },
    quarter: String,
    year: Number,

    // Top Holdings
    topHoldings: [
      {
        name: String,
        isin: String,
        sector: String,
        percentage: Number,
        quantity: Number,
        value: Number,
      },
    ],

    // Sector Allocation
    sectorAllocation: [
      {
        sector: String,
        percentage: Number,
        value: Number,
      },
    ],

    // Asset Allocation
    assetAllocation: {
      equity: Number,
      debt: Number,
      cash: Number,
      other: Number,
    },

    // Market Cap Distribution (for equity funds)
    marketCapDistribution: {
      largeCap: Number,
      midCap: Number,
      smallCap: Number,
    },

    // Credit Rating Distribution (for debt funds)
    creditRatings: [
      {
        rating: String,
        percentage: Number,
      },
    ],

    // Maturity Profile (for debt funds)
    maturityProfile: {
      lessThan1Year: Number,
      oneToThreeYears: Number,
      threeToFiveYears: Number,
      moreThanFiveYears: Number,
    },

    // Statistics
    numberOfHoldings: Number,
    portfolioTurnover: Number,

    // Data completeness
    dataComplete: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    collection: 'fund_holdings',
  }
);

// Compound indexes
fundHoldingSchema.index({ schemeCode: 1, asOfDate: -1 });
fundHoldingSchema.index({ asOfDate: -1, schemeCode: 1 });

// Unique constraint
fundHoldingSchema.index({ schemeCode: 1, asOfDate: 1 }, { unique: true });

// Index for sector searches
fundHoldingSchema.index({ 'sectorAllocation.sector': 1 });

// Static methods
fundHoldingSchema.statics.getLatestHoldings = function (schemeCode) {
  return this.findOne({ schemeCode }).sort({ asOfDate: -1 }).lean();
};

fundHoldingSchema.statics.getHoldingsHistory = function (
  schemeCode,
  quarters = 4
) {
  return this.find({ schemeCode })
    .sort({ asOfDate: -1 })
    .limit(quarters)
    .lean();
};

fundHoldingSchema.statics.findBySector = function (sector, limit = 20) {
  return this.find({
    'sectorAllocation.sector': sector,
    asOfDate: { $gte: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000) }, // Last 180 days
  })
    .sort({ asOfDate: -1 })
    .limit(limit)
    .lean();
};

fundHoldingSchema.statics.findByHolding = function (holdingName) {
  return this.find({
    'topHoldings.name': { $regex: holdingName, $options: 'i' },
    asOfDate: { $gte: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000) },
  })
    .sort({ asOfDate: -1 })
    .lean();
};

// Methods
fundHoldingSchema.methods.getTopSectors = function (count = 5) {
  return this.sectorAllocation
    .sort((a, b) => b.percentage - a.percentage)
    .slice(0, count);
};

fundHoldingSchema.methods.getTopHoldings = function (count = 10) {
  return this.topHoldings
    .sort((a, b) => b.percentage - a.percentage)
    .slice(0, count);
};

const FundHolding = mongoose.model('FundHolding', fundHoldingSchema);

module.exports = FundHolding;
