/**
 * FundNav Model
 * Daily NAV history for all funds
 */

const mongoose = require('mongoose');

const fundNavSchema = new mongoose.Schema(
  {
    schemeCode: {
      type: String,
      required: true,
      index: true,
    },
    schemeName: {
      type: String,
      required: true,
    },

    // NAV Data
    nav: {
      type: Number,
      required: true,
    },
    date: {
      type: Date,
      required: true,
      index: true,
    },

    // Daily changes
    change: {
      value: Number,
      percent: Number,
    },

    // Trading status
    isTradingDay: {
      type: Boolean,
      default: true,
    },

    // Data source
    source: {
      type: String,
      default: 'AMFI',
    },
  },
  {
    timestamps: true,
    collection: 'fund_navs',
  }
);

// Compound indexes for efficient queries
fundNavSchema.index({ schemeCode: 1, date: -1 });
fundNavSchema.index({ date: -1, schemeCode: 1 });

// Unique constraint to prevent duplicate entries
fundNavSchema.index({ schemeCode: 1, date: 1 }, { unique: true });

// Static methods
fundNavSchema.statics.getLatestNav = function (schemeCode) {
  return this.findOne({ schemeCode }).sort({ date: -1 }).lean();
};

fundNavSchema.statics.getNavHistory = function (schemeCode, days = 365) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  return this.find({
    schemeCode,
    date: { $gte: startDate },
  })
    .sort({ date: 1 })
    .lean();
};

fundNavSchema.statics.getNavBetweenDates = function (
  schemeCode,
  startDate,
  endDate
) {
  return this.find({
    schemeCode,
    date: { $gte: startDate, $lte: endDate },
  })
    .sort({ date: 1 })
    .lean();
};

fundNavSchema.statics.getAllFundsLatestNav = function () {
  return this.aggregate([
    {
      $sort: { date: -1 },
    },
    {
      $group: {
        _id: '$schemeCode',
        latestNav: { $first: '$nav' },
        latestDate: { $first: '$date' },
        change: { $first: '$change' },
      },
    },
  ]);
};

// Calculate returns between two dates
fundNavSchema.statics.calculateReturns = async function (
  schemeCode,
  startDate,
  endDate
) {
  const navs = await this.find({
    schemeCode,
    date: { $gte: startDate, $lte: endDate },
  })
    .sort({ date: 1 })
    .limit(2)
    .lean();

  if (navs.length < 2) return null;

  const startNav = navs[0].nav;
  const endNav = navs[navs.length - 1].nav;

  return {
    startNav,
    endNav,
    returns: ((endNav - startNav) / startNav) * 100,
    startDate: navs[0].date,
    endDate: navs[navs.length - 1].date,
  };
};

const FundNav = mongoose.model('FundNav', fundNavSchema);

module.exports = FundNav;
