"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.watchCollection = exports.stopWatchlistChangeStream = exports.startWatchlistChangeStream = void 0;
// MongoDB Change Streams watcher for real-time watchlist updates
// NOTE: Requires MongoDB replica set (use setup-mongodb-replica.ps1 for local dev)
const mongodb_1 = require("../db/mongodb");
const socket_1 = require("./socket");
let changeStream = null;
const startWatchlistChangeStream = async () => {
    try {
        const db = mongodb_1.mongodb.getDb();
        if (!db) {
            console.warn('⚠️ MongoDB not connected, skipping change stream setup');
            return;
        }
        const collection = db.collection('watchlist_items');
        // Check if replica set is enabled (required for change streams)
        const adminDb = db.admin();
        const serverStatus = await adminDb.serverStatus();
        if (!serverStatus.repl) {
            console.log('ℹ️ MongoDB Change Streams disabled (not a replica set)');
            console.log('ℹ️ To enable: Run setup-mongodb-replica.ps1 for local dev');
            console.log('ℹ️ Real-time updates will work via Socket.IO on API calls only');
            return;
        }
        console.log('🔄 Starting MongoDB Change Stream for watchlist_items...');
        changeStream = collection.watch([
            {
                $match: {
                    operationType: { $in: ['insert', 'update', 'delete'] },
                },
            },
        ], { fullDocument: 'updateLookup' });
        changeStream.on('change', async (change) => {
            console.log('🔔 Watchlist change detected:', change.operationType);
            try {
                let userId = null;
                // Extract userId from the document
                if (change.operationType === 'insert' ||
                    change.operationType === 'update') {
                    userId = change.fullDocument?.userId?.toString();
                }
                else if (change.operationType === 'delete') {
                    // For deletes, we need to extract from documentKey
                    userId = change.documentKey?._id?.toString();
                }
                if (userId) {
                    // Fetch updated watchlist for this user
                    const watchlistItems = await collection
                        .find({ userId: userId })
                        .toArray();
                    // Emit to user's socket room
                    (0, socket_1.emitWatchlistUpdate)(userId, {
                        type: change.operationType,
                        watchlist: watchlistItems,
                        timestamp: new Date(),
                    });
                    console.log(`✅ Emitted watchlist update to user: ${userId}`);
                }
            }
            catch (error) {
                console.error('❌ Error processing change stream event:', error);
            }
        });
        changeStream.on('error', (error) => {
            console.error('❌ Change Stream error:', error);
            // Auto-reconnect logic could go here
        });
        changeStream.on('close', () => {
            console.log('🔌 Change Stream closed');
        });
        console.log('✅ MongoDB Change Stream started successfully');
    }
    catch (error) {
        if (error.codeName === 'CommandNotSupported') {
            console.log('ℹ️ MongoDB Change Streams not supported (standalone mode)');
            console.log('ℹ️ To enable: Convert to replica set or use MongoDB Atlas');
        }
        else {
            console.error('❌ Error starting change stream:', error);
        }
    }
};
exports.startWatchlistChangeStream = startWatchlistChangeStream;
const stopWatchlistChangeStream = async () => {
    if (changeStream) {
        await changeStream.close();
        changeStream = null;
        console.log('✅ Change Stream stopped');
    }
};
exports.stopWatchlistChangeStream = stopWatchlistChangeStream;
// Optional: Generic change stream helper for other collections
const watchCollection = (collectionName, callback) => {
    const db = mongodb_1.mongodb.getDb();
    if (!db)
        return null;
    const collection = db.collection(collectionName);
    const stream = collection.watch();
    stream.on('change', callback);
    stream.on('error', (error) => {
        console.error(`❌ Change stream error for ${collectionName}:`, error);
    });
    return stream;
};
exports.watchCollection = watchCollection;
