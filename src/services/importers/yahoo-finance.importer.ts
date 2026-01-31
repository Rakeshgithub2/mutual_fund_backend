import axios from 'axios';
import { RawFundData, ImportResult, ImportOptions } from './types';

/**
 * Yahoo Finance API Importer
 * Fetches ETF and Mutual Fund data from Yahoo Finance
 */
export class YahooFinanceImporter {
  private baseUrl = 'https://query1.finance.yahoo.com/v7/finance';
  private userAgent =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

  /**
   * Popular Indian ETFs on Yahoo Finance
   */
  private indianETFs = [
    // Nifty Index ETFs
    'NIFTYBEES.NS', // Nippon India ETF Nifty BeES
    'JUNIORBEES.NS', // Nippon India ETF Junior BeES
    'BANKBEES.NS', // Nippon India ETF Bank BeES
    'PSUBNKBEES.NS', // Nippon India ETF PSU Bank BeES
    'INFRABEES.NS', // Nippon India ETF Infra BeES
    'CPSEETF.NS', // CPSE ETF
    'ICICIB22.NS', // ICICI Prudential Nifty Next 50 ETF
    'NETFIT.NS', // ICICI Prudential Nifty IT ETF

    // SBI ETFs
    'SETFNIF50.NS', // SBI ETF Nifty 50
    'SETFNIFBK.NS', // SBI ETF Nifty Bank

    // Sector ETFs
    'HDFCNIFETF.NS', // HDFC Nifty 50 ETF
    'ICICIB22.NS', // ICICI Prudential IT ETF
    'MOM30.NS', // Motilal Oswal Nifty Midcap 150 ETF

    // Gold ETFs
    'GOLDBEES.NS', // Nippon India ETF Gold BeES
    'GOLDSHARE.NS', // Goldman Sachs Gold BEes
    'HDFCGOLD.NS', // HDFC Gold ETF
    'SBIGOLD.NS', // SBI Gold ETF
    'AXISGOLD.NS', // Axis Gold ETF

    // Other Commodity ETFs
    'SILVERBEES.NS', // Nippon India Silver ETF
  ];

  /**
   * US ETFs covering various categories
   */
  private usETFs = [
    // Broad Market
    'SPY', // SPDR S&P 500
    'VOO', // Vanguard S&P 500
    'IVV', // iShares Core S&P 500
    'QQQ', // Invesco QQQ (Nasdaq-100)
    'DIA', // SPDR Dow Jones
    'VTI', // Vanguard Total Stock Market
    'IWM', // iShares Russell 2000
    'VEA', // Vanguard FTSE Developed Markets
    'VWO', // Vanguard FTSE Emerging Markets

    // Sector ETFs
    'XLF', // Financial Select Sector SPDR
    'XLE', // Energy Select Sector SPDR
    'XLK', // Technology Select Sector SPDR
    'XLV', // Health Care Select Sector SPDR
    'XLI', // Industrial Select Sector SPDR
    'XLP', // Consumer Staples Select Sector SPDR
    'XLY', // Consumer Discretionary Select Sector SPDR
    'XLU', // Utilities Select Sector SPDR
    'XLB', // Materials Select Sector SPDR
    'XLRE', // Real Estate Select Sector SPDR
    'VGT', // Vanguard Information Technology

    // Bond ETFs
    'AGG', // iShares Core U.S. Aggregate Bond
    'BND', // Vanguard Total Bond Market
    'LQD', // iShares iBoxx Investment Grade Corporate Bond
    'TLT', // iShares 20+ Year Treasury Bond
    'SHY', // iShares 1-3 Year Treasury Bond

    // Gold & Commodities
    'GLD', // SPDR Gold Shares
    'IAU', // iShares Gold Trust
    'SLV', // iShares Silver Trust
    'USO', // United States Oil Fund
    'DBC', // Invesco DB Commodity Index
    'PDBC', // Invesco Optimum Yield Diversified Commodity

    // Thematic ETFs
    'ARKK', // ARK Innovation ETF
    'ARKG', // ARK Genomic Revolution
    'ARKW', // ARK Next Generation Internet
    'ARKF', // ARK Fintech Innovation
    'TAN', // Invesco Solar ETF
    'ICLN', // iShares Global Clean Energy
    'BOTZ', // Global X Robotics & AI
    'CLOU', // Global X Cloud Computing
  ];

  /**
   * Get quote data for a symbol
   */
  async getQuote(symbol: string): Promise<any> {
    try {
      const url = `${this.baseUrl}/quote?symbols=${symbol}`;
      const response = await axios.get(url, {
        headers: { 'User-Agent': this.userAgent },
        timeout: 10000,
      });

      if (
        response.data?.quoteResponse?.result &&
        response.data.quoteResponse.result.length > 0
      ) {
        return response.data.quoteResponse.result[0];
      }
      return null;
    } catch (error: any) {
      console.error(`Error fetching quote for ${symbol}:`, error.message);
      return null;
    }
  }

  /**
   * Get historical data for a symbol
   */
  async getHistoricalData(
    symbol: string,
    period: string = '1y'
  ): Promise<any[]> {
    try {
      const url = `${this.baseUrl}/chart/${symbol}?range=${period}&interval=1d`;
      const response = await axios.get(url, {
        headers: { 'User-Agent': this.userAgent },
        timeout: 15000,
      });

      if (response.data?.chart?.result?.[0]) {
        const result = response.data.chart.result[0];
        const timestamps = result.timestamp || [];
        const quotes = result.indicators?.quote?.[0] || {};

        return timestamps.map((timestamp: number, index: number) => ({
          date: new Date(timestamp * 1000),
          open: quotes.open?.[index] || null,
          high: quotes.high?.[index] || null,
          low: quotes.low?.[index] || null,
          close: quotes.close?.[index] || null,
          volume: quotes.volume?.[index] || null,
        }));
      }
      return [];
    } catch (error: any) {
      console.error(
        `Error fetching historical data for ${symbol}:`,
        error.message
      );
      return [];
    }
  }

  /**
   * Parse Yahoo Finance data to RawFundData
   */
  private parseYahooData(data: any, symbol: string): RawFundData | null {
    try {
      if (!data) return null;

      const name = data.longName || data.shortName || symbol;
      const price = data.regularMarketPrice || data.previousClose || 0;
      const previousPrice = data.previousClose || price;

      // Determine category based on quote type and name
      let category: string = 'equity';
      let subCategory: string = 'Large Cap';
      let fundType: 'mutual_fund' | 'etf' = 'etf';

      if (data.quoteType === 'ETF' || symbol.endsWith('.NS')) {
        fundType = 'etf';

        if (name.toLowerCase().includes('gold') || symbol.includes('GOLD')) {
          category = 'commodity';
          subCategory = 'Gold';
        } else if (
          name.toLowerCase().includes('silver') ||
          symbol.includes('SILVER')
        ) {
          category = 'commodity';
          subCategory = 'Silver';
        } else if (name.toLowerCase().includes('oil')) {
          category = 'commodity';
          subCategory = 'Oil';
        } else if (
          name.toLowerCase().includes('bond') ||
          name.toLowerCase().includes('treasury')
        ) {
          category = 'debt';
          subCategory = 'Government Bond';
        } else if (name.toLowerCase().includes('bank')) {
          category = 'equity';
          subCategory = 'Banking';
        } else if (
          name.toLowerCase().includes('tech') ||
          name.toLowerCase().includes('it')
        ) {
          category = 'equity';
          subCategory = 'Technology';
        } else if (name.toLowerCase().includes('energy')) {
          category = 'equity';
          subCategory = 'Energy';
        } else if (name.toLowerCase().includes('health')) {
          category = 'equity';
          subCategory = 'Healthcare';
        }
      }

      // Calculate returns
      const dayChange = data.regularMarketChangePercent || 0;
      const fiftyTwoWeekHigh = data.fiftyTwoWeekHigh || price;
      const fiftyTwoWeekLow = data.fiftyTwoWeekLow || price;

      return {
        symbol,
        name,
        category: category as any,
        subCategory,
        fundHouse: data.fundFamily || 'Unknown',
        nav: price,
        previousNav: previousPrice,
        aum: data.totalAssets || 0,
        expenseRatio: data.annualReportExpenseRatio
          ? data.annualReportExpenseRatio * 100
          : 0.5,
        exitLoad: 0,
        minInvestment: 500,
        sipMinAmount: 500,
        launchDate: data.fundInceptionDate
          ? new Date(data.fundInceptionDate * 1000)
          : new Date('2020-01-01'),
        returns: {
          day: dayChange,
          week: 0,
          month: 0,
          threeMonth: 0,
          sixMonth: 0,
          oneYear: data.fiftyTwoWeekChangePercent || 0,
          threeYear: 0,
          fiveYear: 0,
        },
        fundManager: 'N/A',
        fundType,
        dataSource: 'Yahoo Finance',
      };
    } catch (error: any) {
      console.error(`Error parsing Yahoo data for ${symbol}:`, error.message);
      return null;
    }
  }

  /**
   * Import ETFs from Yahoo Finance
   */
  async importETFs(options: ImportOptions = {}): Promise<ImportResult> {
    const { limit = 150 } = options;
    const result: ImportResult = {
      success: true,
      imported: 0,
      failed: 0,
      errors: [],
      data: [],
    };

    // Combine Indian and US ETFs
    const allSymbols = [...this.indianETFs, ...this.usETFs].slice(0, limit);

    console.log(`📥 Importing ${allSymbols.length} ETFs from Yahoo Finance...`);

    for (const symbol of allSymbols) {
      try {
        console.log(`  Fetching ${symbol}...`);
        const quote = await this.getQuote(symbol);

        if (quote) {
          const fundData = this.parseYahooData(quote, symbol);
          if (fundData) {
            result.data.push(fundData);
            result.imported++;
            console.log(`  ✓ ${fundData.name}`);
          } else {
            result.failed++;
            result.errors.push(`Failed to parse data for ${symbol}`);
          }
        } else {
          result.failed++;
          result.errors.push(`No data found for ${symbol}`);
        }

        // Rate limiting - wait between requests
        await this.delay(500);
      } catch (error: any) {
        result.failed++;
        result.errors.push(`Error importing ${symbol}: ${error.message}`);
        console.error(`  ✗ Error importing ${symbol}`);
      }
    }

    console.log(
      `\n✅ Import complete: ${result.imported} succeeded, ${result.failed} failed`
    );
    return result;
  }

  /**
   * Import historical prices for a symbol
   */
  async importHistoricalPrices(
    symbol: string,
    period: string = '1y'
  ): Promise<any[]> {
    console.log(`📊 Fetching historical data for ${symbol}...`);
    const data = await this.getHistoricalData(symbol, period);
    console.log(`  ✓ Fetched ${data.length} price points`);
    return data;
  }

  /**
   * Delay helper for rate limiting
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const yahooFinanceImporter = new YahooFinanceImporter();
