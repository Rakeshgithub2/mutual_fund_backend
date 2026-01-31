/**
 * ═══════════════════════════════════════════════════════════════════════
 * MARKET INDICES MODEL
 * ═══════════════════════════════════════════════════════════════════════
 */

const mongoose = require('mongoose');

const marketIndicesSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      enum: [
        'nifty50',
        'sensex',
        'niftymidcap',
        'niftysmallcap',
        'niftybank',
        'niftyit',
        'niftypharma',
        'niftyauto',
        'niftyfmcg',
        'niftymetal',
        'commodity',
        'giftnifty',
      ],
      index: true,
    },
    value: {
      type: Number,
      required: true,
    },
    change: {
      type: Number,
      required: true,
    },
    percent_change: {
      type: Number,
      required: true,
    },
    updated_at: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    collection: 'marketindices',
  }
);

// Index for efficient queries
marketIndicesSchema.index({ updated_at: -1 });

module.exports = mongoose.model('MarketIndices', marketIndicesSchema);
