/**
 * Enhanced Fund Model - Production Ready
 * Comprehensive mutual fund data with all required fields
 */

const mongoose = require('mongoose');

const fundEnhancedSchema = new mongoose.Schema(
  {
    // Basic Information
    fundId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      index: 'text',
    },
    schemeCode: {
      type: String,
      index: true,
    },
    amfiCode: String,

    // Classification
    category: {
      type: String,
      required: true,
      index: true,
      enum: ['equity', 'debt', 'hybrid', 'commodity', 'solution', 'other'],
    },
    subCategory: {
      type: String,
      index: true,
    },
    fundHouse: {
      type: String,
      required: true,
      index: true,
    },

    // NAV Information
    nav: {
      type: Number,
      required: true,
    },
    previousNav: Number,
    navDate: Date,

    // Returns (in percentage)
    returns: {
      oneDay: Number,
      oneMonth: Number,
      sixMonth: Number,
      oneYear: Number,
      threeYear: Number,
      fiveYear: Number,
      sinceInception: Number,
    },

    // Holdings - Top Holdings Array
    topHoldings: [
      {
        name: String,
        percentage: Number,
        sector: String,
      },
    ],

    // Sector Allocation
    sectorAllocation: [
      {
        sector: String,
        percentage: Number,
      },
    ],

    // NAV History - Store last 365 days
    navHistory: [
      {
        date: {
          type: Date,
          required: true,
        },
        nav: {
          type: Number,
          required: true,
        },
      },
    ],

    // Financial Metrics
    aum: Number, // Assets Under Management (in Crores)
    expenseRatio: Number,
    exitLoad: Number,
    minInvestment: Number,
    sipMinAmount: Number,

    // Risk Metrics
    riskLevel: {
      type: String,
      enum: [
        'LOW',
        'LOW_TO_MODERATE',
        'MODERATE',
        'MODERATELY_HIGH',
        'HIGH',
        'VERY_HIGH',
      ],
    },
    riskMetrics: {
      volatility: Number,
      sharpeRatio: Number,
      beta: Number,
      alpha: Number,
    },

    // Ratings
    ratings: {
      morningstar: Number, // 1-5
      valueResearch: Number, // 1-5
      crisil: Number, // 1-5
    },

    // Fund Manager
    fundManager: {
      name: String,
      experience: Number,
      since: Date,
    },

    // Additional Information
    benchmark: String,
    inceptionDate: Date,
    launchDate: Date,

    // Status & Metadata
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    tags: [String],
    popularity: {
      type: Number,
      default: 0,
    },

    // Timestamps
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    collection: 'funds_enhanced',
  }
);

// Indexes for performance
fundEnhancedSchema.index({ category: 1, subCategory: 1 });
fundEnhancedSchema.index({ fundHouse: 1, category: 1 });
fundEnhancedSchema.index({ 'returns.oneYear': -1 });
fundEnhancedSchema.index({ 'returns.threeYear': -1 });
fundEnhancedSchema.index({ aum: -1 });
fundEnhancedSchema.index({ navDate: -1 });
fundEnhancedSchema.index({ isActive: 1, category: 1 });

// Text index for search
fundEnhancedSchema.index({ name: 'text', fundHouse: 'text' });

// Methods
fundEnhancedSchema.methods.toPublicJSON = function () {
  const obj = this.toObject();
  delete obj.__v;
  delete obj._id;
  return obj;
};

// Statics
fundEnhancedSchema.statics.findByCategory = function (category, options = {}) {
  const query = this.find({ category, isActive: true });
  if (options.limit) query.limit(options.limit);
  if (options.sort) query.sort(options.sort);
  return query;
};

fundEnhancedSchema.statics.findTopPerformers = function (
  category,
  period = 'oneYear',
  limit = 10
) {
  return this.find({
    category,
    isActive: true,
    [`returns.${period}`]: { $exists: true, $ne: null },
  })
    .sort({ [`returns.${period}`]: -1 })
    .limit(limit);
};

fundEnhancedSchema.statics.searchFunds = function (searchText, options = {}) {
  return this.find(
    {
      $text: { $search: searchText },
      isActive: true,
    },
    { score: { $meta: 'textScore' } }
  )
    .sort({ score: { $meta: 'textScore' } })
    .limit(options.limit || 20);
};

const FundEnhanced = mongoose.model('FundEnhanced', fundEnhancedSchema);

module.exports = FundEnhanced;
