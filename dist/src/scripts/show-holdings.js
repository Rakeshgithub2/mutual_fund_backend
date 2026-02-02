"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = require("dotenv");
const path_1 = require("path");
(0, dotenv_1.config)({ path: (0, path_1.resolve)(__dirname, '../../.env') });
const mongodb_1 = require("../db/mongodb");
async function showHoldings() {
    await mongodb_1.mongodb.connect();
    const db = mongodb_1.mongodb.getDb();
    const holdings = await db.collection('holdings').find({}).toArray();
    console.log('='.repeat(60));
    console.log('EXISTING HOLDINGS DATA IN DATABASE');
    console.log('='.repeat(60));
    console.log('Total records:', holdings.length);
    holdings.forEach((h, i) => {
        console.log('\n' + '-'.repeat(60));
        console.log(`${i + 1}. ${h.schemeName || h.fundName || 'Fund ' + h.schemeCode}`);
        console.log('   Code:', h.schemeCode || h.fundCode);
        console.log('   Top Holdings:');
        (h.holdings || []).slice(0, 5).forEach((stock) => {
            console.log(`     - ${stock.company} (${stock.holdingPercent}%)`);
        });
        console.log('   Sectors:', Object.keys(h.sectors || {}).join(', '));
    });
    process.exit(0);
}
showHoldings().catch(console.error);
