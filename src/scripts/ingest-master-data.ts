import { mongodb } from '../db/mongodb';
import { ComprehensiveFundDataService } from '../services/comprehensive-fund-data.service';
import { createIndexes } from '../db/schemas';

/**
 * Master Data Ingestion Script
 *
 * Sources:
 * 1. AMFI - 2000+ Indian mutual funds
 * 2. NSE/BSE - Indian ETFs
 * 3. Yahoo Finance - Global ETFs & commodities
 * 4. Alpha Vantage - Historical data (optional)
 *
 * Run: tsx src/scripts/ingest-master-data.ts
 */

async function main() {
  console.log('🚀 Starting comprehensive data ingestion...\n');
  console.log('═'.repeat(60));

  try {
    // Connect to MongoDB
    await mongodb.connect();
    const db = mongodb.getDb();

    // Create indexes
    console.log('\n📊 Step 1: Creating database indexes...');
    await createIndexes(db);
    console.log('✅ Indexes created\n');

    // Initialize service
    const dataService = new ComprehensiveFundDataService(db);

    // Step 2: Fetch AMFI data (Indian mutual funds)
    console.log('═'.repeat(60));
    console.log('📊 Step 2: Fetching AMFI mutual funds data...');
    console.log('Source: https://www.amfiindia.com/spages/NAVAll.txt');
    console.log('Coverage: 2000+ Indian mutual funds\n');

    const amfiResult = await dataService.fetchAMFIData();
    if (amfiResult.success) {
      console.log(`✅ AMFI ingestion complete`);
      console.log(`   - Funds added: ${amfiResult.fundsAdded}`);
      console.log(`   - Funds updated: ${amfiResult.fundsUpdated}\n`);
    }

    // Step 3: Fetch NSE ETFs (Indian ETFs)
    console.log('═'.repeat(60));
    console.log('📊 Step 3: Fetching NSE ETFs...');
    console.log('Source: NSE India API');
    console.log('Coverage: Nifty BeES, Gold BeES, Bank BeES, etc.\n');

    await dataService.fetchNSEETFs();
    console.log('✅ NSE ETF ingestion complete\n');

    // Step 4: Fetch popular global ETFs and commodities
    console.log('═'.repeat(60));
    console.log('📊 Step 4: Fetching global ETFs & commodities...');
    console.log('Source: Yahoo Finance via RapidAPI');
    console.log('Coverage: Gold, Silver, Oil, S&P 500, Nasdaq, etc.\n');

    await dataService.fetchPopularETFs();
    console.log('✅ Global ETF ingestion complete\n');

    // Step 5: Fetch historical data for top funds (optional)
    console.log('═'.repeat(60));
    console.log('📊 Step 5: Fetching historical data (optional)...');

    if (process.env.ALPHA_VANTAGE_KEY) {
      console.log('Source: Alpha Vantage API');
      console.log('Note: Limited to 5 calls/minute on free tier\n');

      const topSymbols = ['NIFTYBEES.NS', 'GOLDBEES.NS', 'GLD', 'SPY'];
      for (const symbol of topSymbols) {
        console.log(`   Fetching ${symbol}...`);
        await dataService.fetchHistoricalData(symbol, 'compact');
      }
      console.log('✅ Historical data ingestion complete\n');
    } else {
      console.log(
        '⚠️  Alpha Vantage API key not configured - skipping historical data'
      );
      console.log('   Set ALPHA_VANTAGE_KEY in .env to enable\n');
    }

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
      bySource: {
        amfi: await fundsCollection.countDocuments({ dataSource: 'AMFI' }),
        nse: await fundsCollection.countDocuments({ dataSource: 'NSE' }),
        yahoo: await fundsCollection.countDocuments({
          dataSource: 'Yahoo Finance',
        }),
      },
      topFundsByAUM: await fundsCollection
        .find({ isActive: true })
        .sort({ aum: -1 })
        .limit(5)
        .project({ name: 1, fundHouse: 1, aum: 1, _id: 0 })
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

    console.log('By Data Source:');
    console.log(`  - AMFI: ${stats.bySource.amfi}`);
    console.log(`  - NSE: ${stats.bySource.nse}`);
    console.log(`  - Yahoo Finance: ${stats.bySource.yahoo}\n`);

    console.log(`Price Data Points: ${stats.priceDataPoints}\n`);

    console.log('Top 5 Funds by AUM:');
    stats.topFundsByAUM.forEach((fund, i) => {
      console.log(`  ${i + 1}. ${fund.name}`);
      console.log(
        `     House: ${fund.fundHouse}, AUM: ₹${(fund.aum / 10000000).toFixed(2)}Cr`
      );
    });

    console.log('\n═'.repeat(60));
    console.log('✅ ALL DATA INGESTION COMPLETED SUCCESSFULLY!');
    console.log('═'.repeat(60));

    // Check acceptance criteria
    console.log('\n📋 ACCEPTANCE CRITERIA CHECK:');
    console.log('═'.repeat(60));

    const checks = [
      {
        name: '100+ stock funds',
        actual: stats.byCategory.equity + stats.byCategory.etf,
        required: 100,
        passed: stats.byCategory.equity + stats.byCategory.etf >= 100,
      },
      {
        name: '50+ commodity funds',
        actual: stats.byCategory.commodity,
        required: 50,
        passed: stats.byCategory.commodity >= 50,
      },
      {
        name: 'Real data (not mock)',
        actual: 'AMFI + NSE + Yahoo',
        required: 'Multiple sources',
        passed:
          stats.bySource.amfi > 0 &&
          (stats.bySource.nse > 0 || stats.bySource.yahoo > 0),
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
      console.log(
        '⚠️  Some acceptance criteria not met - may need additional data sources'
      );
    }
    console.log('═'.repeat(60));

    console.log('\n📝 NEXT STEPS:');
    console.log('1. Run background job for daily NAV updates');
    console.log('2. Enrich fund manager data (manual or scraping)');
    console.log('3. Fetch holdings data for comparison features');
    console.log('4. Set up Redis caching for real-time prices');
    console.log('5. Implement search and comparison APIs\n');

    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ ERROR during data ingestion:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the script
main();
