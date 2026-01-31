/**
 * ═══════════════════════════════════════════════════════════════════════
 * VERIFY ALL MARKET INDICES
 * ═══════════════════════════════════════════════════════════════════════
 */

require('dotenv').config();
const mongoose = require('mongoose');
const MarketIndices = require('../src/models/MarketIndices.model');

const DATABASE_URL = process.env.DATABASE_URL;

const EXPECTED_INDICES = [
  { name: 'nifty50', displayName: 'NIFTY 50' },
  { name: 'sensex', displayName: 'S&P BSE SENSEX' },
  { name: 'niftymidcap', displayName: 'NIFTY MIDCAP 100' },
  { name: 'niftysmallcap', displayName: 'NIFTY SMALLCAP 250' },
  { name: 'niftybank', displayName: 'NIFTY BANK' },
  { name: 'niftyit', displayName: 'NIFTY IT' },
  { name: 'niftypharma', displayName: 'NIFTY PHARMA' },
  { name: 'niftyauto', displayName: 'NIFTY AUTO' },
  { name: 'niftyfmcg', displayName: 'NIFTY FMCG' },
  { name: 'niftymetal', displayName: 'NIFTY METAL' },
  { name: 'commodity', displayName: 'MCX COMMODITY' },
  { name: 'giftnifty', displayName: 'GIFT NIFTY' },
];

async function verifyAllIndices() {
  try {
    console.log('🔍 Verifying Market Indices System...\n');

    // Connect to MongoDB
    await mongoose.connect(DATABASE_URL);
    console.log('✅ Connected to MongoDB\n');

    // Fetch all indices from database
    const indices = await MarketIndices.find().sort({ name: 1 }).lean();

    console.log('═══════════════════════════════════════════════════════');
    console.log('📊 MARKET INDICES VERIFICATION REPORT');
    console.log('═══════════════════════════════════════════════════════\n');

    console.log(`Total Expected: ${EXPECTED_INDICES.length}`);
    console.log(`Total Found: ${indices.length}\n`);

    // Check each expected index
    let foundCount = 0;
    let missingIndices = [];

    console.log('Individual Index Status:\n');

    for (const expected of EXPECTED_INDICES) {
      const found = indices.find((idx) => idx.name === expected.name);

      if (found) {
        foundCount++;
        const changeSymbol = found.change >= 0 ? '+' : '';
        const statusEmoji =
          found.change >= 0 ? '📈' : found.change < 0 ? '📉' : '━';

        console.log(
          `${statusEmoji} ${expected.displayName.padEnd(25)} | Value: ${found.value.toFixed(2).padStart(12)} | Change: ${changeSymbol}${found.change.toFixed(2).padStart(8)} (${changeSymbol}${found.percent_change.toFixed(2)}%)`
        );
      } else {
        missingIndices.push(expected.displayName);
        console.log(`❌ ${expected.displayName.padEnd(25)} | NOT FOUND`);
      }
    }

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('SUMMARY');
    console.log('═══════════════════════════════════════════════════════\n');

    console.log(`✅ Found: ${foundCount}/${EXPECTED_INDICES.length}`);

    if (missingIndices.length > 0) {
      console.log(`❌ Missing: ${missingIndices.length}`);
      console.log(`   Indices: ${missingIndices.join(', ')}\n`);
      console.log('⚠️  Run: npm run update:indices');
    } else {
      console.log('✅ All indices present!\n');
    }

    // Data Quality Checks
    console.log('═══════════════════════════════════════════════════════');
    console.log('DATA QUALITY CHECKS');
    console.log('═══════════════════════════════════════════════════════\n');

    const now = new Date();
    let staleCount = 0;

    for (const index of indices) {
      const ageMinutes = (now - new Date(index.updated_at)) / 1000 / 60;

      if (ageMinutes > 30) {
        staleCount++;
        console.log(
          `⚠️  ${index.name}: Data is ${Math.round(ageMinutes)} minutes old`
        );
      }
    }

    if (staleCount === 0) {
      console.log('✅ All indices have fresh data (< 30 minutes old)');
    } else {
      console.log(
        `\n⚠️  ${staleCount} indices have stale data. Consider running update job.`
      );
    }

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('TOP GAINERS & LOSERS');
    console.log('═══════════════════════════════════════════════════════\n');

    // Sort by percent change
    const sortedByGain = [...indices].sort(
      (a, b) => b.percent_change - a.percent_change
    );

    console.log('📈 Top 3 Gainers:\n');
    for (let i = 0; i < Math.min(3, sortedByGain.length); i++) {
      const idx = sortedByGain[i];
      console.log(
        `   ${i + 1}. ${idx.name.toUpperCase().padEnd(20)} +${idx.percent_change.toFixed(2)}% (${idx.value.toFixed(2)})`
      );
    }

    console.log('\n📉 Top 3 Losers:\n');
    for (
      let i = sortedByGain.length - 1;
      i >= Math.max(0, sortedByGain.length - 3);
      i--
    ) {
      const idx = sortedByGain[i];
      console.log(
        `   ${sortedByGain.length - i}. ${idx.name.toUpperCase().padEnd(20)} ${idx.percent_change.toFixed(2)}% (${idx.value.toFixed(2)})`
      );
    }

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('API ENDPOINT TEST');
    console.log('═══════════════════════════════════════════════════════\n');

    console.log('Available Endpoints:\n');
    console.log('  GET http://localhost:3002/api/indices');
    console.log('  GET http://localhost:3002/api/indices/:name\n');

    console.log('Example Requests:\n');
    console.log('  curl http://localhost:3002/api/indices');
    console.log('  curl http://localhost:3002/api/indices/nifty50');
    console.log('  curl http://localhost:3002/api/indices/sensex');

    console.log('\n✅ Verification Complete!\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Run verification
verifyAllIndices();
