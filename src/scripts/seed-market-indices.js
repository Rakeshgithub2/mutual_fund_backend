/**
 * SEED MARKET INDICES
 * Populates market indices with current data
 */

require('dotenv').config();
const mongoose = require('mongoose');
const marketIndicesService = require('../services/marketIndices.service');

async function seedMarketIndices() {
  try {
    console.log(
      '╔════════════════════════════════════════════════════════════════╗'
    );
    console.log(
      '║         SEED MARKET INDICES FROM LIVE DATA                     ║'
    );
    console.log(
      '╚════════════════════════════════════════════════════════════════╝\n'
    );

    // Connect to MongoDB
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(process.env.DATABASE_URL);
    console.log('✅ Connected to MongoDB\n');

    // Force initial update using singleton
    console.log('🔄 Fetching live market data...\n');
    await marketIndicesService.forceInitialUpdate();

    // Wait for database writes to complete
    console.log('\n⏳ Waiting for database writes to complete...');
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Verify data was saved
    const MarketIndex = require('../models/MarketIndex.model');
    const count = await MarketIndex.countDocuments();
    console.log(`✅ Verified: ${count} indices saved to database\n`);

    if (count > 0) {
      const indices = await MarketIndex.find().lean();
      console.log('📊 Saved Indices:');
      indices.forEach((idx) => {
        console.log(
          `   - ${idx.name}: ${idx.value} (${idx.change.percent >= 0 ? '+' : ''}${idx.change.percent.toFixed(2)}%)`
        );
      });
    }

    console.log(
      '\n╔════════════════════════════════════════════════════════════════╗'
    );
    console.log(
      '║                    SEEDING COMPLETE                             ║'
    );
    console.log(
      '╚════════════════════════════════════════════════════════════════╝\n'
    );

    console.log('✅ Market indices seeded successfully!\n');

    console.log('💡 Next steps:');
    console.log(
      '   - Market indices will auto-update every 2 hours during market hours'
    );
    console.log(
      '   - Check status: curl http://localhost:3002/api/market/summary'
    );
    console.log(
      '   - View all indices: curl http://localhost:3002/api/market/indices\n'
    );

    // Disconnect
    console.log('👋 Disconnecting from MongoDB');
    await mongoose.disconnect();

    console.log('✅ Seeding completed successfully!\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding market indices:', error);
    process.exit(1);
  }
}

// Run the seed
seedMarketIndices();
