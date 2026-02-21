"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WatchlistModel = exports.WatchlistSchema = void 0;
const zod_1 = require("zod");
// Lazy import to avoid circular dependency
let mongodb = null;
function getMongoDB() {
    if (!mongodb) {
        mongodb = require('../db/mongodb').mongodb;
    }
    return mongodb;
}
/**
 * Zod validation schema for Watchlist
 */
exports.WatchlistSchema = zod_1.z.object({
    userId: zod_1.z.string().min(1, 'User ID is required'),
    fundId: zod_1.z.string().min(1, 'Fund ID is required'),
    fundName: zod_1.z.string().min(1, 'Fund name is required'),
    addedAt: zod_1.z.date(),
    // Price Alerts
    priceAlerts: zod_1.z.array(zod_1.z.object({
        type: zod_1.z.enum(['above', 'below', 'change_percent']),
        value: zod_1.z.number(),
        isActive: zod_1.z.boolean().default(true),
        triggeredAt: zod_1.z.date().optional(),
    })),
    notes: zod_1.z.string().optional(),
});
/**
 * Watchlist Model Class
 * Manages user watchlists and price alerts
 */
class WatchlistModel {
    constructor() {
        this._collection = null;
        // Don't initialize collection here - do it lazily
    }
    get collection() {
        if (!this._collection) {
            const db = getMongoDB();
            this._collection = db.getCollection('watchlists');
        }
        return this._collection;
    }
    static getInstance() {
        if (!WatchlistModel.instance) {
            WatchlistModel.instance = new WatchlistModel();
        }
        return WatchlistModel.instance;
    }
    /**
     * Add fund to watchlist
     */
    async add(watchlistData) {
        const watchlist = {
            ...watchlistData,
            addedAt: watchlistData.addedAt || new Date(),
            priceAlerts: watchlistData.priceAlerts || [],
        };
        const result = await this.collection.insertOne(watchlist);
        return { ...watchlist, _id: result.insertedId.toString() };
    }
    /**
     * Remove fund from watchlist
     */
    async remove(userId, fundId) {
        const result = await this.collection.deleteOne({ userId, fundId });
        return result.deletedCount > 0;
    }
    /**
     * Check if fund is in watchlist
     */
    async exists(userId, fundId) {
        const count = await this.collection.countDocuments({ userId, fundId });
        return count > 0;
    }
    /**
     * Get user's watchlist
     */
    async getUserWatchlist(userId, options = {}) {
        const sort = {};
        if (options.sortBy === 'name') {
            sort.fundName = 1;
        }
        else {
            sort.addedAt = -1;
        }
        return await this.collection
            .find({ userId })
            .sort(sort)
            .limit(options.limit || 100)
            .skip(options.skip || 0)
            .toArray();
    }
    /**
     * Get watchlist count for user
     */
    async getUserWatchlistCount(userId) {
        return await this.collection.countDocuments({ userId });
    }
    /**
     * Get all users watching a specific fund
     */
    async getUsersWatchingFund(fundId) {
        return await this.collection.find({ fundId }).toArray();
    }
    /**
     * Add price alert
     */
    async addPriceAlert(userId, fundId, alert) {
        const alertData = {
            ...alert,
            isActive: true,
        };
        const result = await this.collection.findOneAndUpdate({ userId, fundId }, {
            $push: { priceAlerts: alertData },
        }, { returnDocument: 'after' });
        return result || null;
    }
    /**
     * Remove price alert
     */
    async removePriceAlert(userId, fundId, alertIndex) {
        const watchlist = await this.collection.findOne({ userId, fundId });
        if (!watchlist || !watchlist.priceAlerts[alertIndex]) {
            return null;
        }
        watchlist.priceAlerts.splice(alertIndex, 1);
        const result = await this.collection.findOneAndUpdate({ userId, fundId }, { $set: { priceAlerts: watchlist.priceAlerts } }, { returnDocument: 'after' });
        return result || null;
    }
    /**
     * Toggle price alert
     */
    async togglePriceAlert(userId, fundId, alertIndex) {
        const watchlist = await this.collection.findOne({ userId, fundId });
        if (!watchlist || !watchlist.priceAlerts[alertIndex]) {
            return null;
        }
        watchlist.priceAlerts[alertIndex].isActive =
            !watchlist.priceAlerts[alertIndex].isActive;
        const result = await this.collection.findOneAndUpdate({ userId, fundId }, { $set: { priceAlerts: watchlist.priceAlerts } }, { returnDocument: 'after' });
        return result || null;
    }
    /**
     * Trigger price alert
     */
    async triggerAlert(userId, fundId, alertIndex) {
        const watchlist = await this.collection.findOne({ userId, fundId });
        if (!watchlist || !watchlist.priceAlerts[alertIndex]) {
            return null;
        }
        watchlist.priceAlerts[alertIndex].triggeredAt = new Date();
        const result = await this.collection.findOneAndUpdate({ userId, fundId }, { $set: { priceAlerts: watchlist.priceAlerts } }, { returnDocument: 'after' });
        return result || null;
    }
    /**
     * Get active price alerts
     */
    async getActiveAlerts(userId) {
        const filter = {
            priceAlerts: {
                $elemMatch: { isActive: true },
            },
        };
        if (userId) {
            filter.userId = userId;
        }
        return await this.collection.find(filter).toArray();
    }
    /**
     * Update notes
     */
    async updateNotes(userId, fundId, notes) {
        const result = await this.collection.findOneAndUpdate({ userId, fundId }, { $set: { notes } }, { returnDocument: 'after' });
        return result || null;
    }
    /**
     * Bulk add funds to watchlist
     */
    async bulkAdd(userId, funds) {
        const now = new Date();
        const watchlistItems = funds.map((fund) => ({
            userId,
            fundId: fund.fundId,
            fundName: fund.fundName,
            addedAt: now,
            priceAlerts: [],
        }));
        const result = await this.collection.insertMany(watchlistItems);
        return result.insertedCount;
    }
    /**
     * Clear user's watchlist
     */
    async clearUserWatchlist(userId) {
        const result = await this.collection.deleteMany({ userId });
        return result.deletedCount;
    }
    /**
     * Get watchlist with fund details
     * This would typically join with funds collection
     */
    async getUserWatchlistWithDetails(userId) {
        return await this.collection
            .aggregate([
            { $match: { userId } },
            {
                $lookup: {
                    from: 'funds',
                    localField: 'fundId',
                    foreignField: 'fundId',
                    as: 'fundDetails',
                },
            },
            { $unwind: { path: '$fundDetails', preserveNullAndEmptyArrays: true } },
            { $sort: { addedAt: -1 } },
        ])
            .toArray();
    }
    /**
     * Get most watched funds
     */
    async getMostWatchedFunds(limit = 10) {
        const results = await this.collection
            .aggregate([
            {
                $group: {
                    _id: '$fundId',
                    fundName: { $first: '$fundName' },
                    watchCount: { $sum: 1 },
                },
            },
            { $sort: { watchCount: -1 } },
            { $limit: limit },
            {
                $project: {
                    fundId: '$_id',
                    fundName: 1,
                    watchCount: 1,
                    _id: 0,
                },
            },
        ])
            .toArray();
        return results;
    }
}
exports.WatchlistModel = WatchlistModel;
WatchlistModel.instance = null;
