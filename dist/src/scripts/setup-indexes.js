/**
 * MongoDB Index Setup Script
 * Run this script to create optimal indexes for fund queries
 *
 * Usage: node src/scripts/setup-indexes.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

const MONGODB_URI = process.env.DATABASE_URL || process.env.MONGODB_URI;

async function setupIndexes() {
  console.log('🔧 MongoDB Index Setup\n');
  console.log('━'.repeat(50));

  try {
    // Connect to MongoDB
    console.log('📊 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected successfully\n');

    const db = mongoose.connection.db;

    // ═══════════════════════════════════════════════════════════════
    // FUNDS COLLECTION INDEXES
    // ═══════════════════════════════════════════════════════════════
    console.log('📁 Creating indexes for "funds" collection...');
    const fundsCollection = db.collection('funds');

    const fundIndexes = [
      {
        key: { schemeCode: 1 },
        options: { unique: true, name: 'schemeCode_1' },
      },
      { key: { category: 1 }, options: { name: 'category_1' } },
      { key: { subCategory: 1 }, options: { name: 'subCategory_1' } },
      {
        key: { category: 1, subCategory: 1 },
        options: { name: 'category_subCategory_1' },
      },
      { key: { 'amc.name': 1 }, options: { name: 'amc_name_1' } },
      { key: { schemeName: 'text' }, options: { name: 'schemeName_text' } },
      { key: { 'returns.1Y': -1 }, options: { name: 'returns_1Y_desc' } },
      { key: { aum: -1 }, options: { name: 'aum_desc' } },
      { key: { currentNav: 1 }, options: { name: 'currentNav_1' } },
    ];

    for (const index of fundIndexes) {
      try {
        await fundsCollection.createIndex(index.key, index.options);
        console.log(`  ✓ Created: ${index.options.name}`);
      } catch (err) {
        if (err.code === 85 || err.code === 86) {
          console.log(`  ⚠ Exists: ${index.options.name}`);
        } else {
          console.log(`  ✗ Failed: ${index.options.name} - ${err.message}`);
        }
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // HOLDINGS COLLECTION INDEXES
    // ═══════════════════════════════════════════════════════════════
    console.log('\n📁 Creating indexes for "holdings" collection...');
    const holdingsCollection = db.collection('holdings');

    const holdingsIndexes = [
      {
        key: { schemeCode: 1 },
        options: { unique: true, name: 'schemeCode_1' },
      },
      { key: { category: 1 }, options: { name: 'category_1' } },
      { key: { updatedAt: -1 }, options: { name: 'updatedAt_desc' } },
    ];

    for (const index of holdingsIndexes) {
      try {
        await holdingsCollection.createIndex(index.key, index.options);
        console.log(`  ✓ Created: ${index.options.name}`);
      } catch (err) {
        if (err.code === 85 || err.code === 86) {
          console.log(`  ⚠ Exists: ${index.options.name}`);
        } else {
          console.log(`  ✗ Failed: ${index.options.name} - ${err.message}`);
        }
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // FUND MANAGERS COLLECTION INDEXES
    // ═══════════════════════════════════════════════════════════════
    console.log('\n📁 Creating indexes for "fund_managers" collection...');
    const managersCollection = db.collection('fund_managers');

    const managerIndexes = [
      {
        key: { managerId: 1 },
        options: { unique: true, name: 'managerId_1', sparse: true },
      },
      { key: { name: 1 }, options: { name: 'name_1' } },
      { key: { 'amc.name': 1 }, options: { name: 'amc_name_1' } },
    ];

    for (const index of managerIndexes) {
      try {
        await managersCollection.createIndex(index.key, index.options);
        console.log(`  ✓ Created: ${index.options.name}`);
      } catch (err) {
        if (err.code === 85 || err.code === 86) {
          console.log(`  ⚠ Exists: ${index.options.name}`);
        } else {
          console.log(`  ✗ Failed: ${index.options.name} - ${err.message}`);
        }
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // MARKET INDICES COLLECTION INDEXES
    // ═══════════════════════════════════════════════════════════════
    console.log('\n📁 Creating indexes for "marketindices" collection...');
    const marketCollection = db.collection('marketindices');

    const marketIndexes = [
      { key: { symbol: 1 }, options: { unique: true, name: 'symbol_1' } },
      { key: { category: 1 }, options: { name: 'category_1' } },
      { key: { lastUpdated: -1 }, options: { name: 'lastUpdated_desc' } },
    ];

    for (const index of marketIndexes) {
      try {
        await marketCollection.createIndex(index.key, index.options);
        console.log(`  ✓ Created: ${index.options.name}`);
      } catch (err) {
        if (err.code === 85 || err.code === 86) {
          console.log(`  ⚠ Exists: ${index.options.name}`);
        } else {
          console.log(`  ✗ Failed: ${index.options.name} - ${err.message}`);
        }
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // PRINT INDEX STATS
    // ═══════════════════════════════════════════════════════════════
    console.log('\n' + '━'.repeat(50));
    console.log('📊 Index Statistics:\n');

    const collections = ['funds', 'holdings', 'fund_managers', 'marketindices'];
    for (const collName of collections) {
      try {
        const indexes = await db.collection(collName).indexes();
        console.log(`  ${collName}: ${indexes.length} indexes`);
      } catch (err) {
        console.log(`  ${collName}: Unable to get stats`);
      }
    }

    console.log('\n✅ Index setup complete!');
    console.log('━'.repeat(50));
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

setupIndexes();
