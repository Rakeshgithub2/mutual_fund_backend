/**
 * ═══════════════════════════════════════════════════════════════════════
 * MARKET INDICES HISTORY MODEL - MongoDB Schema
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Stores historical market index data for:
 * - Intraday charts (5-minute candles)
 * - Daily OHLC data
 * - Trend analysis
 *
 * Indexes optimized for:
 * - Symbol + timestamp range queries
 * - TTL auto-cleanup for old intraday data
 */

const mongoose = require('mongoose');

const marketIndexHistorySchema = new mongoose.Schema(
  {
    // Index identifier
    symbol: {
      type: String,
      required: true,
      uppercase: true,
      index: true,
    },

    // Human-readable name
    name: {
      type: String,
      required: true,
    },

    // Price data
    value: {
      type: Number,
      required: true,
    },

    // Change from previous close
    change: {
      type: Number,
      default: 0,
    },

    // Percent change
    percentChange: {
      type: Number,
      default: 0,
    },

    // OHLC for the period
    open: Number,
    high: Number,
    low: Number,
    close: Number,

    // Previous session close
    previousClose: Number,

    // Volume (if available)
    volume: Number,

    // Data source
    source: {
      type: String,
      enum: ['NSE', 'YAHOO', 'RAPIDAPI', 'MOCK'],
      default: 'YAHOO',
    },

    // Market status at time of capture
    marketStatus: {
      type: String,
      enum: ['PRE_OPEN', 'OPEN', 'CLOSED', 'HOLIDAY'],
      default: 'OPEN',
    },

    // Timestamp of the data point
    timestamp: {
      type: Date,
      required: true,
      // Note: Don't use index: true here - TTL index handles this
    },

    // Date only (for daily aggregation)
    date: {
      type: String, // YYYY-MM-DD format
      required: true,
      index: true,
    },

    // Time granularity
    granularity: {
      type: String,
      enum: ['5MIN', 'HOURLY', 'DAILY'],
      default: '5MIN',
    },
  },
  {
    timestamps: true,
    collection: 'market_indices_history',
  }
);

// Compound indexes for efficient queries
marketIndexHistorySchema.index({ symbol: 1, timestamp: -1 });
marketIndexHistorySchema.index({ symbol: 1, date: 1, granularity: 1 });
marketIndexHistorySchema.index({ symbol: 1, granularity: 1, timestamp: -1 });

// TTL index - auto-delete intraday data older than 7 days
// Daily data will have granularity='DAILY' and won't be affected
marketIndexHistorySchema.index(
  { timestamp: 1 },
  {
    expireAfterSeconds: 7 * 24 * 60 * 60, // 7 days
    partialFilterExpression: { granularity: '5MIN' },
  }
);

// Static methods
marketIndexHistorySchema.statics.getLatestBySymbol = function (symbol) {
  return this.findOne({ symbol: symbol.toUpperCase() })
    .sort({ timestamp: -1 })
    .lean();
};

marketIndexHistorySchema.statics.getIntradayData = function (
  symbol,
  date = null
) {
  const targetDate = date || new Date().toISOString().split('T')[0];
  return this.find({
    symbol: symbol.toUpperCase(),
    date: targetDate,
    granularity: '5MIN',
  })
    .sort({ timestamp: 1 })
    .lean();
};

marketIndexHistorySchema.statics.getDailyData = function (symbol, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  return this.find({
    symbol: symbol.toUpperCase(),
    granularity: 'DAILY',
    timestamp: { $gte: startDate },
  })
    .sort({ timestamp: 1 })
    .lean();
};

marketIndexHistorySchema.statics.bulkUpsertSnapshot = async function (
  indicesData
) {
  const bulkOps = indicesData.map((index) => ({
    updateOne: {
      filter: {
        symbol: index.symbol,
        timestamp: index.timestamp,
        granularity: index.granularity || '5MIN',
      },
      update: { $set: index },
      upsert: true,
    },
  }));

  if (bulkOps.length > 0) {
    return this.bulkWrite(bulkOps, { ordered: false });
  }
  return null;
};

module.exports = mongoose.model('MarketIndexHistory', marketIndexHistorySchema);
