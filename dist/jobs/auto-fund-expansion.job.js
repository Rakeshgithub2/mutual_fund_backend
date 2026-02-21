/**
 * Auto Fund Expansion Job
 * Daily job to automatically fetch and save new funds to database
 * Makes the database self-growing with fresh funds
 */

const Fund = require('../src/models/Fund.model');
const axios = require('axios');

class AutoFundExpansionJob {
  constructor() {
    this.name = 'AutoFundExpansion';
    this.maxFundsPerRun = 500;
  }

  /**
   * Execute the auto fund expansion job
   * Fetches fresh funds from API and saves to MongoDB
   */
  async execute() {
    console.log(`\n🚀 [${this.name}] Starting auto fund expansion...`);
    const startTime = Date.now();

    try {
      // STEP 1: Get existing fund count
      const existingCount = await Fund.countDocuments();
      console.log(`📊 Current database: ${existingCount} funds`);

      // STEP 2: Fetch fresh funds from RapidAPI
      const rapidApiKey = process.env.RAPIDAPI_KEY;
      if (!rapidApiKey) {
        console.error('❌ RapidAPI key not configured');
        return {
          success: false,
          error: 'API key missing',
        };
      }

      console.log('🔄 Fetching funds from RapidAPI...');
      const response = await axios.get(
        'https://latest-mutual-fund-nav.p.rapidapi.com/fetchAllMutualFund',
        {
          headers: {
            'X-RapidAPI-Key': rapidApiKey,
            'X-RapidAPI-Host': 'latest-mutual-fund-nav.p.rapidapi.com',
          },
          timeout: 30000, // 30 seconds
        }
      );

      if (!response.data || !Array.isArray(response.data)) {
        console.error('❌ Invalid API response');
        return {
          success: false,
          error: 'Invalid response',
        };
      }

      const apiFunds = response.data;
      console.log(`✅ Fetched ${apiFunds.length} funds from API`);

      // STEP 3: Filter out funds that already exist
      const existingSchemeCodes = await Fund.distinct('schemeCode');
      const existingCodesSet = new Set(existingSchemeCodes);

      const newFunds = apiFunds
        .filter((f) => f.schemeCode && !existingCodesSet.has(f.schemeCode))
        .slice(0, this.maxFundsPerRun);

      if (newFunds.length === 0) {
        console.log('✅ No new funds to add - database is up to date');
        return {
          success: true,
          added: 0,
          message: 'Database up to date',
        };
      }

      console.log(`📥 Found ${newFunds.length} new funds to add`);

      // STEP 4: Categorize and prepare funds for insertion
      const categorizedFunds = newFunds.map((fund) => {
        const category = this.categorizeScheme(
          fund.schemeName,
          fund.schemeType,
          fund.schemeCategory
        );

        return {
          schemeCode: fund.schemeCode,
          schemeName: fund.schemeName,
          isinDivPayout: fund.isinDivPayout,
          isinDivReinvestment: fund.isinDivReinvestment,
          isinGrowth: fund.isinGrowth,
          amc: {
            name: fund.fundHouse || 'Unknown',
          },
          category: category.category,
          subCategory: category.subCategory,
          nav: {
            value: parseFloat(fund.nav) || 0,
            date: new Date(fund.date) || new Date(),
            change: 0,
            changePercent: 0,
          },
          riskLevel: this.inferRiskLevel(category.subCategory),
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      });

      // STEP 5: Bulk insert new funds
      console.log('💾 Saving new funds to database...');
      const insertResult = await Fund.insertMany(categorizedFunds, {
        ordered: false, // Continue even if some inserts fail
      });

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      const newTotal = existingCount + insertResult.length;

      console.log('\n✅ Auto Fund Expansion Complete!');
      console.log(`   ├─ New funds added: ${insertResult.length}`);
      console.log(`   ├─ Total funds now: ${newTotal}`);
      console.log(`   └─ Duration: ${duration}s\n`);

      return {
        success: true,
        added: insertResult.length,
        previousCount: existingCount,
        newCount: newTotal,
        duration: duration,
      };
    } catch (error) {
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.error(
        `❌ [${this.name}] Failed after ${duration}s:`,
        error.message
      );

      return {
        success: false,
        error: error.message,
        duration: duration,
      };
    }
  }

  /**
   * Categorize a scheme based on its name and type
   */
  categorizeScheme(schemeName, schemeType, schemeCategory) {
    const name = (schemeName || '').toLowerCase();

    // Equity categorization
    if (
      schemeType?.toLowerCase().includes('equity') ||
      name.includes('equity') ||
      name.includes('stock')
    ) {
      if (name.includes('large cap') || name.includes('largecap')) {
        return { category: 'Equity', subCategory: 'Large Cap' };
      }
      if (name.includes('mid cap') || name.includes('midcap')) {
        return { category: 'Equity', subCategory: 'Mid Cap' };
      }
      if (name.includes('small cap') || name.includes('smallcap')) {
        return { category: 'Equity', subCategory: 'Small Cap' };
      }
      if (name.includes('multi cap') || name.includes('multicap')) {
        return { category: 'Equity', subCategory: 'Multi Cap' };
      }
      if (name.includes('flexi cap') || name.includes('flexicap')) {
        return { category: 'Equity', subCategory: 'Flexi Cap' };
      }
      if (
        name.includes('index') ||
        name.includes('nifty') ||
        name.includes('sensex')
      ) {
        return { category: 'Equity', subCategory: 'Index Fund' };
      }
      if (name.includes('elss') || name.includes('tax')) {
        return { category: 'Equity', subCategory: 'ELSS' };
      }
      if (name.includes('sector') || name.includes('thematic')) {
        return { category: 'Equity', subCategory: 'Sectoral/Thematic' };
      }
      return { category: 'Equity', subCategory: 'Other' };
    }

    // Debt categorization
    if (
      schemeType?.toLowerCase().includes('debt') ||
      name.includes('debt') ||
      name.includes('bond') ||
      name.includes('income')
    ) {
      if (name.includes('liquid')) {
        return { category: 'Debt', subCategory: 'Liquid' };
      }
      if (name.includes('overnight')) {
        return { category: 'Debt', subCategory: 'Overnight' };
      }
      if (name.includes('gilt') || name.includes('government')) {
        return { category: 'Debt', subCategory: 'Gilt' };
      }
      if (name.includes('corporate')) {
        return { category: 'Debt', subCategory: 'Corporate Bond' };
      }
      if (name.includes('dynamic')) {
        return { category: 'Debt', subCategory: 'Dynamic Bond' };
      }
      if (name.includes('credit')) {
        return { category: 'Debt', subCategory: 'Credit Risk' };
      }
      return { category: 'Debt', subCategory: 'Other' };
    }

    // Hybrid categorization
    if (
      schemeType?.toLowerCase().includes('hybrid') ||
      name.includes('hybrid') ||
      name.includes('balanced')
    ) {
      if (name.includes('aggressive')) {
        return { category: 'Hybrid', subCategory: 'Aggressive Hybrid' };
      }
      if (name.includes('conservative')) {
        return { category: 'Hybrid', subCategory: 'Conservative Hybrid' };
      }
      return { category: 'Hybrid', subCategory: 'Balanced Hybrid' };
    }

    // Commodity categorization
    if (
      name.includes('gold') ||
      name.includes('silver') ||
      name.includes('commodity')
    ) {
      if (name.includes('gold')) {
        return { category: 'Commodity', subCategory: 'Gold' };
      }
      if (name.includes('silver')) {
        return { category: 'Commodity', subCategory: 'Silver' };
      }
      return { category: 'Commodity', subCategory: 'Other' };
    }

    // Solution Oriented
    if (name.includes('retirement') || name.includes('children')) {
      return {
        category: 'Solution Oriented',
        subCategory: 'Retirement/Children',
      };
    }

    // Default to Other
    return { category: 'Other', subCategory: schemeCategory || 'Other' };
  }

  /**
   * Infer risk level from subcategory
   */
  inferRiskLevel(subCategory) {
    const riskMap = {
      'Small Cap': 'Very High',
      'Mid Cap': 'High',
      'Large Cap': 'Moderately High',
      'Multi Cap': 'High',
      'Flexi Cap': 'High',
      'Index Fund': 'Moderate',
      ELSS: 'High',
      'Sectoral/Thematic': 'Very High',
      Liquid: 'Low',
      Overnight: 'Low',
      Gilt: 'Low to Moderate',
      'Corporate Bond': 'Low to Moderate',
      'Dynamic Bond': 'Moderate',
      'Credit Risk': 'Moderately High',
      Gold: 'Moderate',
      Silver: 'Moderately High',
    };

    return riskMap[subCategory] || 'Moderate';
  }
}

module.exports = new AutoFundExpansionJob();
