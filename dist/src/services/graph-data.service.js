"use strict";
/**
 * Graph Data Service
 * Stores weekly aggregated NAV points for smooth line charts
 * 1Y: ~52 points, 3Y: ~156 points, 5Y: ~260 points
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GraphDataService = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const moment_1 = __importDefault(require("moment"));
const nav_service_1 = __importDefault(require("./nav.service"));
// Graph Data Schema
const navGraphSchema = new mongoose_1.default.Schema({
    fundId: { type: String, required: true },
    period: { type: String, required: true, enum: ['1Y', '3Y', '5Y'] },
    points: [
        {
            date: Date,
            nav: Number,
        },
    ],
    lastAggregated: { type: Date, default: Date.now },
}, {
    collection: 'mf_nav_graph',
});
navGraphSchema.index({ fundId: 1, period: 1 }, { unique: true });
navGraphSchema.index({ lastAggregated: -1 });
const NAVGraph = mongoose_1.default.model('NAVGraph', navGraphSchema);
class GraphDataService {
    /**
     * Aggregate NAV data weekly for graph rendering
     */
    static async aggregateGraphData(fundId, period) {
        // Determine date range
        const periodMap = {
            '1Y': 1,
            '3Y': 3,
            '5Y': 5,
        };
        const yearsBack = periodMap[period];
        const startDate = (0, moment_1.default)().subtract(yearsBack, 'years').toDate();
        // Get all NAV data for the period
        const navData = await nav_service_1.default.getNAVHistory(fundId, yearsBack * 365);
        if (navData.length === 0) {
            return null;
        }
        // Group by week and take the latest NAV of each week
        const weeklyPoints = this.groupByWeek(navData);
        // Store aggregated data
        return await NAVGraph.findOneAndUpdate({ fundId, period }, {
            $set: {
                points: weeklyPoints,
                lastAggregated: new Date(),
            },
        }, { upsert: true, new: true });
    }
    /**
     * Group NAV data by week (take last NAV of each week)
     */
    static groupByWeek(navData) {
        const weekMap = new Map();
        navData.forEach((nav) => {
            const weekKey = (0, moment_1.default)(nav.date).startOf('week').format('YYYY-WW');
            // Keep the latest NAV of the week
            if (!weekMap.has(weekKey) || nav.date > weekMap.get(weekKey).date) {
                weekMap.set(weekKey, {
                    date: nav.date,
                    nav: nav.nav,
                });
            }
        });
        // Convert to array and sort by date
        return Array.from(weekMap.values()).sort((a, b) => a.date.getTime() - b.date.getTime());
    }
    /**
     * Bulk aggregate for multiple funds
     */
    static async bulkAggregateGraphData(fundIds) {
        const periods = ['1Y', '3Y', '5Y'];
        const results = [];
        for (const fundId of fundIds) {
            for (const period of periods) {
                try {
                    const result = await this.aggregateGraphData(fundId, period);
                    if (result) {
                        results.push(result);
                    }
                }
                catch (error) {
                    console.error(`Error aggregating graph data for ${fundId} (${period}):`, error);
                }
            }
        }
        return results;
    }
    /**
     * Get graph data for a fund
     */
    static async getGraphData(fundId, period) {
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
    static isStale(lastAggregated) {
        const daysSinceUpdate = (0, moment_1.default)().diff((0, moment_1.default)(lastAggregated), 'days');
        return daysSinceUpdate > 7;
    }
    /**
     * Get all graph periods for a fund
     */
    static async getAllGraphData(fundId) {
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
    static async deleteGraphData(fundId) {
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
        const thirtyDaysAgo = (0, moment_1.default)().subtract(30, 'days').toDate();
        return await NAVGraph.deleteMany({
            lastAggregated: { $lt: thirtyDaysAgo },
        });
    }
}
exports.GraphDataService = GraphDataService;
exports.default = GraphDataService;
