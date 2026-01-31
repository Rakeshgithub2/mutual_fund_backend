import axios from 'axios';
import { RawFundData, ImportResult, ImportOptions } from './types';

/**
 * AMFI (Association of Mutual Funds in India) Importer
 * Fetches Indian mutual fund data from AMFI API
 */
export class AMFIImporter {
  private navUrl = 'https://www.amfiindia.com/spages/NAVAll.txt';
  private userAgent =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

  /**
   * Category mappings for AMFI funds
   */
  private categoryMap: Record<
    string,
    { category: string; subCategory: string }
  > = {
    'Equity Scheme - Large Cap Fund': {
      category: 'equity',
      subCategory: 'Large Cap',
    },
    'Equity Scheme - Mid Cap Fund': {
      category: 'equity',
      subCategory: 'Mid Cap',
    },
    'Equity Scheme - Small Cap Fund': {
      category: 'equity',
      subCategory: 'Small Cap',
    },
    'Equity Scheme - Multi Cap Fund': {
      category: 'equity',
      subCategory: 'Multi Cap',
    },
    'Equity Scheme - Large & Mid Cap Fund': {
      category: 'equity',
      subCategory: 'Large & Mid Cap',
    },
    'Equity Scheme - Flexi Cap Fund': {
      category: 'equity',
      subCategory: 'Flexi Cap',
    },
    'Equity Scheme - Focused Fund': {
      category: 'equity',
      subCategory: 'Focused',
    },
    'Equity Scheme - Sectoral/ Thematic': {
      category: 'equity',
      subCategory: 'Sectoral',
    },
    'Equity Scheme - ELSS': { category: 'equity', subCategory: 'ELSS' },
    'Equity Scheme - Value Fund': { category: 'equity', subCategory: 'Value' },
    'Equity Scheme - Dividend Yield Fund': {
      category: 'equity',
      subCategory: 'Dividend Yield',
    },
    'Debt Scheme - Liquid Fund': { category: 'debt', subCategory: 'Liquid' },
    'Debt Scheme - Ultra Short Duration Fund': {
      category: 'debt',
      subCategory: 'Ultra Short',
    },
    'Debt Scheme - Low Duration Fund': {
      category: 'debt',
      subCategory: 'Low Duration',
    },
    'Debt Scheme - Money Market Fund': {
      category: 'debt',
      subCategory: 'Money Market',
    },
    'Debt Scheme - Short Duration Fund': {
      category: 'debt',
      subCategory: 'Short Duration',
    },
    'Debt Scheme - Medium Duration Fund': {
      category: 'debt',
      subCategory: 'Medium Duration',
    },
    'Debt Scheme - Long Duration Fund': {
      category: 'debt',
      subCategory: 'Long Duration',
    },
    'Debt Scheme - Dynamic Bond': {
      category: 'debt',
      subCategory: 'Dynamic Bond',
    },
    'Debt Scheme - Corporate Bond Fund': {
      category: 'debt',
      subCategory: 'Corporate Bond',
    },
    'Debt Scheme - Credit Risk Fund': {
      category: 'debt',
      subCategory: 'Credit Risk',
    },
    'Debt Scheme - Banking and PSU Fund': {
      category: 'debt',
      subCategory: 'Banking & PSU',
    },
    'Debt Scheme - Gilt Fund': { category: 'debt', subCategory: 'Gilt' },
    'Hybrid Scheme - Conservative Hybrid Fund': {
      category: 'hybrid',
      subCategory: 'Conservative',
    },
    'Hybrid Scheme - Balanced Hybrid Fund': {
      category: 'hybrid',
      subCategory: 'Balanced',
    },
    'Hybrid Scheme - Aggressive Hybrid Fund': {
      category: 'hybrid',
      subCategory: 'Aggressive',
    },
    'Hybrid Scheme - Dynamic Asset Allocation': {
      category: 'hybrid',
      subCategory: 'Dynamic',
    },
    'Hybrid Scheme - Multi Asset Allocation': {
      category: 'hybrid',
      subCategory: 'Multi Asset',
    },
    'Hybrid Scheme - Arbitrage Fund': {
      category: 'hybrid',
      subCategory: 'Arbitrage',
    },
    'Other Scheme - Index Fund': { category: 'index', subCategory: 'Index' },
    'Other Scheme - FoF Domestic': {
      category: 'hybrid',
      subCategory: 'Fund of Funds',
    },
    'Other Scheme - FoF Overseas': {
      category: 'hybrid',
      subCategory: 'Fund of Funds',
    },
  };

  /**
   * Top Indian fund houses to prioritize
   */
  private topFundHouses = [
    'HDFC Mutual Fund',
    'ICICI Prudential Mutual Fund',
    'SBI Mutual Fund',
    'Aditya Birla Sun Life Mutual Fund',
    'Axis Mutual Fund',
    'Kotak Mahindra Mutual Fund',
    'Nippon India Mutual Fund',
    'UTI Mutual Fund',
    'DSP Mutual Fund',
    'Franklin Templeton Mutual Fund',
    'Mirae Asset Mutual Fund',
    'Tata Mutual Fund',
    'IDFC Mutual Fund',
    'L&T Mutual Fund',
    'Motilal Oswal Mutual Fund',
  ];

  /**
   * Fetch NAV data from AMFI
   */
  async fetchNAVData(): Promise<string> {
    try {
      console.log('📥 Fetching NAV data from AMFI...');
      const response = await axios.get(this.navUrl, {
        headers: { 'User-Agent': this.userAgent },
        timeout: 30000,
      });
      console.log('✓ NAV data fetched successfully');
      return response.data;
    } catch (error: any) {
      console.error('Error fetching AMFI data:', error.message);
      throw error;
    }
  }

  /**
   * Parse AMFI NAV text file
   */
  parseNAVData(navText: string): any[] {
    const lines = navText.split('\n');
    const funds: any[] = [];
    let currentSchemeType = '';
    let currentFundHouse = '';

    for (const line of lines) {
      const trimmedLine = line.trim();

      // Skip empty lines
      if (!trimmedLine) continue;

      // Check if it's a scheme type header (starts with "Open Ended" or similar)
      if (
        trimmedLine.startsWith('Open Ended Schemes') ||
        trimmedLine.startsWith('Close Ended Schemes') ||
        trimmedLine.startsWith('Interval Fund Schemes')
      ) {
        continue;
      }

      // Check if it's a fund data line (contains semicolons)
      if (trimmedLine.includes(';')) {
        // Parse fund data
        const parts = trimmedLine.split(';');
        if (parts.length >= 6) {
          const [code, isin, , schemeName, navStr, dateStr] = parts;

          const nav = parseFloat(navStr);
          if (isNaN(nav)) continue;

          funds.push({
            amfiCode: code,
            isin: isin || null,
            schemeName: schemeName.trim(),
            nav,
            date: dateStr,
            schemeType: currentSchemeType,
            fundHouse: currentFundHouse,
          });
        }
        continue;
      }

      // Check if it's a category header (like "Equity Scheme - Large Cap Fund")
      if (trimmedLine.includes(' - ') && trimmedLine.endsWith('Fund')) {
        currentSchemeType = trimmedLine;
        continue;
      }

      // Otherwise, it's a fund house header (like "HDFC Mutual Fund")
      currentFundHouse = trimmedLine;
    }

    console.log(`✓ Parsed ${funds.length} funds from AMFI data`);
    return funds;
  }

  /**
   * Convert AMFI fund to RawFundData
   */
  private convertToRawFundData(amfiFund: any): RawFundData | null {
    try {
      // Map category
      const categoryInfo = this.categoryMap[amfiFund.schemeType] || {
        category: 'equity',
        subCategory: 'Multi Cap',
      };

      // Clean fund house name
      let fundHouse = amfiFund.fundHouse;
      if (fundHouse.endsWith('Mutual Fund')) {
        fundHouse = fundHouse.replace(' Mutual Fund', '');
      }

      return {
        symbol: amfiFund.amfiCode,
        name: amfiFund.schemeName,
        category: categoryInfo.category as any,
        subCategory: categoryInfo.subCategory,
        fundHouse: fundHouse,
        nav: amfiFund.nav,
        previousNav: amfiFund.nav * 0.99, // Approximate
        aum: 0, // Not available in NAV file
        expenseRatio: 1.5, // Typical value
        exitLoad: 1.0, // Typical value
        minInvestment: 5000,
        sipMinAmount: 500,
        launchDate: new Date('2020-01-01'), // Not available
        returns: {
          day: 0,
          week: 0,
          month: 0,
          threeMonth: 0,
          sixMonth: 0,
          oneYear: 0,
          threeYear: 0,
          fiveYear: 0,
        },
        fundManager: 'N/A',
        fundType: 'mutual_fund',
        dataSource: 'AMFI',
      };
    } catch (error: any) {
      console.error('Error converting AMFI fund:', error.message);
      return null;
    }
  }

  /**
   * Import mutual funds from AMFI
   */
  async importMutualFunds(options: ImportOptions = {}): Promise<ImportResult> {
    const { limit = 100 } = options;
    const result: ImportResult = {
      success: true,
      imported: 0,
      failed: 0,
      errors: [],
      data: [],
    };

    try {
      // Fetch and parse NAV data
      const navText = await this.fetchNAVData();
      const allFunds = this.parseNAVData(navText);

      // Debug: Log unique fund house names
      const uniqueFundHouses = [...new Set(allFunds.map((f) => f.fundHouse))];
      console.log(
        `📝 Found ${uniqueFundHouses.length} unique fund houses in data`
      );
      console.log(`📝 Sample fund house names:`);
      allFunds.slice(0, 5).forEach((f) => {
        console.log(
          `   "${f.fundHouse}" - ${f.schemeName.substring(0, 40)}...`
        );
      });
      console.log(`📝 Looking for fund houses matching:`);
      this.topFundHouses.slice(0, 5).forEach((house) => {
        const houseName = house.replace(' Mutual Fund', '');
        console.log(`   "${houseName}" (or "${house}")`);
      });

      // Filter for top fund houses (handle both "HDFC Mutual Fund" and "HDFC" formats)
      const priorityFunds = allFunds.filter((fund) =>
        this.topFundHouses.some((house) => {
          const houseName = house.replace(' Mutual Fund', '');
          return fund.fundHouse.includes(houseName) || fund.fundHouse === house;
        })
      );

      console.log(
        `📊 Found ${priorityFunds.length} funds from top fund houses`
      );

      // Select diverse set of funds
      const selectedFunds = this.selectDiverseFunds(priorityFunds, limit);

      console.log(`📥 Importing ${selectedFunds.length} mutual funds...`);

      for (const amfiFund of selectedFunds) {
        try {
          const fundData = this.convertToRawFundData(amfiFund);
          if (fundData) {
            result.data.push(fundData);
            result.imported++;
            console.log(`  ✓ ${fundData.name}`);
          } else {
            result.failed++;
            result.errors.push(`Failed to convert ${amfiFund.schemeName}`);
          }
        } catch (error: any) {
          result.failed++;
          result.errors.push(
            `Error importing ${amfiFund.schemeName}: ${error.message}`
          );
        }
      }

      console.log(
        `\n✅ Import complete: ${result.imported} succeeded, ${result.failed} failed`
      );
    } catch (error: any) {
      result.success = false;
      result.errors.push(`AMFI import failed: ${error.message}`);
      console.error('❌ AMFI import failed:', error.message);
    }

    return result;
  }

  /**
   * Select diverse set of funds across categories
   */
  private selectDiverseFunds(funds: any[], limit: number): any[] {
    const selected: any[] = [];
    const categoryCounts = new Map<string, number>();

    // Group funds by scheme type
    const fundsByType = new Map<string, any[]>();
    for (const fund of funds) {
      const type = fund.schemeType;
      if (!fundsByType.has(type)) {
        fundsByType.set(type, []);
      }
      fundsByType.get(type)!.push(fund);
    }

    // Calculate funds per category
    const categories = Array.from(fundsByType.keys());
    const fundsPerCategory = Math.floor(limit / categories.length);

    // Select funds from each category
    for (const [category, categoryFunds] of fundsByType.entries()) {
      const toSelect = Math.min(fundsPerCategory, categoryFunds.length);
      const sampled = this.sampleArray(categoryFunds, toSelect);
      selected.push(...sampled);

      if (selected.length >= limit) break;
    }

    // Fill remaining with random funds
    while (selected.length < limit && selected.length < funds.length) {
      const remaining = funds.filter((f) => !selected.includes(f));
      if (remaining.length === 0) break;
      selected.push(remaining[Math.floor(Math.random() * remaining.length)]);
    }

    return selected.slice(0, limit);
  }

  /**
   * Sample random elements from array
   */
  private sampleArray<T>(arr: T[], count: number): T[] {
    const shuffled = [...arr].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  }
}

// Export singleton instance
export const amfiImporter = new AMFIImporter();
