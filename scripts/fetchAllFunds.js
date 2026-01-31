/**
 * Comprehensive Fund Seeding Script
 * Fetches 4000+ funds from AMFI and enriches with additional data
 */

require('dotenv').config();
const mongoose = require('mongoose');
const axios = require('axios');
const FundEnhanced = require('../models/FundEnhanced.model');

const DATABASE_URL = process.env.DATABASE_URL;

/**
 * Parse AMFI NAV file
 * Format: Scheme Code;ISIN Div Payout;ISIN Div Reinvestment;ISIN Growth;Scheme Name;Net Asset Value;Date
 */
async function fetchAMFIFunds() {
  try {
    console.log('📥 Fetching AMFI data...');
    const response = await axios.get(
      'https://www.amfiindia.com/spages/NAVAll.txt'
    );
    const lines = response.data.split('\n');

    const funds = [];
    let currentFundHouse = '';

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip empty lines and header
      if (!trimmed || trimmed.startsWith('Scheme Code')) continue;

      // Check if this is a fund house name (no semicolons)
      if (!trimmed.includes(';')) {
        currentFundHouse = trimmed;
        continue;
      }

      // Parse fund data
      const parts = trimmed.split(';');
      if (parts.length < 7) continue;

      const [
        schemeCode,
        isinDiv,
        isinReinv,
        isinGrowth,
        schemeName,
        navValue,
        navDate,
      ] = parts;

      // Skip if invalid NAV
      if (!navValue || navValue === 'N.A.' || isNaN(parseFloat(navValue)))
        continue;

      funds.push({
        schemeCode: schemeCode.trim(),
        name: schemeName.trim(),
        fundHouse: currentFundHouse,
        nav: parseFloat(navValue),
        navDate: new Date(navDate.trim()),
        isinDiv,
        isinReinv,
        isinGrowth,
      });
    }

    console.log(`✅ Fetched ${funds.length} funds from AMFI`);
    return funds;
  } catch (error) {
    console.error('❌ Error fetching AMFI data:', error.message);
    throw error;
  }
}

/**
 * Categorize fund based on name
 */
function categorizeFund(name) {
  const nameLower = name.toLowerCase();

  // Category determination
  let category = 'other';
  let subCategory = '';

  if (
    nameLower.includes('equity') ||
    nameLower.includes('stock') ||
    nameLower.includes('large cap') ||
    nameLower.includes('mid cap') ||
    nameLower.includes('small cap') ||
    nameLower.includes('multi cap') ||
    nameLower.includes('flexi cap') ||
    nameLower.includes('focused') ||
    nameLower.includes('sectoral') ||
    nameLower.includes('thematic') ||
    nameLower.includes('dividend yield') ||
    nameLower.includes('value') ||
    nameLower.includes('contra') ||
    nameLower.includes('elss')
  ) {
    category = 'equity';

    if (nameLower.includes('large cap')) subCategory = 'Large Cap';
    else if (nameLower.includes('mid cap')) subCategory = 'Mid Cap';
    else if (nameLower.includes('small cap')) subCategory = 'Small Cap';
    else if (nameLower.includes('multi cap') || nameLower.includes('multicap'))
      subCategory = 'Multi Cap';
    else if (nameLower.includes('flexi cap') || nameLower.includes('flexicap'))
      subCategory = 'Flexi Cap';
    else if (nameLower.includes('elss')) subCategory = 'ELSS';
    else if (nameLower.includes('focused')) subCategory = 'Focused';
    else if (nameLower.includes('sectoral') || nameLower.includes('sector'))
      subCategory = 'Sectoral';
    else if (nameLower.includes('thematic')) subCategory = 'Thematic';
    else if (nameLower.includes('dividend')) subCategory = 'Dividend Yield';
    else if (nameLower.includes('value')) subCategory = 'Value';
    else if (nameLower.includes('contra')) subCategory = 'Contra';
    else subCategory = 'Other Equity';
  } else if (
    nameLower.includes('debt') ||
    nameLower.includes('bond') ||
    nameLower.includes('gilt') ||
    nameLower.includes('liquid') ||
    nameLower.includes('overnight') ||
    nameLower.includes('ultra short') ||
    nameLower.includes('low duration') ||
    nameLower.includes('money market') ||
    nameLower.includes('short duration') ||
    nameLower.includes('medium duration') ||
    nameLower.includes('long duration') ||
    nameLower.includes('dynamic bond') ||
    nameLower.includes('corporate bond') ||
    nameLower.includes('credit risk') ||
    nameLower.includes('banking & psu')
  ) {
    category = 'debt';

    if (nameLower.includes('liquid')) subCategory = 'Liquid';
    else if (nameLower.includes('overnight')) subCategory = 'Overnight';
    else if (nameLower.includes('ultra short'))
      subCategory = 'Ultra Short Duration';
    else if (nameLower.includes('low duration')) subCategory = 'Low Duration';
    else if (nameLower.includes('money market')) subCategory = 'Money Market';
    else if (nameLower.includes('short duration'))
      subCategory = 'Short Duration';
    else if (nameLower.includes('medium duration'))
      subCategory = 'Medium Duration';
    else if (nameLower.includes('long duration')) subCategory = 'Long Duration';
    else if (nameLower.includes('dynamic bond')) subCategory = 'Dynamic Bond';
    else if (nameLower.includes('corporate bond'))
      subCategory = 'Corporate Bond';
    else if (nameLower.includes('credit risk')) subCategory = 'Credit Risk';
    else if (nameLower.includes('gilt')) subCategory = 'Gilt';
    else if (nameLower.includes('banking') || nameLower.includes('psu'))
      subCategory = 'Banking & PSU';
    else subCategory = 'Other Debt';
  } else if (
    nameLower.includes('hybrid') ||
    nameLower.includes('balanced') ||
    nameLower.includes('aggressive') ||
    nameLower.includes('conservative') ||
    nameLower.includes('dynamic asset') ||
    nameLower.includes('multi asset') ||
    nameLower.includes('arbitrage') ||
    nameLower.includes('equity savings')
  ) {
    category = 'hybrid';

    if (nameLower.includes('aggressive')) subCategory = 'Aggressive Hybrid';
    else if (nameLower.includes('conservative'))
      subCategory = 'Conservative Hybrid';
    else if (nameLower.includes('balanced')) subCategory = 'Balanced Hybrid';
    else if (nameLower.includes('dynamic asset'))
      subCategory = 'Dynamic Asset Allocation';
    else if (nameLower.includes('multi asset'))
      subCategory = 'Multi Asset Allocation';
    else if (nameLower.includes('arbitrage')) subCategory = 'Arbitrage';
    else if (nameLower.includes('equity savings'))
      subCategory = 'Equity Savings';
    else subCategory = 'Other Hybrid';
  } else if (
    nameLower.includes('gold') ||
    nameLower.includes('silver') ||
    nameLower.includes('commodity')
  ) {
    category = 'commodity';

    if (nameLower.includes('gold')) subCategory = 'Gold';
    else if (nameLower.includes('silver')) subCategory = 'Silver';
    else subCategory = 'Other Commodity';
  } else if (
    nameLower.includes('solution') ||
    nameLower.includes('retirement') ||
    nameLower.includes('children')
  ) {
    category = 'solution';

    if (nameLower.includes('retirement')) subCategory = 'Retirement';
    else if (nameLower.includes('children')) subCategory = "Children's Fund";
    else subCategory = 'Other Solution';
  }

  return { category, subCategory };
}

/**
 * Generate mock returns (replace with real data when available)
 */
function generateMockReturns(category) {
  const baseReturns = {
    equity: { oneYear: 15, threeYear: 12, fiveYear: 14 },
    debt: { oneYear: 6, threeYear: 6.5, fiveYear: 7 },
    hybrid: { oneYear: 10, threeYear: 9, fiveYear: 10 },
    commodity: { oneYear: 8, threeYear: 7, fiveYear: 9 },
    solution: { oneYear: 11, threeYear: 10, fiveYear: 11 },
    other: { oneYear: 7, threeYear: 7, fiveYear: 8 },
  };

  const base = baseReturns[category] || baseReturns.other;
  const variance = () => (Math.random() - 0.5) * 10; // +/- 5%

  return {
    oneDay: Number((Math.random() * 2 - 1).toFixed(2)),
    oneMonth: Number((Math.random() * 5 - 2).toFixed(2)),
    sixMonth: Number((base.oneYear / 2 + variance()).toFixed(2)),
    oneYear: Number((base.oneYear + variance()).toFixed(2)),
    threeYear: Number((base.threeYear + variance()).toFixed(2)),
    fiveYear: Number((base.fiveYear + variance()).toFixed(2)),
    sinceInception: Number((base.fiveYear + variance() + 1).toFixed(2)),
  };
}

/**
 * Generate NAV history for last 365 days
 */
function generateNavHistory(currentNav) {
  const history = [];
  const daysBack = 365;
  let nav = currentNav;

  for (let i = 0; i < daysBack; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);

    // Add some randomness (±0.5%)
    nav = nav * (1 + (Math.random() - 0.5) * 0.01);

    history.push({
      date,
      nav: Number(nav.toFixed(4)),
    });
  }

  return history.reverse();
}

/**
 * Generate mock sector allocation
 */
function generateSectorAllocation(category) {
  if (category !== 'equity') return [];

  const sectors = [
    'Banking',
    'IT',
    'Auto',
    'Pharma',
    'FMCG',
    'Energy',
    'Telecom',
    'Metals',
    'Realty',
    'Infrastructure',
  ];

  const allocation = [];
  let remaining = 100;

  for (let i = 0; i < sectors.length - 1; i++) {
    const percentage = Number(
      (Math.random() * (remaining / (sectors.length - i))).toFixed(2)
    );
    allocation.push({ sector: sectors[i], percentage });
    remaining -= percentage;
  }

  allocation.push({
    sector: sectors[sectors.length - 1],
    percentage: Number(remaining.toFixed(2)),
  });

  return allocation.sort((a, b) => b.percentage - a.percentage).slice(0, 7);
}

/**
 * Generate mock top holdings
 */
function generateTopHoldings(category) {
  if (category !== 'equity') return [];

  const companies = [
    { name: 'Reliance Industries', sector: 'Energy' },
    { name: 'HDFC Bank', sector: 'Banking' },
    { name: 'Infosys', sector: 'IT' },
    { name: 'ICICI Bank', sector: 'Banking' },
    { name: 'TCS', sector: 'IT' },
    { name: 'Hindustan Unilever', sector: 'FMCG' },
    { name: 'Kotak Mahindra Bank', sector: 'Banking' },
    { name: 'ITC', sector: 'FMCG' },
    { name: 'Axis Bank', sector: 'Banking' },
    { name: 'Bajaj Finance', sector: 'Finance' },
  ];

  const holdings = [];
  let remaining = 60; // Top holdings usually make up 40-60% of portfolio

  for (let i = 0; i < 10; i++) {
    const percentage = Number(
      (Math.random() * (remaining / (10 - i)) * 0.5 + 2).toFixed(2)
    );
    holdings.push({
      name: companies[i].name,
      percentage,
      sector: companies[i].sector,
    });
    remaining -= percentage;
  }

  return holdings.sort((a, b) => b.percentage - a.percentage);
}

/**
 * Main seed function
 */
async function seedFunds() {
  try {
    console.log('🚀 Starting comprehensive fund seeding...\n');

    // Connect to MongoDB
    await mongoose.connect(DATABASE_URL);
    console.log('✅ Connected to MongoDB\n');

    // Fetch AMFI funds
    const amfiFunds = await fetchAMFIFunds();
    console.log(`📊 Processing ${amfiFunds.length} funds...\n`);

    // Clear existing data
    await FundEnhanced.deleteMany({});
    console.log('🗑️  Cleared existing funds\n');

    // Process and insert funds in batches
    const batchSize = 100;
    let inserted = 0;

    for (let i = 0; i < amfiFunds.length; i += batchSize) {
      const batch = amfiFunds.slice(i, i + batchSize);
      const enrichedFunds = batch.map((fund) => {
        const { category, subCategory } = categorizeFund(fund.name);
        const returns = generateMockReturns(category);

        return {
          fundId: `FUND${fund.schemeCode}`,
          name: fund.name,
          schemeCode: fund.schemeCode,
          amfiCode: fund.schemeCode,
          category,
          subCategory,
          fundHouse: fund.fundHouse,
          nav: fund.nav,
          previousNav: fund.nav * 0.99, // Mock previous NAV
          navDate: fund.navDate,
          returns,
          topHoldings: generateTopHoldings(category),
          sectorAllocation: generateSectorAllocation(category),
          navHistory: generateNavHistory(fund.nav),
          aum: Number((Math.random() * 50000 + 100).toFixed(2)), // Mock AUM
          expenseRatio: Number((Math.random() * 2 + 0.5).toFixed(2)),
          exitLoad: category === 'equity' ? 1.0 : 0.0,
          minInvestment: category === 'equity' ? 5000 : 1000,
          sipMinAmount: category === 'equity' ? 500 : 100,
          riskLevel:
            category === 'equity'
              ? 'HIGH'
              : category === 'debt'
                ? 'LOW'
                : 'MODERATE',
          riskMetrics: {
            volatility: Number((Math.random() * 20 + 5).toFixed(2)),
            sharpeRatio: Number((Math.random() * 2 + 0.5).toFixed(2)),
            beta: Number((Math.random() * 1.5 + 0.5).toFixed(2)),
            alpha: Number((Math.random() * 5 - 2).toFixed(2)),
          },
          ratings: {
            morningstar: Math.floor(Math.random() * 5) + 1,
            valueResearch: Math.floor(Math.random() * 5) + 1,
            crisil: Math.floor(Math.random() * 5) + 1,
          },
          fundManager: {
            name: 'Fund Manager', // TODO: Add real manager names
            experience: Math.floor(Math.random() * 20) + 3,
          },
          isActive: true,
          tags: [category, subCategory.toLowerCase().replace(/\s+/g, '-')],
          popularity: Math.floor(Math.random() * 100),
          lastUpdated: new Date(),
        };
      });

      await FundEnhanced.insertMany(enrichedFunds);
      inserted += enrichedFunds.length;
      console.log(
        `✅ Inserted batch ${Math.floor(i / batchSize) + 1}: ${inserted} funds total`
      );
    }

    console.log('\n✅ Seeding completed successfully!');
    console.log(`📊 Total funds inserted: ${inserted}`);

    // Show statistics
    const stats = await FundEnhanced.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]);

    console.log('\n📊 Category breakdown:');
    stats.forEach((stat) => {
      console.log(`   ${stat._id}: ${stat.count} funds`);
    });

    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
  } catch (error) {
    console.error('\n❌ Seeding failed:', error);
    process.exit(1);
  }
}

// Run the seeder
seedFunds();
