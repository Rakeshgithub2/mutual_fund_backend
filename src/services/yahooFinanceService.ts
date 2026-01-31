// Using native fetch available in Node.js 18+

interface YahooFinanceResponse {
  chart: {
    result: Array<{
      meta: {
        symbol: string;
        currency: string;
        exchangeName: string;
      };
      timestamp: number[];
      indicators: {
        quote: Array<{
          close: number[];
          high: number[];
          low: number[];
          open: number[];
          volume: number[];
        }>;
      };
    }>;
  };
}

export class YahooFinanceService {
  private readonly rapidApiHost =
    process.env.RAPIDAPI_HOST || 'apidojo-yahoo-finance-v1.p.rapidapi.com';
  private readonly rapidApiKey = process.env.RAPIDAPI_KEY || '';

  async fetchHistoricalData(
    symbol: string,
    from: string,
    to: string
  ): Promise<{ success: boolean; data?: any[]; error?: string }> {
    try {
      if (!this.rapidApiKey) {
        throw new Error('RAPIDAPI_KEY is not configured');
      }

      const fromTimestamp = Math.floor(new Date(from).getTime() / 1000);
      const toTimestamp = Math.floor(new Date(to).getTime() / 1000);

      const url = `https://${this.rapidApiHost}/v8/finance/chart/${symbol}?period1=${fromTimestamp}&period2=${toTimestamp}&interval=1d`;

      console.log(
        `Fetching Yahoo Finance data for ${symbol} from ${from} to ${to}`
      );

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-RapidAPI-Host': this.rapidApiHost,
          'X-RapidAPI-Key': this.rapidApiKey,
        },
      });

      if (!response.ok) {
        throw new Error(
          `Yahoo Finance API error: ${response.status} ${response.statusText}`
        );
      }

      const data: YahooFinanceResponse =
        (await response.json()) as YahooFinanceResponse;

      if (!data.chart?.result?.[0]) {
        throw new Error('No data returned from Yahoo Finance API');
      }

      const result = data.chart.result[0];
      const timestamps = result.timestamp;
      const prices = result.indicators.quote[0];

      const historicalData = timestamps
        .map((timestamp, index) => ({
          date: new Date(timestamp * 1000),
          open: prices.open[index],
          high: prices.high[index],
          low: prices.low[index],
          close: prices.close[index],
          volume: prices.volume[index],
          symbol: result.meta.symbol,
        }))
        .filter((item) => item.close !== null && item.close !== undefined);

      console.log(
        `Successfully fetched ${historicalData.length} data points for ${symbol}`
      );

      return {
        success: true,
        data: historicalData,
      };
    } catch (error) {
      console.error(`Yahoo Finance fetch error for ${symbol}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async fetchBenchmarkData(
    benchmarks: string[] = ['NIFTY50', 'SENSEX', 'NIFTY100']
  ): Promise<{
    processed: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let processed = 0;

    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - 30); // Last 30 days
    const toDate = new Date();

    for (const benchmark of benchmarks) {
      try {
        const result = await this.fetchHistoricalData(
          benchmark,
          fromDate.toISOString(),
          toDate.toISOString()
        );

        if (result.success && result.data) {
          // Here you would typically store the benchmark data
          // For now, we'll just log it
          console.log(
            `Processed ${result.data.length} records for ${benchmark}`
          );
          processed += result.data.length;
        } else {
          errors.push(`Failed to fetch ${benchmark}: ${result.error}`);
        }
      } catch (error) {
        const errorMsg = `Error processing ${benchmark}: ${error}`;
        console.error(errorMsg);
        errors.push(errorMsg);
      }
    }

    return { processed, errors };
  }
}

export const yahooFinanceService = new YahooFinanceService();
