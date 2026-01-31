/**
 * MongoDB Connection Reuse for Serverless Environments (Vercel)
 *
 * CRITICAL FIX #1: Connection Pooling for Serverless
 *
 * Problem: Vercel serverless functions reconnect on EVERY request → 5+ sec latency
 * Solution: Cache connection in global scope to reuse across invocations
 */

import { MongoClient, Db } from 'mongodb';

const DATABASE_URL =
  process.env.DATABASE_URL || 'mongodb://localhost:27017/mutual_funds_db';

interface CachedConnection {
  client: MongoClient | null;
  db: Db | null;
  promise: Promise<{ client: MongoClient; db: Db }> | null;
}

// Use global cache for connection reuse in serverless
declare global {
  // eslint-disable-next-line no-var
  var mongoCache: CachedConnection | undefined;
}

let cached: CachedConnection = global.mongoCache ?? {
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
export async function dbConnect(): Promise<{ client: MongoClient; db: Db }> {
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

      const client = new MongoClient(DATABASE_URL, {
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
      if (
        DATABASE_URL.includes('mongodb+srv://') ||
        DATABASE_URL.includes('mongodb://')
      ) {
        const match = DATABASE_URL.match(
          /mongodb(?:\+srv)?:\/\/[^\/]+\/([^?]+)/
        );
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
    } catch (error) {
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
export async function getDb(): Promise<Db> {
  const { db } = await dbConnect();
  return db;
}

/**
 * Get MongoDB client
 */
export async function getClient(): Promise<MongoClient> {
  const { client } = await dbConnect();
  return client;
}

/**
 * Check if connected
 */
export function isConnected(): boolean {
  return cached.client !== null && cached.db !== null;
}

/**
 * Disconnect (mainly for cleanup in tests)
 */
export async function disconnect(): Promise<void> {
  if (cached.client) {
    await cached.client.close();
    cached.client = null;
    cached.db = null;
    cached.promise = null;
    console.log('MongoDB disconnected');
  }
}
