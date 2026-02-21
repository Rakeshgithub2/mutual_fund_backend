/**
 * Link Manual Holdings to Real Scheme Codes
 * This script matches holdings data to actual fund scheme codes in the database
 */

const mongoose = require('mongoose');
require('dotenv').config();

const holdingsSchema = new mongoose.Schema(
  {
    schemeCode: String,
    fundName: String,
    holdings: Array,
    sectorAllocation: Array,
    assetAllocation: Object,
    category: String,
    subCategory: String,
  },
  { timestamps: true }
);

const Holdings =
  mongoose.models.Holdings || mongoose.model('Holdings', holdingsSchema);

const fundSchema = new mongoose.Schema({
  Scheme_Code: String,
  Scheme_Name: String,
  Category: String,
  Sub_Category: String,
});

const Fund = mongoose.models.Fund || mongoose.model('Fund', fundSchema);

// Mapping of fund names to search patterns
const fundMappings = [
  {
    name: 'SBI Blue Chip Fund - Direct Plan - Growth',
    pattern: 'SBI Blue Chip.*Direct.*Growth',
  },
  {
    name: 'HDFC Mid-Cap Opportunities Fund - Direct Plan - Growth',
    pattern: 'HDFC Mid.?Cap.*Direct.*Growth',
  },
  {
    name: 'Nippon India Small Cap Fund - Direct Plan - Growth',
    pattern: 'Nippon.*Small Cap.*Direct.*Growth',
  },
  {
    name: 'Parag Parikh Flexi Cap Fund - Direct Plan - Growth',
    pattern: 'Parag Parikh.*Flexi.*Direct.*Growth',
  },
  {
    name: 'Mirae Asset Large Cap Fund - Direct Plan - Growth',
    pattern: 'Mirae.*Large Cap.*Direct.*Growth',
  },
  {
    name: 'Axis Bluechip Fund - Direct Plan - Growth',
    pattern: 'Axis Blue.?chip.*Direct.*Growth',
  },
  {
    name: 'ICICI Prudential Bluechip Fund - Direct Plan - Growth',
    pattern: 'ICICI.*Blue.?chip.*Direct.*Growth',
  },
  {
    name: 'Quant Small Cap Fund - Direct Plan - Growth',
    pattern: 'Quant Small Cap.*Direct.*Growth',
  },
  {
    name: 'Kotak Emerging Equity Fund - Direct Plan - Growth',
    pattern: 'Kotak.*Emerging.*Direct.*Growth',
  },
  {
    name: 'SBI Contra Fund - Direct Plan - Growth',
    pattern: 'SBI Contra.*Direct.*Growth',
  },
];

async function linkHoldings() {
  try {
    const mongoUri = process.env.DATABASE_URL;
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // Get all manual holdings
    const manualHoldings = await Holdings.find({
      schemeCode: { $regex: /^MANUAL_/ },
    });

    console.log(`📊 Found ${manualHoldings.length} manual holdings to link\n`);

    let linked = 0;
    for (const holding of manualHoldings) {
      // Find matching pattern
      const mapping = fundMappings.find((m) => m.name === holding.fundName);
      if (!mapping) {
        console.log(`⚠️ No mapping for: ${holding.fundName}`);
        continue;
      }

      // Find fund in database
      const fund = await Fund.findOne({
        Scheme_Name: { $regex: mapping.pattern, $options: 'i' },
      });

      if (fund) {
        // Check if holdings already exist for this scheme code
        const existing = await Holdings.findOne({
          schemeCode: fund.Scheme_Code,
        });
        if (existing && existing._id.toString() !== holding._id.toString()) {
          // Update existing record with new data
          await Holdings.findOneAndUpdate(
            { schemeCode: fund.Scheme_Code },
            {
              holdings: holding.holdings,
              sectorAllocation: holding.sectorAllocation,
              assetAllocation: holding.assetAllocation,
              category: fund.Category,
              subCategory: fund.Sub_Category,
              dataSource: 'manual',
            }
          );
          // Delete the manual one
          await Holdings.deleteOne({ _id: holding._id });
        } else {
          // Update scheme code
          await Holdings.updateOne(
            { _id: holding._id },
            {
              schemeCode: fund.Scheme_Code,
              category: fund.Category,
              subCategory: fund.Sub_Category,
            }
          );
        }

        console.log(`✅ Linked: ${holding.fundName}`);
        console.log(`   → Scheme Code: ${fund.Scheme_Code}`);
        console.log(`   → DB Name: ${fund.Scheme_Name}\n`);
        linked++;
      } else {
        console.log(`❌ No match in DB for: ${holding.fundName}`);
      }
    }

    console.log('='.repeat(50));
    console.log(
      `✅ Successfully linked: ${linked}/${manualHoldings.length} holdings`
    );

    // Verify
    const totalHoldings = await Holdings.countDocuments();
    const realHoldings = await Holdings.countDocuments({
      schemeCode: { $not: /^MANUAL_/ },
    });
    console.log(`\n📈 Total holdings records: ${totalHoldings}`);
    console.log(`📈 With real scheme codes: ${realHoldings}`);
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await mongoose.disconnect();
  }
}

linkHoldings();
