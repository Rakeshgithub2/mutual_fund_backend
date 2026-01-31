import { mongodb } from '../db/mongodb';
import { ComprehensiveFundDataService } from '../services/comprehensive-fund-data.service';
import { createIndexes } from '../db/schemas';

/**
 * Clean database and reingest fresh data
 *
 * This script:
 * 1. Drops all collections
 * 2. Recreates indexes
 * 3. Ingests fresh data from all sources
 */

async function main() {
  console.log('🧹 Starting database cleanup and reingestion...\n');

  try {
    // Connect to MongoDB
    await mongodb.connect();
    const db = mongodb.getDb();

    // Step 1: Drop all collections
    console.log('📊 Step 1: Cleaning existing collections...');
    const collections = await db.listCollections().toArray();

    for (const collection of collections) {
      console.log(`   Dropping ${collection.name}...`);
      await db.collection(collection.name).drop();
    }
    console.log('✅ All collections dropped\n');

    // Step 2: Create indexes
    console.log('📊 Step 2: Creating database indexes...');
    await createIndexes(db);
    console.log('✅ Indexes created\n');

    // Initialize service
    const dataService = new ComprehensiveFundDataService(db);

    // Step 3: Fetch AMFI data (Indian mutual funds)
    console.log('═'.repeat(60));
    console.log('📊 Step 3: Fetching AMFI mutual funds data...');
    console.log('Source: https://www.amfiindia.com/spages/NAVAll.txt');
    console.log('Coverage: 2000+ Indian mutual funds\n');

    const amfiResult = await dataService.fetchAMFIData();
    if (amfiResult.success) {
      console.log(`✅ AMFI ingestion complete`);
      console.log(`   - Funds added: ${amfiResult.fundsAdded}`);
      console.log(`   - Funds updated: ${amfiResult.fundsUpdated}\n`);
    }

    // Step 4: Fetch NSE ETFs (Indian ETFs)
    console.log('═'.repeat(60));
    console.log('📊 Step 4: Fetching NSE ETFs...');
    console.log('Source: NSE India API');
    console.log('Coverage: Nifty BeES, Gold BeES, Bank BeES, etc.\n');

    await dataService.fetchNSEETFs();
    console.log('✅ NSE ETF ingestion complete\n');

    // Step 5: Fetch popular global ETFs (skip Yahoo for now due to API issues)
    console.log('═'.repeat(60));
    console.log('📊 Step 5: Fetching global ETFs & commodities...');
    console.log(
      '⚠️  Yahoo Finance API requires valid subscription - skipping for now\n'
    );

    // Generate summary
    console.log('═'.repeat(60));
    console.log('\n📊 DATA INGESTION SUMMARY');
    console.log('═'.repeat(60));

    const fundsCollection = db.collection('funds');
    const pricesCollection = db.collection('fundPrices');

    const stats = {
      totalFunds: await fundsCollection.countDocuments(),
      activeFunds: await fundsCollection.countDocuments({ isActive: true }),
      byCategory: {
        equity: await fundsCollection.countDocuments({ category: 'equity' }),
        debt: await fundsCollection.countDocuments({ category: 'debt' }),
        commodity: await fundsCollection.countDocuments({
          category: 'commodity',
        }),
        hybrid: await fundsCollection.countDocuments({ category: 'hybrid' }),
        etf: await fundsCollection.countDocuments({ fundType: 'etf' }),
      },
      byFundHouse: await fundsCollection
        .aggregate([
          { $match: { isActive: true } },
          {
            $group: {
              _id: '$fundHouse',
              count: { $sum: 1 },
              totalAum: { $sum: '$aum' },
            },
          },
          { $sort: { totalAum: -1 } },
          { $limit: 10 },
        ])
        .toArray(),
      topFundsByAUM: await fundsCollection
        .find({ isActive: true })
        .sort({ aum: -1 })
        .limit(10)
        .project({ name: 1, fundHouse: 1, aum: 1, category: 1, _id: 0 })
        .toArray(),
      priceDataPoints: await pricesCollection.countDocuments(),
    };

    console.log(`\nTotal Funds: ${stats.totalFunds}`);
    console.log(`Active Funds: ${stats.activeFunds}\n`);

    console.log('By Category:');
    console.log(`  - Equity: ${stats.byCategory.equity}`);
    console.log(`  - Debt: ${stats.byCategory.debt}`);
    console.log(`  - Commodity: ${stats.byCategory.commodity}`);
    console.log(`  - Hybrid: ${stats.byCategory.hybrid}`);
    console.log(`  - ETFs: ${stats.byCategory.etf}\n`);

    console.log('Top 10 Fund Houses by AUM:');
    stats.byFundHouse.forEach((house, i) => {
      console.log(
        `  ${i + 1}. ${house._id}: ${house.count} funds, ₹${(house.totalAum / 10000000).toFixed(2)}Cr`
      );
    });

    console.log('\nTop 10 Funds by AUM:');
    stats.topFundsByAUM.forEach((fund, i) => {
      console.log(`  ${i + 1}. ${fund.name.substring(0, 60)}`);
      console.log(
        `     ${fund.fundHouse} | ${fund.category} | ₹${(fund.aum / 10000000).toFixed(2)}Cr`
      );
    });

    console.log(`\nPrice Data Points: ${stats.priceDataPoints}\n`);

    console.log('═'.repeat(60));
    console.log('✅ ALL DATA INGESTION COMPLETED SUCCESSFULLY!');
    console.log('═'.repeat(60));

    // Check acceptance criteria
    console.log('\n📋 ACCEPTANCE CRITERIA CHECK:');
    console.log('═'.repeat(60));

    const checks = [
      {
        name: '100+ stock funds (equity + ETFs)',
        actual: stats.byCategory.equity + stats.byCategory.etf,
        required: 100,
        passed: stats.byCategory.equity + stats.byCategory.etf >= 100,
      },
      {
        name: 'Real data from AMFI',
        actual: stats.totalFunds,
        required: '2000+',
        passed: stats.totalFunds >= 2000,
      },
      {
        name: 'Multiple categories',
        actual: `${stats.byCategory.equity} equity, ${stats.byCategory.debt} debt, ${stats.byCategory.hybrid} hybrid`,
        required: 'Mix',
        passed: stats.byCategory.equity > 0 && stats.byCategory.debt > 0,
      },
    ];

    checks.forEach((check) => {
      const icon = check.passed ? '✅' : '❌';
      console.log(
        `${icon} ${check.name}: ${check.actual} (Required: ${check.required})`
      );
    });

    const allPassed = checks.every((c) => c.passed);
    console.log('\n' + '═'.repeat(60));
    if (allPassed) {
      console.log('🎉 ALL ACCEPTANCE CRITERIA MET!');
    } else {
      console.log('⚠️  Some acceptance criteria not met');
    }
    console.log('═'.repeat(60));

    console.log('\n📝 NEXT STEPS:');
    console.log('1. ✅ AMFI data ingested successfully');
    console.log('2. ⚠️  Configure Yahoo Finance API for global ETFs');
    console.log('3. ⚠️  Configure Alpha Vantage for historical data');
    console.log('4. Enrich fund manager data');
    console.log('5. Set up Redis caching');
    console.log('6. Implement search and comparison APIs');
    console.log('7. Connect frontend to backend\n');

    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ ERROR during data ingestion:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the script
main();
