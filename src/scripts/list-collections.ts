#!/usr/bin/env tsx

/**
 * List Collections Script
 * Check what collections exist in the database
 */

import { mongodb } from '../db/mongodb';

async function listCollections() {
  try {
    console.log('🔍 Listing database collections...');

    await mongodb.connect();
    const db = mongodb.getDb();

    const collections = await db.listCollections().toArray();

    console.log(`\n📊 Found ${collections.length} collections:\n`);

    for (const collection of collections) {
      const coll = db.collection(collection.name);
      const count = await coll.countDocuments();
      console.log(`  - ${collection.name}: ${count} documents`);

      if (count > 0 && count < 5) {
        const sample = await coll.findOne({});
        console.log(
          `    Sample keys:`,
          Object.keys(sample || {})
            .slice(0, 10)
            .join(', ')
        );
      }
    }
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await mongodb.disconnect();
  }
}

// Run check
listCollections()
  .then(() => {
    console.log('\n✅ Check completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Check failed:', error);
    process.exit(1);
  });
