#!/usr/bin/env tsx

/**
 * Fund Import Script
 * Run this script to import funds, managers, and price history
 *
 * Usage:
 *   npm run import:funds
 *   npm run import:funds -- --etfs=30 --mutual-funds=70
 *   npm run import:prices
 *   npm run import:update-navs
 */

import { mongodb } from '../db/mongodb';

async function main() {
  try {
    // Connect to database FIRST, before importing models
    console.log('🔌 Connecting to MongoDB...');
    await mongodb.connect();
    console.log('✅ Connected to MongoDB\n');

    // NOW import the orchestrator (which will import models)
    const { fundIngestionOrchestrator } = await import(
      '../services/importers/orchestrator'
    );

    // Parse command line arguments
    const args = process.argv.slice(2);
    const command = args[0] || 'all';

    switch (command) {
      case 'all':
      case 'funds': {
        // Import all funds
        const etfLimit = parseInt(
          args.find((a) => a.startsWith('--etfs='))?.split('=')[1] || '50'
        );
        const mfLimit = parseInt(
          args.find((a) => a.startsWith('--mutual-funds='))?.split('=')[1] ||
            '100'
        );

        await fundIngestionOrchestrator.importAllFunds({
          etfLimit,
          mutualFundLimit: mfLimit,
          skipExisting: true,
        });
        break;
      }

      case 'prices':
      case 'history': {
        // Import historical prices
        const fundIds = args.slice(1);
        if (fundIds.length === 0) {
          console.error('❌ Please provide fund IDs to import prices for');
          console.log(
            'Example: npm run import:funds prices SPY QQQ NIFTYBEES.NS'
          );
          process.exit(1);
        }

        await fundIngestionOrchestrator.importHistoricalPrices(fundIds, '1y');
        break;
      }

      case 'update-navs':
      case 'navs': {
        // Update latest NAVs
        await fundIngestionOrchestrator.updateLatestNAVs();
        break;
      }

      default:
        console.error(`❌ Unknown command: ${command}`);
        console.log('\nAvailable commands:');
        console.log('  all, funds     - Import all funds and managers');
        console.log('  prices, history - Import historical prices');
        console.log('  update-navs, navs - Update latest NAVs');
        process.exit(1);
    }

    console.log('\n🎉 All done!');
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the script
main();
