/**
 * MFAPI Service
 * Fetches real-time mutual fund data from external API
 */

const axios = require('axios');

class MFAPIService {
  constructor() {
    this.baseURL = 'https://api.mfapi.in/mf';
    this.timeout = 10000; // 10 seconds
  }

  /**
   * Fetch fund details from MFAPI by scheme code
   * @param {string} schemeCode - Fund scheme code
   * @returns {Promise<Object|null>} Fund data or null if not found
   */
  async fetchFundBySchemeCode(schemeCode) {
    try {
      console.log(`🌐 Fetching fund from MFAPI: ${schemeCode}`);

      const url = `${this.baseURL}/${schemeCode}`;
      const response = await axios.get(url, {
        timeout: this.timeout,
        headers: {
          'User-Agent': 'MutualFunds-Backend/1.0',
        },
      });

      const { data } = response;

      if (!data || !data.meta || !data.data || data.data.length === 0) {
        console.log(`❌ No data found for scheme code: ${schemeCode}`);
        return null;
      }

      // Extract and format fund data
      const meta = data.meta;
      const latestNav = data.data[0]; // Most recent NAV

      const fundData = {
        schemeCode: meta.scheme_code,
        schemeName: meta.scheme_name,
        amc: {
          name: meta.fund_house,
        },
        category: this.normalizeCategory(meta.scheme_category),
        subCategory: meta.scheme_type || 'Other',
        nav: {
          value: parseFloat(latestNav.nav),
          date: new Date(latestNav.date),
        },
        // Store historical NAV data
        navHistory: data.data.slice(0, 365).map((nav) => ({
          date: new Date(nav.date),
          value: parseFloat(nav.nav),
        })),
        status: 'Active',
        dataSource: 'MFAPI',
        lastFetched: new Date(),
      };

      console.log(`✅ Successfully fetched fund: ${fundData.schemeName}`);
      return fundData;
    } catch (error) {
      if (error.response?.status === 404) {
        console.log(`❌ Fund not found in MFAPI: ${schemeCode}`);
        return null;
      }

      console.error(
        `❌ Error fetching from MFAPI for ${schemeCode}:`,
        error.message
      );
      throw error;
    }
  }

  /**
   * Search funds by name (fuzzy search)
   * Note: MFAPI doesn't have direct search, so we'll use scheme codes
   * @param {string} query - Search query
   * @returns {Promise<Array>} Array of matching funds
   */
  async searchFundsByName(query) {
    try {
      console.log(`🔍 Searching MFAPI for: ${query}`);

      // MFAPI doesn't have search endpoint, return empty
      // This will force fallback to database search
      return [];
    } catch (error) {
      console.error('Error searching MFAPI:', error.message);
      return [];
    }
  }

  /**
   * Fetch latest NAV for a scheme code
   * @param {string} schemeCode
   * @returns {Promise<Object|null>}
   */
  async fetchLatestNAV(schemeCode) {
    try {
      const url = `${this.baseURL}/${schemeCode}/latest`;
      const response = await axios.get(url, { timeout: 5000 });

      if (!response.data || !response.data.data) {
        return null;
      }

      return {
        schemeCode,
        nav: parseFloat(response.data.data[0].nav),
        date: new Date(response.data.data[0].date),
      };
    } catch (error) {
      console.error(
        `Error fetching latest NAV for ${schemeCode}:`,
        error.message
      );
      return null;
    }
  }

  /**
   * Normalize category names to match our schema
   * @param {string} category
   * @returns {string}
   */
  normalizeCategory(category) {
    if (!category) return 'Other';

    const categoryMap = {
      'Equity Scheme': 'Equity',
      'Debt Scheme': 'Debt',
      'Hybrid Scheme': 'Hybrid',
      'Solution Oriented Scheme': 'Solution Oriented',
      'Other Scheme': 'Other',
      Commodity: 'Commodity',
    };

    // Try exact match first
    if (categoryMap[category]) {
      return categoryMap[category];
    }

    // Try partial match
    for (const [key, value] of Object.entries(categoryMap)) {
      if (category.toLowerCase().includes(key.toLowerCase())) {
        return value;
      }
    }

    return 'Other';
  }

  /**
   * Batch fetch multiple funds
   * @param {string[]} schemeCodes
   * @returns {Promise<Object[]>}
   */
  async fetchMultipleFunds(schemeCodes) {
    console.log(`📦 Batch fetching ${schemeCodes.length} funds from MFAPI`);

    const results = await Promise.allSettled(
      schemeCodes.map((code) => this.fetchFundBySchemeCode(code))
    );

    const successfulFunds = results
      .filter(
        (result) => result.status === 'fulfilled' && result.value !== null
      )
      .map((result) => result.value);

    console.log(
      `✅ Successfully fetched ${successfulFunds.length}/${schemeCodes.length} funds`
    );

    return successfulFunds;
  }
}

module.exports = new MFAPIService();
