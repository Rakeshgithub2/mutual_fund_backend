/**
 * Graph Data Service
 * Stores weekly aggregated NAV points for smooth line charts
 * 1Y: ~52 points, 3Y: ~156 points, 5Y: ~260 points
 */

import mongoose from 'mongoose';
import moment from 'moment';
import NAVService from './nav.service';

// Graph Data Schema
const navGraphSchema = new mongoose.Schema(
  {
    fundId: { type: String, required: true },
    period: { type: String, required: true, enum: ['1Y', '3Y', '5Y'] },
    points: [
      {
        date: Date,
        nav: Number,
      },
    ],
    lastAggregated: { type: Date, default: Date.now },
  },
  {
    collection: 'mf_nav_graph',
  }
);

navGraphSchema.index({ fundId: 1, period: 1 }, { unique: true });
navGraphSchema.index({ lastAggregated: -1 });

const NAVGraph = mongoose.model('NAVGraph', navGraphSchema);

export class GraphDataService {
  /**
   * Aggregate NAV data weekly for graph rendering
   */
  static async aggregateGraphData(fundId: string, period: '1Y' | '3Y' | '5Y') {
    // Determine date range
    const periodMap = {
      '1Y': 1,
      '3Y': 3,
      '5Y': 5,
    };

    const yearsBack = periodMap[period];
    const startDate = moment().subtract(yearsBack, 'years').toDate();

    // Get all NAV data for the period
    const navData = await NAVService.getNAVHistory(fundId, yearsBack * 365);

    if (navData.length === 0) {
      return null;
    }

    // Group by week and take the latest NAV of each week
    const weeklyPoints = this.groupByWeek(navData);

    // Store aggregated data
    return await NAVGraph.findOneAndUpdate(
      { fundId, period },
      {
        $set: {
          points: weeklyPoints,
          lastAggregated: new Date(),
        },
      },
      { upsert: true, new: true }
    );
  }

  /**
   * Group NAV data by week (take last NAV of each week)
   */
  private static groupByWeek(
    navData: any[]
  ): Array<{ date: Date; nav: number }> {
    const weekMap = new Map<string, { date: Date; nav: number }>();

    navData.forEach((nav) => {
      const weekKey = moment(nav.date).startOf('week').format('YYYY-WW');

      // Keep the latest NAV of the week
      if (!weekMap.has(weekKey) || nav.date > weekMap.get(weekKey)!.date) {
        weekMap.set(weekKey, {
          date: nav.date,
          nav: nav.nav,
        });
      }
    });

    // Convert to array and sort by date
    return Array.from(weekMap.values()).sort(
      (a, b) => a.date.getTime() - b.date.getTime()
    );
  }

  /**
   * Bulk aggregate for multiple funds
   */
  static async bulkAggregateGraphData(fundIds: string[]) {
    const periods: Array<'1Y' | '3Y' | '5Y'> = ['1Y', '3Y', '5Y'];
    const results = [];

    for (const fundId of fundIds) {
      for (const period of periods) {
        try {
          const result = await this.aggregateGraphData(fundId, period);
          if (result) {
            results.push(result);
          }
        } catch (error) {
          console.error(
            `Error aggregating graph data for ${fundId} (${period}):`,
            error
          );
        }
      }
    }

    return results;
  }

  /**
   * Get graph data for a fund
   */
  static async getGraphData(fundId: string, period: '1Y' | '3Y' | '5Y') {
    const graphData = await NAVGraph.findOne({ fundId, period });

    // If data doesn't exist or is stale (> 7 days), regenerate
    if (!graphData || this.isStale(graphData.lastAggregated)) {
      return await this.aggregateGraphData(fundId, period);
    }

    return graphData;
  }

  /**
   * Check if graph data is stale
   */
  private static isStale(lastAggregated: Date): boolean {
    const daysSinceUpdate = moment().diff(moment(lastAggregated), 'days');
    return daysSinceUpdate > 7;
  }

  /**
   * Get all graph periods for a fund
   */
  static async getAllGraphData(fundId: string) {
    const [data1Y, data3Y, data5Y] = await Promise.all([
      this.getGraphData(fundId, '1Y'),
      this.getGraphData(fundId, '3Y'),
      this.getGraphData(fundId, '5Y'),
    ]);

    return {
      '1Y': data1Y,
      '3Y': data3Y,
      '5Y': data5Y,
    };
  }

  /**
   * Delete graph data for a fund
   */
  static async deleteGraphData(fundId: string) {
    return await NAVGraph.deleteMany({ fundId });
  }

  /**
   * Get statistics about graph data
   */
  static async getGraphStats() {
    const stats = await NAVGraph.aggregate([
      {
        $group: {
          _id: '$period',
          count: { $sum: 1 },
          avgPointCount: { $avg: { $size: '$points' } },
        },
      },
    ]);

    return stats;
  }

  /**
   * Clean up stale graph data (older than 30 days)
   */
  static async cleanupStaleData() {
    const thirtyDaysAgo = moment().subtract(30, 'days').toDate();

    return await NAVGraph.deleteMany({
      lastAggregated: { $lt: thirtyDaysAgo },
    });
  }
}

export default GraphDataService;
