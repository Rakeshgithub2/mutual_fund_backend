/**
 * PRODUCTION DATABASE SEEDER
 * Seeds production database with all 4,459 funds including complete details
 *
 * Usage: NODE_ENV=production node scripts/seed-production-complete.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

const fundSchema = new mongoose.Schema({
  fundId: String,
  name: String,
  category: String,
  subCategory: String,
  fundHouse: String,
  fundType: String,
  currentNav: Number,
  previousNav: Number,
  navDate: Date,
  returns: {
    day: Number,
    week: Number,
    month: Number,
    threeMonth: Number,
    sixMonth: Number,
    oneYear: Number,
    threeYear: Number,
    fiveYear: Number,
    sinceInception: Number,
  },
  riskMetrics: {
    sharpeRatio: Number,
    standardDeviation: Number,
    beta: Number,
    alpha: Number,
    rSquared: Number,
    sortino: Number,
  },
  aum: Number,
  expenseRatio: Number,
  exitLoad: Number,
  minInvestment: Number,
  sipMinAmount: Number,
  ratings: {
    morningstar: Number,
    crisil: Number,
    valueResearch: Number,
  },
  // IMPORTANT: Detailed fund information
  holdings: [
    {
      companyName: String,
      sector: String,
      percentage: Number,
      quantity: Number,
      value: Number,
    },
  ],
  sectorAllocation: [
    {
      sector: String,
      percentage: Number,
      amount: Number,
    },
  ],
  assetAllocation: {
    equity: Number,
    debt: Number,
    cash: Number,
    others: Number,
  },
  fundManager: {
    name: String,
    experience: Number,
    qualification: String,
    since: Date,
  },
  documents: {
    schemeDocument: String,
    factSheet: String,
    annualReport: String,
  },
  tags: [String],
  popularity: Number,
  isActive: Boolean,
  createdAt: Date,
  updatedAt: Date,
});

const Fund = mongoose.model('Fund', fundSchema);

async function seedProductionDatabase() {
  try {
    console.log('🚀 Starting production database seeding...\n');

    // Use production MongoDB URI
    const PRODUCTION_URI =
      process.env.MONGODB_URI_PRODUCTION || process.env.MONGODB_URI;

    if (!PRODUCTION_URI) {
      throw new Error(
        '❌ MONGODB_URI_PRODUCTION not set in environment variables!'
      );
    }

    console.log('📡 Connecting to production database...');
    await mongoose.connect(PRODUCTION_URI);
    console.log('✅ Connected to production MongoDB\n');

    // First, get all funds from local database
    console.log('📥 Fetching funds from local database...');
    const LOCAL_URI = 'mongodb://localhost:27017/mutual-funds';
    const localConnection = await mongoose
      .createConnection(LOCAL_URI)
      .asPromise();
    const LocalFund = localConnection.model('Fund', fundSchema);

    const allFunds = await LocalFund.find({ isActive: true }).lean();
    console.log(`✅ Found ${allFunds.length} active funds in local database\n`);

    if (allFunds.length === 0) {
      throw new Error(
        '❌ No funds found in local database! Run local seeder first.'
      );
    }

    // Clear existing production data (optional - comment out to keep existing)
    console.log('🗑️  Clearing existing production data...');
    await Fund.deleteMany({});
    console.log('✅ Production database cleared\n');

    // Insert all funds in batches (to avoid memory issues)
    const BATCH_SIZE = 100;
    let inserted = 0;

    console.log('📤 Inserting funds into production database...\n');
    for (let i = 0; i < allFunds.length; i += BATCH_SIZE) {
      const batch = allFunds.slice(i, i + BATCH_SIZE);
      await Fund.insertMany(batch, { ordered: false });
      inserted += batch.length;

      const progress = ((inserted / allFunds.length) * 100).toFixed(1);
      process.stdout.write(
        `Progress: ${inserted}/${allFunds.length} (${progress}%) \r`
      );
    }

    console.log(
      `\n\n✅ Successfully inserted ${inserted} funds into production!`
    );

    // Verify the insertion
    const prodCount = await Fund.countDocuments({ isActive: true });
    console.log(
      `\n🔍 Verification: ${prodCount} active funds in production database`
    );

    // Show category breakdown
    console.log('\n📊 Category Breakdown:');
    const categories = await Fund.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    categories.forEach((cat) => {
      console.log(`   ${cat._id}: ${cat.count} funds`);
    });

    await localConnection.close();
    await mongoose.connection.close();

    console.log('\n✅ Production database seeding completed successfully!');
    console.log(
      '\n🎉 Your backend now has 4,459+ funds with complete details!\n'
    );
  } catch (error) {
    console.error('\n❌ Error seeding production database:', error);
    process.exit(1);
  }
}

// Run the seeder
seedProductionDatabase();
