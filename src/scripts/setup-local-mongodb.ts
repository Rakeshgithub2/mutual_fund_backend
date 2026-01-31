#!/usr/bin/env node

/**
 * Setup script for local MongoDB development
 * This script helps configure and validate the local MongoDB setup
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';

const MONGODB_LOCAL_URL = 'mongodb://localhost:27017/mutual_funds_db';

async function checkMongoDBConnection() {
  console.log('🔍 Checking MongoDB connection...');

  try {
    // Try to connect using MongoDB Node.js driver
    const { MongoClient } = await import('mongodb');
    const client = new MongoClient(MONGODB_LOCAL_URL);

    await client.connect();
    console.log('✅ Connected to MongoDB successfully');

    // List databases to verify connection
    const adminDb = client.db().admin();
    const databases = await adminDb.listDatabases();
    console.log(
      '📚 Available databases:',
      databases.databases.map((db: any) => db.name)
    );

    await client.close();
    return true;
  } catch (error: any) {
    console.error('❌ MongoDB connection failed:', error?.message || error);
    return false;
  }
}

async function checkPrismaSetup() {
  console.log('🔍 Checking Prisma setup...');

  try {
    // Check if Prisma client is generated
    const prismaClientPath = path.join(
      process.cwd(),
      'node_modules',
      '.prisma',
      'client'
    );

    if (!existsSync(prismaClientPath)) {
      console.log(
        '⚠️  Prisma client not generated. Running prisma generate...'
      );
      execSync('npx prisma generate', { stdio: 'inherit' });
    }

    console.log('✅ Prisma client is ready');
    return true;
  } catch (error: any) {
    console.error('❌ Prisma setup failed:', error?.message || error);
    return false;
  }
}

async function runMigrations() {
  console.log('🔍 Checking database migrations...');

  try {
    console.log('📊 Pushing schema to database...');
    execSync('npx prisma db push', { stdio: 'inherit' });
    console.log('✅ Database schema updated successfully');
    return true;
  } catch (error: any) {
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
    console.log(
      '1. Install MongoDB locally: https://docs.mongodb.com/manual/installation/'
    );
    console.log('2. Start MongoDB service:');
    console.log('   - Windows: net start MongoDB');
    console.log(
      '   - macOS: brew services start mongodb/brew/mongodb-community'
    );
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
  console.log(
    '\n💡 Tip: You can now use MongoDB Compass to visually explore your database'
  );
}

// Check if running directly
if (require.main === module) {
  setupLocalMongoDB().catch(console.error);
}

export {
  setupLocalMongoDB,
  checkMongoDBConnection,
  checkPrismaSetup,
  runMigrations,
};
