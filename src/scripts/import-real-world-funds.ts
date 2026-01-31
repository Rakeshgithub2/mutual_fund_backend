#!/usr/bin/env tsx

/**
 * Real-World Fund Data Import Script
 * Fetches 100+ equity funds and 50+ commodity funds from real APIs
 */

import { mongodb } from '../db/mongodb';

async function main() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongodb.connect();
    console.log('✅ Connected to MongoDB\n');

    // Import the orchestrator
    const { fundIngestionOrchestrator } = await import(
      '../services/importers/orchestrator'
    );

    // Parse command line arguments
    const args = process.argv.slice(2);
    const equityCount = parseInt(
      args.find((a) => a.startsWith('--equity='))?.split('=')[1] || '100'
    );
    const commodityCount = parseInt(
      args.find((a) => a.startsWith('--commodity='))?.split('=')[1] || '50'
    );

    console.log('🎯 Import Configuration:');
    console.log(`   • Equity Funds Target: ${equityCount}`);
    console.log(`   • Commodity Funds Target: ${commodityCount}`);
    console.log('');

    // Start the enhanced import
    const stats = await fundIngestionOrchestrator.importRealWorldFunds({
      equityCount,
      commodityCount,
      skipExisting: true,
    });

    console.log('\n🎉 Real-world data import completed successfully!');
    console.log('\n📊 Final Statistics:');
    console.log(`   • Total Funds Imported: ${stats.totalImported}`);
    console.log(`   • Equity Funds: ${stats.equity}`);
    console.log(`     - Large Cap: ~${Math.floor(stats.equity * 0.3)}`);
    console.log(`     - Mid Cap: ~${Math.floor(stats.equity * 0.25)}`);
    console.log(`     - Small Cap: ~${Math.floor(stats.equity * 0.2)}`);
    console.log(`     - Multi Cap: ~${Math.floor(stats.equity * 0.25)}`);
    console.log(`   • Commodity Funds: ${stats.commodity}`);
    console.log(`     - Gold/Silver/Commodity Mix`);
    console.log(`   • Fund Managers: ${stats.managers}`);

    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Import failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the script
main();
