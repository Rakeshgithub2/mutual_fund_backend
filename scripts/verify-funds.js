/**
 * ═══════════════════════════════════════════════════════════════════════
 * FUND DATABASE VERIFICATION SCRIPT
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Validates that MongoDB contains 15,000+ funds with proper distribution
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Fund = require('../src/models/Fund.model');

const DATABASE_URL = process.env.DATABASE_URL;

// Expected distribution
const EXPECTED_DISTRIBUTION = {
  equity: { min: 6000, ratio: 0.4 },
  debt: { min: 5250, ratio: 0.35 },
  commodity: { min: 3750, ratio: 0.25 },
};

const MIN_TOTAL_FUNDS = 15000;

async function verifyDatabase() {
  try {
    console.log('═══════════════════════════════════════════════════════');
    console.log('📊 FUND DATABASE VERIFICATION');
    console.log('═══════════════════════════════════════════════════════\n');

    // Connect to MongoDB
    await mongoose.connect(DATABASE_URL);
    console.log('✅ Connected to MongoDB Atlas\n');

    // Total count
    const totalFunds = await Fund.countDocuments();
    console.log(`📈 TOTAL FUNDS: ${totalFunds.toLocaleString()}`);

    if (totalFunds < MIN_TOTAL_FUNDS) {
      console.log(
        `❌ FAILED: Expected minimum ${MIN_TOTAL_FUNDS.toLocaleString()}, got ${totalFunds.toLocaleString()}`
      );
    } else {
      console.log(
        `✅ PASSED: Meets minimum requirement of ${MIN_TOTAL_FUNDS.toLocaleString()}`
      );
    }

    console.log('\n───────────────────────────────────────────────────────');
    console.log('📊 CATEGORY DISTRIBUTION:');
    console.log('───────────────────────────────────────────────────────\n');

    let passedAll = totalFunds >= MIN_TOTAL_FUNDS;

    // Check each category
    for (const [category, expected] of Object.entries(EXPECTED_DISTRIBUTION)) {
      const count = await Fund.countDocuments({ category });
      const actualRatio = totalFunds > 0 ? count / totalFunds : 0;
      const status = count >= expected.min ? '✅' : '❌';

      console.log(`${status} ${category.toUpperCase()}`);
      console.log(
        `   Count: ${count.toLocaleString()} (Expected min: ${expected.min.toLocaleString()})`
      );
      console.log(
        `   Ratio: ${(actualRatio * 100).toFixed(1)}% (Target: ${(expected.ratio * 100).toFixed(0)}%)`
      );

      if (count < expected.min) {
        passedAll = false;
      }

      // Subcategory breakdown
      const subcategories = await Fund.aggregate([
        { $match: { category } },
        { $group: { _id: '$subcategory', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]);

      console.log('   Subcategories:');
      subcategories.forEach((sub) => {
        console.log(`      → ${sub._id}: ${sub.count.toLocaleString()}`);
      });
      console.log('');
    }

    console.log('───────────────────────────────────────────────────────');
    console.log('📊 AMC (FUND HOUSE) DISTRIBUTION:');
    console.log('───────────────────────────────────────────────────────\n');

    const topAMCs = await Fund.aggregate([
      { $group: { _id: '$amc', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    topAMCs.forEach((amc, index) => {
      console.log(`${index + 1}. ${amc._id}: ${amc.count} funds`);
    });

    console.log('\n───────────────────────────────────────────────────────');
    console.log('📊 DATA QUALITY CHECKS:');
    console.log('───────────────────────────────────────────────────────\n');

    // Check for required fields
    const missingNav = await Fund.countDocuments({ nav: { $exists: false } });
    const missingCategory = await Fund.countDocuments({
      category: { $exists: false },
    });
    const missingAMC = await Fund.countDocuments({ amc: { $exists: false } });

    console.log(
      `NAV field present: ${totalFunds - missingNav}/${totalFunds} ${missingNav === 0 ? '✅' : '⚠️'}`
    );
    console.log(
      `Category field present: ${totalFunds - missingCategory}/${totalFunds} ${missingCategory === 0 ? '✅' : '⚠️'}`
    );
    console.log(
      `AMC field present: ${totalFunds - missingAMC}/${totalFunds} ${missingAMC === 0 ? '✅' : '⚠️'}`
    );

    // Sample funds
    console.log('\n───────────────────────────────────────────────────────');
    console.log('📋 SAMPLE FUNDS:');
    console.log('───────────────────────────────────────────────────────\n');

    const sampleFunds = await Fund.find().limit(5).lean();
    sampleFunds.forEach((fund, index) => {
      console.log(`${index + 1}. ${fund.scheme_name}`);
      console.log(`   Code: ${fund.scheme_code}`);
      console.log(`   AMC: ${fund.amc}`);
      console.log(`   Category: ${fund.category} > ${fund.subcategory}`);
      console.log(`   NAV: ₹${fund.nav}`);
      console.log('');
    });

    console.log('═══════════════════════════════════════════════════════');

    if (passedAll) {
      console.log('✅ VERIFICATION PASSED: Database meets all requirements');
    } else {
      console.log(
        '❌ VERIFICATION FAILED: Database does not meet requirements'
      );
      console.log('   Run: node scripts/ingestion-engine.js');
    }

    console.log('═══════════════════════════════════════════════════════\n');

    await mongoose.connection.close();
    process.exit(passedAll ? 0 : 1);
  } catch (error) {
    console.error('\n❌ Verification failed:', error);
    process.exit(1);
  }
}

// Run verification
if (require.main === module) {
  verifyDatabase();
}

module.exports = { verifyDatabase };
