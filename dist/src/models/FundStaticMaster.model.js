/**
 * STATIC FUND MASTER DATA
 * Updated: 6-12 months
 * Contains permanent, rarely-changing fund information
 */

const mongoose = require('mongoose');

const fundStaticMasterSchema = new mongoose.Schema(
  {
    // Primary Identifiers
    fundCode: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    schemeCode: {
      type: String,
      index: true,
    },

    // Basic Information
    fundName: {
      type: String,
      required: true,
      index: 'text',
    },
    amc: {
      type: String,
      required: true,
      index: true,
    },

    // Classification
    category: {
      type: String,
      required: true,
      index: true,
      enum: [
        'Equity',
        'Debt',
        'Hybrid',
        'Solution Oriented',
        'Other',
        'Commodity',
      ],
    },
    subCategory: {
      type: String,
      index: true,
    },
    fundType: {
      type: String,
      default: 'Open Ended',
      enum: ['Open Ended', 'Close Ended', 'Interval Fund'],
    },

    // Benchmark & Manager
    benchmark: {
      name: String,
      index: String,
    },
    fundManager: {
      name: String,
      experience: Number,
      education: String,
      previousFunds: [String],
    },

    // Launch & Status
    launchDate: {
      type: Date,
      index: true,
    },
    inceptionDate: {
      type: Date,
    },
    fundStatus: {
      type: String,
      default: 'Active',
      enum: ['Active', 'Merged', 'Closed', 'Suspended'],
      index: true,
    },

    // Investment Details
    exitLoad: {
      type: String,
      default: '1% if redeemed within 1 year',
    },
    minimumSIP: {
      type: Number,
      default: 500,
    },
    minimumInvestment: {
      type: Number,
      default: 5000,
    },

    // Risk Profile
    riskGrade: {
      type: String,
      enum: [
        'Low',
        'Low to Moderate',
        'Moderate',
        'Moderately High',
        'High',
        'Very High',
      ],
      index: true,
    },
    riskometer: {
      type: Number,
      min: 1,
      max: 5,
    },

    // ISIN Codes
    isinGrowth: String,
    isinDivPayout: String,
    isinDivReinvestment: String,

    // Additional Info
    objective: String,
    description: String,

    // Metadata
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    lastVerified: {
      type: Date,
      default: Date.now,
    },
  },
  {
    collection: 'fund_static_master',
    timestamps: true,
  }
);

// Indexes for fast search
fundStaticMasterSchema.index({ fundName: 'text', amc: 'text' });
fundStaticMasterSchema.index({ category: 1, subCategory: 1 });
fundStaticMasterSchema.index({ fundStatus: 1, isActive: 1 });

const FundStaticMaster = mongoose.model(
  'FundStaticMaster',
  fundStaticMasterSchema
);

module.exports = FundStaticMaster;
