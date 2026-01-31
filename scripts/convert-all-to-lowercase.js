require('dotenv').config();
const mongoose = require('mongoose');

// Helper to convert to lowercase without spaces
const toLowerNoSpace = (str) => {
  if (!str || typeof str !== 'string') return str;
  return str.toLowerCase().replace(/\s+/g, '');
};

async function convertAllToLowercase() {
  try {
    console.log('\n🔄 CONVERTING ALL DATA TO LOWERCASE\n');

    await mongoose.connect(process.env.DATABASE_URL);
    console.log('✅ Connected to MongoDB\n');

    const Fund = mongoose.model(
      'Fund',
      new mongoose.Schema({}, { collection: 'funds', strict: false })
    );

    // Get all funds
    console.log('📊 Fetching all funds...');
    const allFunds = await Fund.find({}).limit(15000);
    console.log(`Found ${allFunds.length} funds\n`);

    let updated = 0;
    let errors = 0;

    console.log('🔄 Converting data to lowercase...\n');

    for (let i = 0; i < allFunds.length; i++) {
      const fund = allFunds[i];

      try {
        const updateData = {};

        // Convert category and subcategory
        if (fund.category) {
          updateData.category = toLowerNoSpace(fund.category);
        }
        if (fund.subCategory) {
          updateData.subCategory = toLowerNoSpace(fund.subCategory);
        }
        if (fund.subcategory) {
          updateData.subcategory = toLowerNoSpace(fund.subcategory);
        }

        // Convert AMC name
        if (fund.amc && fund.amc.name) {
          updateData['amc.name'] = toLowerNoSpace(fund.amc.name);
        }

        // Convert holdings company names
        if (fund.holdings && Array.isArray(fund.holdings)) {
          updateData.holdings = fund.holdings.map((h) => ({
            ...h,
            companyName: toLowerNoSpace(h.companyName || h.company),
            company: toLowerNoSpace(h.companyName || h.company),
          }));
        }

        // Convert sector allocation names
        if (fund.sectorAllocation && Array.isArray(fund.sectorAllocation)) {
          updateData.sectorAllocation = fund.sectorAllocation.map((s) => ({
            ...s,
            sector: toLowerNoSpace(s.sector || s.sectorName),
            sectorName: toLowerNoSpace(s.sector || s.sectorName),
          }));
        }

        // Convert fund manager names
        if (fund.fundManager && fund.fundManager.name) {
          updateData['fundManager.name'] = toLowerNoSpace(
            fund.fundManager.name
          );
        }

        if (fund.managers && Array.isArray(fund.managers)) {
          updateData.managers = fund.managers.map((m) => ({
            ...m,
            name: toLowerNoSpace(m.name),
          }));
        }

        // Convert risk level
        if (fund.risk && fund.risk.level) {
          updateData['risk.level'] = toLowerNoSpace(fund.risk.level);
        }

        // Update the fund
        if (Object.keys(updateData).length > 0) {
          await Fund.updateOne({ _id: fund._id }, { $set: updateData });
          updated++;

          if (updated % 100 === 0) {
            console.log(`✓ Processed ${updated}/${allFunds.length} funds...`);
          }
        }
      } catch (err) {
        errors++;
        console.error(`Error updating fund ${fund.schemeCode}:`, err.message);
      }
    }

    console.log('\n✅ CONVERSION COMPLETE\n');
    console.log(`Updated: ${updated} funds`);
    console.log(`Errors: ${errors}\n`);

    // Verify sample data
    console.log('📋 Sample Data After Conversion:\n');
    const sample = await Fund.findOne({}).limit(1);
    if (sample) {
      console.log('Category:', sample.category);
      console.log('SubCategory:', sample.subCategory);
      console.log('AMC:', sample.amc?.name);
      if (sample.holdings && sample.holdings[0]) {
        console.log(
          'Sample Holding:',
          sample.holdings[0].companyName || sample.holdings[0].company
        );
      }
      if (sample.sectorAllocation && sample.sectorAllocation[0]) {
        console.log(
          'Sample Sector:',
          sample.sectorAllocation[0].sector ||
            sample.sectorAllocation[0].sectorName
        );
      }
    }

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

convertAllToLowercase();
