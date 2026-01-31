#!/usr/bin/env tsx

/**
 * COMPREHENSIVE AMFI FUND IMPORT SCRIPT
 *
 * Imports complete Indian Mutual Fund universe (2,500-3,000 funds)
 * from AMFI with SEBI-aligned categories and zero-NA policy enforcement
 *
 * Usage:
 *   npm run import:comprehensive-amfi
 *   tsx src/scripts/import-comprehensive-amfi.ts
 *
 * Options:
 *   --limit=N - Limit import to N funds (for testing)
 *   --amc="AMC Name" - Import only from specific AMC
 */

import { ComprehensiveAMFIImporter } from '../services/importers/comprehensive-amfi.importer';
import { mongodb } from '../db/mongodb';

async function main() {
  console.log(
    '╔════════════════════════════════════════════════════════════════╗'
  );
  console.log(
    '║   COMPREHENSIVE AMFI IMPORT - Indian Mutual Fund Universe     ║'
  );
  console.log(
    '║   Target: 2,500-3,000 funds from all SEBI-registered AMCs     ║'
  );
  console.log(
    '╚════════════════════════════════════════════════════════════════╝'
  );
  console.log('');

  try {
    // Connect to MongoDB
    await mongodb.connect();
    console.log('✅ Connected to MongoDB');
    console.log('');

    // Parse command line arguments
    const args = process.argv.slice(2);
    const amcFilter = args
      .find((arg) => arg.startsWith('--amc='))
      ?.split('=')[1];
    const limitArg = args.find((arg) => arg.startsWith('--limit='));
    const limit = limitArg ? parseInt(limitArg.split('=')[1]) : undefined;

    // Create importer
    const importer = new ComprehensiveAMFIImporter();

    // Run import
    console.log('🚀 Starting import...');
    if (amcFilter) {
      console.log(`📍 Filtering to AMC: ${amcFilter}`);
    }
    if (limit) {
      console.log(`📍 Limiting to ${limit} funds (test mode)`);
    }
    console.log('');

    const result = await importer.importCompleteFunds({
      onlyFromAMCs: amcFilter ? [amcFilter] : [],
      skipValidation: false,
      enforceSEBICategories: true,
    });

    // Display results
    console.log('');
    console.log(
      '╔════════════════════════════════════════════════════════════════╗'
    );
    console.log(
      '║                      IMPORT COMPLETE                           ║'
    );
    console.log(
      '╚════════════════════════════════════════════════════════════════╝'
    );
    console.log('');
    console.log(`✅ Status: ${result.success ? 'SUCCESS' : 'FAILED'}`);
    console.log(`➕ Funds Added: ${result.fundsAdded}`);
    console.log(`🔄 Funds Updated: ${result.fundsUpdated}`);
    console.log(`⏭️  Funds Skipped: ${result.fundsSkipped}`);
    console.log(
      `📊 Total Processed: ${result.fundsAdded + result.fundsUpdated + result.fundsSkipped}`
    );

    if (result.errors.length > 0) {
      console.log('');
      console.log(`⚠️  Errors (${result.errors.length}):`);
      result.errors.slice(0, 10).forEach((error) => {
        console.log(`   - ${error}`);
      });
      if (result.errors.length > 10) {
        console.log(`   ... and ${result.errors.length - 10} more`);
      }
    }

    console.log('');
    console.log('✅ Import completed successfully!');
    console.log('');

    // Get statistics
    const fundsCollection = mongodb.getCollection('funds');
    const totalFunds = await fundsCollection.countDocuments();
    const visibleFunds = await fundsCollection.countDocuments({
      isPubliclyVisible: true,
    });
    const hiddenFunds = totalFunds - visibleFunds;

    console.log('📈 DATABASE STATISTICS');
    console.log('═══════════════════════');
    console.log(`Total Funds: ${totalFunds}`);
    console.log(`Publicly Visible (Zero-NA): ${visibleFunds}`);
    console.log(`Hidden (Incomplete Data): ${hiddenFunds}`);

    // Category breakdown
    const categoryStats = await fundsCollection
      .aggregate([
        { $match: { isPubliclyVisible: true } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ])
      .toArray();

    console.log('');
    console.log('📊 VISIBLE FUNDS BY CATEGORY');
    console.log('═══════════════════════════════');
    categoryStats.forEach((stat: any) => {
      console.log(`${stat._id.toUpperCase().padEnd(20)}: ${stat.count} funds`);
    });
  } catch (error: any) {
    console.error('');
    console.error('❌ Import failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await mongodb.disconnect();
    console.log('');
    console.log('👋 Disconnected from MongoDB');
  }
}

main();
