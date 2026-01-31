#!/usr/bin/env tsx

/**
 * Migration Script: Convert all subcategory values to lowercase
 * This script updates existing fund subcategories to lowercase format without spaces
 */

import { mongodb } from '../db/mongodb';

const subcategoryMappings: Record<string, string> = {
  'Large Cap': 'largecap',
  'Mid Cap': 'midcap',
  'Small Cap': 'smallcap',
  'Multi Cap': 'multicap',
  'Flexi Cap': 'flexicap',
  'Large & Mid Cap': 'largeandmidcap',
  'Sectoral/Thematic': 'sectoralthematic',
  Focused: 'focused',
  Value: 'value',
  Contra: 'contra',
  'Dividend Yield': 'dividendyield',
  ELSS: 'elss',
  Gold: 'gold',
  Silver: 'silver',
  Liquid: 'liquid',
  Overnight: 'overnight',
  'Ultra Short Duration': 'ultrashortduration',
  'Low Duration': 'lowduration',
  'Money Market': 'moneymarket',
  'Short Duration': 'shortduration',
  'Medium Duration': 'mediumduration',
  'Medium to Long Duration': 'mediumtolongduration',
  'Long Duration': 'longduration',
  'Dynamic Bond': 'dynamicbond',
  'Corporate Bond': 'corporatebond',
  'Credit Risk': 'creditrisk',
  'Banking & PSU': 'bankingandpsu',
  Gilt: 'gilt',
  Floater: 'floater',
  'Conservative Hybrid': 'conservativehybrid',
  'Balanced Hybrid': 'balancedhybrid',
  'Aggressive Hybrid': 'aggressivehybrid',
  'Dynamic Asset Allocation': 'dynamicassetallocation',
  'Multi Asset Allocation': 'multiassetallocation',
  Arbitrage: 'arbitrage',
  'Equity Savings': 'equitysavings',
  Index: 'index',
  'Tax Saving': 'taxsaving',
  Retirement: 'retirement',
  'Fund of Funds - Domestic': 'fundoffundsdomestic',
  'Fund of Funds - Overseas': 'fundoffundsoverseas',
  'Multi-Commodity': 'multicommodity',
  Others: 'others',
};

async function migrateSubcategories() {
  try {
    console.log('🔄 Starting subcategory migration...');

    await mongodb.connect();
    const collection = mongodb.getCollection('funds');

    // Get all funds
    const allFunds = await collection.find({}).toArray();
    console.log(`📊 Found ${allFunds.length} funds to process`);

    let updatedCount = 0;
    let skippedCount = 0;

    for (const fund of allFunds) {
      if (fund.subCategory) {
        const oldSubCategory = fund.subCategory;
        const newSubCategory =
          subcategoryMappings[oldSubCategory] ||
          oldSubCategory.toLowerCase().replace(/[\s_\-&\/]/g, '');

        if (oldSubCategory !== newSubCategory) {
          await collection.updateOne(
            { _id: fund._id },
            { $set: { subCategory: newSubCategory } }
          );
          console.log(
            `  ✅ Updated: "${oldSubCategory}" → "${newSubCategory}"`
          );
          updatedCount++;
        } else {
          skippedCount++;
        }
      }
    }

    console.log('\n✅ Migration completed!');
    console.log(`   Updated: ${updatedCount} funds`);
    console.log(
      `   Skipped: ${skippedCount} funds (already in correct format)`
    );

    // Verify the results
    console.log('\n📊 Verification - Fund counts by subcategory:');
    const subcategoryGroups = await collection
      .aggregate([
        { $group: { _id: '$subCategory', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ])
      .toArray();

    for (const group of subcategoryGroups) {
      console.log(`   ${group._id}: ${group.count} funds`);
    }
  } catch (error) {
    console.error('❌ Migration error:', error);
    throw error;
  } finally {
    await mongodb.disconnect();
  }
}

// Run migration
migrateSubcategories()
  .then(() => {
    console.log('\n🎉 Migration script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration script failed:', error);
    process.exit(1);
  });
