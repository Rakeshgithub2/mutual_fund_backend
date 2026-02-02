"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = require("dotenv");
const path_1 = require("path");
(0, dotenv_1.config)({ path: (0, path_1.resolve)(__dirname, '../../.env') });
const mongodb_1 = require("../db/mongodb");
// Realistic holdings for different fund categories
const LARGE_CAP_HOLDINGS = {
    holdings: [
        {
            company: 'HDFC Bank Ltd',
            sector: 'Financial Services',
            holdingPercent: 9.2,
        },
        {
            company: 'Reliance Industries Ltd',
            sector: 'Oil & Gas',
            holdingPercent: 8.5,
        },
        {
            company: 'ICICI Bank Ltd',
            sector: 'Financial Services',
            holdingPercent: 7.8,
        },
        {
            company: 'Infosys Ltd',
            sector: 'Information Technology',
            holdingPercent: 6.5,
        },
        {
            company: 'Tata Consultancy Services Ltd',
            sector: 'Information Technology',
            holdingPercent: 5.8,
        },
        { company: 'Bharti Airtel Ltd', sector: 'Telecom', holdingPercent: 4.2 },
        { company: 'ITC Ltd', sector: 'Consumer Goods', holdingPercent: 3.8 },
        {
            company: 'Larsen & Toubro Ltd',
            sector: 'Infrastructure',
            holdingPercent: 3.5,
        },
        {
            company: 'Axis Bank Ltd',
            sector: 'Financial Services',
            holdingPercent: 3.2,
        },
        {
            company: 'Kotak Mahindra Bank Ltd',
            sector: 'Financial Services',
            holdingPercent: 2.9,
        },
    ],
    sectors: {
        'Financial Services': 28.5,
        'Information Technology': 18.2,
        'Oil & Gas': 12.0,
        'Consumer Goods': 10.5,
        Telecom: 8.2,
        Infrastructure: 7.5,
        Automobile: 6.8,
        Pharma: 5.3,
        Others: 3.0,
    },
};
const MID_CAP_HOLDINGS = {
    holdings: [
        {
            company: 'Max Healthcare Institute Ltd',
            sector: 'Healthcare',
            holdingPercent: 5.8,
        },
        {
            company: 'Persistent Systems Ltd',
            sector: 'Information Technology',
            holdingPercent: 5.2,
        },
        {
            company: 'Indian Hotels Company Ltd',
            sector: 'Hotels',
            holdingPercent: 4.8,
        },
        {
            company: 'Tube Investments of India Ltd',
            sector: 'Auto Components',
            holdingPercent: 4.5,
        },
        {
            company: 'Coforge Ltd',
            sector: 'Information Technology',
            holdingPercent: 4.2,
        },
        {
            company: 'Sundaram Finance Ltd',
            sector: 'Financial Services',
            holdingPercent: 3.9,
        },
        { company: 'Voltas Ltd', sector: 'Consumer Durables', holdingPercent: 3.6 },
        {
            company: 'Oberoi Realty Ltd',
            sector: 'Real Estate',
            holdingPercent: 3.4,
        },
        {
            company: 'Supreme Industries Ltd',
            sector: 'Manufacturing',
            holdingPercent: 3.2,
        },
        {
            company: 'Crompton Greaves Consumer Electricals',
            sector: 'Consumer Durables',
            holdingPercent: 3.0,
        },
    ],
    sectors: {
        'Information Technology': 22.5,
        'Financial Services': 18.0,
        Healthcare: 14.2,
        'Consumer Durables': 12.5,
        'Auto Components': 10.8,
        'Real Estate': 8.5,
        Hotels: 6.2,
        Manufacturing: 4.8,
        Others: 2.5,
    },
};
const SMALL_CAP_HOLDINGS = {
    holdings: [
        {
            company: 'Apar Industries Ltd',
            sector: 'Capital Goods',
            holdingPercent: 4.2,
        },
        {
            company: 'KPIT Technologies Ltd',
            sector: 'Information Technology',
            holdingPercent: 3.8,
        },
        {
            company: 'Cyient Ltd',
            sector: 'Information Technology',
            holdingPercent: 3.5,
        },
        {
            company: 'CMS Info Systems Ltd',
            sector: 'Financial Services',
            holdingPercent: 3.2,
        },
        {
            company: 'JK Cement Ltd',
            sector: 'Building Materials',
            holdingPercent: 3.0,
        },
        {
            company: 'Karur Vysya Bank Ltd',
            sector: 'Financial Services',
            holdingPercent: 2.8,
        },
        {
            company: 'Sonata Software Ltd',
            sector: 'Information Technology',
            holdingPercent: 2.6,
        },
        {
            company: 'Radico Khaitan Ltd',
            sector: 'Consumer Goods',
            holdingPercent: 2.4,
        },
        {
            company: 'Kajaria Ceramics Ltd',
            sector: 'Building Materials',
            holdingPercent: 2.2,
        },
        {
            company: 'Blue Star Ltd',
            sector: 'Consumer Durables',
            holdingPercent: 2.0,
        },
    ],
    sectors: {
        'Information Technology': 20.5,
        'Financial Services': 16.2,
        'Capital Goods': 14.8,
        'Building Materials': 12.0,
        'Consumer Durables': 10.5,
        'Consumer Goods': 9.2,
        Healthcare: 7.5,
        Chemicals: 5.8,
        Others: 3.5,
    },
};
const FLEXI_CAP_HOLDINGS = {
    holdings: [
        {
            company: 'HDFC Bank Ltd',
            sector: 'Financial Services',
            holdingPercent: 7.5,
        },
        {
            company: 'ICICI Bank Ltd',
            sector: 'Financial Services',
            holdingPercent: 6.2,
        },
        {
            company: 'Reliance Industries Ltd',
            sector: 'Oil & Gas',
            holdingPercent: 5.8,
        },
        {
            company: 'Infosys Ltd',
            sector: 'Information Technology',
            holdingPercent: 4.5,
        },
        {
            company: 'Persistent Systems Ltd',
            sector: 'Information Technology',
            holdingPercent: 3.8,
        },
        { company: 'Bharti Airtel Ltd', sector: 'Telecom', holdingPercent: 3.5 },
        {
            company: 'Max Healthcare Institute Ltd',
            sector: 'Healthcare',
            holdingPercent: 3.2,
        },
        { company: 'Tata Motors Ltd', sector: 'Automobile', holdingPercent: 2.9 },
        {
            company: 'Sun Pharma Industries Ltd',
            sector: 'Pharma',
            holdingPercent: 2.6,
        },
        {
            company: 'Maruti Suzuki India Ltd',
            sector: 'Automobile',
            holdingPercent: 2.4,
        },
    ],
    sectors: {
        'Financial Services': 25.0,
        'Information Technology': 16.5,
        'Oil & Gas': 10.2,
        Healthcare: 9.8,
        Automobile: 9.5,
        Telecom: 8.2,
        'Consumer Goods': 7.5,
        Pharma: 6.8,
        Others: 6.5,
    },
};
async function seedHoldingsData() {
    await mongodb_1.mongodb.connect();
    const db = mongodb_1.mongodb.getDb();
    // Clear old bad data
    await db.collection('holdings').deleteMany({});
    await db.collection('sector_allocation').deleteMany({});
    console.log('🗑️  Cleared old holdings data\n');
    // Get popular funds by category
    const fundCategories = [
        {
            regex: /nippon.*large cap.*direct.*growth/i,
            subCategory: 'largecap',
            template: LARGE_CAP_HOLDINGS,
        },
        {
            regex: /nippon.*mid cap.*direct.*growth/i,
            subCategory: 'midcap',
            template: MID_CAP_HOLDINGS,
        },
        {
            regex: /nippon.*small cap.*direct.*growth/i,
            subCategory: 'smallcap',
            template: SMALL_CAP_HOLDINGS,
        },
        {
            regex: /hdfc.*large cap.*direct.*growth/i,
            subCategory: 'largecap',
            template: LARGE_CAP_HOLDINGS,
        },
        {
            regex: /hdfc.*mid.*cap.*direct.*growth/i,
            subCategory: 'midcap',
            template: MID_CAP_HOLDINGS,
        },
        {
            regex: /hdfc.*small cap.*direct.*growth/i,
            subCategory: 'smallcap',
            template: SMALL_CAP_HOLDINGS,
        },
        {
            regex: /sbi.*large cap.*direct.*growth/i,
            subCategory: 'largecap',
            template: LARGE_CAP_HOLDINGS,
        },
        {
            regex: /sbi.*mid.*cap.*direct.*growth/i,
            subCategory: 'midcap',
            template: MID_CAP_HOLDINGS,
        },
        {
            regex: /sbi.*small cap.*direct.*growth/i,
            subCategory: 'smallcap',
            template: SMALL_CAP_HOLDINGS,
        },
        {
            regex: /axis.*large cap.*direct.*growth/i,
            subCategory: 'largecap',
            template: LARGE_CAP_HOLDINGS,
        },
        {
            regex: /axis.*mid.*cap.*direct.*growth/i,
            subCategory: 'midcap',
            template: MID_CAP_HOLDINGS,
        },
        {
            regex: /axis.*small cap.*direct.*growth/i,
            subCategory: 'smallcap',
            template: SMALL_CAP_HOLDINGS,
        },
        {
            regex: /icici.*large cap.*direct.*growth/i,
            subCategory: 'largecap',
            template: LARGE_CAP_HOLDINGS,
        },
        {
            regex: /icici.*mid.*cap.*direct.*growth/i,
            subCategory: 'midcap',
            template: MID_CAP_HOLDINGS,
        },
        {
            regex: /icici.*small cap.*direct.*growth/i,
            subCategory: 'smallcap',
            template: SMALL_CAP_HOLDINGS,
        },
        {
            regex: /flexi.*cap.*direct.*growth/i,
            subCategory: 'flexicap',
            template: FLEXI_CAP_HOLDINGS,
        },
    ];
    let totalInserted = 0;
    for (const { regex, subCategory, template } of fundCategories) {
        const funds = await db
            .collection('funds')
            .find({
            schemeName: { $regex: regex },
        })
            .limit(3)
            .toArray();
        for (const fund of funds) {
            // Add slight variation to make each fund unique
            const variation = Math.random() * 0.5 - 0.25; // ±0.25%
            const holdings = template.holdings.map((h) => ({
                ...h,
                holdingPercent: Math.round((h.holdingPercent + variation) * 10) / 10,
            }));
            await db.collection('holdings').insertOne({
                schemeCode: fund.schemeCode,
                schemeName: fund.schemeName,
                category: fund.category,
                subCategory: subCategory,
                amc: fund.amc,
                holdings: holdings,
                sectors: template.sectors,
                asOfDate: '2026-01-01',
                updatedAt: new Date(),
            });
            await db.collection('sector_allocation').insertOne({
                schemeCode: fund.schemeCode,
                schemeName: fund.schemeName,
                sectors: template.sectors,
                asOfDate: '2026-01-01',
                updatedAt: new Date(),
            });
            console.log(`✅ ${subCategory.toUpperCase().padEnd(10)} | ${fund.schemeName?.substring(0, 50)}`);
            totalInserted++;
        }
    }
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🎉 Seeded ${totalInserted} funds with category-specific holdings!`);
    console.log(`${'='.repeat(60)}\n`);
    // Verify
    const count = await db.collection('holdings').countDocuments();
    console.log('Total holdings records:', count);
    process.exit(0);
}
seedHoldingsData().catch(console.error);
