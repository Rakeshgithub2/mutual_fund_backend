"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = require("dotenv");
const path_1 = require("path");
(0, dotenv_1.config)({ path: (0, path_1.resolve)(__dirname, '../../.env') });
const mongodb_1 = require("../db/mongodb");
async function checkFunds() {
    await mongodb_1.mongodb.connect();
    const db = mongodb_1.mongodb.getDb();
    // Count total funds
    const totalFunds = await db.collection('funds').countDocuments();
    console.log('📊 Total Funds in DB:', totalFunds);
    // Count by category
    const categories = await db
        .collection('funds')
        .aggregate([
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 15 },
    ])
        .toArray();
    console.log('\n📈 Funds by Category:');
    categories.forEach((c) => console.log('  ', c._id || 'Unknown', ':', c.count));
    // Check existing holdings
    const holdingsCount = await db.collection('holdings').countDocuments();
    console.log('\n💼 Existing Holdings Records:', holdingsCount);
    // Check sector allocations
    const sectorCount = await db.collection('sector_allocation').countDocuments();
    console.log('🥧 Existing Sector Allocations:', sectorCount);
    // Sample fund to check fields
    const sampleFund = await db.collection('funds').findOne({});
    console.log('\n📋 Fund Document Fields:', Object.keys(sampleFund || {}));
    // Count equity funds (for Gemini processing)
    const equityFunds = await db.collection('funds').countDocuments({
        $or: [
            { category: { $regex: /equity/i } },
            {
                schemeName: {
                    $regex: /large cap|mid cap|small cap|multi cap|flexi cap/i,
                },
            },
        ],
    });
    console.log('\n🎯 Equity-type Funds (for holdings extraction):', equityFunds);
    // Sample equity funds
    const sampleEquity = await db
        .collection('funds')
        .find({
        schemeName: {
            $regex: /large cap|mid cap|small cap|equity/i,
            $not: /ETF|Gold|Silver/,
        },
    })
        .limit(10)
        .toArray();
    console.log('\n🔍 Sample Equity Funds for Processing:');
    sampleEquity.forEach((f) => {
        const name = f.schemeName || f.fundName || f.name;
        const code = f.schemeCode || f.fundCode;
        console.log(`  - ${name?.substring(0, 55)} (${code})`);
    });
    process.exit(0);
}
checkFunds().catch(console.error);
