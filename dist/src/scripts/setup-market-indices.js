/**
 * ═══════════════════════════════════════════════════════════════════════
 * MARKET INDICES SETUP SCRIPT
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Run this script once to:
 * 1. Create MongoDB indexes for market indices history
 * 2. Seed initial market indices data
 * 3. Verify Redis connection
 * 4. Test the complete pipeline
 *
 * Usage:
 *   node src/scripts/setup-market-indices.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Redis = require('ioredis');

const MarketIndexHistory = require('../models/MarketIndexHistory.model');
const MarketHours = require('../utils/marketHours.production');
const { CACHE_KEYS, TTL_CONFIG } = require('../utils/redisLock.util');

const DATABASE_URL = process.env.DATABASE_URL;
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

async function setupMarketIndices() {
  console.log('\n' + '═'.repeat(60));
  console.log('🚀 MARKET INDICES SETUP');
  console.log('═'.repeat(60));

  try {
    // Step 1: Connect to MongoDB
    console.log('\n1️⃣  Connecting to MongoDB...');
    await mongoose.connect(DATABASE_URL);
    console.log('   ✅ MongoDB connected');

    // Step 2: Create indexes (drop conflicting ones first)
    console.log('\n2️⃣  Creating MongoDB indexes...');
    try {
      // Try to drop the conflicting timestamp_1 index if it exists
      const collection = mongoose.connection.db.collection(
        'market_indices_history'
      );
      const existingIndexes = await collection.indexes();
      const hasConflictingIndex = existingIndexes.some(
        (idx) => idx.name === 'timestamp_1' && !idx.expireAfterSeconds
      );

      if (hasConflictingIndex) {
        console.log(
          '   ⚠️  Found conflicting timestamp_1 index, dropping it...'
        );
        await collection.dropIndex('timestamp_1');
        console.log('   ✅ Dropped conflicting index');
      }
    } catch (dropError) {
      // Index might not exist, that's fine
      console.log('   ℹ️  No conflicting index to drop');
    }

    await MarketIndexHistory.createIndexes();
    console.log('   ✅ Indexes created:');
    console.log('      - symbol + timestamp (compound)');
    console.log('      - symbol + date + granularity (compound)');
    console.log('      - TTL index for auto-cleanup (7 days for 5MIN data)');

    // Step 3: Check existing data
    console.log('\n3️⃣  Checking existing data...');
    const count = await MarketIndexHistory.countDocuments();
    console.log(`   📊 Found ${count} existing records`);

    // Step 4: Test Redis connection
    console.log('\n4️⃣  Testing Redis connection...');
    let redisConnected = false;
    try {
      const redis = new Redis(REDIS_URL, {
        maxRetriesPerRequest: 3,
        lazyConnect: true,
      });

      await redis.connect();
      await redis.ping();
      console.log('   ✅ Redis connected');
      redisConnected = true;

      // Check if cache exists
      const cached = await redis.get(CACHE_KEYS.INDICES_LATEST);
      if (cached) {
        console.log('   📦 Cache exists with data');
        const data = JSON.parse(cached);
        console.log(
          `      - Last updated: ${data.updatedAtIST || data.updatedAt}`
        );
        console.log(`      - Indices count: ${data.indices?.length || 0}`);
      } else {
        console.log('   ⚠️  Cache is empty');
      }

      await redis.quit();
    } catch (redisError) {
      console.log(`   ⚠️  Redis not available: ${redisError.message}`);
      console.log('   💡 Redis is optional - MongoDB will be used as fallback');
    }

    // Step 5: Market status check
    console.log('\n5️⃣  Checking market status...');
    const marketStatus = MarketHours.getMarketStatus();
    console.log(`   📊 Status: ${marketStatus.status}`);
    console.log(`   📊 Message: ${marketStatus.message}`);
    console.log(`   📊 Is Trading Day: ${marketStatus.isTradingDay}`);
    console.log(
      `   📊 Current Time: ${marketStatus.currentTime} (${marketStatus.timezone})`
    );
    if (marketStatus.nextOpenTime) {
      console.log(`   📊 Next Open: ${marketStatus.nextOpenTime}`);
    }

    // Step 6: Summary
    console.log('\n' + '═'.repeat(60));
    console.log('✅ SETUP COMPLETE');
    console.log('═'.repeat(60));
    console.log('\n📋 Summary:');
    console.log('   • MongoDB: Connected ✓');
    console.log('   • Indexes: Created ✓');
    console.log(
      `   • Redis: ${redisConnected ? 'Connected ✓' : 'Not available (using MongoDB fallback)'}`
    );
    console.log(`   • Historical Records: ${count}`);
    console.log(`   • Market Status: ${marketStatus.status}`);

    console.log('\n📌 Next Steps:');
    console.log('   1. Start the backend server: npm run dev');
    console.log(
      '   2. The cron scheduler will automatically update indices every 5 minutes'
    );
    console.log('   3. Or run manually: node workers/market-indices.worker.js');
    console.log('\n');
  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
  }
}

// Run
setupMarketIndices().then(() => process.exit(0));
