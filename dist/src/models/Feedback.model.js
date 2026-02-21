"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.feedbackModel = exports.FeedbackModel = exports.FeedbackSchema = void 0;
const mongodb_1 = require("mongodb");
// Lazy import to avoid circular dependency
let mongodb = null;
function getMongoDB() {
    if (!mongodb) {
        mongodb = require('../db/mongodb').mongodb;
    }
    return mongodb;
}
const zod_1 = require("zod");
/**
 * Zod validation schema for Feedback
 */
exports.FeedbackSchema = zod_1.z.object({
    feedbackType: zod_1.z.enum(['bug', 'feature', 'general']),
    rating: zod_1.z.number().min(0).max(5),
    name: zod_1.z.string().min(1).optional(),
    email: zod_1.z.string().email().nullable().optional(),
    message: zod_1.z.string().min(1, 'Message is required'),
    userId: zod_1.z.string().nullable(),
    status: zod_1.z.enum(['pending', 'reviewed', 'resolved']).default('pending'),
});
/**
 * Feedback Model - MongoDB operations for feedback
 */
class FeedbackModel {
    constructor() {
        this._collection = null;
    }
    get collection() {
        if (!this._collection) {
            const db = getMongoDB();
            this._collection = db.getCollection('feedback');
        }
        return this._collection;
    }
    /**
     * Ensure indexes are created
     */
    async ensureIndexes() {
        try {
            await this.collection.createIndex({ createdAt: -1 });
            await this.collection.createIndex({ status: 1 });
            await this.collection.createIndex({ userId: 1 });
            await this.collection.createIndex({ feedbackType: 1 });
            console.log('✓ Feedback collection indexes created');
        }
        catch (error) {
            console.error('Error creating feedback indexes:', error);
        }
    }
    /**
     * Create a new feedback entry
     */
    async create(feedbackData) {
        const feedback = {
            ...feedbackData,
            status: feedbackData.status || 'pending',
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        const result = await this.collection.insertOne(feedback);
        return { ...feedback, _id: result.insertedId };
    }
    /**
     * Find feedback by ID
     */
    async findById(id) {
        try {
            return await this.collection.findOne({ _id: new mongodb_1.ObjectId(id) });
        }
        catch (error) {
            return null;
        }
    }
    /**
     * Find all feedback with optional filters
     */
    async findAll(options = {}) {
        const { status, feedbackType, userId, limit = 50, skip = 0 } = options;
        const filter = {};
        if (status)
            filter.status = status;
        if (feedbackType)
            filter.feedbackType = feedbackType;
        if (userId)
            filter.userId = userId;
        const [feedback, total] = await Promise.all([
            this.collection
                .find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .toArray(),
            this.collection.countDocuments(filter),
        ]);
        return { feedback, total };
    }
    /**
     * Update feedback status
     */
    async updateStatus(id, status) {
        try {
            const result = await this.collection.updateOne({ _id: new mongodb_1.ObjectId(id) }, {
                $set: {
                    status,
                    updatedAt: new Date(),
                },
            });
            return result.modifiedCount > 0;
        }
        catch (error) {
            return false;
        }
    }
    /**
     * Get feedback statistics
     */
    async getStatistics() {
        const [total, byStatus, byType, avgRating] = await Promise.all([
            // Total count
            this.collection.countDocuments(),
            // Count by status
            this.collection
                .aggregate([
                {
                    $group: {
                        _id: '$status',
                        count: { $sum: 1 },
                    },
                },
            ])
                .toArray(),
            // Count by type
            this.collection
                .aggregate([
                {
                    $group: {
                        _id: '$feedbackType',
                        count: { $sum: 1 },
                    },
                },
            ])
                .toArray(),
            // Average rating
            this.collection
                .aggregate([
                {
                    $group: {
                        _id: null,
                        avgRating: { $avg: '$rating' },
                    },
                },
            ])
                .toArray(),
        ]);
        const statusCounts = {
            pending: 0,
            reviewed: 0,
            resolved: 0,
        };
        byStatus.forEach((item) => {
            statusCounts[item._id] = item.count;
        });
        const typeCounts = {
            bug: 0,
            feature: 0,
            general: 0,
        };
        byType.forEach((item) => {
            typeCounts[item._id] = item.count;
        });
        return {
            total,
            byStatus: statusCounts,
            byType: typeCounts,
            averageRating: avgRating[0]?.avgRating || 0,
        };
    }
    /**
     * Delete feedback by ID
     */
    async delete(id) {
        try {
            const result = await this.collection.deleteOne({ _id: new mongodb_1.ObjectId(id) });
            return result.deletedCount > 0;
        }
        catch (error) {
            return false;
        }
    }
}
exports.FeedbackModel = FeedbackModel;
// Export singleton instance
exports.feedbackModel = new FeedbackModel();
