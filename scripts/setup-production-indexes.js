#!/usr/bin/env node

/**
 * Setup critical production indexes
 * Run this before deploying to production
 */

const { MongoClient } = require('mongodb');
require('dotenv').config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not set in .env file');
  process.exit(1);
}

async function setupIndexes() {
  console.log('🔧 Setting up critical production indexes...');
  
  const client = new MongoClient(DATABASE_URL);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');
    
    const db = client.db();
    
    // 1. Users collection
    console.log('📝 Setting up users indexes...');
    await db.collection('users').createIndex({ email: 1 }, { unique: true });
    await db.collection('users').createIndex({ googleId: 1 }, { sparse: true });
    console.log('   ✅ users indexes created\n');
    
    // 2. Refresh tokens with TTL
    console.log('📝 Setting up refresh_tokens indexes (with TTL)...');
    await db.collection('refresh_tokens').createIndex({ token: 1 }, { unique: true });
    await db.collection('refresh_tokens').createIndex({ userId: 1 });
    await db.collection('refresh_tokens').createIndex(
      { expiresAt: 1 },
      { expireAfterSeconds: 0 }
    );
    console.log('   ✅ refresh_tokens indexes created (auto-delete enabled)\n');
    
    // 3. Fund master collection
    console.log('📝 Setting up fund_master indexes...');
    await db.collection('fund_master').createIndex({ fundId: 1 }, { unique: true });
    await db.collection('fund_master').createIndex({ schemeCode: 1 }, { sparse: true });
    await db.collection('fund_master').createIndex({ category: 1 });
    await db.collection('fund_master').createIndex({ amc: 1 });
    await db.collection('fund_master').createIndex({ name: 'text', amc: 'text' });
    console.log('   ✅ fund_master indexes created\n');
    
    // 4. Watchlist
    console.log('📝 Setting up watchlist indexes...');
    await db.collection('watchlist').createIndex(
      { userId: 1, fundId: 1 },
      { unique: true }
    );
    await db.collection('watchlist').createIndex({ userId: 1 });
    console.log('   ✅ watchlist indexes created\n');
    
    // 5. Goals
    console.log('📝 Setting up goals indexes...');
    await db.collection('goals').createIndex({ userId: 1 });
    await db.collection('goals').createIndex({ userId: 1, createdAt: -1 });
    console.log('   ✅ goals indexes created\n');
    
    // 6. Reminders
    console.log('📝 Setting up reminders indexes...');
    await db.collection('reminders').createIndex({ userId: 1 });
    await db.collection('reminders').createIndex({ scheduledDate: 1 });
    await db.collection('reminders').createIndex({ status: 1, scheduledDate: 1 });
    console.log('   ✅ reminders indexes created\n');
    
    console.log('\n🎉 All critical indexes created successfully!');
    console.log('\n📊 Index Summary:');
    
    const collections = ['users', 'refresh_tokens', 'fund_master', 'watchlist', 'goals', 'reminders'];
    
    for (const collName of collections) {
      const indexes = await db.collection(collName).indexes();
      console.log(`   ${collName}: ${indexes.length} indexes`);
    }
    
  } catch (error) {
    console.error('❌ Error setting up indexes:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

setupIndexes();
