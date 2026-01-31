/**
 * Fund Data Enrichment Service
 * Adds missing holdings, sector allocation, and other details to fund data
 *
 * IMPORTANT: This service generates UNIQUE holdings per fund using:
 * - Fund's schemeCode as a seed for deterministic randomization
 * - Fund's AUM to vary allocation percentages
 * - Fund name hash to shuffle holdings order
 */

class FundEnrichmentService {
  /**
   * Generate a deterministic hash from a string (for seeded randomization)
   * @param {string} str - Input string
   * @returns {number} - Hash value between 0 and 1
   */
  static hashString(str) {
    if (!str) return 0.5;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash % 1000) / 1000; // Returns 0 to 0.999
  }

  /**
   * Seeded random number generator for deterministic results per fund
   * @param {number} seed - Seed value (0 to 1)
   * @param {number} index - Additional index for variation
   * @returns {number} - Random number between 0 and 1
   */
  static seededRandom(seed, index = 0) {
    const x = Math.sin(seed * 10000 + index) * 10000;
    return x - Math.floor(x);
  }

  /**
   * Shuffle array deterministically based on seed
   * @param {Array} array - Array to shuffle
   * @param {number} seed - Seed for deterministic shuffle
   * @returns {Array} - Shuffled array (new instance)
   */
  static shuffleWithSeed(array, seed) {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(this.seededRandom(seed, i) * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  /**
   * Enrich fund data with missing information
   * @param {Object} fund - Fund document from database
   * @returns {Object} - Enriched fund data
   */
  static enrichFundData(fund) {
    if (!fund) return null;

    const enriched = { ...fund };

    // Generate a unique seed for this fund based on its schemeCode and name
    const fundSeed = this.hashString(
      fund.schemeCode || fund.schemeName || fund._id?.toString()
    );

    // Ensure holdings exist
    if (!enriched.holdings || enriched.holdings.length === 0) {
      enriched.holdings = this.generateHoldings(fund, fundSeed);
      enriched.holdingsCount = enriched.holdings.length;
      enriched.holdingsSource = 'generated'; // Flag to indicate this is generated data
    }

    // Ensure sector allocation exists
    if (!enriched.sectorAllocation || enriched.sectorAllocation.length === 0) {
      enriched.sectorAllocation = this.generateSectorAllocation(fund, fundSeed);
      enriched.sectorAllocationCount = enriched.sectorAllocation.length;
      enriched.sectorSource = 'generated';
    }

    // Ensure historical NAV exists
    if (!enriched.historicalNav || enriched.historicalNav.length === 0) {
      enriched.historicalNav = this.generateHistoricalNav(fund);
    }

    // Ensure performance history exists
    if (
      !enriched.performanceHistory ||
      enriched.performanceHistory.length === 0
    ) {
      enriched.performanceHistory = this.generatePerformanceHistory(fund);
    }

    // Fix object values that should be numbers
    if (enriched.aum && typeof enriched.aum === 'object') {
      enriched.aum = enriched.aum.value || 0;
    }

    if (enriched.expenseRatio && typeof enriched.expenseRatio === 'object') {
      enriched.expenseRatio = enriched.expenseRatio.value || 0;
    }

    if (enriched.minInvestment && typeof enriched.minInvestment === 'object') {
      enriched.minInvestment = enriched.minInvestment.value || 5000;
    }

    // Ensure manager details exist
    if (!enriched.managerDetails && enriched.fundManager) {
      enriched.managerDetails = this.generateManagerDetails(
        enriched.fundManager
      );
    }

    return enriched;
  }

  /**
   * Generate realistic holdings based on fund category
   * @param {Object} fund - Fund object
   * @param {number} seed - Unique seed for this fund (0 to 1)
   */
  static generateHoldings(fund, seed = 0.5) {
    const category = (fund.category || '').toLowerCase().replace(/_/g, ' ');
    const subCategory = (fund.subCategory || '')
      .toLowerCase()
      .replace(/_/g, ' ');

    // Equity holdings (includes large cap, mid cap, small cap, multi cap, etc.)
    if (
      category.includes('equity') ||
      category.includes('cap') ||
      subCategory.includes('equity') ||
      subCategory.includes('cap')
    ) {
      return this.generateEquityHoldings(subCategory || category, seed, fund);
    }

    // Debt holdings
    if (category.includes('debt') || subCategory.includes('debt')) {
      return this.generateDebtHoldings(seed, fund);
    }

    // Commodity holdings
    if (category.includes('commodity') || subCategory.includes('commodity')) {
      return this.generateCommodityHoldings(seed, fund);
    }

    // Default to equity holdings
    return this.generateEquityHoldings('diversified', seed, fund);
  }

  /**
   * Generate equity holdings with unique variations per fund
   * @param {string} subCategory - Fund sub-category
   * @param {number} seed - Unique seed for this fund
   * @param {Object} fund - Fund object for additional context
   */
  static generateEquityHoldings(subCategory, seed = 0.5, fund = {}) {
    // Top Indian companies by sector
    const companies = {
      banking: [
        { name: 'HDFC Bank Ltd', sector: 'Banking', weight: 8.5 },
        { name: 'ICICI Bank Ltd', sector: 'Banking', weight: 7.2 },
        { name: 'Kotak Mahindra Bank', sector: 'Banking', weight: 5.8 },
        { name: 'Axis Bank Ltd', sector: 'Banking', weight: 4.5 },
        { name: 'State Bank of India', sector: 'Banking', weight: 4.2 },
      ],
      it: [
        { name: 'Tata Consultancy Services', sector: 'IT', weight: 7.5 },
        { name: 'Infosys Ltd', sector: 'IT', weight: 6.8 },
        { name: 'HCL Technologies', sector: 'IT', weight: 5.2 },
        { name: 'Wipro Ltd', sector: 'IT', weight: 4.1 },
        { name: 'Tech Mahindra', sector: 'IT', weight: 3.5 },
      ],
      largecap: [
        { name: 'Reliance Industries', sector: 'Energy', weight: 9.2 },
        { name: 'HDFC Bank Ltd', sector: 'Banking', weight: 7.8 },
        { name: 'Infosys Ltd', sector: 'IT', weight: 6.5 },
        { name: 'ICICI Bank Ltd', sector: 'Banking', weight: 5.9 },
        { name: 'TCS', sector: 'IT', weight: 5.4 },
        { name: 'Bharti Airtel', sector: 'Telecom', weight: 4.2 },
        { name: 'ITC Ltd', sector: 'FMCG', weight: 3.8 },
        { name: 'Hindustan Unilever', sector: 'FMCG', weight: 3.5 },
        { name: 'Kotak Mahindra Bank', sector: 'Banking', weight: 3.2 },
        { name: 'Larsen & Toubro', sector: 'Capital Goods', weight: 2.9 },
        {
          name: 'Asian Paints',
          sector: 'Consumer Durables',
          weight: 2.5,
        },
        {
          name: 'Bajaj Finance',
          sector: 'Financial Services',
          weight: 2.3,
        },
        { name: 'Maruti Suzuki', sector: 'Automobile', weight: 2.1 },
        { name: 'Titan Company', sector: 'Consumer Durables', weight: 1.9 },
        { name: 'Mahindra & Mahindra', sector: 'Automobile', weight: 1.7 },
      ],
      midcap: [
        { name: 'Trent Ltd', sector: 'Retail', weight: 6.5 },
        { name: 'PI Industries', sector: 'Chemicals', weight: 5.8 },
        {
          name: 'Mphasis Ltd',
          sector: 'IT',
          weight: 5.2,
        },
        {
          name: 'Dixon Technologies',
          sector: 'Electronics',
          weight: 4.9,
        },
        {
          name: 'Federal Bank',
          sector: 'Banking',
          weight: 4.5,
        },
        { name: 'Apollo Hospitals', sector: 'Healthcare', weight: 4.2 },
        { name: 'Tube Investments', sector: 'Auto Ancillaries', weight: 3.9 },
        { name: 'SRF Ltd', sector: 'Chemicals', weight: 3.6 },
        { name: 'Coforge Ltd', sector: 'IT', weight: 3.3 },
        {
          name: 'Voltas Ltd',
          sector: 'Consumer Durables',
          weight: 3.1,
        },
      ],
      smallcap: [
        {
          name: 'Central Depository Services',
          sector: 'Financial',
          weight: 5.2,
        },
        {
          name: 'KPIT Technologies',
          sector: 'IT',
          weight: 4.8,
        },
        { name: 'Rainbow Hospitals', sector: 'Healthcare', weight: 4.5 },
        {
          name: 'Suprajit Engineering',
          sector: 'Auto Components',
          weight: 4.2,
        },
        { name: 'Affle India', sector: 'IT', weight: 3.9 },
        { name: 'Route Mobile', sector: 'IT', weight: 3.6 },
        { name: 'Clean Science', sector: 'Chemicals', weight: 3.3 },
        { name: 'Lux Industries', sector: 'Textiles', weight: 3.1 },
        { name: 'Garware Technical', sector: 'Auto Components', weight: 2.9 },
        { name: 'Prince Pipes', sector: 'Building Materials', weight: 2.7 },
      ],
    };

    // Select appropriate holdings based on subcategory
    let selectedCompanies = companies.largecap; // default

    if (subCategory.includes('midcap')) {
      selectedCompanies = companies.midcap;
    } else if (subCategory.includes('smallcap')) {
      selectedCompanies = companies.smallcap;
    } else if (subCategory.includes('banking')) {
      selectedCompanies = companies.banking;
    } else if (subCategory.includes('it') || subCategory.includes('tech')) {
      selectedCompanies = companies.it;
    }

    // IMPORTANT: Shuffle the companies based on fund's unique seed
    // This ensures each fund has different order of holdings
    const shuffledCompanies = this.shuffleWithSeed(selectedCompanies, seed);

    // Take a subset of companies (varies by fund)
    const numCompanies = Math.floor(8 + this.seededRandom(seed, 100) * 7); // 8-15 companies
    const fundCompanies = shuffledCompanies.slice(0, numCompanies);

    // Vary the weights based on fund's seed
    const aum = fund.aum || 1000;
    const aumFactor = Math.min(aum / 10000, 1); // Larger funds have more concentrated holdings

    return fundCompanies.map((company, index) => {
      // Vary weight by ±30% based on seed
      const weightVariation = 0.7 + this.seededRandom(seed, index) * 0.6; // 0.7 to 1.3
      const adjustedWeight = parseFloat(
        (company.weight * weightVariation).toFixed(2)
      );

      // Generate unique values per fund
      const valueBase = 1000 + this.seededRandom(seed, index + 50) * 9000;
      const quantityBase =
        50000 + this.seededRandom(seed, index + 100) * 450000;

      return {
        name: company.name,
        ticker: company.name.split(' ')[0].toUpperCase(),
        sector: company.sector,
        percentage: adjustedWeight,
        value: Math.floor(valueBase * (1 + aumFactor)),
        isin: `INE${String(Math.floor(this.seededRandom(seed, index + 200) * 999999)).padStart(6, '0')}01`,
        quantity: Math.floor(quantityBase * (1 + aumFactor * 0.5)),
        marketValue: Math.floor((valueBase * quantityBase) / 100),
      };
    });
  }

  /**
   * Generate debt holdings with unique variations per fund
   * @param {number} seed - Unique seed for this fund
   * @param {Object} fund - Fund object
   */
  static generateDebtHoldings(seed = 0.5, fund = {}) {
    const instruments = [
      {
        name: 'Government of India 7.26% 2032',
        type: 'Government Bond',
        weight: 15.5,
      },
      {
        name: 'HDFC Ltd 8.5% 2028',
        type: 'Corporate Bond',
        weight: 12.3,
      },
      {
        name: 'State Bank of India 7.75% 2030',
        type: 'Corporate Bond',
        weight: 10.8,
      },
      {
        name: 'ICICI Bank 8.25% 2027',
        type: 'Corporate Bond',
        weight: 9.5,
      },
      {
        name: 'Government of India 7.38% 2027',
        type: 'Government Bond',
        weight: 8.9,
      },
      {
        name: 'Bajaj Finance 8.75% 2026',
        type: 'Corporate Bond',
        weight: 7.6,
      },
      {
        name: 'Reliance Industries 7.95% 2028',
        type: 'Corporate Bond',
        weight: 7.2,
      },
      {
        name: 'Power Finance Corporation 8.1% 2029',
        type: 'Corporate Bond',
        weight: 6.5,
      },
      {
        name: 'LIC Housing Finance 8.3% 2027',
        type: 'Corporate Bond',
        weight: 5.9,
      },
      {
        name: 'Treasury Bills',
        type: 'Government Security',
        weight: 5.2,
      },
    ];

    // Shuffle based on seed for unique order per fund
    const shuffledInstruments = this.shuffleWithSeed(instruments, seed);
    const numInstruments = Math.floor(6 + this.seededRandom(seed, 50) * 4); // 6-10 instruments

    return shuffledInstruments
      .slice(0, numInstruments)
      .map((instrument, index) => {
        const weightVariation = 0.75 + this.seededRandom(seed, index) * 0.5;

        return {
          name: instrument.name,
          ticker: instrument.name.split(' ').slice(0, 2).join('-'),
          sector: instrument.type,
          percentage: parseFloat(
            (instrument.weight * weightVariation).toFixed(2)
          ),
          value: Math.floor(500 + this.seededRandom(seed, index + 10) * 4500),
          isin: `INE${String(Math.floor(100 + this.seededRandom(seed, index + 20) * 900)).padStart(6, '0')}01`,
          rating: ['AAA', 'AA+', 'AA', 'A+'][
            Math.floor(this.seededRandom(seed, index + 30) * 4)
          ],
          maturity: `${2025 + Math.floor(this.seededRandom(seed, index + 40) * 8)}-${String(
            Math.floor(this.seededRandom(seed, index + 45) * 12) + 1
          ).padStart(2, '0')}-01`,
        };
      });
  }

  /**
   * Generate commodity holdings with unique variations per fund
   * @param {number} seed - Unique seed for this fund
   * @param {Object} fund - Fund object
   */
  static generateCommodityHoldings(seed = 0.5, fund = {}) {
    // Vary gold/silver ratio based on seed
    const goldWeight = 55 + this.seededRandom(seed, 1) * 25; // 55-80%
    const silverWeight = 10 + this.seededRandom(seed, 2) * 20; // 10-30%
    const cashWeight = 100 - goldWeight - silverWeight;

    return [
      {
        name: 'Gold ETF Units',
        ticker: 'GOLD',
        sector: 'Precious Metals',
        percentage: parseFloat(goldWeight.toFixed(1)),
        value: Math.floor(10000 + this.seededRandom(seed, 10) * 10000),
      },
      {
        name: 'Silver ETF Units',
        ticker: 'SILVER',
        sector: 'Precious Metals',
        percentage: parseFloat(silverWeight.toFixed(1)),
        value: Math.floor(3000 + this.seededRandom(seed, 20) * 4000),
      },
      {
        name: 'Cash & Cash Equivalents',
        ticker: 'CASH',
        sector: 'Cash',
        percentage: parseFloat(cashWeight.toFixed(1)),
        value: Math.floor(2000 + this.seededRandom(seed, 30) * 3000),
      },
    ];
  }

  /**
   * Generate sector allocation with unique variations per fund
   * @param {Object} fund - Fund object
   * @param {number} seed - Unique seed for this fund
   */
  static generateSectorAllocation(fund, seed = 0.5) {
    const category = (fund.category || '').toLowerCase().replace(/_/g, ' ');
    const subCategory = (fund.subCategory || '')
      .toLowerCase()
      .replace(/_/g, ' ');

    // Equity sector allocation (includes large cap, mid cap, small cap, etc.)
    if (
      category.includes('equity') ||
      category.includes('cap') ||
      subCategory.includes('equity') ||
      subCategory.includes('cap')
    ) {
      const baseSectors = [
        {
          sector: 'Banking & Financial Services',
          percentage: 28.5,
          value: 8500,
        },
        { sector: 'Information Technology', percentage: 18.2, value: 5400 },
        { sector: 'Energy & Utilities', percentage: 12.4, value: 3700 },
        { sector: 'FMCG', percentage: 10.3, value: 3100 },
        { sector: 'Automobile', percentage: 8.7, value: 2600 },
        { sector: 'Healthcare & Pharma', percentage: 7.5, value: 2250 },
        { sector: 'Capital Goods', percentage: 6.2, value: 1860 },
        { sector: 'Telecom', percentage: 4.8, value: 1440 },
        { sector: 'Consumer Durables', percentage: 3.4, value: 1020 },
      ];

      // Shuffle and vary percentages based on seed
      const shuffled = this.shuffleWithSeed(baseSectors, seed);
      return shuffled.map((s, i) => {
        const variation = 0.7 + this.seededRandom(seed, i + 200) * 0.6;
        return {
          sector: s.sector,
          percentage: parseFloat((s.percentage * variation).toFixed(1)),
          value: Math.floor(s.value * variation),
        };
      });
    }

    // Debt sector allocation
    if (category.includes('debt') || subCategory.includes('debt')) {
      const debtSectors = [
        { sector: 'Government Securities', percentage: 45.5, value: 13650 },
        { sector: 'Banking & Financial', percentage: 28.3, value: 8490 },
        { sector: 'Corporate Bonds', percentage: 18.7, value: 5610 },
        { sector: 'Cash & Equivalents', percentage: 7.5, value: 2250 },
      ];

      return debtSectors.map((s, i) => {
        const variation = 0.75 + this.seededRandom(seed, i + 300) * 0.5;
        return {
          sector: s.sector,
          percentage: parseFloat((s.percentage * variation).toFixed(1)),
          value: Math.floor(s.value * variation),
        };
      });
    }

    // Commodity allocation
    if (category.includes('commodity')) {
      const goldPct = 55 + this.seededRandom(seed, 400) * 25;
      const silverPct = 10 + this.seededRandom(seed, 401) * 20;
      const cashPct = Math.max(5, 100 - goldPct - silverPct);

      return [
        {
          sector: 'Gold',
          percentage: parseFloat(goldPct.toFixed(1)),
          value: Math.floor(goldPct * 300),
        },
        {
          sector: 'Silver',
          percentage: parseFloat(silverPct.toFixed(1)),
          value: Math.floor(silverPct * 300),
        },
        {
          sector: 'Cash',
          percentage: parseFloat(cashPct.toFixed(1)),
          value: Math.floor(cashPct * 300),
        },
      ];
    }

    // Default
    return [{ sector: 'Diversified', percentage: 100, value: 30000 }];
  }

  /**
   * Generate historical NAV data
   */
  static generateHistoricalNav(fund) {
    const currentNav = fund.currentNav || 100;
    const returns = fund.returns || {};
    const historical = [];
    const today = new Date();

    // Generate 10 years of data
    for (let i = 0; i < 3650; i += 7) {
      // Weekly data
      const date = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);

      // Calculate NAV based on returns
      let navAdjustment = 1;
      const yearsAgo = i / 365;

      if (yearsAgo < 1 && returns['1Y']) {
        navAdjustment = 1 - (returns['1Y'] / 100) * (yearsAgo / 1);
      } else if (yearsAgo < 3 && returns['3Y']) {
        navAdjustment = 1 - (returns['3Y'] / 100) * (yearsAgo / 3);
      } else if (yearsAgo < 5 && returns['5Y']) {
        navAdjustment = 1 - (returns['5Y'] / 100) * (yearsAgo / 5);
      } else if (returns.sinceInception) {
        navAdjustment = 1 - (returns.sinceInception / 100) * (yearsAgo / 10);
      }

      const nav = currentNav * navAdjustment;

      historical.push({
        date: date.toISOString().split('T')[0],
        nav: Math.max(10, parseFloat(nav.toFixed(4))),
      });
    }

    return historical.reverse();
  }

  /**
   * Generate performance history for charts
   */
  static generatePerformanceHistory(fund) {
    const historical = this.generateHistoricalNav(fund);

    return historical.map((item) => ({
      date: item.date,
      value: item.nav,
    }));
  }

  /**
   * Generate manager details from fundManager string or object
   */
  static generateManagerDetails(fundManager) {
    if (!fundManager) return null;

    // If fundManager is already an object with name
    if (typeof fundManager === 'object' && fundManager.name) {
      return {
        name: fundManager.name,
        experience: fundManager.experience || 10,
        qualification: ['MBA Finance', 'CFA'],
        designation: 'Senior Fund Manager',
        bio: `${fundManager.name} is an experienced fund manager with over ${
          fundManager.experience || 10
        } years of expertise in managing mutual funds.`,
      };
    }

    // If fundManager is a string
    if (typeof fundManager === 'string') {
      return {
        name: fundManager,
        experience: 10,
        qualification: ['MBA Finance', 'CFA'],
        designation: 'Senior Fund Manager',
        bio: `${fundManager} is an experienced fund manager with expertise in managing mutual funds.`,
      };
    }

    return null;
  }
}

module.exports = FundEnrichmentService;
