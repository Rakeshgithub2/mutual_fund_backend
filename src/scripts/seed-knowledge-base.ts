/**
 * Seed Knowledge Base to MongoDB
 * Run this script to populate the knowledge_base collection
 *
 * Usage: npx ts-node src/scripts/seed-knowledge-base.ts
 */

import { mongodb } from '../db/mongodb';
import { knowledgeBase } from '../data/knowledge-base-1000-complete';

async function seedKnowledgeBase() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongodb.connect();

    const collection = mongodb.getCollection('knowledge_base');

    // Clear existing data
    const existingCount = await collection.countDocuments();
    if (existingCount > 0) {
      console.log(`🗑️ Clearing ${existingCount} existing entries...`);
      await collection.deleteMany({});
    }

    // Insert all knowledge entries
    console.log(`📚 Inserting ${knowledgeBase.length} knowledge entries...`);
    await collection.insertMany(knowledgeBase);

    // Create text index for searching
    console.log('🔍 Creating search index...');
    try {
      await collection.dropIndex('knowledge_search_index');
    } catch (e) {
      // Index might not exist
    }

    await collection.createIndex(
      {
        question: 'text',
        keywords: 'text',
        definition: 'text',
        points: 'text',
      },
      {
        weights: {
          question: 10,
          keywords: 8,
          definition: 5,
          points: 3,
        },
        name: 'knowledge_search_index',
      }
    );

    // Verify
    const count = await collection.countDocuments();
    console.log(`✅ Successfully seeded ${count} knowledge base entries!`);

    // Show sample
    const sample = await collection.findOne({ id: 1 });
    console.log('\n📖 Sample entry:');
    console.log(JSON.stringify(sample, null, 2));

    // Show categories breakdown
    const categories = await collection
      .aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }])
      .toArray();

    console.log('\n📊 Entries by category:');
    categories.forEach((c) => {
      console.log(`   ${c._id}: ${c.count} questions`);
    });
  } catch (error) {
    console.error('❌ Error seeding knowledge base:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

seedKnowledgeBase();
