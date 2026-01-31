/**
 * Initialization Script
 * Sets up all required data, indexes, and services
 */

import mongoose from 'mongoose';
import MarketCalendarService from '../services/market-calendar.service';
import MarketIndicesService from '../services/market-indices.service';

export async function initializeSystem() {
  console.log('🚀 Initializing Financial Data System...\n');

  try {
    // Step 1: Connect to MongoDB
    console.log('📦 Connecting to MongoDB...');
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(process.env.DATABASE_URL || '');
      console.log('✅ MongoDB connected\n');
    }

    // Step 2: Seed market calendar with 2026 holidays
    console.log('📅 Setting up market calendar...');
    const holidaysResult = await MarketCalendarService.seed2026Holidays();
    console.log(
      `✅ Added/updated ${holidaysResult.upsertedCount + holidaysResult.modifiedCount} holidays\n`
    );

    // Step 3: Initialize market indices
    console.log('📈 Initializing market indices...');
    await MarketIndicesService.initializeIndices();
    console.log('✅ Market indices initialized\n');

    // Step 4: Check market status
    console.log('🔍 Checking market status...');
    const marketStatus = await MarketCalendarService.getMarketStatus();
    console.log(
      `Market Status: ${marketStatus.isOpen ? '🟢 OPEN' : '🔴 CLOSED'}`
    );
    if (!marketStatus.isOpen) {
      console.log(`Reason: ${marketStatus.reason}`);
    }
    console.log(`Current Time: ${marketStatus.currentTime}\n`);

    console.log('✅ System initialization completed successfully!\n');

    return {
      success: true,
      message: 'System initialized successfully',
    };
  } catch (error: any) {
    console.error('❌ Initialization failed:', error.message);
    throw error;
  }
}

// Run if executed directly
if (require.main === module) {
  initializeSystem()
    .then(() => {
      console.log('✅ Done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Error:', error);
      process.exit(1);
    });
}

export default initializeSystem;
