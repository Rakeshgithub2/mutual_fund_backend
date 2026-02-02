#!/usr/bin/env node
"use strict";
/**
 * Setup script for local MongoDB development
 * This script helps configure and validate the local MongoDB setup
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupLocalMongoDB = setupLocalMongoDB;
exports.checkMongoDBConnection = checkMongoDBConnection;
exports.checkPrismaSetup = checkPrismaSetup;
exports.runMigrations = runMigrations;
const child_process_1 = require("child_process");
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const MONGODB_LOCAL_URL = 'mongodb://localhost:27017/mutual_funds_db';
async function checkMongoDBConnection() {
    console.log('🔍 Checking MongoDB connection...');
    try {
        // Try to connect using MongoDB Node.js driver
        const { MongoClient } = await Promise.resolve().then(() => __importStar(require('mongodb')));
        const client = new MongoClient(MONGODB_LOCAL_URL);
        await client.connect();
        console.log('✅ Connected to MongoDB successfully');
        // List databases to verify connection
        const adminDb = client.db().admin();
        const databases = await adminDb.listDatabases();
        console.log('📚 Available databases:', databases.databases.map((db) => db.name));
        await client.close();
        return true;
    }
    catch (error) {
        console.error('❌ MongoDB connection failed:', error?.message || error);
        return false;
    }
}
async function checkPrismaSetup() {
    console.log('🔍 Checking Prisma setup...');
    try {
        // Check if Prisma client is generated
        const prismaClientPath = path_1.default.join(process.cwd(), 'node_modules', '.prisma', 'client');
        if (!(0, fs_1.existsSync)(prismaClientPath)) {
            console.log('⚠️  Prisma client not generated. Running prisma generate...');
            (0, child_process_1.execSync)('npx prisma generate', { stdio: 'inherit' });
        }
        console.log('✅ Prisma client is ready');
        return true;
    }
    catch (error) {
        console.error('❌ Prisma setup failed:', error?.message || error);
        return false;
    }
}
async function runMigrations() {
    console.log('🔍 Checking database migrations...');
    try {
        console.log('📊 Pushing schema to database...');
        (0, child_process_1.execSync)('npx prisma db push', { stdio: 'inherit' });
        console.log('✅ Database schema updated successfully');
        return true;
    }
    catch (error) {
        console.error('❌ Migration failed:', error?.message || error);
        return false;
    }
}
async function setupLocalMongoDB() {
    console.log('🚀 Setting up local MongoDB for development\n');
    // Check if MongoDB is running
    const mongoConnected = await checkMongoDBConnection();
    if (!mongoConnected) {
        console.log('\n❌ Setup failed: MongoDB is not running or not accessible');
        console.log('\n📋 To fix this:');
        console.log('1. Install MongoDB locally: https://docs.mongodb.com/manual/installation/');
        console.log('2. Start MongoDB service:');
        console.log('   - Windows: net start MongoDB');
        console.log('   - macOS: brew services start mongodb/brew/mongodb-community');
        console.log('   - Linux: sudo systemctl start mongod');
        console.log('3. Verify MongoDB is running on port 27017');
        console.log('4. Run this script again\n');
        return;
    }
    // Check Prisma setup
    const prismaReady = await checkPrismaSetup();
    if (!prismaReady) {
        console.log('\n❌ Setup failed: Prisma client setup failed');
        return;
    }
    // Run migrations
    const migrationsSuccessful = await runMigrations();
    if (!migrationsSuccessful) {
        console.log('\n❌ Setup failed: Database migrations failed');
        return;
    }
    console.log('\n🎉 Local MongoDB setup completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('1. Start the development server: npm run dev:local');
    console.log('2. Start the worker (optional): npm run worker:local');
    console.log('3. Seed the database (optional): npm run db:seed:local');
    console.log('\n🔗 MongoDB Compass connection string:');
    console.log(MONGODB_LOCAL_URL);
    console.log('\n💡 Tip: You can now use MongoDB Compass to visually explore your database');
}
// Check if running directly
if (require.main === module) {
    setupLocalMongoDB().catch(console.error);
}
