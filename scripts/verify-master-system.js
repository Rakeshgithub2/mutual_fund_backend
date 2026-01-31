/**
 * ═══════════════════════════════════════════════════════════════════════
 * MASTER VERIFICATION SCRIPT
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Validates entire system after fixes:
 * - Fund counts by category & subcategory
 * - News articles (daily 20)
 * - Market indices (updating every 5 min)
 * - Data quality checks
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Fund = require('../src/models/Fund.model');
const MarketNews = require('../src/models/MarketNews.model');
const MarketIndices = require('../src/models/MarketIndices.model');

const DATABASE_URL = process.env.DATABASE_URL;

async function verifySystem() {
  try {
    console.log('═══════════════════════════════════════════════════════');
    console.log('🔍 MASTER SYSTEM VERIFICATION');
    console.log('═══════════════════════════════════════════════════════\n');

    await mongoose.connect(DATABASE_URL);
    console.log('✅ Connected to MongoDB Atlas\n');

    // ========== FUNDS VERIFICATION ==========
    console.log('📊 FUNDS VERIFICATION');
    console.log('───────────────────────────────────────────────────────\n');

    const totalFunds = await Fund.countDocuments();
    console.log(`Total Funds: ${totalFunds.toLocaleString()}`);

    if (totalFunds >= 15000) {
      console.log('✅ PASSED: Total funds >= 15,000\n');
    } else {
      console.log(`⚠️  WARNING: Total funds ${totalFunds} < 15,000\n`);
    }

    // Count by category
    console.log('Count by Category:');
    const categories = ['Equity', 'Debt', 'Commodity'];
    for (const cat of categories) {
      const count = await Fund.countDocuments({ category: cat });
      const percentage = ((count / totalFunds) * 100).toFixed(1);
      console.log(`  ${cat}: ${count.toLocaleString()} (${percentage}%)`);

      // Verify commodity minimum
      if (cat === 'Commodity') {
        if (count >= 500) {
          console.log(`  ✅ PASSED: Commodity funds >= 500`);
        } else {
          console.log(`  ❌ FAILED: Commodity funds ${count} < 500`);
        }
      }
    }

    // Count by subcategory
    console.log('\nCount by Subcategory:');
    for (const cat of categories) {
      const subcats = await Fund.aggregate([
        { $match: { category: cat } },
        { $group: { _id: '$subCategory', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]);

      console.log(`\n  ${cat}:`);
      subcats.forEach((sub) => {
        console.log(`    ${sub._id}: ${sub.count.toLocaleString()}`);
      });

      // Verify commodity subcategory minimums
      if (cat === 'Commodity') {
        const gold = subcats.find((s) => s._id === 'gold')?.count || 0;
        const silver = subcats.find((s) => s._id === 'silver')?.count || 0;
        const multicommodity =
          subcats.find((s) => s._id === 'multicommodity')?.count || 0;

        console.log('');
        if (gold >= 200)
          console.log(`    ✅ Gold >= 200 (${gold.toLocaleString()})`);
        else console.log(`    ❌ Gold < 200 (${gold.toLocaleString()})`);

        if (silver >= 150)
          console.log(`    ✅ Silver >= 150 (${silver.toLocaleString()})`);
        else console.log(`    ❌ Silver < 150 (${silver.toLocaleString()})`);

        if (multicommodity >= 150)
          console.log(
            `    ✅ Multicommodity >= 150 (${multicommodity.toLocaleString()})`
          );
        else
          console.log(
            `    ❌ Multicommodity < 150 (${multicommodity.toLocaleString()})`
          );
      }
    }

    // Data quality checks
    console.log('\n\n📊 DATA QUALITY CHECKS');
    console.log('───────────────────────────────────────────────────────\n');

    const withBenchmark = await Fund.countDocuments({
      benchmark: { $exists: true, $ne: null },
    });
    const withRiskLevel = await Fund.countDocuments({
      riskLevel: { $exists: true, $ne: null },
    });
    const withHoldings = await Fund.countDocuments({
      holdings: { $exists: true, $not: { $size: 0 } },
    });

    console.log(
      `Funds with Benchmark: ${withBenchmark.toLocaleString()} (${((withBenchmark / totalFunds) * 100).toFixed(1)}%)`
    );
    console.log(
      `Funds with Risk Level: ${withRiskLevel.toLocaleString()} (${((withRiskLevel / totalFunds) * 100).toFixed(1)}%)`
    );
    console.log(
      `Funds with Holdings: ${withHoldings.toLocaleString()} (${((withHoldings / totalFunds) * 100).toFixed(1)}%)`
    );

    // Sample fund
    console.log('\nSample Fund:');
    const sampleFund = await Fund.findOne({ category: 'Commodity' }).lean();
    if (sampleFund) {
      console.log(`  Name: ${sampleFund.schemeName}`);
      console.log(`  Category: ${sampleFund.category}`);
      console.log(`  Subcategory: ${sampleFund.subCategory}`);
      console.log(`  Benchmark: ${sampleFund.benchmark || 'N/A'}`);
      console.log(`  Risk Level: ${sampleFund.riskLevel || 'N/A'}`);
      console.log(`  Holdings: ${sampleFund.holdings?.length || 0}`);
      console.log(`  Sectors: ${sampleFund.sectors?.length || 0}`);
    }

    // ========== NEWS VERIFICATION ==========
    console.log('\n\n📰 NEWS VERIFICATION');
    console.log('───────────────────────────────────────────────────────\n');

    const totalNews = await MarketNews.countDocuments();
    console.log(`Total News Articles: ${totalNews}`);

    if (totalNews >= 20) {
      console.log('✅ PASSED: News articles >= 20\n');
    } else {
      console.log(`⚠️  WARNING: News articles ${totalNews} < 20`);
      console.log('   Run: node jobs/update-news.job.js\n');
    }

    // News by category
    const newsCategories = await MarketNews.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    console.log('News by Category:');
    newsCategories.forEach((cat) => {
      console.log(`  ${cat._id}: ${cat.count}`);
    });

    // Recent news
    const recentNews = await MarketNews.findOne()
      .sort({ published_at: -1 })
      .lean();
    if (recentNews) {
      const hoursAgo = Math.floor(
        (Date.now() - new Date(recentNews.published_at)) / 3600000
      );
      console.log(`\nMost Recent News:`);
      console.log(`  Published: ${hoursAgo} hours ago`);
      console.log(`  Title: ${recentNews.title.substring(0, 60)}...`);
    }

    // ========== MARKET INDICES VERIFICATION ==========
    console.log('\n\n📈 MARKET INDICES VERIFICATION');
    console.log('───────────────────────────────────────────────────────\n');

    const totalIndices = await MarketIndices.countDocuments();
    console.log(`Total Indices: ${totalIndices}`);

    const indices = await MarketIndices.find().sort({ name: 1 }).lean();

    if (indices.length >= 3) {
      console.log('✅ PASSED: All 3 indices present\n');
    } else {
      console.log(`⚠️  WARNING: Only ${indices.length} indices found`);
      console.log('   Run: node jobs/update-indices.job.js\n');
    }

    indices.forEach((idx) => {
      const minutesAgo = Math.floor(
        (Date.now() - new Date(idx.updated_at)) / 60000
      );
      const status = minutesAgo <= 10 ? '✅' : '⚠️ ';
      console.log(
        `${status} ${idx.name.toUpperCase()}: ${idx.value.toFixed(2)} (${idx.change > 0 ? '+' : ''}${idx.change.toFixed(2)} | ${idx.percent_change.toFixed(2)}%)`
      );
      console.log(`   Updated: ${minutesAgo} minutes ago`);
    });

    // ========== SUMMARY ==========
    console.log('\n\n═══════════════════════════════════════════════════════');
    console.log('📊 VERIFICATION SUMMARY');
    console.log('═══════════════════════════════════════════════════════\n');

    const checks = [
      { name: 'Total Funds >= 15,000', passed: totalFunds >= 15000 },
      {
        name: 'Commodity Funds >= 500',
        passed: (await Fund.countDocuments({ category: 'Commodity' })) >= 500,
      },
      { name: 'News Articles = 20', passed: totalNews === 20 },
      { name: 'Market Indices Present', passed: indices.length >= 3 },
      {
        name: 'Indices Recently Updated',
        passed: indices.every(
          (idx) => Date.now() - new Date(idx.updated_at) < 600000
        ),
      },
    ];

    checks.forEach((check) => {
      console.log(`${check.passed ? '✅' : '❌'} ${check.name}`);
    });

    const allPassed = checks.every((c) => c.passed);

    console.log('\n═══════════════════════════════════════════════════════');
    if (allPassed) {
      console.log('✅ ALL CHECKS PASSED - SYSTEM READY');
    } else {
      console.log('⚠️  SOME CHECKS FAILED - REVIEW ABOVE');
    }
    console.log('═══════════════════════════════════════════════════════\n');

    await mongoose.connection.close();
    process.exit(allPassed ? 0 : 1);
  } catch (error) {
    console.error('\n❌ Verification failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  verifySystem();
}

module.exports = { verifySystem };
