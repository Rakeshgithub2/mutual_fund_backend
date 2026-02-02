"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mongodb = void 0;
const mongodb_1 = require("mongodb");
const DATABASE_URL = process.env.DATABASE_URL || 'mongodb://localhost:27017/mutual_funds_db';
class MongoDB {
    constructor() {
        this.client = null;
        this.db = null;
        this.connectionPromise = null;
    }
    static getInstance() {
        if (!MongoDB.instance) {
            MongoDB.instance = new MongoDB();
        }
        return MongoDB.instance;
    }
    async connect() {
        // If already connected, return immediately
        if (this.db && this.client) {
            return;
        }
        // If connection is in progress, wait for it
        if (this.connectionPromise) {
            return this.connectionPromise;
        }
        // Start new connection
        this.connectionPromise = this.establishConnection();
        return this.connectionPromise;
    }
    async establishConnection() {
        try {
            console.log('🔄 Connecting to MongoDB...');
            // Create new client if needed
            if (!this.client) {
                this.client = new mongodb_1.MongoClient(DATABASE_URL, {
                    maxPoolSize: 10,
                    minPoolSize: 1,
                    serverSelectionTimeoutMS: 10000,
                    socketTimeoutMS: 45000,
                });
            }
            await this.client.connect();
            // Extract database name from URL
            let dbName = 'mutual_funds_db';
            if (DATABASE_URL.includes('mongodb+srv://') ||
                DATABASE_URL.includes('mongodb://')) {
                const match = DATABASE_URL.match(/mongodb(?:\+srv)?:\/\/[^\/]+\/([^?]+)/);
                if (match && match[1]) {
                    dbName = match[1];
                }
            }
            this.db = this.client.db(dbName);
            console.log(`✅ MongoDB connected to database: ${dbName}`);
        }
        catch (error) {
            console.error('❌ MongoDB connection failed:', error);
            this.db = null;
            this.client = null;
            throw error;
        }
        finally {
            this.connectionPromise = null;
        }
    }
    getDb() {
        if (!this.db) {
            throw new Error('Database not initialized. Call connect() first.');
        }
        return this.db;
    }
    getCollection(name) {
        return this.getDb().collection(name);
    }
    isConnected() {
        return this.db !== null && this.client !== null;
    }
    async disconnect() {
        if (this.client) {
            await this.client.close();
            this.client = null;
            this.db = null;
            console.log('✅ MongoDB disconnected');
        }
    }
}
exports.mongodb = MongoDB.getInstance();
