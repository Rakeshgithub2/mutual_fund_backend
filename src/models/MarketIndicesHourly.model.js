/**
 * MARKET INDICES DATA
 * Updated: Every Hour during trading hours
 * Cached in Redis for real-time access
 */

const mongoose = require('mongoose');

const marketIndicesHourlySchema = new mongoose.Schema(
  {
    // Index Identifier
    indexCode: {
      type: String,
      required: true,
      index: true,
      enum: [
        'NIFTY50',
        'SENSEX',
        'NIFTY100',
        'NIFTY200',
        'NIFTYMIDCAP100',
        'NIFTYSMALLCAP100',
        'NIFTYBANK',
        'NIFTYIT',
        'NIFTYFMCG',
        'NIFTYPHARMA',
        'NIFTYAUTO',
        'NIFTYMETAL',
        'NIFTYREALTY',
        'GIFTNIFTY',
      ],
    },
    indexName: {
      type: String,
      required: true,
    },

    // Price Data
    currentValue: {
      type: Number,
      required: true,
    },
    openValue: {
      type: Number,
      required: true,
    },
    highValue: {
      type: Number,
      required: true,
    },
    lowValue: {
      type: Number,
      required: true,
    },
    previousClose: {
      type: Number,
      required: true,
    },

    // Changes
    change: {
      type: Number,
      required: true,
      description: 'Absolute change',
    },
    changePercent: {
      type: Number,
      required: true,
      description: 'Percentage change',
    },

    // Volume
    volume: {
      type: Number,
      default: null,
    },

    // Timestamp
    timestamp: {
      type: Date,
      required: true,
      index: true,
    },
    tradingDate: {
      type: Date,
      required: true,
      index: true,
    },

    // Market Status
    marketStatus: {
      type: String,
      enum: ['OPEN', 'CLOSED', 'PRE_OPEN', 'POST_CLOSE'],
      default: 'CLOSED',
    },
    isHoliday: {
      type: Boolean,
      default: false,
    },

    // Data Quality
    dataSource: {
      type: String,
      default: 'NSE',
      enum: ['NSE', 'BSE', 'Yahoo', 'Manual'],
    },
    isLive: {
      type: Boolean,
      default: true,
    },

    // Metadata
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    collection: 'market_indices_hourly',
    timestamps: false,
  }
);

// Compound indexes
marketIndicesHourlySchema.index({ indexCode: 1, timestamp: -1 });
marketIndicesHourlySchema.index({ tradingDate: -1, indexCode: 1 });
marketIndicesHourlySchema.index({ timestamp: -1 });

// Unique constraint
marketIndicesHourlySchema.index(
  { indexCode: 1, timestamp: 1 },
  { unique: true }
);

// TTL index to auto-delete old data after 90 days
marketIndicesHourlySchema.index(
  { timestamp: 1 },
  { expireAfterSeconds: 7776000 }
); // 90 days

const MarketIndicesHourly = mongoose.model(
  'MarketIndicesHourly',
  marketIndicesHourlySchema
);

module.exports = MarketIndicesHourly;
