"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = require("dotenv");
const path_1 = require("path");
// Load .env from mutual-funds-backend directory
(0, dotenv_1.config)({ path: (0, path_1.resolve)(__dirname, '../../.env') });
const mongodb_1 = require("../db/mongodb");
const gemini_1 = require("../lib/gemini");
async function updateHoldingsWithGemini() {
    // Verify API key is loaded
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error('❌ GEMINI_API_KEY not found in environment variables!');
        console.log('Please ensure .env file has GEMINI_API_KEY set');
        process.exit(1);
    }
    console.log('✅ Gemini API Key loaded successfully');
    await mongodb_1.mongodb.connect();
    const db = mongodb_1.mongodb.getDb();
    // Fetch all funds first, then filter in code for better control
    const allFunds = await db.collection('funds').find({}).toArray();
    // Filter to only Equity and Debt funds (exclude ETFs, Gold, Silver, Commodity)
    const funds = allFunds.filter((fund) => {
        const name = fund.fundName || fund.name || fund.schemeName || '';
        const category = fund.category || fund.fundType || fund.type || '';
        // Skip if no name
        if (!name)
            return false;
        // Skip ETFs and commodities
        if (/ETF|Gold|Silver|Commodity/i.test(name))
            return false;
        // Include only Equity and Debt
        const isEquityOrDebt = /equity|debt|large cap|mid cap|small cap|multi cap|flexi cap|hybrid|balanced/i.test(category) ||
            /equity|debt|large cap|mid cap|small cap|multi cap|flexi cap|hybrid|balanced/i.test(name);
        return isEquityOrDebt;
    });
    console.log(`📊 Found ${funds.length} Equity/Debt funds to process (from ${allFunds.length} total)\n`);
    const gemini = new gemini_1.GeminiClient(apiKey);
    let successCount = 0;
    let failCount = 0;
    for (const fund of funds) {
        const fundName = fund.fundName || fund.name || fund.schemeName;
        const fundCode = fund.fundCode || fund.fundId || fund.schemeCode;
        // Skip if no valid fund name or code
        if (!fundName || !fundCode) {
            console.log(`⏭️  Skipping fund with missing name/code`);
            continue;
        }
        console.log(`\n🔍 Fetching holdings for: ${fundName} (${fundCode})`);
        // Query Gemini for holdings with explicit JSON format
        const prompt = `You are a financial data expert. For the Indian mutual fund "${fundName}", provide the top 10 stock holdings and sector allocation.

Return ONLY a valid JSON object in this exact format (no markdown, no explanation):
{
  "holdings": [
    {"company": "Company Name", "sector": "Sector Name", "holdingPercent": 5.5},
    {"company": "Company Name 2", "sector": "Sector Name", "holdingPercent": 4.2}
  ],
  "sectors": {
    "Financial Services": 25.5,
    "Information Technology": 18.2,
    "Consumer Goods": 12.0
  }
}

Use realistic data based on typical Indian equity mutual fund portfolios. Include companies like Reliance Industries, HDFC Bank, Infosys, TCS, ICICI Bank, etc.`;
        const geminiResult = await gemini.getHoldingsAndSectors(prompt);
        if (geminiResult?.holdings && geminiResult?.sectors) {
            // Update holdings collection
            await db.collection('holdings').updateMany({ fundCode }, {
                $set: {
                    fundCode,
                    holdings: geminiResult.holdings,
                    asOfDate: new Date().toISOString().slice(0, 7),
                },
            }, { upsert: true });
            // Update sector allocation collection
            await db.collection('sector_allocation').updateMany({ fundCode }, {
                $set: {
                    fundCode,
                    sectors: geminiResult.sectors,
                    asOfDate: new Date().toISOString().slice(0, 7),
                },
            }, { upsert: true });
            console.log(`✅ Updated holdings and sectors for ${fundName}`);
            successCount++;
        }
        else {
            console.log(`❌ Gemini did not return valid data for ${fundName}`);
            failCount++;
        }
    }
    console.log(`\n🎉 All funds processed. Success: ${successCount}, Failed: ${failCount}`);
}
updateHoldingsWithGemini().catch(console.error);
