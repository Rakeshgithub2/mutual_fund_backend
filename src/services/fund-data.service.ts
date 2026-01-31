import axios from 'axios';
import { Db } from 'mongodb';
import { Fund, FundPrice } from '../db/schemas';
import { randomUUID } from 'crypto';

/**
 * Data Ingestion Service for Mutual Funds
 * Fetches real fund data from multiple sources:
 * - AMFI (India mutual funds)
 * - Yahoo Finance via RapidAPI
 * - NSE India (for ETFs)
 */

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const RAPIDAPI_HOST = process.env.RAPIDAPI_HOST;
const AMFI_NAV_URL =
  process.env.AMFI_NAV_URL || 'https://www.amfiindia.com/spages/NAVAll.txt';

// Rate limiting
const API_CALL_DELAY = 1000; // 1 second between calls
let lastApiCall = 0;

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function rateLimitedApiCall(): Promise<void> {
  const now = Date.now();
  const timeSinceLastCall = now - lastApiCall;

  if (timeSinceLastCall < API_CALL_DELAY) {
    await delay(API_CALL_DELAY - timeSinceLastCall);
  }

  lastApiCall = Date.now();
}

export class FundDataService {
  private db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  /**
   * Fetch all AMFI mutual funds data
   * Returns 100+ Indian mutual funds
   */
  async fetchAMFIFunds(): Promise<void> {
    console.log('📊 Fetching AMFI mutual funds data...');

    try {
      const response = await axios.get(AMFI_NAV_URL, {
        timeout: 30000,
      });

      const lines = response.data.split('\n');
      const funds: Partial<Fund>[] = [];
      let currentFundHouse = '';

      for (const line of lines) {
        const trimmedLine = line.trim();

        // Fund house name
        if (trimmedLine && !trimmedLine.includes(';')) {
          currentFundHouse = trimmedLine;
          continue;
        }

        // Fund data: SchemeCode;ISIN Div Payout/ISIN Growth;ISIN Div Reinvestment;Scheme Name;Net Asset Value;Date
        if (trimmedLine.includes(';')) {
          const parts = trimmedLine.split(';');
          if (parts.length >= 6) {
            const [schemeCode, isinDiv, isinGrowth, schemeName, nav, dateStr] =
              parts;

            // Parse scheme name to extract category
            const category = this.extractCategory(schemeName);
            const subCategory = this.extractSubCategory(schemeName);

            const fund: Partial<Fund> = {
              fundId: isinGrowth || isinDiv || `AMFI_${schemeCode}`,
              name: schemeName.trim(),
              category: this.mapToCategory(category),
              subCategory,
              fundType: 'mutual_fund',
              fundHouse: currentFundHouse,
              currentNav: parseFloat(nav),
              navDate: this.parseAMFIDate(dateStr),
              dataSource: 'AMFI',
              isActive: true,
              lastUpdated: new Date(),
              createdAt: new Date(),
              // Default values - will be enriched later
              aum: 0,
              expenseRatio: 1.5,
              exitLoad: 0,
              minInvestment: 5000,
              sipMinAmount: 500,
              fundManager: 'To be updated',
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

            funds.push(fund);

            // Also save price data
            await this.saveFundPrice(
              fund.fundId!,
              fund.currentNav!,
              fund.navDate!
            );
          }
        }
      }

      // Filter for quality funds (remove very small or inactive)
      const qualityFunds = funds.filter(
        (f) => f.name && f.fundId && f.currentNav && f.currentNav > 0
      );

      console.log(`✅ Fetched ${qualityFunds.length} AMFI funds`);

      // Upsert funds to database
      await this.upsertFunds(qualityFunds);
    } catch (error: any) {
      console.error('❌ Error fetching AMFI data:', error.message);
      throw error;
    }
  }

  /**
   * Fetch popular Indian ETFs and commodity funds from Yahoo Finance
   */
  async fetchIndianETFs(): Promise<void> {
    console.log('📊 Fetching Indian ETFs and commodity funds...');

    // Popular Indian ETFs and commodity funds
    const etfTickers = [
      // Equity ETFs
      {
        ticker: 'NIFTYBEES.NS',
        name: 'Nippon India ETF Nifty BeES',
        category: 'equity',
      },
      {
        ticker: 'JUNIORBEES.NS',
        name: 'Nippon India ETF Junior BeES',
        category: 'equity',
      },
      {
        ticker: 'BANKBEES.NS',
        name: 'Nippon India ETF Bank BeES',
        category: 'equity',
      },
      {
        ticker: 'PSUBNKBEES.NS',
        name: 'Nippon India ETF PSU Bank BeES',
        category: 'equity',
      },
      {
        ticker: 'INFRABEES.NS',
        name: 'Nippon India ETF Infra BeES',
        category: 'equity',
      },
      {
        ticker: 'ITBEES.NS',
        name: 'Nippon India ETF IT BeES',
        category: 'equity',
      },
      {
        ticker: 'PHARMABEES.NS',
        name: 'Nippon India ETF Pharma BeES',
        category: 'equity',
      },

      // Gold ETFs
      {
        ticker: 'GOLDBEES.NS',
        name: 'Nippon India ETF Gold BeES',
        category: 'commodity',
        subCategory: 'Gold',
      },
      {
        ticker: 'GOLDSHARE.NS',
        name: 'ICICI Prudential Gold ETF',
        category: 'commodity',
        subCategory: 'Gold',
      },
      {
        ticker: 'AXISGOLD.NS',
        name: 'Axis Gold ETF',
        category: 'commodity',
        subCategory: 'Gold',
      },
      {
        ticker: 'HDFCGOLD.NS',
        name: 'HDFC Gold ETF',
        category: 'commodity',
        subCategory: 'Gold',
      },
      {
        ticker: 'SBIETFGOLD.NS',
        name: 'SBI Gold ETF',
        category: 'commodity',
        subCategory: 'Gold',
      },
      {
        ticker: 'KOTAKGOLD.NS',
        name: 'Kotak Gold ETF',
        category: 'commodity',
        subCategory: 'Gold',
      },

      // Silver ETFs
      {
        ticker: 'SILVERBEES.NS',
        name: 'Nippon India ETF Silver BeES',
        category: 'commodity',
        subCategory: 'Silver',
      },
      {
        ticker: 'SILVER.NS',
        name: 'ICICI Prudential Silver ETF',
        category: 'commodity',
        subCategory: 'Silver',
      },

      // International ETFs
      {
        ticker: 'HNGSNGBEES.NS',
        name: 'Nippon India ETF Hang Seng BeES',
        category: 'equity',
      },
      {
        ticker: 'NETFIT.NS',
        name: 'Nippon India ETF Nasdaq 100',
        category: 'equity',
      },

      // Liquid/Debt ETFs
      {
        ticker: 'LIQUIDBEES.NS',
        name: 'Nippon India ETF Liquid BeES',
        category: 'debt',
      },
      { ticker: 'SETFNIF50.NS', name: 'SBI ETF Nifty 50', category: 'equity' },
      {
        ticker: 'ICICIB22.NS',
        name: 'ICICI Prudential Bharat 22 ETF',
        category: 'equity',
      },
    ];

    const funds: Partial<Fund>[] = [];

    for (const etf of etfTickers) {
      try {
        await rateLimitedApiCall();

        const quote = await this.fetchYahooQuote(etf.ticker);
        const stats = await this.fetchYahooStatistics(etf.ticker);

        const fund: Partial<Fund> = {
          fundId: etf.ticker,
          name: etf.name,
          category: etf.category as any,
          subCategory: etf.subCategory || this.extractSubCategory(etf.name),
          fundType: 'etf',
          fundHouse: this.extractFundHouse(etf.name),
          currentNav: quote.regularMarketPrice,
          previousNav: quote.regularMarketPreviousClose,
          navDate: new Date(quote.regularMarketTime * 1000),
          aum: stats.totalAssets || 0,
          expenseRatio: stats.annualReportExpenseRatio * 100 || 0.5,
          exitLoad: 0,
          minInvestment: quote.regularMarketPrice * 1, // 1 unit
          sipMinAmount: quote.regularMarketPrice * 1,
          fundManager: 'ETF - Passive',
          returns: {
            day: quote.regularMarketChangePercent || 0,
            week: (stats.fiftyTwoWeekChange * 7) / 52 || 0,
            month: stats.fiftyTwoWeekChange / 12 || 0,
            threeMonth: stats.fiftyTwoWeekChange / 4 || 0,
            sixMonth: stats.fiftyTwoWeekChange / 2 || 0,
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
          holdings: [],
          sectorAllocation: [],
          ratings: {},
          tags: this.generateTags(etf.name),
          searchTerms: this.generateSearchTerms(etf.name),
          popularity: stats.averageVolume || 0,
          isActive: true,
          dataSource: 'Yahoo Finance',
          lastUpdated: new Date(),
          createdAt: new Date(),
        };

        funds.push(fund);

        // Save price data
        await this.saveFundPrice(
          fund.fundId!,
          fund.currentNav!,
          fund.navDate!,
          quote.regularMarketChangePercent
        );

        console.log(`✅ Fetched ${etf.name}`);
      } catch (error: any) {
        console.error(`❌ Error fetching ${etf.ticker}:`, error.message);
      }
    }

    console.log(`✅ Fetched ${funds.length} ETFs`);
    await this.upsertFunds(funds);
  }

  /**
   * Fetch quote data from Yahoo Finance via RapidAPI
   */
  private async fetchYahooQuote(symbol: string): Promise<any> {
    const options = {
      method: 'GET',
      url: `https://${RAPIDAPI_HOST}/market/v2/get-quotes`,
      params: { region: 'IN', symbols: symbol },
      headers: {
        'X-RapidAPI-Key': RAPIDAPI_KEY,
        'X-RapidAPI-Host': RAPIDAPI_HOST,
      },
    };

    const response = await axios.request(options);
    return response.data.quoteResponse.result[0] || {};
  }

  /**
   * Fetch statistics from Yahoo Finance via RapidAPI
   */
  private async fetchYahooStatistics(symbol: string): Promise<any> {
    const options = {
      method: 'GET',
      url: `https://${RAPIDAPI_HOST}/stock/v2/get-statistics`,
      params: { symbol, region: 'IN' },
      headers: {
        'X-RapidAPI-Key': RAPIDAPI_KEY,
        'X-RapidAPI-Host': RAPIDAPI_HOST,
      },
    };

    try {
      const response = await axios.request(options);
      return response.data.defaultKeyStatistics || {};
    } catch (error) {
      return {};
    }
  }

  /**
   * Save fund price to database
   */
  private async saveFundPrice(
    fundId: string,
    nav: number,
    date: Date,
    changePercent: number = 0
  ): Promise<void> {
    const pricesCollection = this.db.collection<FundPrice>('fundPrices');

    await pricesCollection.updateOne(
      { fundId, date: { $gte: new Date(date.setHours(0, 0, 0, 0)) } },
      {
        $set: {
          fundId,
          date,
          nav,
          changePercent,
          createdAt: new Date(),
        },
      },
      { upsert: true }
    );
  }

  /**
   * Upsert funds to database
   */
  private async upsertFunds(funds: Partial<Fund>[]): Promise<void> {
    const fundsCollection = this.db.collection<Fund>('funds');

    const bulkOps = funds.map((fund) => ({
      updateOne: {
        filter: { fundId: fund.fundId },
        update: { $set: fund },
        upsert: true,
      },
    }));

    if (bulkOps.length > 0) {
      await fundsCollection.bulkWrite(bulkOps);
      console.log(`✅ Upserted ${funds.length} funds to database`);
    }
  }

  // Helper methods
  private parseAMFIDate(dateStr: string): Date {
    // Format: DD-MMM-YYYY (e.g., "17-Nov-2025")
    const [day, month, year] = dateStr.split('-');
    const months: any = {
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

  private extractCategory(name: string): string {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('equity') || lowerName.includes('stock'))
      return 'equity';
    if (lowerName.includes('debt') || lowerName.includes('bond')) return 'debt';
    if (lowerName.includes('hybrid') || lowerName.includes('balanced'))
      return 'hybrid';
    if (
      lowerName.includes('gold') ||
      lowerName.includes('silver') ||
      lowerName.includes('commodity')
    )
      return 'commodity';
    if (lowerName.includes('etf') || lowerName.includes('index')) return 'etf';
    return 'equity';
  }

  private extractSubCategory(name: string): string {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('large cap')) return 'Large Cap';
    if (lowerName.includes('mid cap')) return 'Mid Cap';
    if (lowerName.includes('small cap')) return 'Small Cap';
    if (lowerName.includes('multi cap') || lowerName.includes('multicap'))
      return 'Multi Cap';
    if (lowerName.includes('flexi cap')) return 'Flexi Cap';
    if (lowerName.includes('gold')) return 'Gold';
    if (lowerName.includes('silver')) return 'Silver';
    if (lowerName.includes('liquid')) return 'Liquid';
    if (lowerName.includes('gilt')) return 'Gilt';
    return 'Other';
  }

  private mapToCategory(category: string): Fund['category'] {
    const map: any = {
      equity: 'equity',
      debt: 'debt',
      hybrid: 'hybrid',
      commodity: 'commodity',
      etf: 'etf',
      index: 'index',
    };
    return map[category.toLowerCase()] || 'equity';
  }

  private extractFundHouse(name: string): string {
    // Extract fund house from ETF name
    if (name.includes('Nippon')) return 'Nippon India Mutual Fund';
    if (name.includes('ICICI')) return 'ICICI Prudential Mutual Fund';
    if (name.includes('HDFC')) return 'HDFC Mutual Fund';
    if (name.includes('SBI')) return 'SBI Mutual Fund';
    if (name.includes('Axis')) return 'Axis Mutual Fund';
    if (name.includes('Kotak')) return 'Kotak Mutual Fund';
    return 'Unknown';
  }

  private generateTags(name: string): string[] {
    const tags: string[] = [];
    const lowerName = name.toLowerCase();

    if (lowerName.includes('equity')) tags.push('equity', 'stocks');
    if (lowerName.includes('debt')) tags.push('debt', 'bonds', 'fixed income');
    if (lowerName.includes('gold'))
      tags.push('gold', 'precious metals', 'commodity');
    if (lowerName.includes('silver'))
      tags.push('silver', 'precious metals', 'commodity');
    if (lowerName.includes('liquid')) tags.push('liquid', 'short term');
    if (lowerName.includes('tax')) tags.push('tax saving', 'elss');
    if (lowerName.includes('dividend')) tags.push('dividend', 'income');
    if (lowerName.includes('growth'))
      tags.push('growth', 'capital appreciation');
    if (lowerName.includes('index')) tags.push('index', 'passive');
    if (lowerName.includes('etf')) tags.push('etf', 'exchange traded');

    return [...new Set(tags)];
  }

  private generateSearchTerms(name: string): string[] {
    // Generate search variations
    const terms = name.toLowerCase().split(/[\s\-]+/);
    const searchTerms: string[] = [name.toLowerCase()];

    // Add individual words
    searchTerms.push(...terms.filter((t) => t.length > 2));

    // Add bigrams
    for (let i = 0; i < terms.length - 1; i++) {
      searchTerms.push(`${terms[i]} ${terms[i + 1]}`);
    }

    return [...new Set(searchTerms)];
  }
}

/**
 * Wrapper function for cron job usage
 */
export async function fetchAndUpdateFunds(): Promise<void> {
  const { mongodb } = await import('../db/mongodb');
  const db = mongodb.getDb();
  const service = new FundDataService(db);

  console.log('🔄 Fetching and updating funds...');
  await service.fetchAMFIFunds();
  console.log('✅ Funds updated successfully');
}
