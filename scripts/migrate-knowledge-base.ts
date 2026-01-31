/**
 * Script to migrate 1000 Q&A pairs from knowledge-base-1000-complete.ts to MongoDB
 */

import { PrismaClient } from '@prisma/client';
import { knowledgeBase } from '../src/data/knowledge-base-1000-complete';

const prisma = new PrismaClient();

async function migrateKnowledgeBase() {
  console.log('Starting knowledge base migration...');
  console.log(`Total questions to migrate: ${knowledgeBase.length}`);

  try {
    // Clear existing data
    console.log('Clearing existing knowledge base...');
    await prisma.knowledgeBase.deleteMany({});

    let successCount = 0;
    let errorCount = 0;

    // Insert all questions in batches
    const batchSize = 100;
    for (let i = 0; i < knowledgeBase.length; i += batchSize) {
      const batch = knowledgeBase.slice(i, i + batchSize);

      console.log(
        `Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(knowledgeBase.length / batchSize)}...`
      );

      for (const entry of batch) {
        try {
          // Create searchable text combining all fields
          const searchableText = [
            entry.question,
            entry.definition,
            ...entry.points,
            ...entry.keywords,
            entry.formula || '',
          ]
            .join(' ')
            .toLowerCase();

          await prisma.knowledgeBase.create({
            data: {
              questionId: entry.id,
              question: entry.question,
              keywords: entry.keywords,
              definition: entry.definition,
              points: entry.points,
              category: entry.category,
              level: entry.level,
              relatedQuestions: entry.relatedQuestions || [],
              formula: entry.formula || null,
              searchableText,
            },
          });
          successCount++;
        } catch (error) {
          console.error(`Error migrating question ${entry.id}:`, error);
          errorCount++;
        }
      }
    }

    console.log('\n=== Migration Complete ===');
    console.log(`✓ Successfully migrated: ${successCount} questions`);
    console.log(`✗ Failed: ${errorCount} questions`);
    console.log(`Total: ${knowledgeBase.length} questions`);

    // Verify migration
    const count = await prisma.knowledgeBase.count();
    console.log(`\nVerification: ${count} questions in database`);

    // Display categories
    const categories = await prisma.knowledgeBase.groupBy({
      by: ['category'],
      _count: {
        category: true,
      },
    });

    console.log('\nQuestions by category:');
    categories.forEach((cat) => {
      console.log(`  ${cat.category}: ${cat._count.category}`);
    });
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration
migrateKnowledgeBase()
  .then(() => {
    console.log('\n✓ Migration script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n✗ Migration script failed:', error);
    process.exit(1);
  });
