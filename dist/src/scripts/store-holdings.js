/**
 * STEP-5: Store Holdings from GPT/Manual Data
 *
 * Usage:
 * 1. Export holdings data to JSON file
 * 2. Run: node src/scripts/store-holdings.js <json-file>
 *
 * JSON Format:
 * [
 *   {
 *     "fundName": "HDFC Top 100 Fund",
 *     "schemeCode": "100123",  // Optional - will auto-match
 *     "category": "Equity",
 *     "subCategory": "Large Cap",
 *     "holdings": [
 *       { "name": "HDFC Bank Ltd", "weight": 9.5, "sector": "Financial Services" },
 *       { "name": "ICICI Bank Ltd", "weight": 8.2 },  // sector will be auto-detected
 *       ...
 *     ]
 *   }
 * ]
 */

const mongoose = require('mongoose');
const { sectorMap } = require('../utils/sectorMap');
require('dotenv').config();

// Schema for holdings
const holdingsSchema = new mongoose.Schema(
  {
    schemeCode: { type: String, required: true, index: true },
    fundName: { type: String, required: true },
    holdings: [
      {
        name: String,
        weight: Number,
        sector: String,
        quantity: Number,
        value: Number,
      },
    ],
    sectorAllocation: [
      {
        sector: String,
        weight: Number,
      },
    ],
    assetAllocation: {
      equity: Number,
      debt: Number,
      cash: Number,
      others: Number,
    },
    updatedAt: { type: Date, default: Date.now },
    dataSource: { type: String, default: 'manual' },
    category: String,
    subCategory: String,
  },
  { timestamps: true }
);

const Holdings =
  mongoose.models.Holdings || mongoose.model('Holdings', holdingsSchema);

// Fund schema for lookup
const fundSchema = new mongoose.Schema({
  Scheme_Code: String,
  Scheme_Name: String,
  Category: String,
  Sub_Category: String,
});

const Fund = mongoose.models.Fund || mongoose.model('Fund', fundSchema);

/**
 * Find scheme code by fund name (fuzzy match)
 */
async function findSchemeCode(fundName) {
  // Try exact match first
  let fund = await Fund.findOne({
    Scheme_Name: { $regex: fundName, $options: 'i' },
  });

  if (fund) return fund.Scheme_Code;

  // Try partial match with key words
  const words = fundName.split(' ').filter((w) => w.length > 3);
  for (const word of words) {
    fund = await Fund.findOne({
      Scheme_Name: { $regex: word, $options: 'i' },
    });
    if (fund) return fund.Scheme_Code;
  }

  // Generate synthetic code
  return `MANUAL_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
}

/**
 * Process holdings data and calculate sector allocation
 */
function processHoldings(holdings) {
  // Auto-detect sectors if not provided
  const processedHoldings = holdings.map((h) => ({
    name: h.name,
    weight: h.weight,
    sector: h.sector || sectorMap(h.name),
    quantity: h.quantity || 0,
    value: h.value || 0,
  }));

  // Calculate sector allocation
  const sectorWeights = {};
  for (const h of processedHoldings) {
    sectorWeights[h.sector] = (sectorWeights[h.sector] || 0) + h.weight;
  }

  const sectorAllocation = Object.entries(sectorWeights)
    .map(([sector, weight]) => ({
      sector,
      weight: parseFloat(weight.toFixed(2)),
    }))
    .sort((a, b) => b.weight - a.weight);

  return { processedHoldings, sectorAllocation };
}

/**
 * Store holdings for a single fund
 */
async function storeFundHoldings(fundData) {
  const {
    fundName,
    holdings,
    category,
    subCategory,
    dataSource = 'manual',
  } = fundData;

  // Get or generate scheme code
  let schemeCode = fundData.schemeCode;
  if (!schemeCode) {
    schemeCode = await findSchemeCode(fundName);
    console.log(`  Auto-matched scheme code: ${schemeCode}`);
  }

  // Process holdings
  const { processedHoldings, sectorAllocation } = processHoldings(holdings);

  // Calculate equity percentage from holdings
  const equityWeight = processedHoldings
    .filter(
      (h) =>
        h.sector !== 'Government Securities' && h.sector !== 'Corporate Bonds'
    )
    .reduce((sum, h) => sum + h.weight, 0);

  const debtWeight = processedHoldings
    .filter(
      (h) =>
        h.sector === 'Government Securities' || h.sector === 'Corporate Bonds'
    )
    .reduce((sum, h) => sum + h.weight, 0);

  // Upsert holdings
  const result = await Holdings.findOneAndUpdate(
    { schemeCode },
    {
      schemeCode,
      fundName,
      holdings: processedHoldings,
      sectorAllocation,
      assetAllocation: {
        equity: equityWeight,
        debt: debtWeight,
        cash: Math.max(0, 100 - equityWeight - debtWeight),
        others: 0,
      },
      category,
      subCategory,
      dataSource,
      updatedAt: new Date(),
    },
    { upsert: true, new: true }
  );

  return result;
}

/**
 * Main function to import holdings from JSON
 */
async function importHoldings(jsonFilePath) {
  try {
    // Connect to MongoDB
    const mongoUri =
      process.env.DATABASE_URL ||
      process.env.MONGODB_URI ||
      process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error('DATABASE_URL not found in environment');
    }

    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected!\n');

    // Load JSON data
    const fs = require('fs');
    const data = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));

    console.log(`📊 Processing ${data.length} funds...\n`);

    let success = 0;
    let failed = 0;

    for (const fund of data) {
      try {
        console.log(`📈 ${fund.fundName}`);
        const result = await storeFundHoldings(fund);
        console.log(`   ✅ Stored ${result.holdings.length} holdings\n`);
        success++;
      } catch (err) {
        console.log(`   ❌ Error: ${err.message}\n`);
        failed++;
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log(`✅ Successfully imported: ${success} funds`);
    console.log(`❌ Failed: ${failed} funds`);
    console.log('='.repeat(50));

    // Show sample
    const sample = await Holdings.findOne().sort({ updatedAt: -1 });
    if (sample) {
      console.log('\n📋 Sample stored record:');
      console.log(`   Fund: ${sample.fundName}`);
      console.log(`   Holdings: ${sample.holdings.length} stocks`);
      console.log(
        `   Top holding: ${sample.holdings[0]?.name} (${sample.holdings[0]?.weight}%)`
      );
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await mongoose.disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  const jsonFile = process.argv[2];
  if (!jsonFile) {
    console.log('Usage: node src/scripts/store-holdings.js <json-file>');
    console.log('');
    console.log('Example JSON format:');
    console.log(
      JSON.stringify(
        [
          {
            fundName: 'HDFC Top 100 Fund',
            schemeCode: '100123',
            category: 'Equity',
            subCategory: 'Large Cap',
            holdings: [
              {
                name: 'HDFC Bank Ltd',
                weight: 9.5,
                sector: 'Financial Services',
              },
              { name: 'Reliance Industries', weight: 8.2 },
            ],
          },
        ],
        null,
        2
      )
    );
    process.exit(1);
  }

  importHoldings(jsonFile);
}

module.exports = { storeFundHoldings, importHoldings };
