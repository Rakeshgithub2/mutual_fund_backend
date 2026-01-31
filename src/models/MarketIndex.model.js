/**
 * MarketIndex Model
 * Market indices data with intraday updates
 */

const mongoose = require('mongoose');

const marketIndexSchema = new mongoose.Schema(
  {
    symbol: {
      type: String,
      required: true,
      unique: true,
      index: true,
      uppercase: true,
    },
    name: {
      type: String,
      required: true,
    },

    // Current data
    value: {
      type: Number,
      required: true,
    },
    change: {
      value: Number,
      percent: Number,
    },

    // Session data
    open: Number,
    high: Number,
    low: Number,
    close: Number,
    previousClose: Number,

    // Volume
    volume: Number,

    // Timestamp
    lastUpdated: {
      type: Date,
      required: true,
      index: true,
    },

    // Market status
    marketStatus: {
      type: String,
      enum: ['PRE_OPEN', 'OPEN', 'CLOSED', 'HOLIDAY'],
      default: 'CLOSED',
    },

    // Index category
    category: {
      type: String,
      enum: ['BROAD_MARKET', 'SECTORAL', 'THEMATIC', 'STRATEGY'],
      default: 'BROAD_MARKET',
      index: true,
    },

    // Exchange
    exchange: {
      type: String,
      enum: ['NSE', 'BSE'],
      default: 'NSE',
    },

    // Historical high/low
    weekHigh52: Number,
    weekLow52: Number,

    // Metadata
    displayOrder: Number,
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    collection: 'market_indices',
  }
);

// Indexes
marketIndexSchema.index({ symbol: 1, lastUpdated: -1 });
marketIndexSchema.index({ category: 1, displayOrder: 1 });
marketIndexSchema.index({ marketStatus: 1, isActive: 1 });

// Static methods
marketIndexSchema.statics.getActiveIndices = function () {
  return this.find({ isActive: true }).sort({ displayOrder: 1 }).lean();
};

marketIndexSchema.statics.getBroadMarketIndices = function () {
  return this.find({
    category: 'BROAD_MARKET',
    isActive: true,
  })
    .sort({ displayOrder: 1 })
    .lean();
};

marketIndexSchema.statics.getSectoralIndices = function () {
  return this.find({
    category: 'SECTORAL',
    isActive: true,
  })
    .sort({ name: 1 })
    .lean();
};

marketIndexSchema.statics.getIndexBySymbol = function (symbol) {
  return this.findOne({
    symbol: symbol.toUpperCase(),
    isActive: true,
  }).lean();
};

marketIndexSchema.statics.bulkUpdateIndices = async function (indicesData) {
  const bulkOps = indicesData.map((data) => ({
    updateOne: {
      filter: { symbol: data.symbol.toUpperCase() },
      update: {
        $set: {
          value: data.value,
          change: data.change,
          open: data.open,
          high: data.high,
          low: data.low,
          close: data.close,
          volume: data.volume,
          lastUpdated: new Date(),
          marketStatus: data.marketStatus || 'CLOSED',
        },
      },
      upsert: true,
    },
  }));

  return this.bulkWrite(bulkOps);
};

// Methods
marketIndexSchema.methods.isMarketOpen = function () {
  return this.marketStatus === 'OPEN' || this.marketStatus === 'PRE_OPEN';
};

marketIndexSchema.methods.getPerformance = function () {
  return {
    symbol: this.symbol,
    name: this.name,
    value: this.value,
    change: this.change,
    trend:
      this.change.percent > 0
        ? 'up'
        : this.change.percent < 0
          ? 'down'
          : 'neutral',
  };
};

const MarketIndex = mongoose.model('MarketIndex', marketIndexSchema);

module.exports = MarketIndex;
