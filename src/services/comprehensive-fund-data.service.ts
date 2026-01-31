import axios from 'axios';
import { Db } from 'mongodb';
import { Fund, FundPrice, FundManager } from '../db/schemas';
import { randomUUID } from 'crypto';

/**
 * Comprehensive Data Sources Configuration
 *
 * INDIAN SOURCES:
 * - AMFI: Daily NAV for all Indian mutual funds
 * - NSE/BSE: ETF data and live prices
 * - CAMS/KFinTech: Transaction data (future)
 *
 * GLOBAL SOURCES:
 * - Yahoo Finance: Global stocks, ETFs, commodities
 * - Alpha Vantage: Historical data, fundamentals
 * - IEX Cloud: Real-time market data
 *
 * PREMIUM SOURCES (Optional):
 * - Morningstar: Fund ratings, holdings, manager info
 * - Bloomberg: Professional-grade data
 */

// API Configuration
const CONFIG = {
  // India - AMFI
  AMFI_NAV_URL:
    process.env.AMFI_NAV_URL || 'https://www.amfiindia.com/spages/NAVAll.txt',

  // India - NSE
  NSE_API_BASE: 'https://www.nseindia.com/api',
  NSE_ETF_LIST:
    'https://www.nseindia.com/api/equity-stockIndices?index=NIFTY%20ETF',

  // Yahoo Finance via RapidAPI
  RAPIDAPI_KEY: process.env.RAPIDAPI_KEY,
  RAPIDAPI_HOST:
    process.env.RAPIDAPI_HOST || 'apidojo-yahoo-finance-v1.p.rapidapi.com',

  // Alpha Vantage
  ALPHA_VANTAGE_KEY: process.env.ALPHA_VANTAGE_KEY,
  ALPHA_VANTAGE_BASE: 'https://www.alphavantage.co/query',

  // IEX Cloud
  IEX_TOKEN: process.env.IEX_TOKEN,
  IEX_BASE: 'https://cloud.iexapis.com/stable',

  // Fund House URLs for scraping
  FUND_HOUSES: {
    SBI: 'https://www.sbimf.com',
    HDFC: 'https://www.hdfcfund.com',
    ICICI: 'https://www.icicipruamc.com',
    AXIS: 'https://www.axismf.com',
    KOTAK: 'https://www.kotakmf.com',
  },
};

// Rate limiting
const RATE_LIMITS = {
  AMFI: 60000, // 1 minute
  NSE: 2000, // 2 seconds
  YAHOO: 1000, // 1 second
  ALPHA_VANTAGE: 12000, // 12 seconds (5 calls/min on free tier)
  IEX: 100, // 100ms (for paid tier)
};

let apiCallTimestamps: { [key: string]: number } = {};

async function rateLimitedCall(
  source: keyof typeof RATE_LIMITS
): Promise<void> {
  const now = Date.now();
  const lastCall = apiCallTimestamps[source] || 0;
  const timeSinceLastCall = now - lastCall;
  const delay = RATE_LIMITS[source];

  if (timeSinceLastCall < delay) {
    await new Promise((resolve) =>
      setTimeout(resolve, delay - timeSinceLastCall)
    );
  }

  apiCallTimestamps[source] = Date.now();
}

export class ComprehensiveFundDataService {
  private db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  // ==================== AMFI DATA FETCHING ====================

  /**
   * Fetch complete AMFI mutual fund universe (2000+ funds)
   * Source: https://www.amfiindia.com/spages/NAVAll.txt
   * Updates: Daily after market close
   */
  async fetchAMFIData(): Promise<{
    success: boolean;
    fundsAdded: number;
    fundsUpdated: number;
  }> {
    console.log('📊 [AMFI] Fetching Indian mutual funds data...');
    await rateLimitedCall('AMFI');

    try {
      const response = await axios.get(CONFIG.AMFI_NAV_URL, {
        timeout: 60000,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      const lines = response.data.split('\n');
      const fundsToUpsert: Partial<Fund>[] = [];
      let currentFundHouse = '';

      for (const line of lines) {
        const trimmed = line.trim();

        // Fund house name (lines without semicolons)
        if (trimmed && !trimmed.includes(';')) {
          currentFundHouse = trimmed;
          continue;
        }

        // Fund data: SchemeCode;ISIN Div;ISIN Growth;Scheme Name;NAV;Date
        if (trimmed.includes(';')) {
          const parts = trimmed.split(';');
          if (parts.length >= 6) {
            const [
              schemeCode,
              isinDiv,
              isinGrowth,
              schemeName,
              navStr,
              dateStr,
            ] = parts;
            const nav = parseFloat(navStr);

            if (isNaN(nav) || nav <= 0) continue;

            const fundId = isinGrowth || isinDiv || `AMFI_${schemeCode}`;
            const navDate = this.parseAMFIDate(dateStr);

            const fund: Partial<Fund> = {
              fundId,
              name: schemeName.trim(),
              category: this.detectCategory(schemeName),
              subCategory: this.detectSubCategory(schemeName),
              fundType: 'mutual_fund',
              fundHouse: currentFundHouse,
              currentNav: nav,
              previousNav: 0, // Will be updated from history
              navDate,
              dataSource: 'AMFI',
              isActive: true,
              lastUpdated: new Date(),

              // Defaults - enriched later from other sources
              aum: 0,
              expenseRatio: this.estimateExpenseRatio(schemeName),
              exitLoad: this.estimateExitLoad(schemeName),
              minInvestment: 5000,
              sipMinAmount: 500,
              fundManager: 'To be updated',
              launchDate: new Date('2020-01-01'), // Default, update from factsheet

              returns: {
                day: 0,
                week: 0,
                month: 0,
                threeMonth: 0,
                sixMonth: 0,
                oneYear: 0,
                threeYear: 0,
                fiveYear: 0,
                sinceInception: 0,
              },

              riskMetrics: {
                sharpeRatio: 0,
                standardDeviation: 0,
                beta: 1,
                alpha: 0,
                rSquared: 0,
                sortino: 0,
              },

              holdings: [],
              sectorAllocation: [],
              ratings: {},
              tags: this.generateTags(schemeName),
              searchTerms: this.generateSearchTerms(schemeName),
              popularity: 0,
            };

            fundsToUpsert.push(fund);

            // Save price history
            await this.savePriceData(fundId, nav, navDate, 0);
          }
        }
      }

      // Bulk upsert to database
      const result = await this.bulkUpsertFunds(fundsToUpsert);

      console.log(`✅ [AMFI] Processed ${fundsToUpsert.length} funds`);
      console.log(`   Added: ${result.added}, Updated: ${result.updated}`);

      return {
        success: true,
        fundsAdded: result.added,
        fundsUpdated: result.updated,
      };
    } catch (error: any) {
      console.error('❌ [AMFI] Error:', error.message);
      return { success: false, fundsAdded: 0, fundsUpdated: 0 };
    }
  }

  // ==================== NSE/BSE ETF DATA ====================

  /**
   * Fetch Indian ETFs from NSE
   * Source: NSE India API
   * Coverage: Nifty BeES, Gold BeES, Bank BeES, etc.
   */
  async fetchNSEETFs(): Promise<void> {
    console.log('📊 [NSE] Fetching Indian ETFs...');
    await rateLimitedCall('NSE');

    try {
      // NSE requires cookies and specific headers
      const session = axios.create({
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Accept: 'application/json',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });

      // Get session cookies first
      await session.get('https://www.nseindia.com');

      // Fetch ETF list
      const response = await session.get(CONFIG.NSE_ETF_LIST);
      const etfs = response.data.data || [];

      const fundsToUpsert: Partial<Fund>[] = [];

      for (const etf of etfs) {
        const symbol = etf.symbol;

        // Fetch detailed quote
        await rateLimitedCall('NSE');
        const quoteUrl = `${CONFIG.NSE_API_BASE}/quote-equity?symbol=${symbol}`;

        try {
          const quoteRes = await session.get(quoteUrl);
          const quote = quoteRes.data;

          const fund: Partial<Fund> = {
            fundId: `${symbol}.NS`,
            name: quote.info?.companyName || symbol,
            category: this.detectCategory(symbol),
            subCategory: this.detectSubCategory(symbol),
            fundType: 'etf',
            fundHouse: this.extractFundHouse(symbol),
            currentNav: quote.priceInfo?.lastPrice || 0,
            previousNav: quote.priceInfo?.previousClose || 0,
            navDate: new Date(),
            dataSource: 'NSE',
            isActive: true,
            lastUpdated: new Date(),
            aum: 0,
            expenseRatio: 0.5,
            exitLoad: 0,
            minInvestment: quote.priceInfo?.lastPrice || 100,
            sipMinAmount: quote.priceInfo?.lastPrice || 100,
            fundManager: 'ETF - Passive',
            launchDate: new Date(quote.info?.listingDate || '2020-01-01'),
            returns: {
              day: this.calculateDayReturn(quote.priceInfo),
              week: quote.priceInfo?.weekHigh
                ? ((quote.priceInfo.lastPrice - quote.priceInfo.weekLow) /
                    quote.priceInfo.weekLow) *
                  100
                : 0,
              month: 0,
              threeMonth: 0,
              sixMonth: 0,
              oneYear: quote.priceInfo?.yearHigh
                ? ((quote.priceInfo.lastPrice - quote.priceInfo.yearLow) /
                    quote.priceInfo.yearLow) *
                  100
                : 0,
              threeYear: 0,
              fiveYear: 0,
              sinceInception: 0,
            },
            riskMetrics: {
              sharpeRatio: 0,
              standardDeviation: 0,
              beta: 1,
              alpha: 0,
              rSquared: 0,
              sortino: 0,
            },
            holdings: [],
            sectorAllocation: [],
            ratings: {},
            tags: this.generateTags(symbol),
            searchTerms: this.generateSearchTerms(symbol),
            popularity: quote.priceInfo?.totalTradedVolume || 0,
          };

          fundsToUpsert.push(fund);

          // Save price
          await this.savePriceData(
            fund.fundId!,
            fund.currentNav!,
            new Date(),
            fund.returns.day
          );
        } catch (error) {
          console.warn(`⚠️  [NSE] Error fetching ${symbol}`);
        }
      }

      await this.bulkUpsertFunds(fundsToUpsert);
      console.log(`✅ [NSE] Processed ${fundsToUpsert.length} ETFs`);
    } catch (error: any) {
      console.error('❌ [NSE] Error:', error.message);
    }
  }

  // ==================== YAHOO FINANCE (GLOBAL) ====================

  /**
   * Fetch global ETFs and commodities via Yahoo Finance
   * Coverage: Gold, Silver, Oil, Global equity ETFs
   */
  async fetchYahooFinanceData(symbols: string[]): Promise<void> {
    console.log(`📊 [Yahoo Finance] Fetching ${symbols.length} symbols...`);

    const fundsToUpsert: Partial<Fund>[] = [];

    for (const symbol of symbols) {
      try {
        await rateLimitedCall('YAHOO');

        const quote = await this.fetchYahooQuote(symbol);
        const stats = await this.fetchYahooStatistics(symbol);
        const profile = await this.fetchYahooProfile(symbol);

        const fund: Partial<Fund> = {
          fundId: symbol,
          name: quote.longName || quote.shortName || symbol,
          category: this.categorizeFromYahoo(quote, profile),
          subCategory: this.subCategorizeFromYahoo(quote, profile),
          fundType: quote.quoteType === 'ETF' ? 'etf' : 'mutual_fund',
          fundHouse: this.extractFundHouse(quote.longName || ''),
          currentNav: quote.regularMarketPrice || 0,
          previousNav: quote.regularMarketPreviousClose || 0,
          navDate: new Date(
            (quote.regularMarketTime || Date.now() / 1000) * 1000
          ),
          dataSource: 'Yahoo Finance',
          isActive: true,
          lastUpdated: new Date(),

          aum: stats.totalAssets || 0,
          expenseRatio: (stats.annualReportExpenseRatio || 0) * 100,
          exitLoad: 0,
          minInvestment: quote.regularMarketPrice || 0,
          sipMinAmount: quote.regularMarketPrice || 0,
          fundManager: profile.fundFamily || 'ETF',
          launchDate: stats.fundInceptionDate
            ? new Date(stats.fundInceptionDate * 1000)
            : new Date(),

          returns: {
            day: quote.regularMarketChangePercent || 0,
            week: this.calculateReturn(
              quote.regularMarketPrice,
              stats.fiftyTwoWeekLow,
              7
            ),
            month: this.calculateReturn(
              quote.regularMarketPrice,
              stats.fiftyTwoWeekLow,
              30
            ),
            threeMonth: this.calculateReturn(
              quote.regularMarketPrice,
              stats.fiftyTwoWeekLow,
              90
            ),
            sixMonth: this.calculateReturn(
              quote.regularMarketPrice,
              stats.fiftyTwoWeekLow,
              180
            ),
            oneYear: stats.fiftyTwoWeekChange || 0,
            threeYear: stats.threeYearAverageReturn || 0,
            fiveYear: stats.fiveYearAverageReturn || 0,
            sinceInception: 0,
          },

          riskMetrics: {
            sharpeRatio: stats.threeYearSharpeRatio || 0,
            standardDeviation: stats.threeYearStandardDeviation || 0,
            beta: stats.beta3Year || 1,
            alpha: stats.alpha3Year || 0,
            rSquared: 0,
            sortino: 0,
          },

          holdings: await this.fetchYahooHoldings(symbol),
          sectorAllocation: [],
          ratings: {
            morningstar: stats.morningstarRating,
          },
          tags: this.generateTags(quote.longName || symbol),
          searchTerms: this.generateSearchTerms(quote.longName || symbol),
          popularity: quote.averageVolume || 0,
        };

        fundsToUpsert.push(fund);

        await this.savePriceData(
          symbol,
          fund.currentNav!,
          fund.navDate!,
          fund.returns.day
        );
      } catch (error: any) {
        console.warn(`⚠️  [Yahoo] Error fetching ${symbol}:`, error.message);
      }
    }

    await this.bulkUpsertFunds(fundsToUpsert);
    console.log(`✅ [Yahoo Finance] Processed ${fundsToUpsert.length} funds`);
  }

  /**
   * Fetch popular commodity and international ETFs
   */
  async fetchPopularETFs(): Promise<void> {
    const etfSymbols = [
      // Indian ETFs
      'NIFTYBEES.NS',
      'JUNIORBEES.NS',
      'BANKBEES.NS',
      'GOLDBEES.NS',
      'LIQUIDBEES.NS',
      'PSUBNKBEES.NS',
      'INFRABEES.NS',
      'SILVERBEES.NS',

      // US Commodity ETFs
      'GLD', // SPDR Gold Shares
      'SLV', // iShares Silver Trust
      'USO', // United States Oil Fund
      'DBA', // Invesco DB Agriculture Fund
      'DBC', // Invesco DB Commodity Index
      'PPLT', // Aberdeen Standard Physical Platinum
      'PALL', // Aberdeen Standard Physical Palladium
      'CPER', // United States Copper Index Fund

      // US Equity ETFs
      'SPY', // S&P 500 ETF
      'QQQ', // Nasdaq 100 ETF
      'DIA', // Dow Jones Industrial Average
      'IWM', // Russell 2000
      'VTI', // Vanguard Total Stock Market

      // International ETFs
      'EEM', // iShares MSCI Emerging Markets
      'VWO', // Vanguard FTSE Emerging Markets
      'FXI', // iShares China Large-Cap
      'EWJ', // iShares MSCI Japan
    ];

    await this.fetchYahooFinanceData(etfSymbols);
  }

  // ==================== ALPHA VANTAGE (HISTORICAL DATA) ====================

  /**
   * Fetch historical NAV data from Alpha Vantage
   * Use for calculating returns and filling gaps
   */
  async fetchHistoricalData(
    symbol: string,
    outputSize: 'compact' | 'full' = 'compact'
  ): Promise<void> {
    if (!CONFIG.ALPHA_VANTAGE_KEY) {
      console.warn('⚠️  Alpha Vantage API key not configured');
      return;
    }

    await rateLimitedCall('ALPHA_VANTAGE');

    try {
      const url = `${CONFIG.ALPHA_VANTAGE_BASE}?function=TIME_SERIES_DAILY_ADJUSTED&symbol=${symbol}&outputsize=${outputSize}&apikey=${CONFIG.ALPHA_VANTAGE_KEY}`;

      const response = await axios.get(url);
      const timeSeries = response.data['Time Series (Daily)'] || {};

      const prices: Array<{ date: Date; nav: number; changePercent: number }> =
        [];

      for (const [dateStr, data] of Object.entries(timeSeries)) {
        const close = parseFloat((data as any)['5. adjusted close']);
        const prevClose = parseFloat((data as any)['4. close']);
        const changePercent = prevClose
          ? ((close - prevClose) / prevClose) * 100
          : 0;

        prices.push({
          date: new Date(dateStr),
          nav: close,
          changePercent,
        });
      }

      // Bulk insert price history
      for (const price of prices) {
        await this.savePriceData(
          symbol,
          price.nav,
          price.date,
          price.changePercent
        );
      }

      console.log(
        `✅ [Alpha Vantage] Saved ${prices.length} historical prices for ${symbol}`
      );
    } catch (error: any) {
      console.error(`❌ [Alpha Vantage] Error for ${symbol}:`, error.message);
    }
  }

  // ==================== FUND MANAGER DATA ====================

  /**
   * Fetch fund manager information
   * Sources: Fund house websites, Morningstar, manual data
   */
  async enrichFundManagerData(fundId: string): Promise<void> {
    console.log(`📊 Enriching manager data for ${fundId}`);

    const fund = await this.db.collection<Fund>('funds').findOne({ fundId });
    if (!fund) return;

    // Try to extract manager from fund house website
    const managerInfo = await this.scrapeFundManager(fund.fundHouse, fund.name);

    if (managerInfo) {
      const manager: Partial<FundManager> = {
        managerId: randomUUID(),
        name: managerInfo.name,
        bio: managerInfo.bio || '',
        experience: managerInfo.experience || 0,
        qualification: managerInfo.qualifications || [],
        currentFundHouse: fund.fundHouse,
        designation: managerInfo.designation || 'Fund Manager',
        joinedDate: new Date(managerInfo.joinedDate || Date.now()),
        fundsManaged: [
          {
            fundId: fund.fundId,
            fundName: fund.name,
            category: fund.category,
            subCategory: fund.subCategory,
            startDate: new Date(),
            aum: fund.aum,
            tenure: 0,
            returns: {
              oneYear: fund.returns.oneYear,
              threeYear: fund.returns.threeYear,
              fiveYear: fund.returns.fiveYear,
              sinceTenure: fund.returns.oneYear,
            },
          },
        ],
        totalAumManaged: fund.aum,
        averageReturns: {
          oneYear: fund.returns.oneYear,
          threeYear: fund.returns.threeYear,
          fiveYear: fund.returns.fiveYear,
        },
        awards: [],
        isActive: true,
        lastUpdated: new Date(),
        createdAt: new Date(),
      };

      // Upsert manager
      await this.db
        .collection<FundManager>('fundManagers')
        .updateOne({ name: manager.name }, { $set: manager }, { upsert: true });

      // Update fund with manager ID
      await this.db.collection<Fund>('funds').updateOne(
        { fundId },
        {
          $set: {
            fundManager: manager.name,
            fundManagerId: manager.managerId,
          },
        }
      );
    }
  }

  /**
   * Scrape fund manager info from fund house websites
   * This is a placeholder - implement actual scraping logic
   */
  private async scrapeFundManager(
    fundHouse: string,
    fundName: string
  ): Promise<any> {
    // TODO: Implement web scraping for each fund house
    // For now, return null (will be manually updated or from premium APIs)
    return null;
  }

  // ==================== HELPER METHODS ====================

  private async fetchYahooQuote(symbol: string): Promise<any> {
    const options = {
      method: 'GET',
      url: `https://${CONFIG.RAPIDAPI_HOST}/market/v2/get-quotes`,
      params: { region: 'US', symbols: symbol },
      headers: {
        'X-RapidAPI-Key': CONFIG.RAPIDAPI_KEY!,
        'X-RapidAPI-Host': CONFIG.RAPIDAPI_HOST,
      },
    };

    const response = await axios.request(options);
    return response.data.quoteResponse?.result?.[0] || {};
  }

  private async fetchYahooStatistics(symbol: string): Promise<any> {
    try {
      const options = {
        method: 'GET',
        url: `https://${CONFIG.RAPIDAPI_HOST}/stock/v2/get-statistics`,
        params: { symbol, region: 'US' },
        headers: {
          'X-RapidAPI-Key': CONFIG.RAPIDAPI_KEY!,
          'X-RapidAPI-Host': CONFIG.RAPIDAPI_HOST,
        },
      };

      const response = await axios.request(options);
      return response.data.defaultKeyStatistics || {};
    } catch (error) {
      return {};
    }
  }

  private async fetchYahooProfile(symbol: string): Promise<any> {
    try {
      const options = {
        method: 'GET',
        url: `https://${CONFIG.RAPIDAPI_HOST}/stock/v2/get-profile`,
        params: { symbol, region: 'US' },
        headers: {
          'X-RapidAPI-Key': CONFIG.RAPIDAPI_KEY!,
          'X-RapidAPI-Host': CONFIG.RAPIDAPI_HOST,
        },
      };

      const response = await axios.request(options);
      return response.data.assetProfile || {};
    } catch (error) {
      return {};
    }
  }

  private async fetchYahooHoldings(symbol: string): Promise<any[]> {
    try {
      const options = {
        method: 'GET',
        url: `https://${CONFIG.RAPIDAPI_HOST}/stock/v2/get-holdings`,
        params: { symbol },
        headers: {
          'X-RapidAPI-Key': CONFIG.RAPIDAPI_KEY!,
          'X-RapidAPI-Host': CONFIG.RAPIDAPI_HOST,
        },
      };

      const response = await axios.request(options);
      const holdings = response.data.holdings || [];

      return holdings.slice(0, 15).map((h: any) => ({
        name: h.holdingName,
        ticker: h.symbol,
        percentage: h.holdingPercent * 100,
        sector: h.sector || 'Unknown',
      }));
    } catch (error) {
      return [];
    }
  }

  private async savePriceData(
    fundId: string,
    nav: number,
    date: Date,
    changePercent: number = 0
  ): Promise<void> {
    const pricesCollection = this.db.collection<FundPrice>('fundPrices');

    const dateOnly = new Date(date.setHours(0, 0, 0, 0));

    await pricesCollection.updateOne(
      { fundId, date: dateOnly },
      {
        $set: {
          fundId,
          date: dateOnly,
          nav,
          changePercent,
          createdAt: new Date(),
        },
      },
      { upsert: true }
    );
  }

  private async bulkUpsertFunds(
    funds: Partial<Fund>[]
  ): Promise<{ added: number; updated: number }> {
    if (funds.length === 0) return { added: 0, updated: 0 };

    const fundsCollection = this.db.collection<Fund>('funds');
    const bulkOps = funds.map((fund) => ({
      updateOne: {
        filter: { fundId: fund.fundId },
        update: { $set: fund },
        upsert: true,
      },
    }));

    const result = await fundsCollection.bulkWrite(bulkOps);

    return {
      added: result.upsertedCount,
      updated: result.modifiedCount,
    };
  }

  // Category detection
  private detectCategory(name: string): Fund['category'] {
    const lower = name.toLowerCase();
    if (
      lower.includes('gold') ||
      lower.includes('silver') ||
      lower.includes('commodity') ||
      lower.includes('metal')
    )
      return 'commodity';
    if (
      lower.includes('debt') ||
      lower.includes('bond') ||
      lower.includes('gilt') ||
      lower.includes('liquid')
    )
      return 'debt';
    if (lower.includes('hybrid') || lower.includes('balanced')) return 'hybrid';
    if (
      lower.includes('etf') ||
      lower.includes('index') ||
      lower.includes('bees')
    )
      return 'etf';
    return 'equity';
  }

  private detectSubCategory(name: string): string {
    const lower = name.toLowerCase();
    if (lower.includes('large cap')) return 'Large Cap';
    if (lower.includes('mid cap')) return 'Mid Cap';
    if (lower.includes('small cap')) return 'Small Cap';
    if (lower.includes('multi cap') || lower.includes('multicap'))
      return 'Multi Cap';
    if (lower.includes('flexi cap')) return 'Flexi Cap';
    if (lower.includes('gold')) return 'Gold';
    if (lower.includes('silver')) return 'Silver';
    if (lower.includes('liquid')) return 'Liquid';
    return 'Other';
  }

  private categorizeFromYahoo(quote: any, profile: any): Fund['category'] {
    if (quote.quoteType === 'COMMODITY') return 'commodity';
    if (quote.quoteType === 'ETF') {
      const name = (quote.longName || '').toLowerCase();
      if (name.includes('bond') || name.includes('treasury')) return 'debt';
      if (
        name.includes('gold') ||
        name.includes('silver') ||
        name.includes('commodity')
      )
        return 'commodity';
      return 'etf';
    }
    return 'equity';
  }

  private subCategorizeFromYahoo(quote: any, profile: any): string {
    const name = (quote.longName || quote.shortName || '').toLowerCase();
    if (name.includes('gold')) return 'Gold';
    if (name.includes('silver')) return 'Silver';
    if (name.includes('oil') || name.includes('energy')) return 'Oil & Gas';
    if (name.includes('agriculture')) return 'Agriculture';
    return 'Other';
  }

  private estimateExpenseRatio(name: string): number {
    if (name.toLowerCase().includes('index')) return 0.5;
    if (name.toLowerCase().includes('etf')) return 0.5;
    if (name.toLowerCase().includes('equity')) return 2.0;
    if (name.toLowerCase().includes('debt')) return 1.0;
    return 1.5;
  }

  private estimateExitLoad(name: string): number {
    if (name.toLowerCase().includes('liquid')) return 0;
    if (name.toLowerCase().includes('etf')) return 0;
    return 1.0;
  }

  private extractFundHouse(name: string): string {
    const patterns = [
      { pattern: /nippon|reliance/i, house: 'Nippon India Mutual Fund' },
      { pattern: /icici/i, house: 'ICICI Prudential Mutual Fund' },
      { pattern: /hdfc/i, house: 'HDFC Mutual Fund' },
      { pattern: /sbi/i, house: 'SBI Mutual Fund' },
      { pattern: /axis/i, house: 'Axis Mutual Fund' },
      { pattern: /kotak/i, house: 'Kotak Mutual Fund' },
      {
        pattern: /aditya birla|absl/i,
        house: 'Aditya Birla Sun Life Mutual Fund',
      },
      { pattern: /uti/i, house: 'UTI Mutual Fund' },
      { pattern: /ishares/i, house: 'BlackRock iShares' },
      { pattern: /spdr/i, house: 'State Street Global Advisors' },
      { pattern: /vanguard/i, house: 'Vanguard' },
      { pattern: /invesco/i, house: 'Invesco' },
    ];

    for (const { pattern, house } of patterns) {
      if (pattern.test(name)) return house;
    }

    return 'Unknown';
  }

  private generateTags(name: string): string[] {
    const tags: string[] = [];
    const lower = name.toLowerCase();

    if (lower.includes('equity')) tags.push('equity', 'stocks');
    if (lower.includes('debt')) tags.push('debt', 'bonds', 'fixed income');
    if (lower.includes('gold'))
      tags.push('gold', 'precious metals', 'commodity');
    if (lower.includes('silver'))
      tags.push('silver', 'precious metals', 'commodity');
    if (lower.includes('index')) tags.push('index', 'passive');
    if (lower.includes('etf')) tags.push('etf', 'exchange traded');
    if (lower.includes('large cap')) tags.push('large cap', 'bluechip');
    if (lower.includes('mid cap')) tags.push('mid cap');
    if (lower.includes('small cap')) tags.push('small cap');
    if (lower.includes('tax')) tags.push('tax saving', 'elss');

    return [...new Set(tags)];
  }

  private generateSearchTerms(name: string): string[] {
    const terms = name.toLowerCase().split(/[\s\-]+/);
    const searchTerms: string[] = [name.toLowerCase()];

    searchTerms.push(...terms.filter((t) => t.length > 2));

    for (let i = 0; i < terms.length - 1; i++) {
      searchTerms.push(`${terms[i]} ${terms[i + 1]}`);
    }

    return [...new Set(searchTerms)];
  }

  private parseAMFIDate(dateStr: string): Date {
    const [day, month, year] = dateStr.split('-');
    const months: { [key: string]: number } = {
      Jan: 0,
      Feb: 1,
      Mar: 2,
      Apr: 3,
      May: 4,
      Jun: 5,
      Jul: 6,
      Aug: 7,
      Sep: 8,
      Oct: 9,
      Nov: 10,
      Dec: 11,
    };
    return new Date(parseInt(year), months[month], parseInt(day));
  }

  private calculateReturn(current: number, past: number, days: number): number {
    if (!past || past === 0) return 0;
    return ((current - past) / past) * 100;
  }

  private calculateDayReturn(priceInfo: any): number {
    if (!priceInfo) return 0;
    const change = priceInfo.regularMarketChange || 0;
    const previous = priceInfo.regularMarketPreviousClose || 0;
    return previous ? (change / previous) * 100 : 0;
  }
}

// Export default instance
export const fundDataService = (db: Db) => new ComprehensiveFundDataService(db);
