"use strict";
/**
 * MongoDB Connection Reuse for Serverless Environments (Vercel)
 *
 * CRITICAL FIX #1: Connection Pooling for Serverless
 *
 * Problem: Vercel serverless functions reconnect on EVERY request → 5+ sec latency
 * Solution: Cache connection in global scope to reuse across invocations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.dbConnect = dbConnect;
exports.getDb = getDb;
exports.getClient = getClient;
exports.isConnected = isConnected;
exports.disconnect = disconnect;
const mongodb_1 = require("mongodb");
const DATABASE_URL = process.env.DATABASE_URL || 'mongodb://localhost:27017/mutual_funds_db';
let cached = global.mongoCache ?? {
    client: null,
    db: null,
    promise: null,
};
if (!global.mongoCache) {
    global.mongoCache = cached;
}
/**
 * Connect to MongoDB with connection reuse
 * - First call: Creates new connection and caches it
 * - Subsequent calls: Returns cached connection instantly
 * - Concurrent calls: Wait for same connection promise
 */
async function dbConnect() {
    // Return cached connection if available
    if (cached.client && cached.db) {
        return { client: cached.client, db: cached.db };
    }
    // Wait for ongoing connection if one exists
    if (cached.promise) {
        return cached.promise;
    }
    // Create new connection promise
    cached.promise = (async () => {
        try {
            console.log('🔄 Creating new MongoDB connection...');
            const client = new mongodb_1.MongoClient(DATABASE_URL, {
                maxPoolSize: 10,
                minPoolSize: 2,
                maxIdleTimeMS: 30000,
                serverSelectionTimeoutMS: 10000,
                socketTimeoutMS: 45000,
                // Critical for serverless
                connectTimeoutMS: 10000,
                retryWrites: true,
                retryReads: true,
            });
            await client.connect();
            // Extract database name from URL
            let dbName = 'mutual_funds_db';
            if (DATABASE_URL.includes('mongodb+srv://') ||
                DATABASE_URL.includes('mongodb://')) {
                const match = DATABASE_URL.match(/mongodb(?:\+srv)?:\/\/[^\/]+\/([^?]+)/);
                if (match && match[1]) {
                    dbName = match[1];
                }
            }
            const db = client.db(dbName);
            console.log(`✅ MongoDB connected (Database: ${dbName})`);
            // Cache the connection
            cached.client = client;
            cached.db = db;
            return { client, db };
        }
        catch (error) {
            console.error('❌ MongoDB connection failed:', error);
            // Clear promise on error so next call retries
            cached.promise = null;
            throw error;
        }
    })();
    return cached.promise;
}
/**
 * Get cached database instance
 */
async function getDb() {
    const { db } = await dbConnect();
    return db;
}
/**
 * Get MongoDB client
 */
async function getClient() {
    const { client } = await dbConnect();
    return client;
}
/**
 * Check if connected
 */
function isConnected() {
    return cached.client !== null && cached.db !== null;
}
/**
 * Disconnect (mainly for cleanup in tests)
 */
async function disconnect() {
    if (cached.client) {
        await cached.client.close();
        cached.client = null;
        cached.db = null;
        cached.promise = null;
        console.log('MongoDB disconnected');
    }
}
