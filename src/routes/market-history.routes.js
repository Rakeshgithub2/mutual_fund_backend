/**
 * Market History API Routes
 * Provides historical data for market indices
 */

const express = require('express');
const router = express.Router();

// Symbol mapping for Indian indices
const SYMBOL_MAP = {
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
 */
router.get('/history/:symbol', async (req, res) => {
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

    // For now, always use mock data since Yahoo Finance requires API key
    console.warn(
      `⚠️ Using mock data for ${symbol} (Yahoo Finance requires RapidAPI key)`
    );

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

    // Generate mock data
    const mockData = generateMockHistoricalData(
      symbol,
      fromDate,
      toDate,
      period
    );

    res.json({
      success: true,
      data: mockData,
      source: 'generated',
      symbol: symbol,
      yahooSymbol: yahooSymbol,
      period: period,
      dataPoints: mockData.length,
      message:
        'Using generated historical data (Configure RAPIDAPI_KEY for real data)',
    });

    console.log(`✅ Sent ${mockData.length} data points for ${symbol}`);
  } catch (error) {
    console.error('❌ Error fetching historical data:', error);

    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
      symbol: req.params.symbol,
    });
  }
});

/**
 * Generate mock historical data
 */
function generateMockHistoricalData(symbol, fromDate, toDate, period) {
  const data = [];

  // Base values for different indices
  const baseValues = {
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

module.exports = router;
