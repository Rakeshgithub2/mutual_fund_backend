/**
 * Market Indices Update Job
 * Runs every 5 minutes ONLY when market is open
 * Updates indices via external API and pushes to WebSocket clients
 */

import axios from 'axios';
import MarketCalendarService from '../services/market-calendar.service';
import MarketIndicesService, {
  IndexData,
} from '../services/market-indices.service';

export class MarketIndicesJob {
  /**
   * Fetch indices from NSE/BSE API
   * Replace with actual API endpoint
   */
  private static async fetchIndicesFromAPI(): Promise<IndexData[]> {
    // TODO: Replace with actual NSE/BSE API endpoint
    // This is a mock implementation

    try {
      // Example: Fetching from NSE unofficial API (replace with official source)
      const response = await axios.get(
        'https://www.nseindia.com/api/allIndices',
        {
          headers: {
            'User-Agent': 'Mozilla/5.0',
            Accept: 'application/json',
          },
          timeout: 10000,
        }
      );

      // Parse and format data
      const indices: IndexData[] = response.data.data.map((item: any) => ({
        indexName: item.indexName || item.index,
        symbol: this.normalizeSymbol(item.indexName || item.index),
        value: parseFloat(item.last || item.lastPrice || 0),
        change: parseFloat(item.change || 0),
        percentChange: parseFloat(item.percentChange || item.pChange || 0),
        high: parseFloat(item.high || 0),
        low: parseFloat(item.low || 0),
        open: parseFloat(item.open || 0),
        previousClose: parseFloat(item.previousClose || 0),
      }));

      return indices;
    } catch (error) {
      console.error('Error fetching indices from API:', error);

      // Fallback: Return mock data for development
      return this.getMockIndices();
    }
  }

  /**
   * Normalize index name to symbol
   */
  private static normalizeSymbol(indexName: string): string {
    const symbolMap: Record<string, string> = {
      'NIFTY 50': 'NIFTY50',
      'NIFTY BANK': 'NIFTYBANK',
      'NIFTY IT': 'NIFTYIT',
      'NIFTY NEXT 50': 'NIFTYNEXT50',
      'NIFTY MIDCAP 100': 'NIFTYMIDCAP',
      'NIFTY PHARMA': 'NIFTYPHARMA',
      'S&P BSE SENSEX': 'SENSEX',
    };

    return symbolMap[indexName] || indexName.replace(/\s+/g, '').toUpperCase();
  }

  /**
   * Mock data for development
   */
  private static getMockIndices(): IndexData[] {
    const baseValues = {
      NIFTY50: 22000,
      SENSEX: 72000,
      NIFTYBANK: 48000,
      NIFTYNEXT50: 65000,
      NIFTYMIDCAP: 52000,
      NIFTYIT: 35000,
      NIFTYPHARMA: 18000,
    };

    return Object.entries(baseValues).map(([symbol, baseValue]) => {
      const randomChange = (Math.random() - 0.5) * 500;
      const value = baseValue + randomChange;
      const percentChange = (randomChange / baseValue) * 100;

      return {
        indexName: symbol,
        symbol,
        value: parseFloat(value.toFixed(2)),
        change: parseFloat(randomChange.toFixed(2)),
        percentChange: parseFloat(percentChange.toFixed(2)),
        high: value + Math.random() * 100,
        low: value - Math.random() * 100,
        open: value - Math.random() * 50,
        previousClose: baseValue,
      };
    });
  }

  /**
   * Main job execution
   */
  static async execute() {
    console.log('[Market Indices Job] Starting...');

    // Step 1: Check if market is open
    const marketStatus = await MarketCalendarService.isMarketOpen();

    if (!marketStatus.isOpen) {
      console.log(
        `[Market Indices Job] Market is closed: ${marketStatus.reason}`
      );
      return {
        success: false,
        reason: marketStatus.reason,
        action: 'skipped',
      };
    }

    console.log('[Market Indices Job] Market is OPEN. Fetching data...');

    // Step 2: Fetch latest indices data
    const indices = await this.fetchIndicesFromAPI();

    if (indices.length === 0) {
      console.error('[Market Indices Job] No indices data received');
      return {
        success: false,
        reason: 'No data received from API',
      };
    }

    // Step 3: Update MongoDB (overwrites old values)
    const result = await MarketIndicesService.updateMultiple(indices, true);

    console.log(`[Market Indices Job] Updated ${indices.length} indices`);

    // Step 4: Emit to WebSocket clients (if available)
    try {
      const { emitMarketUpdate } =
        await import('../websocket/market-websocket');
      emitMarketUpdate(indices);
    } catch (error) {
      console.log('[Market Indices Job] WebSocket not available yet');
    }

    return {
      success: true,
      indicesUpdated: indices.length,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Manual trigger for testing
   */
  static async runManually() {
    return await this.execute();
  }
}

export default MarketIndicesJob;
