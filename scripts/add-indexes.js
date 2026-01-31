/**
 * Add MongoDB Indexes Script
 * Ensures proper indexes for optimal query performance
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Fund = require('../src/models/Fund.model');
const MarketIndex = require('../src/models/MarketIndex.model');

async function addIndexes() {
  try {
    console.log('📊 Adding MongoDB indexes...\n');

    await mongoose.connect(process.env.DATABASE_URL);
    console.log('✅ Connected to MongoDB\n');

    // Fund collection indexes
    console.log('Creating indexes for funds collection...');

    // Helper function to safely create index
    async function safeCreateIndex(spec, options, name) {
      try {
        await Fund.collection.createIndex(spec, options);
        console.log(`  ✅ ${name}`);
      } catch (error) {
        if (error.code === 85 || error.codeName === 'IndexOptionsConflict') {
          console.log(
            `  ℹ️  ${name} (already exists with different options, skipping)`
          );
        } else {
          throw error;
        }
      }
    }

    await safeCreateIndex(
      { scheme_code: 1 },
      { unique: true, sparse: true },
      'scheme_code (unique)'
    );

    await safeCreateIndex({ category: 1 }, {}, 'category');
    await safeCreateIndex({ subcategory: 1 }, {}, 'subcategory');
    await safeCreateIndex(
      { category: 1, subcategory: 1 },
      {},
      'category + subcategory (compound)'
    );
    await safeCreateIndex({ amc: 1 }, {}, 'amc');
    await safeCreateIndex({ nav: -1 }, {}, 'nav');
    await safeCreateIndex({ last_updated: -1 }, {}, 'last_updated');

    // Text indexes - skip if conflicting
    await safeCreateIndex(
      { scheme_name: 'text' },
      {},
      'scheme_name (text search)'
    );

    // Backward compatibility
    await safeCreateIndex(
      { schemeCode: 1 },
      { sparse: true },
      'schemeCode (backward compatibility)'
    );

    console.log('\n✅ All indexes created successfully\n');

    // List all indexes
    const indexes = await Fund.collection.indexes();
    console.log('Current indexes:');
    indexes.forEach((idx, i) => {
      console.log(
        `  ${i + 1}. ${JSON.stringify(idx.key)} ${idx.unique ? '(unique)' : ''} ${idx.sparse ? '(sparse)' : ''}`
      );
    });

    await mongoose.connection.close();
    console.log('\n✅ Done\n');
  } catch (error) {
    console.error('❌ Error adding indexes:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  addIndexes();
}

module.exports = { addIndexes };
