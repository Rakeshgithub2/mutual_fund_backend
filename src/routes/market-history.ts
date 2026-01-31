import { Router, Request, Response } from 'express';
import { YahooFinanceService } from '../services/yahooFinanceService';

const router = Router();
const yahooFinance = new YahooFinanceService();

// Symbol mapping for Indian indices
const SYMBOL_MAP: Record<string, string> = {
  NIFTY50: '^NSEI',
  SENSEX: '^BSESN',
  BANKNIFTY: '^NSEBANK',
  NIFTYIT: '^CNXIT',
  NIFTYMIDCAP: '^NSEMDCP50',
  NIFTYSMALLCAP: '^CNXSC',
  NIFTY100: '^CNX100',
  NIFTY200: '^CNX200',
  NIFTY500: '^CNX500',
  NIFTYNEXT50: 'NIFTYJR.NS',
};

/**
 * GET /api/market/history/:symbol
 * Fetch historical data for a market index
 * Query params:
 *   - period: 1D, 6M, 1Y, 3Y, 5Y, 10Y, 20Y, ALL (default: 1Y)
 */
router.get('/history/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const { period = '1Y' } = req.query;

    console.log(`📊 Fetching historical data for ${symbol} (${period})`);

    // Get Yahoo Finance symbol
    const yahooSymbol = SYMBOL_MAP[symbol.toUpperCase()];

    if (!yahooSymbol) {
      return res.status(400).json({
        success: false,
        error: `Symbol ${symbol} not supported`,
        supportedSymbols: Object.keys(SYMBOL_MAP),
      });
    }

    // Calculate date range based on period
    const toDate = new Date();
    const fromDate = new Date();

    switch (period) {
      case '1D':
        fromDate.setDate(toDate.getDate() - 1);
        break;
      case '6M':
        fromDate.setMonth(toDate.getMonth() - 6);
        break;
      case '1Y':
        fromDate.setFullYear(toDate.getFullYear() - 1);
        break;
      case '3Y':
        fromDate.setFullYear(toDate.getFullYear() - 3);
        break;
      case '5Y':
        fromDate.setFullYear(toDate.getFullYear() - 5);
        break;
      case '10Y':
        fromDate.setFullYear(toDate.getFullYear() - 10);
        break;
      case '20Y':
        fromDate.setFullYear(toDate.getFullYear() - 20);
        break;
      case 'ALL':
        fromDate.setFullYear(toDate.getFullYear() - 25);
        break;
      default:
        fromDate.setFullYear(toDate.getFullYear() - 1);
    }

    // Fetch from Yahoo Finance
    const result = await yahooFinance.fetchHistoricalData(
      yahooSymbol,
      fromDate.toISOString(),
      toDate.toISOString()
    );

    if (!result.success || !result.data) {
      console.warn(`⚠️ Yahoo Finance failed, using mock data for ${symbol}`);

      // Generate mock data as fallback
      const mockData = generateMockHistoricalData(
        symbol,
        fromDate,
        toDate,
        period as string
      );

      return res.json({
        success: true,
        data: mockData,
        source: 'mock',
        symbol: symbol,
        period: period,
        message: 'Using generated data (Yahoo Finance unavailable)',
      });
    }

    // Format the response
    const formattedData = result.data.map((item: any) => ({
      date: item.date,
      value: item.close,
      open: item.open,
      high: item.high,
      low: item.low,
      volume: item.volume,
    }));

    res.json({
      success: true,
      data: formattedData,
      source: 'yahoo-finance',
      symbol: symbol,
      yahooSymbol: yahooSymbol,
      period: period,
      dataPoints: formattedData.length,
    });

    console.log(`✅ Sent ${formattedData.length} data points for ${symbol}`);
  } catch (error: any) {
    console.error('❌ Error fetching historical data:', error);

    // Fallback to mock data on error
    const { symbol } = req.params;
    const { period = '1Y' } = req.query;

    const toDate = new Date();
    const fromDate = new Date();
    if (period === '1Y') fromDate.setFullYear(toDate.getFullYear() - 1);

    const mockData = generateMockHistoricalData(
      symbol,
      fromDate,
      toDate,
      period as string
    );

    res.json({
      success: true,
      data: mockData,
      source: 'mock',
      symbol: symbol,
      period: period,
      message: 'Using generated data due to API error',
      error: error.message,
    });
  }
});

/**
 * Generate mock historical data as fallback
 */
function generateMockHistoricalData(
  symbol: string,
  fromDate: Date,
  toDate: Date,
  period: string
): any[] {
  const data: any[] = [];

  // Base values for different indices
  const baseValues: Record<string, number> = {
    NIFTY50: 19500,
    SENSEX: 65000,
    BANKNIFTY: 45000,
    NIFTYIT: 30000,
    NIFTYMIDCAP: 35000,
    NIFTYSMALLCAP: 10000,
    NIFTY100: 19000,
    NIFTY200: 10500,
    NIFTY500: 17500,
    NIFTYNEXT50: 42000,
  };

  const baseValue = baseValues[symbol.toUpperCase()] || 20000;

  // Calculate number of data points
  let dataPoints = 252; // Default to 1 year of trading days
  const daysDiff = Math.floor(
    (toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (period === '1D') {
    dataPoints = 78; // 6.5 hours of trading at 5-minute intervals
  } else {
    dataPoints = Math.min(daysDiff, 252 * 25); // Cap at 25 years
  }

  // Generate data with realistic growth and volatility
  let currentValue = baseValue * 0.75; // Start at 75% of current value
  const targetValue = baseValue;
  const dailyGrowth = (targetValue - currentValue) / dataPoints;
  const volatility = baseValue * 0.015; // 1.5% daily volatility

  for (let i = 0; i < dataPoints; i++) {
    const date = new Date(fromDate);

    if (period === '1D') {
      date.setMinutes(fromDate.getMinutes() + i * 5);
    } else {
      date.setDate(
        fromDate.getDate() + Math.floor((i / dataPoints) * daysDiff)
      );
    }

    // Add growth trend plus random volatility
    const randomChange = (Math.random() - 0.48) * volatility;
    currentValue += dailyGrowth + randomChange;

    // Generate OHLC data
    const dayVolatility = volatility * 0.3;
    const open = currentValue + (Math.random() - 0.5) * dayVolatility;
    const close = currentValue;
    const high = Math.max(open, close) + Math.random() * dayVolatility;
    const low = Math.min(open, close) - Math.random() * dayVolatility;

    data.push({
      date: date.toISOString(),
      value: parseFloat(close.toFixed(2)),
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      volume: Math.floor(Math.random() * 1000000000) + 500000000,
    });
  }

  return data;
}

/**
 * GET /api/market/indices
 * Get current values for all major indices
 */
router.get('/indices', async (req: Request, res: Response) => {
  try {
    // This endpoint already exists in the main app
    // Redirect to /api/market/summary
    res.redirect('/api/market/summary');
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
