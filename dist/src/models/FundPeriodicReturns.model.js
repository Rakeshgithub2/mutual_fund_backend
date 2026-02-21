/**
 * PERIODIC PERFORMANCE DATA
 * Updated: Monthly/Quarterly
 * Time series data for historical analysis
 */

const mongoose = require('mongoose');

const fundPeriodicReturnsSchema = new mongoose.Schema(
  {
    fundCode: {
      type: String,
      required: true,
      index: true,
    },

    // Returns Data
    return_1M: {
      type: Number,
      default: null,
    },
    return_3M: {
      type: Number,
      default: null,
    },
    return_6M: {
      type: Number,
      default: null,
    },
    return_1Y: {
      type: Number,
      default: null,
    },
    return_3Y: {
      type: Number,
      default: null,
    },
    return_5Y: {
      type: Number,
      default: null,
    },
    return_SI: {
      type: Number,
      default: null,
      description: 'Since Inception',
    },

    // Risk Metrics
    volatility: {
      type: Number,
      default: null,
      description: 'Standard deviation',
    },
    sharpeRatio: {
      type: Number,
      default: null,
    },
    alpha: {
      type: Number,
      default: null,
    },
    beta: {
      type: Number,
      default: null,
    },
    standardDeviation: {
      type: Number,
      default: null,
    },

    // Fund Size
    aum: {
      type: Number,
      required: true,
      description: 'Assets Under Management in Crores',
    },

    // Cost
    expenseRatio: {
      type: Number,
      required: true,
    },

    // Portfolio Metrics
    portfolioTurnover: {
      type: Number,
      default: null,
    },
    avgMarketCap: {
      type: Number,
      default: null,
    },

    // Data Period
    date: {
      type: Date,
      required: true,
      index: true,
    },
    dataMonth: {
      type: String,
      required: true,
      index: true,
      description: 'YYYY-MM format',
    },

    // Metadata
    dataSource: {
      type: String,
      default: 'AMFI',
    },
    calculationDate: {
      type: Date,
      default: Date.now,
    },
  },
  {
    collection: 'fund_periodic_returns',
    timestamps: true,
  }
);

// Compound indexes for time-series queries
fundPeriodicReturnsSchema.index({ fundCode: 1, date: -1 });
fundPeriodicReturnsSchema.index({ fundCode: 1, dataMonth: -1 });
fundPeriodicReturnsSchema.index({ date: -1 });

// Unique constraint to prevent duplicate entries
fundPeriodicReturnsSchema.index(
  { fundCode: 1, dataMonth: 1 },
  { unique: true }
);

const FundPeriodicReturns = mongoose.model(
  'FundPeriodicReturns',
  fundPeriodicReturnsSchema
);

module.exports = FundPeriodicReturns;
