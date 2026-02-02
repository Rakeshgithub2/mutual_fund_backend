"use strict";
/**
 * Queue Service - Add missing funds to ingestion queue
 *
 * When a fund is not found in MongoDB, add it to the queue
 * for the Oracle VM worker to fetch
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.addToMissingFundsQueue = addToMissingFundsQueue;
exports.checkQueueStatus = checkQueueStatus;
exports.getQueueStats = getQueueStats;
const mongodb_serverless_1 = require("../lib/mongodb-serverless");
/**
 * Add fund to missing funds queue
 */
async function addToMissingFundsQueue(searchQuery, schemeCode) {
    try {
        const db = await (0, mongodb_serverless_1.getDb)();
        const queueCollection = db.collection('missing_funds_queue');
        // Check if already in queue (pending or processing)
        const existing = await queueCollection.findOne({
            $or: [
                { searchQuery, status: { $in: ['pending', 'processing'] } },
                schemeCode
                    ? { schemeCode, status: { $in: ['pending', 'processing'] } }
                    : {},
            ],
        });
        if (existing) {
            console.log(`⏭️ Fund already in queue: ${searchQuery}`);
            return false;
        }
        // Add to queue
        const queueItem = {
            searchQuery,
            schemeCode,
            requestedAt: new Date(),
            status: 'pending',
        };
        await queueCollection.insertOne(queueItem);
        console.log(`✅ Added to queue: ${searchQuery} (${schemeCode || 'no code'})`);
        return true;
    }
    catch (error) {
        console.error('❌ Error adding to queue:', error.message);
        return false;
    }
}
/**
 * Check queue status for a search query
 */
async function checkQueueStatus(searchQuery) {
    try {
        const db = await (0, mongodb_serverless_1.getDb)();
        const queueCollection = db.collection('missing_funds_queue');
        const item = await queueCollection.findOne({ searchQuery }, { sort: { requestedAt: -1 } });
        return item;
    }
    catch (error) {
        console.error('Error checking queue status:', error);
        return null;
    }
}
/**
 * Get queue statistics
 */
async function getQueueStats() {
    try {
        const db = await (0, mongodb_serverless_1.getDb)();
        const queueCollection = db.collection('missing_funds_queue');
        const [pending, processing, completed, failed, total] = await Promise.all([
            queueCollection.countDocuments({ status: 'pending' }),
            queueCollection.countDocuments({ status: 'processing' }),
            queueCollection.countDocuments({ status: 'completed' }),
            queueCollection.countDocuments({ status: 'failed' }),
            queueCollection.countDocuments(),
        ]);
        return { pending, processing, completed, failed, total };
    }
    catch (error) {
        console.error('Error getting queue stats:', error);
        return { pending: 0, processing: 0, completed: 0, failed: 0, total: 0 };
    }
}
