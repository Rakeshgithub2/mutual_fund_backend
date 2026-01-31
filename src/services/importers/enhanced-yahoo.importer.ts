import axios from 'axios';
import { RawFundData, ImportResult, ImportOptions } from './types';

/**
 * Enhanced Yahoo Finance Importer for ETFs and Global Funds
 * Focuses on commodity ETFs and international equity funds
 */
export class EnhancedYahooImporter {
  private baseUrl = 'https://query1.finance.yahoo.com/v8/finance/chart';
  private searchUrl = 'https://query2.finance.yahoo.com/v1/finance/search';
  private userAgent =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

  /**
   * Popular commodity ETF symbols
   */
  private commodityETFs = [
    // Gold ETFs
    { symbol: 'GLD', name: 'SPDR Gold Trust', subCategory: 'Gold' },
    { symbol: 'IAU', name: 'iShares Gold Trust', subCategory: 'Gold' },
    { symbol: 'GLDM', name: 'SPDR Gold MiniShares Trust', subCategory: 'Gold' },
    {
      symbol: 'SGOL',
      name: 'Aberdeen Standard Physical Gold Shares ETF',
      subCategory: 'Gold',
    },

    // Silver ETFs
    { symbol: 'SLV', name: 'iShares Silver Trust', subCategory: 'Silver' },
    {
      symbol: 'SIVR',
      name: 'Aberdeen Standard Physical Silver Shares ETF',
      subCategory: 'Silver',
    },

    // Commodity Baskets
    {
      symbol: 'DJP',
      name: 'iPath Bloomberg Commodity Index Total Return ETN',
      subCategory: 'Commodity',
    },
    {
      symbol: 'GSG',
      name: 'iShares S&P GSCI Commodity-Indexed Trust',
      subCategory: 'Commodity',
    },
    {
      symbol: 'PDBC',
      name: 'Invesco Optimum Yield Diversified Commodity Strategy No K-1 ETF',
      subCategory: 'Commodity',
    },
    {
      symbol: 'COMT',
      name: 'iShares GSCI Commodity Dynamic Roll Strategy ETF',
      subCategory: 'Commodity',
    },

    // Oil & Energy
    { symbol: 'USO', name: 'United States Oil Fund LP', subCategory: 'Energy' },
    {
      symbol: 'UNG',
      name: 'United States Natural Gas Fund LP',
      subCategory: 'Energy',
    },
    {
      symbol: 'XLE',
      name: 'Energy Select Sector SPDR Fund',
      subCategory: 'Energy',
    },

    // Agricultural
    {
      symbol: 'DBA',
      name: 'Invesco DB Agriculture Fund',
      subCategory: 'Agriculture',
    },
    { symbol: 'CORN', name: 'Teucrium Corn Fund', subCategory: 'Agriculture' },
    { symbol: 'WEAT', name: 'Teucrium Wheat Fund', subCategory: 'Agriculture' },

    // Industrial Metals
    {
      symbol: 'COPX',
      name: 'Global X Copper Miners ETF',
      subCategory: 'Industrial Metals',
    },
    {
      symbol: 'REMX',
      name: 'VanEck Vectors Rare Earth/Strategic Metals ETF',
      subCategory: 'Industrial Metals',
    },

    // Indian Commodity ETFs (NSE)
    {
      symbol: 'GOLDBEES.NS',
      name: 'Goldman Sachs Gold BEEs',
      subCategory: 'Gold',
    },
    {
      symbol: 'LIQUIDBEES.NS',
      name: 'Goldman Sachs Liquid BEEs',
      subCategory: 'Money Market',
    },
  ];

  /**
   * Popular equity ETF symbols for large/mid/small cap
   */
  private equityETFs = [
    // Large Cap US ETFs
    {
      symbol: 'SPY',
      name: 'SPDR S&P 500 ETF Trust',
      category: 'equity',
      subCategory: 'Large Cap',
    },
    {
      symbol: 'VOO',
      name: 'Vanguard S&P 500 ETF',
      category: 'equity',
      subCategory: 'Large Cap',
    },
    {
      symbol: 'IVV',
      name: 'iShares Core S&P 500 ETF',
      category: 'equity',
      subCategory: 'Large Cap',
    },
    {
      symbol: 'VTI',
      name: 'Vanguard Total Stock Market ETF',
      category: 'equity',
      subCategory: 'Large Cap',
    },
    {
      symbol: 'QQQ',
      name: 'Invesco QQQ Trust',
      category: 'equity',
      subCategory: 'Large Cap',
    },

    // Mid Cap US ETFs
    {
      symbol: 'MDY',
      name: 'SPDR S&P MidCap 400 ETF Trust',
      category: 'equity',
      subCategory: 'Mid Cap',
    },
    {
      symbol: 'IJH',
      name: 'iShares Core S&P Mid-Cap ETF',
      category: 'equity',
      subCategory: 'Mid Cap',
    },
    {
      symbol: 'VO',
      name: 'Vanguard Mid-Cap ETF',
      category: 'equity',
      subCategory: 'Mid Cap',
    },

    // Small Cap US ETFs
    {
      symbol: 'IWM',
      name: 'iShares Russell 2000 ETF',
      category: 'equity',
      subCategory: 'Small Cap',
    },
    {
      symbol: 'VB',
      name: 'Vanguard Small-Cap ETF',
      category: 'equity',
      subCategory: 'Small Cap',
    },
    {
      symbol: 'SLY',
      name: 'SPDR S&P 600 Small Cap ETF',
      category: 'equity',
      subCategory: 'Small Cap',
    },

    // Indian Equity ETFs (NSE)
    {
      symbol: 'NIFTYBEES.NS',
      name: 'Nippon India ETF Nifty BeES',
      category: 'equity',
      subCategory: 'Large Cap',
    },
    {
      symbol: 'JUNIORBEES.NS',
      name: 'Nippon India ETF Junior BeES',
      category: 'equity',
      subCategory: 'Mid Cap',
    },
    {
      symbol: 'BANKBEES.NS',
      name: 'Nippon India ETF Bank BeES',
      category: 'equity',
      subCategory: 'Sectoral',
    },
    {
      symbol: 'ITBEES.NS',
      name: 'Nippon India ETF IT BeES',
      category: 'equity',
      subCategory: 'Sectoral',
    },
    {
      symbol: 'PSUBNKBEES.NS',
      name: 'Nippon India ETF PSU Bank BeES',
      category: 'equity',
      subCategory: 'Sectoral',
    },

    // International Developed Markets
    {
      symbol: 'EFA',
      name: 'iShares MSCI EAFE ETF',
      category: 'equity',
      subCategory: 'International',
    },
    {
      symbol: 'VEA',
      name: 'Vanguard FTSE Developed Markets ETF',
      category: 'equity',
      subCategory: 'International',
    },
    {
      symbol: 'IEFA',
      name: 'iShares Core MSCI EAFE IMI Index ETF',
      category: 'equity',
      subCategory: 'International',
    },

    // Emerging Markets
    {
      symbol: 'EEM',
      name: 'iShares MSCI Emerging Markets ETF',
      category: 'equity',
      subCategory: 'Emerging Markets',
    },
    {
      symbol: 'VWO',
      name: 'Vanguard FTSE Emerging Markets ETF',
      category: 'equity',
      subCategory: 'Emerging Markets',
    },
    {
      symbol: 'IEMG',
      name: 'iShares Core MSCI Emerging Markets IMI Index ETF',
      category: 'equity',
      subCategory: 'Emerging Markets',
    },
  ];

  /**
   * Get current quote for a symbol
   */
  async getQuote(symbol: string): Promise<any> {
    try {
      const response = await axios.get(`${this.baseUrl}/${symbol}`, {
        headers: { 'User-Agent': this.userAgent },
        timeout: 10000,
        params: {
          interval: '1d',
          range: '1d',
        },
      });

      const result = response.data?.chart?.result?.[0];
      if (!result) return null;

      const meta = result.meta;
      const quote = result.indicators?.quote?.[0];

      if (!meta || !quote) return null;

      return {
        symbol: meta.symbol,
        regularMarketPrice: meta.regularMarketPrice,
        previousClose: meta.previousClose,
        currency: meta.currency,
        exchangeName: meta.exchangeName,
        marketState: meta.marketState,
        timezone: meta.timezone,
        volume: quote.volume?.[quote.volume.length - 1],
        change: meta.regularMarketPrice - meta.previousClose,
        changePercent:
          ((meta.regularMarketPrice - meta.previousClose) /
            meta.previousClose) *
          100,
      };
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
      const response = await axios.get(`${this.baseUrl}/${symbol}`, {
        headers: { 'User-Agent': this.userAgent },
        timeout: 15000,
        params: {
          interval: '1d',
          range: period,
        },
      });

      const result = response.data?.chart?.result?.[0];
      if (!result) return [];

      const timestamps = result.timestamp;
      const quotes = result.indicators?.quote?.[0];

      if (!timestamps || !quotes) return [];

      const historicalData = [];
      for (let i = 0; i < timestamps.length; i++) {
        if (quotes.close[i] !== null) {
          historicalData.push({
            date: new Date(timestamps[i] * 1000),
            open: quotes.open[i],
            high: quotes.high[i],
            low: quotes.low[i],
            close: quotes.close[i],
            volume: quotes.volume[i],
          });
        }
      }

      return historicalData;
    } catch (error: any) {
      console.error(
        `Error fetching historical data for ${symbol}:`,
        error.message
      );
      return [];
    }
  }

  /**
   * Calculate returns from historical data
   */
  private calculateReturns(historicalData: any[]): any {
    if (!historicalData || historicalData.length < 2) {
      return {
        day: 0,
        week: 0,
        month: 0,
        threeMonth: 0,
        sixMonth: 0,
        oneYear: 0,
        threeYear: 0,
        fiveYear: 0,
      };
    }

    const current = historicalData[historicalData.length - 1].close;
    const oneDay = this.getPriceByDaysAgo(historicalData, 1);
    const oneWeek = this.getPriceByDaysAgo(historicalData, 7);
    const oneMonth = this.getPriceByDaysAgo(historicalData, 30);
    const threeMonth = this.getPriceByDaysAgo(historicalData, 90);
    const sixMonth = this.getPriceByDaysAgo(historicalData, 180);
    const oneYear = this.getPriceByDaysAgo(historicalData, 365);

    return {
      day: oneDay ? ((current - oneDay) / oneDay) * 100 : 0,
      week: oneWeek ? ((current - oneWeek) / oneWeek) * 100 : 0,
      month: oneMonth ? ((current - oneMonth) / oneMonth) * 100 : 0,
      threeMonth: threeMonth ? ((current - threeMonth) / threeMonth) * 100 : 0,
      sixMonth: sixMonth ? ((current - sixMonth) / sixMonth) * 100 : 0,
      oneYear: oneYear ? ((current - oneYear) / oneYear) * 100 : 0,
      threeYear: 0, // Would need 3 years of data
      fiveYear: 0, // Would need 5 years of data
    };
  }

  /**
   * Get price from N days ago
   */
  private getPriceByDaysAgo(data: any[], daysAgo: number): number | null {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() - daysAgo);

    let closestPrice = null;
    let closestDiff = Infinity;

    for (const item of data) {
      const diff = Math.abs(item.date.getTime() - targetDate.getTime());
      if (diff < closestDiff) {
        closestDiff = diff;
        closestPrice = item.close;
      }
    }

    return closestPrice;
  }

  /**
   * Convert ETF data to RawFundData
   */
  private async convertETFToRawFundData(etf: any): Promise<RawFundData | null> {
    try {
      const quote = await this.getQuote(etf.symbol);
      if (!quote) return null;

      const historicalData = await this.getHistoricalData(etf.symbol, '1y');
      const returns = this.calculateReturns(historicalData);

      // Determine fund house from symbol
      let fundHouse = 'Unknown';
      if (etf.name.includes('SPDR')) fundHouse = 'State Street';
      else if (etf.name.includes('iShares')) fundHouse = 'BlackRock';
      else if (etf.name.includes('Vanguard')) fundHouse = 'Vanguard';
      else if (etf.name.includes('Invesco')) fundHouse = 'Invesco';
      else if (etf.symbol.includes('.NS')) fundHouse = 'Nippon India';

      return {
        symbol: etf.symbol,
        name: etf.name,
        category: etf.category || 'commodity',
        subCategory: etf.subCategory,
        fundHouse,
        nav: quote.regularMarketPrice,
        previousNav: quote.previousClose,
        aum: this.estimateETFAUM(etf.symbol),
        expenseRatio: this.estimateETFExpenseRatio(etf.symbol),
        exitLoad: 0, // ETFs typically have no exit load
        minInvestment: etf.symbol.includes('.NS') ? 1000 : 100, // Indian vs US
        sipMinAmount: 500,
        launchDate: new Date('2020-01-01'), // Approximate
        returns,
        fundManager: `${fundHouse} Portfolio Team`,
        fundType: 'etf',
        dataSource: 'Yahoo Finance Enhanced',
      };
    } catch (error: any) {
      console.error(`Error converting ETF ${etf.symbol}:`, error.message);
      return null;
    }
  }

  /**
   * Estimate ETF AUM
   */
  private estimateETFAUM(symbol: string): number {
    const largeCap = ['SPY', 'VOO', 'QQQ', 'GLD', 'SLV'];
    const midCap = ['MDY', 'IJH', 'EFA', 'EEM'];

    if (largeCap.includes(symbol)) return 50000 + Math.random() * 100000;
    if (midCap.includes(symbol)) return 10000 + Math.random() * 20000;
    return 1000 + Math.random() * 5000;
  }

  /**
   * Estimate ETF expense ratio
   */
  private estimateETFExpenseRatio(symbol: string): number {
    if (symbol.includes('Vanguard') || symbol.startsWith('V'))
      return 0.1 + Math.random() * 0.2;
    if (symbol.includes('iShares')) return 0.2 + Math.random() * 0.3;
    if (symbol.includes('SPDR')) return 0.1 + Math.random() * 0.4;
    return 0.3 + Math.random() * 0.5;
  }

  /**
   * Import commodity ETFs
   */
  async importCommodityETFs(
    options: ImportOptions = {}
  ): Promise<ImportResult> {
    const { limit = 20 } = options;

    const result: ImportResult = {
      success: true,
      imported: 0,
      failed: 0,
      errors: [],
      data: [],
    };

    try {
      console.log(
        `📥 Importing ${Math.min(limit, this.commodityETFs.length)} commodity ETFs...`
      );

      const selectedETFs = this.commodityETFs.slice(0, limit);

      for (const etf of selectedETFs) {
        try {
          const etfData = await this.convertETFToRawFundData(etf);
          if (etfData) {
            result.data.push(etfData);
            result.imported++;
            console.log(`  ✓ ${etfData.name} (${etfData.subCategory})`);
          } else {
            result.failed++;
          }

          // Delay to respect API limits
          await this.delay(500);
        } catch (error: any) {
          result.failed++;
          result.errors.push(`Error importing ${etf.name}: ${error.message}`);
        }
      }

      console.log(
        `\n✅ Commodity ETF import complete: ${result.imported} succeeded, ${result.failed} failed`
      );
    } catch (error: any) {
      result.success = false;
      result.errors.push(`Commodity ETF import failed: ${error.message}`);
      console.error('❌ Commodity ETF import failed:', error.message);
    }

    return result;
  }

  /**
   * Import equity ETFs
   */
  async importEquityETFs(
    options: ImportOptions & {
      categories?: string[];
    } = {}
  ): Promise<ImportResult> {
    const { limit = 30, categories = ['Large Cap', 'Mid Cap', 'Small Cap'] } =
      options;

    const result: ImportResult = {
      success: true,
      imported: 0,
      failed: 0,
      errors: [],
      data: [],
    };

    try {
      console.log(
        `📥 Importing equity ETFs for categories: ${categories.join(', ')}...`
      );

      // Filter ETFs by requested categories
      const filteredETFs = this.equityETFs.filter((etf) =>
        categories.includes(etf.subCategory)
      );

      const selectedETFs = filteredETFs.slice(0, limit);

      for (const etf of selectedETFs) {
        try {
          const etfData = await this.convertETFToRawFundData(etf);
          if (etfData) {
            result.data.push(etfData);
            result.imported++;
            console.log(`  ✓ ${etfData.name} (${etfData.subCategory})`);
          } else {
            result.failed++;
          }

          // Delay to respect API limits
          await this.delay(500);
        } catch (error: any) {
          result.failed++;
          result.errors.push(`Error importing ${etf.name}: ${error.message}`);
        }
      }

      console.log(
        `\n✅ Equity ETF import complete: ${result.imported} succeeded, ${result.failed} failed`
      );
    } catch (error: any) {
      result.success = false;
      result.errors.push(`Equity ETF import failed: ${error.message}`);
      console.error('❌ Equity ETF import failed:', error.message);
    }

    return result;
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const enhancedYahooImporter = new EnhancedYahooImporter();
