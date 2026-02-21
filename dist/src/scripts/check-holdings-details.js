"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = require("dotenv");
const path_1 = require("path");
(0, dotenv_1.config)({ path: (0, path_1.resolve)(__dirname, '../../.env') });
const mongodb_1 = require("../db/mongodb");
async function checkHoldingsDetails() {
    await mongodb_1.mongodb.connect();
    const db = mongodb_1.mongodb.getDb();
    // Get holdings with scheme codes
    const holdings = await db.collection('holdings').find({}).toArray();
    const schemeCodes = holdings.map((h) => h.schemeCode?.toString());
    console.log('='.repeat(70));
    console.log('HOLDINGS DATA ANALYSIS');
    console.log('='.repeat(70));
    // Find the corresponding funds
    for (const h of holdings) {
        const fund = await db.collection('funds').findOne({
            schemeCode: h.schemeCode?.toString(),
        });
        console.log('\n' + '-'.repeat(70));
        console.log('Scheme Code:', h.schemeCode);
        console.log('Fund Name:', fund?.schemeName || 'NOT FOUND IN FUNDS');
        console.log('Category:', fund?.category || 'N/A');
        console.log('Sub-Category:', fund?.subCategory || 'N/A');
        console.log('AMC:', fund?.amc || 'N/A');
        console.log('Holdings:');
        (h.holdings || []).slice(0, 5).forEach((stock) => {
            console.log(`  - ${stock.company} (${stock.holdingPercent}%)`);
        });
    }
    // Check if we have holdings for Nippon funds
    console.log('\n' + '='.repeat(70));
    console.log('NIPPON FUNDS IN DATABASE');
    console.log('='.repeat(70));
    const nipponFunds = await db
        .collection('funds')
        .find({
        schemeName: { $regex: /nippon.*direct.*growth/i },
        $or: [
            { schemeName: { $regex: /large cap/i } },
            { schemeName: { $regex: /mid cap/i } },
            { schemeName: { $regex: /small cap/i } },
        ],
    })
        .limit(10)
        .toArray();
    nipponFunds.forEach((f) => {
        console.log(`\n${f.schemeName}`);
        console.log(`  Code: ${f.schemeCode}, Category: ${f.subCategory || f.category}`);
    });
    process.exit(0);
}
checkHoldingsDetails().catch(console.error);
