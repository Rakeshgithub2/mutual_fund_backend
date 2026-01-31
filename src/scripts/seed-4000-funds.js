/**
 * Seed 4000+ Funds from AMFI
 * This script fetches and stores all Indian mutual funds in the database
 *
 * Usage: npm run seed:4000-funds
 */

// Load environment variables first
require('dotenv').config();

const mongoose = require('mongoose');
const axios = require('axios');
const Fund = require('../models/Fund.model');

// AMFI NAV URL
const AMFI_NAV_URL = 'https://www.amfiindia.com/spages/NAVAll.txt';

// Category mapping
const CATEGORY_MAP = {
  equity: ['equity', 'elss', 'index', 'etf', 'sectoral', 'thematic'],
  debt: [
    'debt',
    'gilt',
    'liquid',
    'money market',
    'short term',
    'medium term',
    'long term',
    'dynamic bond',
  ],
  hybrid: ['hybrid', 'balanced', 'monthly income', 'arbitrage'],
  'solution-oriented': ['retirement', 'children'],
  other: ['fof', 'fund of funds', 'other'],
};

/**
 * Parse AMFI NAV file
 */
function parseAMFIData(data) {
  const lines = data.split('\n');
  const funds = [];
  let currentAMC = '';

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Skip empty lines
    if (!trimmedLine) continue;

    // Check if it's an AMC name line (doesn't contain semicolons)
    if (!trimmedLine.includes(';')) {
      currentAMC = trimmedLine;
      continue;
    }

    // Skip header lines
    if (trimmedLine.includes('Scheme Name') || trimmedLine.includes('ISIN')) {
      continue;
    }

    // Parse fund data
    const parts = trimmedLine.split(';');
    if (parts.length >= 5) {
      const schemeCode = parts[0].trim();
      const schemeName = parts[3].trim();
      const navValue = parseFloat(parts[4].trim());
      const navDate =
        parts[7]?.trim() || new Date().toISOString().split('T')[0];

      // Determine category from scheme name
      const category = determineCategory(schemeName);
      const subCategory = determineSubCategory(schemeName, category);

      funds.push({
        schemeCode,
        schemeName,
        amc: {
          name: currentAMC || 'Unknown AMC',
        },
        category,
        subCategory,
        nav: {
          value: navValue || 0,
          date: parseDate(navDate),
        },
        status: 'Active',
        dataSource: 'AMFI',
        isPubliclyVisible: true,
        metadata: {
          lastUpdated: new Date(),
          importedAt: new Date(),
        },
      });
    }
  }

  return funds;
}

/**
 * Determine category from scheme name
 */
function determineCategory(schemeName) {
  const nameLower = schemeName.toLowerCase();

  for (const [category, keywords] of Object.entries(CATEGORY_MAP)) {
    for (const keyword of keywords) {
      if (nameLower.includes(keyword)) {
        return category;
      }
    }
  }

  // Default categorization
  if (nameLower.includes('growth') || nameLower.includes('direct')) {
    return 'equity';
  }
  if (nameLower.includes('income') || nameLower.includes('bond')) {
    return 'debt';
  }

  return 'other';
}

/**
 * Determine subcategory from scheme name
 */
function determineSubCategory(schemeName, category) {
  const nameLower = schemeName.toLowerCase();

  if (category === 'equity') {
    if (nameLower.includes('large cap')) return 'Large Cap';
    if (nameLower.includes('mid cap')) return 'Mid Cap';
    if (nameLower.includes('small cap')) return 'Small Cap';
    if (nameLower.includes('multi cap') || nameLower.includes('multicap'))
      return 'Multi Cap';
    if (nameLower.includes('flexi cap') || nameLower.includes('flexicap'))
      return 'Flexi Cap';
    if (nameLower.includes('elss')) return 'ELSS';
    if (nameLower.includes('index')) return 'Index Fund';
    if (nameLower.includes('sectoral') || nameLower.includes('sector'))
      return 'Sectoral/Thematic';
    return 'Equity - Other';
  }

  if (category === 'debt') {
    if (nameLower.includes('liquid')) return 'Liquid';
    if (nameLower.includes('ultra short')) return 'Ultra Short Duration';
    if (nameLower.includes('short') || nameLower.includes('low duration'))
      return 'Short Duration';
    if (nameLower.includes('medium')) return 'Medium Duration';
    if (nameLower.includes('long')) return 'Long Duration';
    if (nameLower.includes('gilt')) return 'Gilt';
    if (nameLower.includes('corporate')) return 'Corporate Bond';
    if (nameLower.includes('dynamic')) return 'Dynamic Bond';
    return 'Debt - Other';
  }

  if (category === 'hybrid') {
    if (nameLower.includes('aggressive')) return 'Aggressive Hybrid';
    if (nameLower.includes('conservative')) return 'Conservative Hybrid';
    if (nameLower.includes('balanced')) return 'Balanced Hybrid';
    if (nameLower.includes('arbitrage')) return 'Arbitrage';
    return 'Hybrid - Other';
  }

  return 'Other';
}

/**
 * Parse date string from AMFI format
 */
function parseDate(dateStr) {
  if (
    !dateStr ||
    dateStr.trim() === '' ||
    dateStr === 'N.A.' ||
    dateStr === 'NA'
  ) {
    return new Date();
  }

  try {
    // AMFI format: DD-MMM-YYYY or DD-Mon-YYYY
    const parts = dateStr.trim().split('-');
    if (parts.length === 3) {
      const monthMap = {
        Jan: 0,
        'Jan.': 0,
        January: 0,
        Feb: 1,
        'Feb.': 1,
        February: 1,
        Mar: 2,
        'Mar.': 2,
        March: 2,
        Apr: 3,
        'Apr.': 3,
        April: 3,
        May: 4,
        'May.': 4,
        Jun: 5,
        'Jun.': 5,
        June: 5,
        Jul: 6,
        'Jul.': 6,
        July: 6,
        Aug: 7,
        'Aug.': 7,
        August: 7,
        Sep: 8,
        'Sep.': 8,
        September: 8,
        Oct: 9,
        'Oct.': 9,
        October: 9,
        Nov: 10,
        'Nov.': 10,
        November: 10,
        Dec: 11,
        'Dec.': 11,
        December: 11,
      };
      const day = parseInt(parts[0]);
      const month = monthMap[parts[1]];
      const year = parseInt(parts[2]);

      if (!isNaN(day) && month !== undefined && !isNaN(year)) {
        return new Date(year, month, day);
      }
    }
  } catch (error) {
    console.warn('Error parsing date:', dateStr);
  }
  return new Date();
}

/**
 * Import funds into database
 */
async function importFunds(funds) {
  console.log(`📊 Importing ${funds.length} funds into database...`);

  let imported = 0;
  let updated = 0;
  let errors = 0;

  // Process in batches to avoid memory issues
  const batchSize = 500;

  for (let i = 0; i < funds.length; i += batchSize) {
    const batch = funds.slice(i, i + batchSize);

    try {
      const bulkOps = batch.map((fund) => ({
        updateOne: {
          filter: { schemeCode: fund.schemeCode },
          update: { $set: fund },
          upsert: true,
        },
      }));

      const result = await Fund.bulkWrite(bulkOps);
      imported += result.upsertedCount;
      updated += result.modifiedCount;

      console.log(
        `  ✓ Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(funds.length / batchSize)}`
      );
      console.log(`    Imported: ${imported}, Updated: ${updated}`);
    } catch (error) {
      console.error(`  ❌ Error processing batch:`, error.message);
      errors++;
    }
  }

  return { imported, updated, errors };
}

/**
 * Main execution
 */
async function main() {
  console.log(
    '╔════════════════════════════════════════════════════════════════╗'
  );
  console.log(
    '║         SEED 4000+ FUNDS FROM AMFI DATABASE                   ║'
  );
  console.log(
    '╚════════════════════════════════════════════════════════════════╝'
  );
  console.log('');

  try {
    // Connect to MongoDB
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(process.env.DATABASE_URL);
    console.log('✅ Connected to MongoDB');
    console.log('');

    // Fetch AMFI data
    console.log('🌐 Fetching data from AMFI...');
    console.log(`URL: ${AMFI_NAV_URL}`);

    const response = await axios.get(AMFI_NAV_URL, {
      timeout: 60000, // 60 seconds
    });

    console.log('✅ Data fetched successfully');
    console.log('');

    // Parse data
    console.log('📋 Parsing AMFI data...');
    const funds = parseAMFIData(response.data);
    console.log(`✅ Parsed ${funds.length} funds`);
    console.log('');

    // Display category breakdown
    const categoryCount = {};
    funds.forEach((fund) => {
      categoryCount[fund.category] = (categoryCount[fund.category] || 0) + 1;
    });

    console.log('📊 CATEGORY BREAKDOWN:');
    Object.entries(categoryCount).forEach(([cat, count]) => {
      console.log(`   ${cat.padEnd(20)}: ${count} funds`);
    });
    console.log('');

    // Import into database
    const result = await importFunds(funds);

    console.log('');
    console.log(
      '╔════════════════════════════════════════════════════════════════╗'
    );
    console.log(
      '║                    IMPORT COMPLETE                             ║'
    );
    console.log(
      '╚════════════════════════════════════════════════════════════════╝'
    );
    console.log('');
    console.log(`✅ New funds imported: ${result.imported}`);
    console.log(`🔄 Existing funds updated: ${result.updated}`);
    console.log(`❌ Errors: ${result.errors}`);
    console.log(
      `📊 Total funds processed: ${result.imported + result.updated}`
    );
    console.log('');

    // Get final count from database
    const totalInDB = await Fund.countDocuments();
    console.log(`💾 Total funds in database: ${totalInDB}`);
    console.log('');
    console.log('✅ Seeding completed successfully!');
    console.log('');
    console.log('💡 Next steps:');
    console.log('   - Start the backend server: npm run dev');
    console.log(
      '   - Test fund fetching: curl http://localhost:3002/api/funds'
    );
    console.log('   - Real-time API fallback is now active');
  } catch (error) {
    console.error('');
    console.error('❌ Seeding failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('');
    console.log('👋 Disconnected from MongoDB');
  }
}

// Run the script
main();
