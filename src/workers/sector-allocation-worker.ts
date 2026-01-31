#!/usr/bin/env ts-node

/**
 * Sector Allocation Worker
 *
 * Background job to process equity funds missing sector allocation data
 *
 * Usage:
 *   npm run worker:sectors              # Process 100 funds
 *   npm run worker:sectors -- --limit=500  # Process 500 funds
 *   npm run worker:sectors -- --stats     # Show statistics only
 */

import { mongodb } from '../db/mongodb';
import { SectorAllocationService } from '../services/sectorAllocation.service';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  try {
    console.log('🚀 Sector Allocation Worker Started\n');

    // Parse command line arguments
    const args = process.argv.slice(2);
    const limitArg = args.find((arg) => arg.startsWith('--limit='));
    const statsOnly = args.includes('--stats');
    const limit = limitArg ? parseInt(limitArg.split('=')[1]) : 100;

    // Connect to database
    console.log('📡 Connecting to MongoDB...');
    await mongodb.connect();
    console.log('✅ Connected to MongoDB\n');

    // Show statistics
    console.log('📊 Current Statistics:');
    const stats = await SectorAllocationService.getStats();
    console.log(`   Total Equity Funds: ${stats.totalEquityFunds}`);
    console.log(`   ✅ Funds with Sectors: ${stats.fundsWithSectors}`);
    console.log(`   ❌ Funds without Sectors: ${stats.fundsWithoutSectors}`);
    console.log(`   📈 Coverage: ${stats.coveragePercent}%\n`);

    if (statsOnly) {
      console.log('ℹ️  Stats-only mode. Exiting...');
      process.exit(0);
    }

    if (stats.fundsWithoutSectors === 0) {
      console.log('✅ All equity funds already have sector allocation!');
      process.exit(0);
    }

    // Process funds
    console.log(
      `🔄 Processing ${Math.min(limit, stats.fundsWithoutSectors)} funds...\n`
    );
    await SectorAllocationService.processAllFunds(limit);

    // Show updated statistics
    console.log('\n📊 Updated Statistics:');
    const updatedStats = await SectorAllocationService.getStats();
    console.log(`   Total Equity Funds: ${updatedStats.totalEquityFunds}`);
    console.log(`   ✅ Funds with Sectors: ${updatedStats.fundsWithSectors}`);
    console.log(
      `   ❌ Funds without Sectors: ${updatedStats.fundsWithoutSectors}`
    );
    console.log(`   📈 Coverage: ${updatedStats.coveragePercent}%`);
    console.log(
      `   🎯 Improvement: +${(updatedStats.coveragePercent - stats.coveragePercent).toFixed(2)}%\n`
    );

    console.log('✅ Worker completed successfully');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Worker failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run worker
main();
