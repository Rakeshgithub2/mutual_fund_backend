/**
 * Fund Model
 * Core mutual fund data with comprehensive fields
 */

const mongoose = require('mongoose');

const fundSchema = new mongoose.Schema(
  {
    // Basic Information
    schemeCode: {
      type: String,
      required: false, // Not required for imported funds
      unique: true,
      sparse: true, // Only enforce uniqueness when field exists (allows multiple nulls)
      index: true,
    },
    schemeName: {
      type: String,
      required: false, // Optional for imported funds that use 'name' field instead
    },
    isinDivPayout: String,
    isinDivReinvestment: String,
    isinGrowth: String,

    // AMC Information
    amc: {
      name: {
        type: String,
        required: true,
        index: true,
      },
      logo: String,
    },

    // Classification
    category: {
      type: String,
      required: true,
      index: true,
      enum: [
        'equity',
        'debt',
        'hybrid',
        'solution oriented',
        'other',
        'commodity',
      ],
    },
    subCategory: {
      type: String,
      index: true,
    },

    // Fund Characteristics
    benchmark: {
      name: String,
      index: String,
    },
    riskLevel: {
      type: String,
      enum: [
        'low',
        'low to moderate',
        'moderate',
        'moderately high',
        'high',
        'very high',
      ],
      index: true,
    },

    // Financial Data
    nav: {
      value: Number,
      date: Date,
      change: Number,
      changePercent: Number,
    },

    aum: {
      value: Number,
      date: Date,
      currency: {
        type: String,
        default: 'INR',
      },
    },

    // Performance Metrics
    returns: {
      '1D': Number,
      '1W': Number,
      '1M': Number,
      '3M': Number,
      '6M': Number,
      '1Y': Number,
      '3Y': Number,
      '5Y': Number,
      sinceInception: Number,
    },

    // Rolling Returns (for detailed analysis)
    rollingReturns: {
      '1Y': [Number],
      '3Y': [Number],
      '5Y': [Number],
    },

    // Costs
    expenseRatio: {
      value: Number,
      date: Date,
    },
    exitLoad: {
      value: String,
      description: String,
    },

    // Fund Manager
    fundManager: {
      name: String,
      experience: Number,
      since: Date,
    },

    // Investment Details
    minInvestment: {
      lumpsum: Number,
      sip: Number,
    },

    inceptionDate: {
      type: Date,
      index: true,
    },

    // Status
    status: {
      type: String,
      enum: ['Active', 'Suspended', 'Closed'],
      default: 'Active',
      index: true,
    },

    // Rankings
    categoryRank: Number,
    totalFundsInCategory: Number,

    // Additional metadata
    metadata: {
      lastUpdated: Date,
      dataSource: String,
      completeness: {
        type: Number,
        default: 0,
        min: 0,
        max: 100,
      },
    },
  },
  {
    timestamps: true,
    collection: 'funds',
  }
);

// Indexes for performance
fundSchema.index({ category: 1, subCategory: 1 });
fundSchema.index({ category: 1, subcategory: 1 }); // Support lowercase subcategory
fundSchema.index({ 'amc.name': 1, category: 1 });
fundSchema.index({ status: 1, category: 1 });
fundSchema.index({ schemeCode: 1, status: 1 });
fundSchema.index({ 'nav.date': -1 });
fundSchema.index({ 'returns.1Y': -1 });
fundSchema.index({ 'returns.3Y': -1 });
fundSchema.index({ categoryRank: 1 });

// Text index for search - Using only schemeName to match existing index
fundSchema.index({ schemeName: 'text' });

// Virtual for NAV trend
fundSchema.virtual('navTrend').get(function () {
  if (this.nav && this.nav.changePercent) {
    return this.nav.changePercent > 0
      ? 'up'
      : this.nav.changePercent < 0
        ? 'down'
        : 'neutral';
  }
  return 'neutral';
});

// Methods
fundSchema.methods.calculateCompleteness = function () {
  const fields = [
    'schemeCode',
    'schemeName',
    'amc.name',
    'category',
    'subCategory',
    'nav.value',
    'aum.value',
    'expenseRatio.value',
    'inceptionDate',
    'fundManager.name',
    'riskLevel',
    'benchmark.name',
  ];

  let completed = 0;
  fields.forEach((field) => {
    if (this.get(field)) completed++;
  });

  return Math.round((completed / fields.length) * 100);
};

fundSchema.methods.toPublicJSON = function () {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

// Statics
fundSchema.statics.findByCategory = function (category, options = {}) {
  const query = this.find({ category, status: 'Active' });

  if (options.limit) query.limit(options.limit);
  if (options.sort) query.sort(options.sort);

  return query;
};

fundSchema.statics.findTopPerformers = function (
  category,
  period = '1Y',
  limit = 10
) {
  return this.find({
    category,
    status: 'Active',
    [`returns.${period}`]: { $exists: true, $ne: null },
  })
    .sort({ [`returns.${period}`]: -1 })
    .limit(limit);
};

fundSchema.statics.searchFunds = function (searchText, options = {}) {
  return this.find(
    {
      $text: { $search: searchText },
      status: 'Active',
    },
    { score: { $meta: 'textScore' } }
  )
    .sort({ score: { $meta: 'textScore' } })
    .limit(options.limit || 20);
};

const Fund = mongoose.model('Fund', fundSchema);

module.exports = Fund;
