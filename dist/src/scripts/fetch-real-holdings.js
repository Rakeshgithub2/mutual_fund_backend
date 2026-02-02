"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = require("dotenv");
const path_1 = require("path");
// Load .env from mutual-funds-backend directory
(0, dotenv_1.config)({ path: (0, path_1.resolve)(__dirname, '../../.env') });
const mongodb_1 = require("../db/mongodb");
const gemini_1 = require("../lib/gemini");
const BATCH_SIZE = 20; // Process 20 funds at a time to avoid rate limits
const DELAY_MS = 2000; // 2 second delay between requests
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
async function updateHoldingsWithGemini() {
    // Verify API key is loaded
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error('❌ GEMINI_API_KEY not found in environment variables!');
        process.exit(1);
    }
    console.log('✅ Gemini API Key loaded');
    await mongodb_1.mongodb.connect();
    const db = mongodb_1.mongodb.getDb();
    // Get popular equity funds (Direct Plan, Growth) - these are the ones users care about
    const funds = await db
        .collection('funds')
        .find({
        category: 'equity',
        schemeName: {
            $regex: /Direct.*Growth|Direct Plan.*Growth/i,
            $not: /ETF|Gold|Silver|Commodity|IDCW|Dividend/i,
        },
    })
        .limit(BATCH_SIZE)
        .toArray();
    console.log(`\n📊 Processing ${funds.length} Equity Direct Growth funds\n`);
    const gemini = new gemini_1.GeminiClient(apiKey);
    let successCount = 0;
    let failCount = 0;
    for (let i = 0; i < funds.length; i++) {
        const fund = funds[i];
        const fundName = fund.schemeName;
        const fundCode = fund.schemeCode;
        if (!fundName || !fundCode) {
            console.log(`⏭️  Skipping fund with missing name/code`);
            continue;
        }
        console.log(`\n[${i + 1}/${funds.length}] 🔍 ${fundName.substring(0, 50)}...`);
        // Query Gemini for holdings
        const prompt = `You are a financial data expert. For the Indian mutual fund "${fundName}", provide the top 10 stock holdings and sector allocation based on the latest available data.

Return ONLY a valid JSON object in this exact format (no markdown, no explanation, no code blocks):
{
  "holdings": [
    {"company": "Reliance Industries Ltd", "sector": "Oil & Gas", "holdingPercent": 8.5},
    {"company": "HDFC Bank Ltd", "sector": "Financial Services", "holdingPercent": 7.2}
  ],
  "sectors": {
    "Financial Services": 28.5,
    "Information Technology": 18.2,
    "Oil & Gas": 12.0,
    "Consumer Goods": 10.5
  }
}

Use realistic data for Indian equity mutual funds. Include actual Indian companies like Reliance, HDFC Bank, Infosys, TCS, ICICI Bank, Bharti Airtel, ITC, Kotak Bank, L&T, Axis Bank, etc.`;
        try {
            const geminiResult = await gemini.getHoldingsAndSectors(prompt);
            if (geminiResult?.holdings?.length > 0) {
                // Update holdings collection
                await db.collection('holdings').updateOne({ schemeCode: fundCode }, {
                    $set: {
                        schemeCode: fundCode,
                        schemeName: fundName,
                        holdings: geminiResult.holdings,
                        sectors: geminiResult.sectors,
                        asOfDate: new Date().toISOString().slice(0, 10),
                        updatedAt: new Date(),
                    },
                }, { upsert: true });
                // Also update sector_allocation collection
                await db.collection('sector_allocation').updateOne({ schemeCode: fundCode }, {
                    $set: {
                        schemeCode: fundCode,
                        schemeName: fundName,
                        sectors: geminiResult.sectors,
                        asOfDate: new Date().toISOString().slice(0, 10),
                        updatedAt: new Date(),
                    },
                }, { upsert: true });
                console.log(`   ✅ Updated: ${geminiResult.holdings.length} holdings, ${Object.keys(geminiResult.sectors || {}).length} sectors`);
                successCount++;
            }
            else {
                console.log(`   ❌ No valid data returned`);
                failCount++;
            }
        }
        catch (err) {
            console.log(`   ❌ Error: ${err.message}`);
            failCount++;
        }
        // Add delay to avoid rate limiting
        if (i < funds.length - 1) {
            await sleep(DELAY_MS);
        }
    }
    console.log(`\n${'='.repeat(50)}`);
    console.log(`🎉 Processing Complete!`);
    console.log(`   ✅ Success: ${successCount}`);
    console.log(`   ❌ Failed: ${failCount}`);
    console.log(`${'='.repeat(50)}\n`);
    // Show sample of updated holdings
    const sampleHoldings = await db
        .collection('holdings')
        .find({})
        .limit(3)
        .toArray();
    console.log('📋 Sample Holdings Data:');
    sampleHoldings.forEach((h) => {
        console.log(`\n${h.schemeName}:`);
        console.log('  Holdings:', h.holdings
            ?.slice(0, 3)
            .map((x) => `${x.company} (${x.holdingPercent}%)`)
            .join(', '));
    });
    process.exit(0);
}
updateHoldingsWithGemini().catch(console.error);
