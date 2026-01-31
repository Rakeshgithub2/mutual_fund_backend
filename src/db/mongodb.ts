import { MongoClient, Db, Collection, Document } from 'mongodb';
import { config } from 'dotenv';

// Load environment variables
config();

const DATABASE_URL =
  process.env.DATABASE_URL || 'mongodb://localhost:27017/mutual_funds_db';

// Production-optimized connection options for MongoDB Atlas
const MONGO_OPTIONS = {
  maxPoolSize: 10, // Maximum connection pool size
  minPoolSize: 2, // Minimum connection pool size
  maxIdleTimeMS: 30000, // Close idle connections after 30s
  serverSelectionTimeoutMS: 5000, // Fail fast if can't connect in 5s
  socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
  family: 4, // Use IPv4, skip IPv6 lookup (faster DNS)
  retryWrites: true,
  retryReads: true,
  compressors: ['zlib' as const], // Enable compression
};

// Global connection cache (critical for serverless/Vercel)
let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

class MongoDB {
  private static instance: MongoDB;
  private client: MongoClient | null = null;
  private db: Db | null = null;
  private connectionPromise: Promise<void> | null = null;

  private constructor() {
    // Use global cache if available
    if (cachedClient && cachedDb) {
      this.client = cachedClient;
      this.db = cachedDb;
      console.log('♻️  [MONGO] Reusing cached connection');
    }
  }

  public static getInstance(): MongoDB {
    if (!MongoDB.instance) {
      MongoDB.instance = new MongoDB();
    }
    return MongoDB.instance;
  }

  public async connect(): Promise<void> {
    // If already connected, reuse connection
    if (this.db && this.client) {
      console.log('✅ [MONGO] Already connected (reusing pool)');
      return;
    }

    // If connection in progress, wait for it
    if (this.connectionPromise) {
      console.log('⏳ [MONGO] Connection in progress, waiting...');
      return this.connectionPromise;
    }

    // Create new connection with timing
    this.connectionPromise = this.doConnect();
    try {
      await this.connectionPromise;
    } finally {
      this.connectionPromise = null;
    }
  }

  private async doConnect(): Promise<void> {
    const startTime = Date.now();
    try {
      console.log('🔄 [MONGO] Initiating connection...');
      console.log(
        '📍 [MONGO] Target:',
        DATABASE_URL.replace(/:[^:@]+@/, ':***@')
      );

      // Create client with production-optimized settings
      this.client = new MongoClient(DATABASE_URL, MONGO_OPTIONS);

      const connectStart = Date.now();
      await this.client.connect();
      const connectTime = Date.now() - connectStart;

      // Extract database name from URL
      let dbName = 'mutual_funds_db'; // Default

      // For Atlas URLs, extract the database name from the path
      if (DATABASE_URL.includes('mongodb+srv://')) {
        // Pattern: mongodb+srv://user:pass@host/dbname?params
        const match = DATABASE_URL.match(/mongodb\+srv:\/\/[^\/]+\/([^?]+)/);
        if (match && match[1]) {
          dbName = match[1];
        }
      } else {
        // For local MongoDB URLs
        const extracted = DATABASE_URL.split('/').pop()?.split('?')[0];
        if (extracted) {
          dbName = extracted;
        }
      }

      this.db = this.client.db(dbName);

      // Cache globally for serverless reuse
      cachedClient = this.client;
      cachedDb = this.db;

      const totalTime = Date.now() - startTime;
      console.log(`✅ [MONGO] Connected successfully`);
      console.log(`   📊 Database: ${dbName}`);
      console.log(`   ⏱️  Connect time: ${connectTime}ms`);
      console.log(`   ⏱️  Total time: ${totalTime}ms`);
      console.log(`   🔧 Pool size: ${MONGO_OPTIONS.maxPoolSize}`);
    } catch (error) {
      console.error('❌ [MONGO] Connection failed:', error);
      this.db = null;
      this.client = null;
      cachedClient = null;
      cachedDb = null;
      throw error;
    }
  }

  public getDb(): Db {
    if (!this.db) {
      throw new Error(
        '[MONGO] Database not initialized. Call connect() first.'
      );
    }
    return this.db;
  }

  public getCollection<T extends Document = Document>(
    name: string
  ): Collection<T> {
    return this.getDb().collection<T>(name);
  }

  /**
   * Execute query with timing logs
   */
  public async queryWithTiming<T>(
    collectionName: string,
    operation: string,
    queryFn: (collection: Collection) => Promise<T>
  ): Promise<T> {
    const startTime = Date.now();
    try {
      const collection = this.getCollection(collectionName);
      const result = await queryFn(collection);
      const queryTime = Date.now() - startTime;

      if (queryTime > 1000) {
        console.warn(
          `⚠️  [MONGO] Slow query: ${collectionName}.${operation} took ${queryTime}ms`
        );
      } else {
        console.log(
          `⚡ [MONGO] ${collectionName}.${operation} = ${queryTime}ms`
        );
      }

      return result;
    } catch (error) {
      const queryTime = Date.now() - startTime;
      console.error(
        `❌ [MONGO] Query failed: ${collectionName}.${operation} after ${queryTime}ms`,
        error
      );
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      console.log('🔌 [MONGO] Disconnected');
      this.db = null;
      this.client = null;
      cachedClient = null;
      cachedDb = null;
    }
  }

  public isConnected(): boolean {
    return this.db !== null && this.client !== null;
  }

  /**
   * Get connection health metrics
   */
  public getHealthMetrics() {
    return {
      connected: this.isConnected(),
      poolSize: MONGO_OPTIONS.maxPoolSize,
      usingCache: this.client === cachedClient,
    };
  }
}

export const mongodb = MongoDB.getInstance();
