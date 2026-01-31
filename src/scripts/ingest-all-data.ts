import { mongodb } from '../db/mongodb';
import { FundDataService } from '../services/fund-data.service';
import { createIndexes } from '../db/schemas';

async function main() {
  console.log('🚀 Starting data ingestion process...\n');

  try {
    // Connect to MongoDB
    await mongodb.connect();
    const db = mongodb.getDb();

    // Create indexes first
    console.log('📊 Creating database indexes...');
    await createIndexes(db);
    console.log('✅ Indexes created\n');

    // Initialize data service
    const fundDataService = new FundDataService(db);

    // Fetch AMFI funds (100+ Indian mutual funds)
    console.log('📥 Fetching AMFI mutual funds data...');
    await fundDataService.fetchAMFIFunds();
    console.log('✅ AMFI data ingestion complete\n');

    // Fetch Indian ETFs and commodity funds
    console.log('📥 Fetching Indian ETFs and commodity funds...');
    await fundDataService.fetchIndianETFs();
    console.log('✅ ETF data ingestion complete\n');

    // Summary
    const fundsCollection = db.collection('funds');
    const totalFunds = await fundsCollection.countDocuments();
    const equityFunds = await fundsCollection.countDocuments({
      category: 'equity',
    });
    const commodityFunds = await fundsCollection.countDocuments({
      category: 'commodity',
    });
    const debtFunds = await fundsCollection.countDocuments({
      category: 'debt',
    });
    const etfs = await fundsCollection.countDocuments({ fundType: 'etf' });

    console.log('\n📊 Data Ingestion Summary:');
    console.log('═'.repeat(50));
    console.log(`Total Funds: ${totalFunds}`);
    console.log(`  - Equity Funds: ${equityFunds}`);
    console.log(`  - Commodity Funds: ${commodityFunds}`);
    console.log(`  - Debt Funds: ${debtFunds}`);
    console.log(`  - ETFs: ${etfs}`);
    console.log('═'.repeat(50));
    console.log('\n✅ All data ingestion completed successfully!\n');

    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error during data ingestion:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
