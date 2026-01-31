/**
 * ═══════════════════════════════════════════════════════════════════════
 * SYSTEM MONITOR - Track Update Status
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Monitors system health and update status
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Fund = require('../src/models/Fund.model');

const DATABASE_URL = process.env.DATABASE_URL;

async function monitorSystem() {
  try {
    console.log('═══════════════════════════════════════════════════════');
    console.log('🔍 SYSTEM HEALTH MONITOR');
    console.log('═══════════════════════════════════════════════════════\n');

    await mongoose.connect(DATABASE_URL);

    // Total funds
    const totalFunds = await Fund.countDocuments();
    console.log(`📊 Total Funds: ${totalFunds.toLocaleString()}\n`);

    // Category breakdown
    console.log('📈 Category Distribution:');
    const categories = ['equity', 'debt', 'commodity'];
    for (const cat of categories) {
      const count = await Fund.countDocuments({ category: cat });
      const pct = ((count / totalFunds) * 100).toFixed(1);
      console.log(
        `   ${cat.toUpperCase()}: ${count.toLocaleString()} (${pct}%)`
      );
    }

    // Recent updates
    console.log('\n⏰ Update Status:');

    const recentNAV = await Fund.findOne({ nav: { $exists: true } })
      .sort({ last_updated: -1 })
      .select('scheme_name last_updated nav_date')
      .lean();

    if (recentNAV) {
      const timeSince = Math.round(
        (Date.now() - new Date(recentNAV.last_updated)) / 60000
      );
      console.log(`   Last NAV Update: ${timeSince} minutes ago`);
      console.log(`   NAV Date: ${recentNAV.nav_date}`);
    }

    // Data quality
    console.log('\n✅ Data Quality:');
    const withNAV = await Fund.countDocuments({
      nav: { $exists: true, $ne: null },
    });
    const withReturns = await Fund.countDocuments({
      'returns.oneyear': { $exists: true },
    });
    const withAUM = await Fund.countDocuments({
      aum: { $exists: true, $ne: null },
    });

    console.log(
      `   Funds with NAV: ${withNAV.toLocaleString()} (${((withNAV / totalFunds) * 100).toFixed(1)}%)`
    );
    console.log(
      `   Funds with Returns: ${withReturns.toLocaleString()} (${((withReturns / totalFunds) * 100).toFixed(1)}%)`
    );
    console.log(
      `   Funds with AUM: ${withAUM.toLocaleString()} (${((withAUM / totalFunds) * 100).toFixed(1)}%)`
    );

    // Top performing funds (1Y)
    console.log('\n🏆 Top 5 Performing Funds (1Y):');
    const topFunds = await Fund.find({ 'returns.oneyear': { $exists: true } })
      .sort({ 'returns.oneyear': -1 })
      .limit(5)
      .select('scheme_name category returns.oneyear')
      .lean();

    topFunds.forEach((fund, i) => {
      console.log(`   ${i + 1}. ${fund.scheme_name}`);
      console.log(
        `      Category: ${fund.category} | 1Y Return: ${fund.returns?.oneyear?.toFixed(2)}%`
      );
    });

    // AMC distribution
    console.log('\n🏢 Top 5 AMCs by Fund Count:');
    const topAMCs = await Fund.aggregate([
      { $group: { _id: '$amc', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]);

    topAMCs.forEach((amc, i) => {
      console.log(`   ${i + 1}. ${amc._id}: ${amc.count} funds`);
    });

    // System recommendations
    console.log('\n💡 Recommendations:');
    if (totalFunds < 15000) {
      console.log('   ⚠️  Run: npm run ingest:funds (Fund count below 15,000)');
    } else {
      console.log('   ✅ Fund database is healthy');
    }

    if (recentNAV && Date.now() - new Date(recentNAV.last_updated) > 7200000) {
      console.log('   ⚠️  NAV data is stale (>2 hours old)');
    } else {
      console.log('   ✅ NAV updates are current');
    }

    console.log('\n═══════════════════════════════════════════════════════\n');

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Monitor error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  monitorSystem();
}

module.exports = { monitorSystem };
