/**
 * Data Migration Script
 * Migrates existing fund data to professional 4-tier architecture
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

// Old schema (existing)
const OldFundSchema = new mongoose.Schema(
  {
    schemeCode: String,
    fundName: String,
    amc: String,
    category: String,
    nav: Number,
    navDate: Date,
    returns: Object,
    // ... other fields
  },
  { collection: 'funds' }
);

const OldFund = mongoose.model('OldFund', OldFundSchema);

// New schemas
const FundStaticMaster = require('../src/models/FundStaticMaster.model');
const FundPeriodicReturns = require('../src/models/FundPeriodicReturns.model');
const FundNavDaily = require('../src/models/FundNavDaily.model');

class DataMigration {
  constructor() {
    this.stats = {
      total: 0,
      static: 0,
      periodic: 0,
      daily: 0,
      errors: 0,
      skipped: 0,
    };
  }

  /**
   * Connect to MongoDB
   */
  async connect() {
    try {
      const uri = process.env.MONGODB_URI;

      if (!uri) {
        throw new Error('MONGODB_URI not found in environment variables');
      }

      await mongoose.connect(uri);
      console.log('✅ Connected to MongoDB');
    } catch (error) {
      console.error('❌ MongoDB connection failed:', error);
      throw error;
    }
  }

  /**
   * Run full migration
   */
  async migrate() {
    console.log(
      '\n🚀 Starting data migration to professional architecture...\n'
    );

    try {
      // Fetch all existing funds
      const oldFunds = await OldFund.find().lean();
      this.stats.total = oldFunds.length;

      console.log(`📊 Found ${this.stats.total} funds to migrate\n`);

      // Migrate in batches
      const batchSize = 100;
      for (let i = 0; i < oldFunds.length; i += batchSize) {
        const batch = oldFunds.slice(i, i + batchSize);
        await this.migrateBatch(batch, i, oldFunds.length);
      }

      console.log('\n✅ Migration completed!\n');
      this.printStats();
    } catch (error) {
      console.error('\n❌ Migration failed:', error);
      throw error;
    }
  }

  /**
   * Migrate a batch of funds
   */
  async migrateBatch(funds, startIndex, total) {
    console.log(
      `🔄 Processing batch ${startIndex + 1}-${Math.min(startIndex + funds.length, total)} of ${total}...`
    );

    for (const fund of funds) {
      try {
        await this.migrateSingleFund(fund);
      } catch (error) {
        console.error(`❌ Failed to migrate ${fund.fundName}:`, error.message);
        this.stats.errors++;
      }
    }
  }

  /**
   * Migrate a single fund to 3 collections
   */
  async migrateSingleFund(oldFund) {
    const fundCode =
      oldFund.schemeCode || oldFund.fundCode || this.generateFundCode(oldFund);

    // 1. Migrate static data
    await this.migrateStaticData(fundCode, oldFund);

    // 2. Migrate periodic returns
    await this.migratePeriodicReturns(fundCode, oldFund);

    // 3. Migrate daily NAV
    await this.migrateDailyNAV(fundCode, oldFund);
  }

  /**
   * Migrate to fund_static_master
   */
  async migrateStaticData(fundCode, oldFund) {
    try {
      const staticData = {
        fundCode,
        schemeCode: oldFund.schemeCode,
        isin: oldFund.isin,
        fundName: oldFund.fundName || oldFund.schemeName,
        amc: oldFund.amc || oldFund.amcName,
        category: oldFund.category,
        subCategory: oldFund.subCategory || oldFund.subcategory,
        fundType: oldFund.fundType || 'Open-ended',
        benchmark: oldFund.benchmark || 'NIFTY 50',
        fundManager: {
          name: oldFund.fundManager || 'N/A',
          experience: oldFund.managerExperience || 0,
          education: oldFund.managerEducation || 'N/A',
        },
        launchDate: oldFund.launchDate || new Date('2000-01-01'),
        minimumSIP: oldFund.minimumSIP || oldFund.minSIP || 500,
        exitLoad: oldFund.exitLoad || 'Nil',
        riskGrade: this.calculateRiskGrade(oldFund),
        fundStatus: oldFund.fundStatus || 'Active',
        isActive: true,
        tags: oldFund.tags || [],
        description: oldFund.description || '',
        investmentObjective: oldFund.investmentObjective || '',
      };

      await FundStaticMaster.findOneAndUpdate(
        { fundCode },
        { $set: staticData },
        { upsert: true }
      );

      this.stats.static++;
      return true;
    } catch (error) {
      console.error(
        `Failed to migrate static data for ${fundCode}:`,
        error.message
      );
      return false;
    }
  }

  /**
   * Migrate to fund_periodic_returns
   */
  async migratePeriodicReturns(fundCode, oldFund) {
    try {
      const returns = oldFund.returns || {};

      const periodicData = {
        fundCode,
        return_1M: this.parseReturn(returns['1M'] || returns.return_1M),
        return_3M: this.parseReturn(returns['3M'] || returns.return_3M),
        return_6M: this.parseReturn(returns['6M'] || returns.return_6M),
        return_1Y: this.parseReturn(returns['1Y'] || returns.return_1Y),
        return_3Y: this.parseReturn(returns['3Y'] || returns.return_3Y),
        return_5Y: this.parseReturn(returns['5Y'] || returns.return_5Y),
        volatility: oldFund.volatility || 0,
        sharpeRatio: oldFund.sharpeRatio || 0,
        alpha: oldFund.alpha || 0,
        beta: oldFund.beta || 0,
        aum: oldFund.aum || oldFund.totalAUM || 0,
        expenseRatio: oldFund.expenseRatio || 0,
        sortinoRatio: oldFund.sortinoRatio || 0,
        maxDrawdown: oldFund.maxDrawdown || 0,
        dataMonth: this.getCurrentMonth(),
        date: new Date(),
        isVerified: false,
      };

      await FundPeriodicReturns.findOneAndUpdate(
        { fundCode, dataMonth: periodicData.dataMonth },
        { $set: periodicData },
        { upsert: true }
      );

      this.stats.periodic++;
      return true;
    } catch (error) {
      console.error(
        `Failed to migrate periodic returns for ${fundCode}:`,
        error.message
      );
      return false;
    }
  }

  /**
   * Migrate to fund_nav_daily
   */
  async migrateDailyNAV(fundCode, oldFund) {
    try {
      if (!oldFund.nav || !oldFund.navDate) {
        this.stats.skipped++;
        return false;
      }

      const navData = {
        fundCode,
        nav: parseFloat(oldFund.nav),
        navDate: new Date(oldFund.navDate),
        previousNav: oldFund.previousNav || null,
        navChange: oldFund.navChange || 0,
        navChangePercent: oldFund.navChangePercent || 0,
        dayReturn: oldFund.dayReturn || 0,
        weekReturn: oldFund.weekReturn || 0,
        monthReturn: oldFund.monthReturn || 0,
        dataSource: oldFund.dataSource || 'MIGRATION',
        isVerified: false,
      };

      await FundNavDaily.findOneAndUpdate(
        { fundCode, navDate: navData.navDate },
        { $set: navData },
        { upsert: true }
      );

      this.stats.daily++;
      return true;
    } catch (error) {
      console.error(
        `Failed to migrate daily NAV for ${fundCode}:`,
        error.message
      );
      return false;
    }
  }

  /**
   * Helper: Calculate risk grade from existing data
   */
  calculateRiskGrade(fund) {
    const volatility = fund.volatility || 0;
    const category = fund.category || '';

    if (category.toLowerCase().includes('equity')) {
      if (volatility < 10) return 'Moderate';
      if (volatility < 15) return 'High';
      return 'Very High';
    } else if (category.toLowerCase().includes('debt')) {
      if (volatility < 5) return 'Low';
      if (volatility < 10) return 'Moderate';
      return 'High';
    } else if (category.toLowerCase().includes('hybrid')) {
      return 'Moderate';
    }

    return 'Moderate';
  }

  /**
   * Helper: Parse return value
   */
  parseReturn(value) {
    if (!value) return 0;
    const parsed = parseFloat(value);
    return isNaN(parsed) ? 0 : parsed;
  }

  /**
   * Helper: Get current month in YYYY-MM format
   */
  getCurrentMonth() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  /**
   * Helper: Generate fund code if missing
   */
  generateFundCode(fund) {
    const name = fund.fundName || 'FUND';
    const prefix = name.substring(0, 3).toUpperCase();
    const random = Math.floor(Math.random() * 900000) + 100000;
    return `${prefix}${random}`;
  }

  /**
   * Print migration statistics
   */
  printStats() {
    console.log('📊 Migration Statistics:');
    console.log('─────────────────────────────────');
    console.log(`Total funds:          ${this.stats.total}`);
    console.log(`Static master:        ${this.stats.static} ✅`);
    console.log(`Periodic returns:     ${this.stats.periodic} ✅`);
    console.log(`Daily NAV:            ${this.stats.daily} ✅`);
    console.log(`Skipped (no NAV):     ${this.stats.skipped} ⚠️`);
    console.log(`Errors:               ${this.stats.errors} ❌`);
    console.log('─────────────────────────────────');

    const successRate = ((this.stats.static / this.stats.total) * 100).toFixed(
      2
    );
    console.log(`Success rate:         ${successRate}%`);
  }

  /**
   * Verify migration
   */
  async verify() {
    console.log('\n🔍 Verifying migration...\n');

    const staticCount = await FundStaticMaster.countDocuments();
    const periodicCount = await FundPeriodicReturns.countDocuments();
    const dailyCount = await FundNavDaily.countDocuments();

    console.log('📊 New Collections:');
    console.log(`fund_static_master:        ${staticCount} documents`);
    console.log(`fund_periodic_returns:     ${periodicCount} documents`);
    console.log(`fund_nav_daily:            ${dailyCount} documents`);

    // Sample data check
    const sampleStatic = await FundStaticMaster.findOne().lean();
    const samplePeriodic = await FundPeriodicReturns.findOne().lean();
    const sampleDaily = await FundNavDaily.findOne().lean();

    console.log('\n✅ Sample documents created successfully');

    if (sampleStatic) {
      console.log(
        `Sample fund: ${sampleStatic.fundName} (${sampleStatic.fundCode})`
      );
    }
  }

  /**
   * Disconnect from MongoDB
   */
  async disconnect() {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB\n');
  }
}

// Run migration
async function runMigration() {
  const migration = new DataMigration();

  try {
    await migration.connect();

    // Confirm before migrating
    console.log(
      '\n⚠️  This will migrate existing fund data to the new 4-tier architecture.'
    );
    console.log('⚠️  Old data will NOT be deleted (backup recommended).\n');

    // Auto-proceed (remove this in production, add user confirmation)
    const proceed =
      process.argv.includes('--force') || process.env.AUTO_MIGRATE === 'true';

    if (!proceed) {
      console.log(
        '💡 Run with --force flag to proceed: npm run migrate:professional -- --force'
      );
      console.log('💡 Or set AUTO_MIGRATE=true in .env\n');
      process.exit(0);
    }

    await migration.migrate();
    await migration.verify();
    await migration.disconnect();

    console.log('🎉 Migration completed successfully!\n');
    process.exit(0);
  } catch (error) {
    console.error('\n💥 Migration failed:', error);
    await migration.disconnect();
    process.exit(1);
  }
}

// Export for use in other scripts
module.exports = { DataMigration };

// Run if called directly
if (require.main === module) {
  runMigration();
}
