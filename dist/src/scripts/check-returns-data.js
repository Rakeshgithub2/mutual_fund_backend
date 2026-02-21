#!/usr/bin/env tsx
"use strict";
/**
 * Check Returns Data Script
 * Verify that funds have returns.oneYear data
 */
Object.defineProperty(exports, "__esModule", { value: true });
const mongodb_1 = require("../db/mongodb");
async function checkReturnsData() {
    try {
        console.log('🔍 Checking returns data...');
        await mongodb_1.mongodb.connect();
        const collection = mongodb_1.mongodb.getCollection('funds');
        // Get sample funds
        const sampleFunds = await collection.find({}).limit(10).toArray();
        console.log(`\n📊 Sample of ${sampleFunds.length} funds:\n`);
        for (const fund of sampleFunds) {
            console.log(`Fund: ${fund.name}`);
            console.log(`  SubCategory: ${fund.subCategory}`);
            console.log(`  Returns:`, fund.returns);
            console.log('');
        }
        // Count funds with and without returns.oneYear
        const fundsWithReturns = await collection.countDocuments({
            'returns.oneYear': { $exists: true, $ne: null },
        });
        const fundsWithoutReturns = await collection.countDocuments({
            $or: [
                { 'returns.oneYear': { $exists: false } },
                { 'returns.oneYear': null },
            ],
        });
        const totalFunds = await collection.countDocuments();
        console.log('📈 Statistics:');
        console.log(`  Total funds: ${totalFunds}`);
        console.log(`  Funds WITH returns.oneYear: ${fundsWithReturns}`);
        console.log(`  Funds WITHOUT returns.oneYear: ${fundsWithoutReturns}`);
    }
    catch (error) {
        console.error('❌ Error:', error);
        throw error;
    }
    finally {
        await mongodb_1.mongodb.disconnect();
    }
}
// Run check
checkReturnsData()
    .then(() => {
    console.log('\n✅ Check completed');
    process.exit(0);
})
    .catch((error) => {
    console.error('\n❌ Check failed:', error);
    process.exit(1);
});
