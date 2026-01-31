/**
 * Watchlist Model
 * Stores user's watchlist of mutual funds
 */

const mongoose = require('mongoose');

const watchlistSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    funds: [
      {
        schemeCode: {
          type: String,
          required: true,
        },
        addedAt: {
          type: Date,
          default: Date.now,
        },
        notes: {
          type: String,
          maxlength: 500,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Indexes
watchlistSchema.index({ 'funds.schemeCode': 1 });
watchlistSchema.index(
  { userId: 1, 'funds.schemeCode': 1 },
  { unique: true, sparse: true }
);

// Static methods
watchlistSchema.statics.getUserWatchlist = function (userId) {
  return this.findOne({ userId });
};

watchlistSchema.statics.addFundToWatchlist = async function (
  userId,
  schemeCode
) {
  let watchlist = await this.findOne({ userId });

  if (!watchlist) {
    watchlist = new this({
      userId,
      funds: [],
    });
  }

  // Check if already exists
  const exists = watchlist.funds.some((f) => f.schemeCode === schemeCode);
  if (exists) {
    throw new Error('Fund already in watchlist');
  }

  watchlist.funds.push({
    schemeCode,
    addedAt: new Date(),
  });

  await watchlist.save();
  return watchlist;
};

watchlistSchema.statics.removeFundFromWatchlist = async function (
  userId,
  schemeCode
) {
  const watchlist = await this.findOne({ userId });

  if (!watchlist) {
    throw new Error('Watchlist not found');
  }

  watchlist.funds = watchlist.funds.filter((f) => f.schemeCode !== schemeCode);
  await watchlist.save();
  return watchlist;
};

// Instance methods
watchlistSchema.methods.getFundCount = function () {
  return this.funds.length;
};

const Watchlist = mongoose.model('Watchlist', watchlistSchema);

module.exports = Watchlist;
