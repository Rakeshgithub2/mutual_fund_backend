/**
 * MongoDB Indexes Setup Script
 *
 * This script creates all necessary indexes to prevent "Sort exceeded memory limit" errors
 * and optimize query performance for 14K+ mutual funds dataset.
 *
 * Run this ONCE after deploying to AWS:
 * node scripts/create-indexes.js
 */

const { MongoClient } = require('mongodb');
require('dotenv').config();

const MONGO_URI =
  process.env.MONGO_URI || 'mongodb://localhost:27017/mutualfunds';

async function createIndexes() {
  console.log('🚀 Starting MongoDB Index Creation...\n');

  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');

    const db = client.db();
    const fundsCollection = db.collection('funds');

    // Drop existing indexes (except _id) - OPTIONAL, only if recreating
    console.log('🧹 Checking existing indexes...');
    const existingIndexes = await fundsCollection.indexes();
    console.log(`Found ${existingIndexes.length} existing indexes`);
    for (const index of existingIndexes) {
      if (index.name !== '_id_') {
        await fundsCollection.dropIndex(index.name);
        console.log(`  Dropped: ${index.name}`);
      }
    }
    console.log();

    // ============================================
    // CRITICAL INDEXES FOR SORTING & FILTERING
    // ============================================

    console.log('📊 Creating performance indexes...\n');

    // 1. PRIMARY SORTING INDEX - Prevents "Sort exceeded memory limit"
    console.log('1️⃣  Creating AUM sort index (most critical)...');
    await fundsCollection.createIndex(
      { aum: -1 },
      {
        name: 'aum_sort_desc',
        background: true,
      }
    );
    console.log('    ✅ aum_sort_desc created\n');

    // 2. CATEGORY FILTERING - Used in 90% of queries
    console.log('2️⃣  Creating category filter index...');
    await fundsCollection.createIndex(
      { category: 1, aum: -1 },
      {
        name: 'category_aum',
        background: true,
      }
    );
    console.log('    ✅ category_aum created\n');

    // 3. SUBCATEGORY FILTERING - Large-cap, Mid-cap, etc.
    console.log('3️⃣  Creating subCategory filter index...');
    await fundsCollection.createIndex(
      { subCategory: 1, aum: -1 },
      {
        name: 'subcategory_aum',
        background: true,
      }
    );
    console.log('    ✅ subcategory_aum created\n');

    // 4. FUND HOUSE FILTERING
    console.log('4️⃣  Creating fundHouse filter index...');
    await fundsCollection.createIndex(
      { fundHouse: 1, aum: -1 },
      {
        name: 'fundhouse_aum',
        background: true,
      }
    );
    console.log('    ✅ fundhouse_aum created\n');

    // 5. ACTIVE STATUS FILTER - Only show active funds
    console.log('5️⃣  Creating isActive filter index...');
    await fundsCollection.createIndex(
      { isActive: 1, aum: -1 },
      {
        name: 'active_aum',
        background: true,
      }
    );
    console.log('    ✅ active_aum created\n');

    // 6. COMPOUND INDEX - Category + Active + Sort
    console.log('6️⃣  Creating compound category+active+sort index...');
    await fundsCollection.createIndex(
      { isActive: 1, category: 1, aum: -1 },
      {
        name: 'active_category_aum',
        background: true,
      }
    );
    console.log('    ✅ active_category_aum created\n');

    // 7. FUND ID LOOKUP - For /api/funds/:id
    console.log('7️⃣  Creating fundId lookup index...');
    await fundsCollection.createIndex(
      { fundId: 1 },
      {
        name: 'fundid_lookup',
        unique: true,
        background: true,
      }
    );
    console.log('    ✅ fundid_lookup created\n');

    // 8. AMFI CODE LOOKUP - Alternative ID
    console.log('8️⃣  Creating amfiCode lookup index...');
    await fundsCollection.createIndex(
      { amfiCode: 1 },
      {
        name: 'amficode_lookup',
        sparse: true,
        background: true,
      }
    );
    console.log('    ✅ amficode_lookup created\n');

    // 9. TEXT SEARCH INDEX - For name search
    console.log('9️⃣  Creating text search index for fund names...');
    await fundsCollection.createIndex(
      { name: 'text', fundHouse: 'text' },
      {
        name: 'name_text_search',
        background: true,
        weights: {
          name: 10,
          fundHouse: 5,
        },
      }
    );
    console.log('    ✅ name_text_search created\n');

    // ============================================
    // VERIFY INDEXES
    // ============================================

    console.log('🔍 Verifying all indexes...\n');
    const finalIndexes = await fundsCollection.indexes();

    console.log(`Total indexes: ${finalIndexes.length}\n`);
    finalIndexes.forEach((index, i) => {
      console.log(`  ${i + 1}. ${index.name}`);
      console.log(`     Keys: ${JSON.stringify(index.key)}`);
      if (index.unique) console.log(`     Unique: true`);
      if (index.sparse) console.log(`     Sparse: true`);
      console.log();
    });

    // ============================================
    // STATS
    // ============================================

    const stats = await fundsCollection.stats();
    console.log('📈 Collection Statistics:\n');
    console.log(`  Documents: ${stats.count}`);
    console.log(
      `  Storage Size: ${(stats.storageSize / 1024 / 1024).toFixed(2)} MB`
    );
    console.log(
      `  Index Size: ${(stats.totalIndexSize / 1024 / 1024).toFixed(2)} MB`
    );
    console.log();

    console.log('🎉 Index creation completed successfully!\n');
    console.log(
      '💡 TIP: Run "db.funds.getIndexes()" in MongoDB shell to verify\n'
    );
  } catch (error) {
    console.error('❌ Error creating indexes:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the script
createIndexes()
  .then(() => {
    console.log('\n✅ All done! Your queries should now be FAST ⚡');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed:', error.message);
    process.exit(1);
  });
