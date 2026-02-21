/**
 * ═══════════════════════════════════════════════════════════════════════
 * MARKET NEWS MODEL
 * ═══════════════════════════════════════════════════════════════════════
 */

const mongoose = require('mongoose');

const marketNewsSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    content: {
      type: String,
      default: '',
    },
    source: {
      type: String,
      required: true,
    },
    url: {
      type: String,
      required: true,
      unique: true,
    },
    category: {
      type: String,
      enum: ['stock', 'mutualfund', 'gold', 'finance'],
      default: 'finance',
      index: true,
    },
    published_at: {
      type: Date,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: 'marketnews',
  }
);

// Index for efficient queries
marketNewsSchema.index({ published_at: -1 });
marketNewsSchema.index({ category: 1, published_at: -1 });

module.exports = mongoose.model('MarketNews', marketNewsSchema);
