/**
 * NAV History Schema & Service
 * Stores daily NAV for last 5 years only (automatic cleanup)
 */

import mongoose from 'mongoose';
import moment from 'moment';

// NAV History Schema - Time-series style with 5-year retention
const navHistorySchema = new mongoose.Schema(
  {
    fundId: { type: String, required: true, index: true },
    amfiCode: { type: String, index: true },
    date: { type: Date, required: true },
    nav: { type: Number, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  {
    collection: 'mf_nav_history',
  }
);

// Compound index for efficient queries
navHistorySchema.index({ fundId: 1, date: -1 });
navHistorySchema.index({ amfiCode: 1, date: -1 });
navHistorySchema.index({ date: -1 });

// TTL index - auto-delete documents older than 5 years
navHistorySchema.index(
  { date: 1 },
  { expireAfterSeconds: 5 * 365 * 24 * 60 * 60 }
);

const NAVHistory = mongoose.model('NAVHistory', navHistorySchema);

// Returns Cache Schema - Latest calculated returns
const returnsLatestSchema = new mongoose.Schema(
  {
    fundId: { type: String, required: true, unique: true },
    amfiCode: String,
    return1Y: Number,
    return3Y: Number,
    return5Y: Number,
    currentNAV: Number,
    lastCalculated: { type: Date, default: Date.now },
  },
  {
    collection: 'mf_returns_latest',
  }
);

returnsLatestSchema.index({ fundId: 1 });
returnsLatestSchema.index({ lastCalculated: -1 });

const ReturnsLatest = mongoose.model('ReturnsLatest', returnsLatestSchema);

export class NAVService {
  /**
   * Add single NAV entry
   */
  static async addNAV(
    fundId: string,
    date: Date,
    nav: number,
    amfiCode?: string
  ) {
    return await NAVHistory.findOneAndUpdate(
      { fundId, date },
      {
        $set: { nav, amfiCode, createdAt: new Date() },
      },
      { upsert: true, new: true }
    );
  }

  /**
   * Bulk add NAV entries (daily update)
   */
  static async bulkAddNAVs(
    navs: Array<{
      fundId: string;
      amfiCode?: string;
      date: Date;
      nav: number;
    }>
  ) {
    const operations = navs.map((navEntry) => ({
      updateOne: {
        filter: { fundId: navEntry.fundId, date: navEntry.date },
        update: {
          $set: {
            nav: navEntry.nav,
            amfiCode: navEntry.amfiCode,
            createdAt: new Date(),
          },
        },
        upsert: true,
      },
    }));

    return await NAVHistory.bulkWrite(operations);
  }

  /**
   * Get NAV for specific date (or closest previous date)
   */
  static async getNAVForDate(fundId: string, targetDate: Date) {
    return await NAVHistory.findOne({
      fundId,
      date: { $lte: targetDate },
    }).sort({ date: -1 });
  }

  /**
   * Get NAV history for a fund (last N days)
   */
  static async getNAVHistory(fundId: string, days: number = 365) {
    const startDate = moment().subtract(days, 'days').toDate();

    return await NAVHistory.find({
      fundId,
      date: { $gte: startDate },
    }).sort({ date: 1 });
  }

  /**
   * Calculate returns (1Y, 3Y, 5Y) for a fund
   */
  static async calculateReturns(fundId: string) {
    const today = new Date();
    const currentNAV = await this.getNAVForDate(fundId, today);

    if (!currentNAV) {
      return null;
    }

    // Get NAVs for 1Y, 3Y, 5Y ago
    const nav1YAgo = await this.getNAVForDate(
      fundId,
      moment().subtract(1, 'year').toDate()
    );

    const nav3YAgo = await this.getNAVForDate(
      fundId,
      moment().subtract(3, 'years').toDate()
    );

    const nav5YAgo = await this.getNAVForDate(
      fundId,
      moment().subtract(5, 'years').toDate()
    );

    // Calculate percentage returns
    const calculateReturn = (oldNAV: number | null, currentNav: number) => {
      if (!oldNAV) return null;
      return ((currentNav - oldNAV) / oldNAV) * 100;
    };

    return {
      fundId,
      amfiCode: currentNAV.amfiCode,
      currentNAV: currentNAV.nav,
      return1Y: calculateReturn(nav1YAgo?.nav || null, currentNAV.nav),
      return3Y: calculateReturn(nav3YAgo?.nav || null, currentNAV.nav),
      return5Y: calculateReturn(nav5YAgo?.nav || null, currentNAV.nav),
      lastCalculated: new Date(),
    };
  }

  /**
   * Calculate and store returns for a fund
   */
  static async updateReturns(fundId: string) {
    const returns = await this.calculateReturns(fundId);

    if (!returns) {
      return null;
    }

    return await ReturnsLatest.findOneAndUpdate(
      { fundId },
      { $set: returns },
      { upsert: true, new: true }
    );
  }

  /**
   * Bulk calculate and store returns for all funds
   */
  static async bulkUpdateReturns(fundIds: string[]) {
    const results = [];

    for (const fundId of fundIds) {
      try {
        const result = await this.updateReturns(fundId);
        results.push(result);
      } catch (error) {
        console.error(`Error calculating returns for ${fundId}:`, error);
      }
    }

    return results;
  }

  /**
   * Get latest returns for a fund
   */
  static async getReturns(fundId: string) {
    return await ReturnsLatest.findOne({ fundId });
  }

  /**
   * Get latest returns for multiple funds
   */
  static async getMultipleReturns(fundIds: string[]) {
    return await ReturnsLatest.find({ fundId: { $in: fundIds } });
  }

  /**
   * Clean up old NAV data (manual trigger, backup for TTL)
   */
  static async cleanupOldNAVs() {
    const fiveYearsAgo = moment().subtract(5, 'years').toDate();

    const result = await NAVHistory.deleteMany({
      date: { $lt: fiveYearsAgo },
    });

    return result;
  }

  /**
   * Get NAV count for a fund
   */
  static async getNAVCount(fundId: string): Promise<number> {
    return await NAVHistory.countDocuments({ fundId });
  }

  /**
   * Get latest NAV for a fund
   */
  static async getLatestNAV(fundId: string) {
    return await NAVHistory.findOne({ fundId }).sort({ date: -1 });
  }
}

export default NAVService;
