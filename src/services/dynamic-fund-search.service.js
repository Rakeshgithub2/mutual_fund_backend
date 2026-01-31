/**
 * Dynamic Fund Search Service
 * Implements universal fund search with API fallback
 * Never shows "not found" - always fetches from API if not in DB
 */

const Fund = require('../models/Fund.model');
const axios = require('axios');

class DynamicFundSearchService {
  /**
   * Universal fund search - searches DB first, then fetches from API
   * @param {string} query - Search query (fund name, keywords, etc.)
   * @param {Object} options - Search options
   * @returns {Promise<Array>} - Array of funds
   */
  static async searchFunds(query, options = {}) {
    const { category, limit = null } = options;

    console.log(`🔍 Searching for: "${query}"`);

    // Step 1: Search local database first
    const dbResults = await this.searchLocalDB(query, category, limit);

    if (dbResults.length > 0) {
      console.log(`✅ Found ${dbResults.length} funds in local DB`);
      return dbResults;
    }

    // Step 2: No results in DB - fetch from external APIs
    console.log(`🌐 Not found in DB, fetching from external APIs...`);
    const apiResults = await this.fetchFromAPIs(query, category);

    if (apiResults.length > 0) {
      // Step 3: Save fetched funds to DB for future searches
      console.log(`💾 Saving ${apiResults.length} funds to DB...`);
      await this.saveFundsToDB(apiResults);
      return apiResults;
    }

    // Step 4: Still no results - try broader search
    console.log(`🔄 Trying broader search...`);
    const broaderResults = await this.searchLocalDB(query, null, limit, true);
    return broaderResults;
  }

  /**
   * Search local database with fuzzy matching
   */
  static async searchLocalDB(
    query,
    category = null,
    limit = null,
    fuzzy = false
  ) {
    const searchQuery = {
      $or: [
        { name: new RegExp(query, 'i') },
        { schemeName: new RegExp(query, 'i') },
        { 'amc.name': new RegExp(query, 'i') },
      ],
    };

    if (category) {
      searchQuery.category = new RegExp(`^${category}$`, 'i');
    }

    // Fuzzy search - more relaxed matching
    if (fuzzy) {
      const keywords = query.split(' ').filter((word) => word.length > 2);
      searchQuery.$or = keywords.map((keyword) => ({
        $or: [
          { name: new RegExp(keyword, 'i') },
          { schemeName: new RegExp(keyword, 'i') },
        ],
      }));
    }

    let queryBuilder = Fund.find(searchQuery)
      .select('-__v')
      .sort({ 'returns.oneYear': -1, 'returns.1Y': -1 })
      .lean();

    if (limit) {
      queryBuilder = queryBuilder.limit(limit);
    }

    return await queryBuilder;
  }

  /**
   * Fetch funds from external APIs
   */
  static async fetchFromAPIs(query, category) {
    const results = [];

    // Try AMFI API first
    try {
      const amfiResults = await this.fetchFromAMFI(query, category);
      results.push(...amfiResults);
    } catch (error) {
      console.error('AMFI API error:', error.message);
    }

    // Try MFAPI if AMFI fails or returns no results
    if (results.length === 0) {
      try {
        const mfapiResults = await this.fetchFromMFAPI(query);
        results.push(...mfapiResults);
      } catch (error) {
        console.error('MFAPI error:', error.message);
      }
    }

    return results;
  }

  /**
   * Fetch from AMFI NAV data
   */
  static async fetchFromAMFI(query, category) {
    const AMFI_URL =
      process.env.AMFI_NAV_URL || 'https://www.amfiindia.com/spages/NAVAll.txt';

    try {
      const response = await axios.get(AMFI_URL, { timeout: 10000 });
      const lines = response.data.split('\n');

      const funds = [];
      let currentAMC = '';

      for (const line of lines) {
        if (line.startsWith('Scheme Code')) continue;
        if (!line.includes(';')) continue;

        const parts = line.split(';');
        if (parts.length < 6) {
          // This might be an AMC name line
          if (parts[0]) currentAMC = parts[0].trim();
          continue;
        }

        const [schemeCode, isin, schemeName, nav, , date] = parts;

        // Match query in scheme name
        if (!schemeName.toLowerCase().includes(query.toLowerCase())) {
          continue;
        }

        // Match category if specified
        if (category && !this.matchCategory(schemeName, category)) {
          continue;
        }

        funds.push({
          schemeCode: schemeCode.trim(),
          isin: isin?.trim() || null,
          name: schemeName.trim(),
          schemeName: schemeName.trim(),
          currentNav: parseFloat(nav),
          navDate: date?.trim() || new Date().toISOString().split('T')[0],
          category: this.detectCategory(schemeName),
          subcategory: this.detectSubcategory(schemeName),
          amc: {
            name: currentAMC || 'Unknown',
            code: currentAMC.replace(/\s+/g, '_').toUpperCase(),
          },
          status: 'Active',
          returns: {},
          source: 'AMFI',
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // Limit results to 50 from API
        if (funds.length >= 50) break;
      }

      return funds;
    } catch (error) {
      console.error('AMFI fetch error:', error.message);
      return [];
    }
  }

  /**
   * Fetch from MFAPI (alternative source)
   */
  static async fetchFromMFAPI(query) {
    try {
      // MFAPI provides mutual fund data by scheme code
      // For search, we'd need to maintain a list of scheme codes
      // This is a placeholder for when MFAPI search is implemented
      return [];
    } catch (error) {
      console.error('MFAPI error:', error.message);
      return [];
    }
  }

  /**
   * Save fetched funds to database
   */
  static async saveFundsToDB(funds) {
    const savedFunds = [];

    for (const fundData of funds) {
      try {
        // Check if fund already exists (by schemeCode or ISIN)
        const existing = await Fund.findOne({
          $or: [{ schemeCode: fundData.schemeCode }, { isin: fundData.isin }],
        });

        if (!existing) {
          const fund = new Fund(fundData);
          await fund.save();
          savedFunds.push(fund);
          console.log(`✅ Saved: ${fund.name}`);
        } else {
          console.log(`⏭️ Skipped (exists): ${fundData.name}`);
        }
      } catch (error) {
        console.error(`❌ Error saving fund ${fundData.name}:`, error.message);
      }
    }

    console.log(`💾 Saved ${savedFunds.length} new funds to database`);
    return savedFunds;
  }

  /**
   * Detect fund category from name
   */
  static detectCategory(name) {
    const nameLower = name.toLowerCase();

    if (nameLower.includes('equity') || nameLower.includes('elss'))
      return 'equity';
    if (nameLower.includes('debt') || nameLower.includes('bond')) return 'debt';
    if (nameLower.includes('hybrid') || nameLower.includes('balanced'))
      return 'hybrid';
    if (
      nameLower.includes('gold') ||
      nameLower.includes('silver') ||
      nameLower.includes('commodity')
    )
      return 'commodity';
    if (nameLower.includes('etf') || nameLower.includes('index'))
      return 'equity';
    if (nameLower.includes('liquid') || nameLower.includes('ultra short'))
      return 'debt';
    if (nameLower.includes('money market')) return 'debt';

    return 'other';
  }

  /**
   * Detect fund subcategory from name
   */
  static detectSubcategory(name) {
    const nameLower = name.toLowerCase();

    // Equity subcategories
    if (nameLower.includes('large cap') || nameLower.includes('bluechip'))
      return 'Large Cap';
    if (nameLower.includes('mid cap')) return 'Mid Cap';
    if (nameLower.includes('small cap')) return 'Small Cap';
    if (nameLower.includes('flexi cap') || nameLower.includes('multi cap'))
      return 'Flexi Cap';
    if (nameLower.includes('elss')) return 'ELSS';
    if (nameLower.includes('focused')) return 'Focused';
    if (
      nameLower.includes('sectoral') ||
      nameLower.includes('sector') ||
      nameLower.includes('pharma') ||
      nameLower.includes('banking') ||
      nameLower.includes('technology') ||
      nameLower.includes('infrastructure')
    )
      return 'Sectoral';
    if (nameLower.includes('value')) return 'Value';
    if (nameLower.includes('dividend yield')) return 'Dividend Yield';

    // Debt subcategories
    if (nameLower.includes('liquid')) return 'Liquid';
    if (nameLower.includes('ultra short')) return 'Ultra Short Duration';
    if (
      nameLower.includes('short duration') ||
      nameLower.includes('short term')
    )
      return 'Short Duration';
    if (
      nameLower.includes('medium duration') ||
      nameLower.includes('medium term')
    )
      return 'Medium Duration';
    if (nameLower.includes('long duration') || nameLower.includes('long term'))
      return 'Long Duration';
    if (nameLower.includes('gilt')) return 'Gilt';
    if (nameLower.includes('corporate bond')) return 'Corporate Bond';
    if (nameLower.includes('credit risk')) return 'Credit Risk';
    if (nameLower.includes('dynamic bond')) return 'Dynamic Bond';
    if (nameLower.includes('money market')) return 'Money Market';

    // Hybrid subcategories
    if (nameLower.includes('aggressive hybrid')) return 'Aggressive Hybrid';
    if (nameLower.includes('conservative hybrid')) return 'Conservative Hybrid';
    if (
      nameLower.includes('balanced hybrid') ||
      nameLower.includes('balanced advantage')
    )
      return 'Balanced Hybrid';
    if (nameLower.includes('multi asset')) return 'Multi Asset Allocation';

    // Commodity
    if (nameLower.includes('gold')) return 'Gold';
    if (nameLower.includes('silver')) return 'Silver';

    return 'Other';
  }

  /**
   * Match category
   */
  static matchCategory(name, category) {
    const detected = this.detectCategory(name);
    return detected.toLowerCase() === category.toLowerCase();
  }

  /**
   * Get all funds without limit (for category pages)
   */
  static async getAllFundsByCategory(category, subcategory = null) {
    const query = {
      $or: [
        { status: 'Active' },
        { status: null },
        { status: { $exists: false } },
      ],
    };

    if (category) {
      query.category = new RegExp(`^${category}$`, 'i');
    }

    if (subcategory) {
      query.$and = [
        {
          $or: [
            { subcategory: new RegExp(`^${subcategory}$`, 'i') },
            { subCategory: new RegExp(`^${subcategory}$`, 'i') },
          ],
        },
      ];
    }

    // NO LIMIT - return all funds
    const funds = await Fund.find(query)
      .select('-__v')
      .sort({ 'returns.oneYear': -1, 'returns.1Y': -1 })
      .lean();

    console.log(
      `📊 Found ${funds.length} funds for ${category}/${subcategory || 'all'}`
    );
    return funds;
  }
}

module.exports = DynamicFundSearchService;
