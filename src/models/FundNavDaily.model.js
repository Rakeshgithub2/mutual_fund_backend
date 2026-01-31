/**
 * DAILY NAV DATA
 * Updated: Every Trading Day
 * Cached in Redis for fast access
 */

const mongoose = require('mongoose');

const fundNavDailySchema = new mongoose.Schema(
  {
    fundCode: {
      type: String,
      required: true,
      index: true,
    },

    // NAV Information
    nav: {
      type: Number,
      required: true,
    },
    navDate: {
      type: Date,
      required: true,
      index: true,
    },

    // Short-term Returns
    dayReturn: {
      type: Number,
      default: null,
      description: '1-day return percentage',
    },
    weekReturn: {
      type: Number,
      default: null,
      description: '1-week return percentage',
    },
    monthReturn: {
      type: Number,
      default: null,
      description: '1-month return percentage',
    },

    // Previous Values for Comparison
    previousNav: {
      type: Number,
      default: null,
    },
    navChange: {
      type: Number,
      default: null,
      description: 'Absolute NAV change',
    },
    navChangePercent: {
      type: Number,
      default: null,
      description: 'Percentage NAV change',
    },

    // Data Quality
    isVerified: {
      type: Boolean,
      default: true,
    },
    dataSource: {
      type: String,
      default: 'AMFI',
      enum: ['AMFI', 'NSE', 'BSE', 'Manual'],
    },

    // Metadata
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    collection: 'fund_nav_daily',
    timestamps: false, // Using custom updatedAt
  }
);

// Compound indexes for efficient queries
fundNavDailySchema.index({ fundCode: 1, navDate: -1 });
fundNavDailySchema.index({ navDate: -1 });

// Unique constraint to prevent duplicate NAV entries
fundNavDailySchema.index({ fundCode: 1, navDate: 1 }, { unique: true });

// TTL index to auto-delete old data after 2 years
fundNavDailySchema.index({ navDate: 1 }, { expireAfterSeconds: 63072000 }); // 2 years

const FundNavDaily = mongoose.model('FundNavDaily', fundNavDailySchema);

module.exports = FundNavDaily;
