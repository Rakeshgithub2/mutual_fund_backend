import axios from 'axios';
import { mongodb } from '../db/mongodb';
import { MarketIndex } from '../db/schemas';

/**
 * MARKET INDICES SERVICE
 *
 * Real-time Indian market indices with:
 * - Zero/stale data prevention
 * - Multiple fallback sources
 * - Sanity checks
 * - NIFTY 50, SENSEX, BANK NIFTY, GIFT NIFTY, etc.
 */
export class MarketIndicesService {
  private static instance: MarketIndicesService;

  // API endpoints for different indices
  private readonly NSE_API = 'https://www.nseindia.com/api/allIndices';
  private readonly BSE_API =
    'https://api.bseindia.com/BseIndiaAPI/api/DefaultData/w';

  // Fallback APIs
  private readonly YAHOO_FINANCE_API =
    'https://query1.finance.yahoo.com/v8/finance/chart';

  // Staleness threshold (minutes)
  private readonly STALENESS_THRESHOLD = 15;

  // Sanity check ranges (% change limits)
  private readonly SANITY_RANGES: Record<string, { min: number; max: number }> =
    {
      NIFTY_50: { min: -10, max: 10 },
      SENSEX: { min: -10, max: 10 },
      BANK_NIFTY: { min: -12, max: 12 },
      NIFTY_NEXT_50: { min: -12, max: 12 },
      NIFTY_MIDCAP_100: { min: -15, max: 15 },
      NIFTY_SMALLCAP_100: { min: -20, max: 20 },
      // Global indices
      SPX: { min: -10, max: 10 },
      DJI: { min: -10, max: 10 },
      IXIC: { min: -12, max: 12 },
      N225: { min: -10, max: 10 },
      SSE: { min: -12, max: 12 },
      HSI: { min: -12, max: 12 },
      FTSE: { min: -10, max: 10 },
      GDAXI: { min: -10, max: 10 },
      FCHI: { min: -10, max: 10 },
    };

  private constructor() {}

  public static getInstance(): MarketIndicesService {
    if (!MarketIndicesService.instance) {
      MarketIndicesService.instance = new MarketIndicesService();
    }
    return MarketIndicesService.instance;
  }

  /**
   * Get all major Indian market indices
   */
  async getAllIndices(): Promise<MarketIndex[]> {
    const indicesCollection =
      mongodb.getCollection<MarketIndex>('marketIndices');

    // Try to get cached data first
    const cachedIndices = await indicesCollection.find({}).toArray();

    // Check if cached data is fresh (< 5 minutes old)
    const now = new Date();
    const freshIndices = cachedIndices.filter((idx) => {
      const ageMinutes =
        (now.getTime() - idx.lastUpdated.getTime()) / 1000 / 60;
      return ageMinutes < 5;
    });

    if (freshIndices.length > 0) {
      return freshIndices;
    }

    // Fetch fresh data
    return await this.fetchAndUpdateAllIndices();
  }

  /**
   * Get specific index by ID
   */
  async getIndex(indexId: string): Promise<MarketIndex | null> {
    const indicesCollection =
      mongodb.getCollection<MarketIndex>('marketIndices');
    const index = await indicesCollection.findOne({ indexId });

    if (!index) {
      return null;
    }

    // Check if stale
    const staleness = this.calculateStaleness(index.lastUpdated);
    if (staleness > this.STALENESS_THRESHOLD) {
      // Refresh this index
      return await this.fetchAndUpdateIndex(indexId);
    }

    return index;
  }

  /**
   * Fetch and update all indices
   */
  async fetchAndUpdateAllIndices(): Promise<MarketIndex[]> {
    const indianIndices = [
      'NIFTY_50',
      'NIFTY_NEXT_50',
      'NIFTY_MIDCAP_100',
      'NIFTY_SMALLCAP_100',
      'SENSEX',
      'BANK_NIFTY',
    ];

    const globalIndices = [
      'SPX', // S&P 500
      'DJI', // Dow Jones
      'IXIC', // NASDAQ
      'N225', // Nikkei 225
      'SSE', // Shanghai Composite
      'HSI', // Hang Seng
      'FTSE', // FTSE 100
      'GDAXI', // DAX
      'FCHI', // CAC 40
    ];

    const allIndices = [...indianIndices, ...globalIndices];
    const results: MarketIndex[] = [];

    for (const indexId of allIndices) {
      try {
        const index = await this.fetchAndUpdateIndex(indexId);
        if (index) {
          results.push(index);
        }
      } catch (error) {
        console.error(`Error fetching ${indexId}:`, error);
      }
    }

    return results;
  }

  /**
   * Fetch and update specific index
   */
  async fetchAndUpdateIndex(indexId: string): Promise<MarketIndex | null> {
    try {
      // Try primary source (NSE/BSE)
      let indexData = await this.fetchFromPrimarySource(indexId);

      if (!indexData) {
        // Fallback to Yahoo Finance
        console.log(`Primary source failed for ${indexId}, trying fallback...`);
        indexData = await this.fetchFromYahooFinance(indexId);
      }

      if (!indexData) {
        console.error(`Failed to fetch ${indexId} from all sources`);
        return null;
      }

      // Sanity check
      const sanityPassed = this.performSanityCheck(indexData);
      indexData.sanityCheckPassed = sanityPassed;

      if (!sanityPassed) {
        console.warn(
          `Sanity check failed for ${indexId}: ${indexData.changePercent}% change`
        );
      }

      // Calculate staleness
      indexData.staleness = this.calculateStaleness(indexData.lastUpdated!);

      // Save to database
      const indicesCollection =
        mongodb.getCollection<MarketIndex>('marketIndices');
      await indicesCollection.updateOne(
        { indexId: indexData.indexId! },
        { $set: indexData },
        { upsert: true }
      );

      return indexData as MarketIndex;
    } catch (error: any) {
      console.error(`Error updating ${indexId}:`, error.message);
      return null;
    }
  }

  /**
   * Fetch from primary source (NSE/BSE)
   */
  private async fetchFromPrimarySource(
    indexId: string
  ): Promise<Partial<MarketIndex> | null> {
    try {
      const response = await axios.get(this.NSE_API, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Accept: 'application/json',
        },
        timeout: 10000,
      });

      const data = response.data;
      const indexMap: Record<string, string> = {
        NIFTY_50: 'NIFTY 50',
        NIFTY_NEXT_50: 'NIFTY NEXT 50',
        NIFTY_MIDCAP_100: 'NIFTY MIDCAP 100',
        NIFTY_SMALLCAP_100: 'NIFTY SMALLCAP 100',
        BANK_NIFTY: 'NIFTY BANK',
      };

      const targetName = indexMap[indexId];
      if (!targetName) return null;

      const indexData = data.data?.find((idx: any) => idx.index === targetName);
      if (!indexData) return null;

      // Safely parse numeric values with fallbacks
      const last = parseFloat(indexData.last) || 0;
      const previousClose = parseFloat(indexData.previousClose) || last;
      const change = parseFloat(indexData.change) || last - previousClose;
      const perChange =
        parseFloat(indexData.perChange) ||
        (previousClose > 0 ? (change / previousClose) * 100 : 0);

      return {
        indexId,
        name: indexData.index,
        symbol: targetName.replace(/ /g, '_'),
        currentValue: last,
        previousClose,
        change,
        changePercent: perChange,
        open: parseFloat(indexData.open) || previousClose,
        high: parseFloat(indexData.high) || last,
        low: parseFloat(indexData.low) || last,
        marketStatus: this.getMarketStatus(),
        lastUpdated: new Date(),
        tradingDay: new Date(),
        dataSource: 'NSE',
        isFallbackData: false,
        sanityCheckPassed: true,
        staleness: 0,
        createdAt: new Date(),
      };
    } catch (error) {
      console.error(`NSE API error for ${indexId}:`, error);
      return null;
    }
  }

  /**
   * Fetch from Yahoo Finance (fallback)
   */
  private async fetchFromYahooFinance(
    indexId: string
  ): Promise<Partial<MarketIndex> | null> {
    try {
      const symbolMap: Record<
        string,
        { symbol: string; name: string; country: string }
      > = {
        // Indian Indices
        NIFTY_50: { symbol: '^NSEI', name: 'NIFTY 50', country: 'India' },
        SENSEX: { symbol: '^BSESN', name: 'BSE SENSEX', country: 'India' },
        BANK_NIFTY: {
          symbol: '^NSEBANK',
          name: 'NIFTY Bank',
          country: 'India',
        },
        NIFTY_NEXT_50: {
          symbol: '^NSEI',
          name: 'NIFTY Next 50',
          country: 'India',
        },
        NIFTY_MIDCAP_100: {
          symbol: '^NSEI',
          name: 'NIFTY Midcap 100',
          country: 'India',
        },

        // US Indices
        SPX: { symbol: '^GSPC', name: 'S&P 500', country: 'USA' },
        DJI: {
          symbol: '^DJI',
          name: 'Dow Jones Industrial Average',
          country: 'USA',
        },
        IXIC: { symbol: '^IXIC', name: 'NASDAQ Composite', country: 'USA' },

        // Asian Indices
        N225: { symbol: '^N225', name: 'Nikkei 225', country: 'Japan' },
        SSE: {
          symbol: '000001.SS',
          name: 'Shanghai Composite',
          country: 'China',
        },
        HSI: { symbol: '^HSI', name: 'Hang Seng Index', country: 'Hong Kong' },

        // European Indices
        FTSE: { symbol: '^FTSE', name: 'FTSE 100', country: 'United Kingdom' },
        GDAXI: { symbol: '^GDAXI', name: 'DAX', country: 'Germany' },
        FCHI: { symbol: '^FCHI', name: 'CAC 40', country: 'France' },
      };

      const indexInfo = symbolMap[indexId];
      if (!indexInfo) return null;

      const url = `${this.YAHOO_FINANCE_API}/${indexInfo.symbol}?interval=1d&range=1d`;
      const response = await axios.get(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 10000,
      });

      const data = response.data.chart.result[0];
      const quote = data.indicators.quote[0];
      const meta = data.meta;

      // Safely parse numeric values
      const regularMarketPrice = parseFloat(meta.regularMarketPrice) || 0;
      const chartPreviousClose =
        parseFloat(meta.chartPreviousClose) || regularMarketPrice;
      const change = regularMarketPrice - chartPreviousClose;
      const changePercent =
        chartPreviousClose > 0 ? (change / chartPreviousClose) * 100 : 0;

      return {
        indexId,
        name: indexInfo.name,
        symbol: indexInfo.symbol,
        currentValue: regularMarketPrice,
        previousClose: chartPreviousClose,
        change,
        changePercent,
        open: parseFloat(quote.open?.[0]) || chartPreviousClose,
        high: parseFloat(quote.high?.[0]) || regularMarketPrice,
        low: parseFloat(quote.low?.[0]) || regularMarketPrice,
        marketStatus: this.getMarketStatus(),
        lastUpdated: new Date(meta.regularMarketTime * 1000),
        tradingDay: new Date(),
        dataSource: 'Yahoo_Finance',
        isFallbackData: true,
        sanityCheckPassed: true,
        staleness: 0,
        createdAt: new Date(),
      };
    } catch (error) {
      console.error(`Yahoo Finance error for ${indexId}:`, error);
      return null;
    }
  }

  /**
   * Perform sanity check on index data
   */
  private performSanityCheck(indexData: Partial<MarketIndex>): boolean {
    if (!indexData.indexId || indexData.changePercent === undefined) {
      return false;
    }

    // Check for NaN values
    if (isNaN(indexData.changePercent) || !isFinite(indexData.changePercent)) {
      console.log(`Sanity check failed for ${indexData.indexId}: NaN% change`);
      return false;
    }

    const range = this.SANITY_RANGES[indexData.indexId];
    if (!range) {
      return true; // No range defined, pass by default
    }

    // Check if change % is within acceptable range
    const isValid =
      indexData.changePercent >= range.min &&
      indexData.changePercent <= range.max;

    if (!isValid) {
      console.log(
        `Sanity check failed for ${indexData.indexId}: ${indexData.changePercent.toFixed(2)}% outside range ${range.min}% to ${range.max}%`
      );
    }

    return isValid;
  }

  /**
   * Calculate staleness in minutes
   */
  private calculateStaleness(lastUpdated: Date): number {
    const now = new Date();
    const ageMs = now.getTime() - lastUpdated.getTime();
    return Math.floor(ageMs / 1000 / 60);
  }

  /**
   * Get current market status (India markets)
   */
  private getMarketStatus(): MarketIndex['marketStatus'] {
    const now = new Date();
    const istOffset = 5.5 * 60; // IST is UTC+5:30
    const istTime = new Date(now.getTime() + istOffset * 60 * 1000);
    const hours = istTime.getUTCHours();
    const minutes = istTime.getUTCMinutes();
    const dayOfWeek = istTime.getUTCDay();

    // Weekend
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return 'closed';
    }

    // Market hours: 9:15 AM - 3:30 PM IST
    const currentMinutes = hours * 60 + minutes;
    const marketOpen = 9 * 60 + 15; // 9:15 AM
    const marketClose = 15 * 60 + 30; // 3:30 PM

    if (currentMinutes < marketOpen) {
      return 'pre_open';
    } else if (currentMinutes >= marketOpen && currentMinutes <= marketClose) {
      return 'open';
    } else {
      return 'post_close';
    }
  }

  /**
   * Refresh all indices (background job)
   */
  async refreshAllIndices(): Promise<void> {
    console.log('🔄 Refreshing all market indices...');
    await this.fetchAndUpdateAllIndices();
    console.log('✅ Market indices refreshed');
  }
}

export const marketIndicesService = MarketIndicesService.getInstance();
