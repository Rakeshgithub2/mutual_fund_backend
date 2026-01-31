import { Router } from 'express';
import { Request, Response } from 'express';

const router = Router();

// Mock market indices data (you can replace with real API later)
const marketIndices = [
  {
    id: 'nifty50',
    name: 'NIFTY 50',
    shortName: 'NIFTY',
    value: 19674.25,
    change: 125.5,
    changePercent: 0.64,
    high: 19698.4,
    low: 19534.8,
    open: 19548.75,
    previousClose: 19548.75,
    volume: '2.1B',
    marketCap: '₹120.5 Lakh Cr',
    lastUpdated: new Date().toISOString(),
    constituents: 50,
    description: 'Top 50 companies by market capitalization',
  },
  {
    id: 'sensex',
    name: 'S&P BSE SENSEX',
    shortName: 'SENSEX',
    value: 65930.77,
    change: 389.45,
    changePercent: 0.59,
    high: 66025.35,
    low: 65541.32,
    open: 65541.32,
    previousClose: 65541.32,
    volume: '1.8B',
    marketCap: '₹285.2 Lakh Cr',
    lastUpdated: new Date().toISOString(),
    constituents: 30,
    description: 'Top 30 companies listed on BSE',
  },
  {
    id: 'niftynext50',
    name: 'NIFTY NEXT 50',
    shortName: 'NEXT50',
    value: 44289.65,
    change: -156.35,
    changePercent: -0.35,
    high: 44445.2,
    low: 44125.8,
    open: 44446.0,
    previousClose: 44446.0,
    volume: '845M',
    marketCap: '₹45.8 Lakh Cr',
    lastUpdated: new Date().toISOString(),
    constituents: 50,
    description: 'Next 50 companies after NIFTY 50',
  },
  {
    id: 'niftymidcap',
    name: 'NIFTY MIDCAP 100',
    shortName: 'MIDCAP',
    value: 34567.8,
    change: 245.6,
    changePercent: 0.72,
    high: 34620.4,
    low: 34322.2,
    open: 34322.2,
    previousClose: 34322.2,
    volume: '1.2B',
    marketCap: '₹65.3 Lakh Cr',
    lastUpdated: new Date().toISOString(),
    constituents: 100,
    description: 'Top 100 mid-cap companies',
  },
];

// GET /api/market-indices
router.get('/', async (req: Request, res: Response) => {
  try {
    console.log('📈 GET /api/market-indices - Request received');

    // Add some realistic variations to make data look live
    const liveIndices = marketIndices.map((index) => ({
      ...index,
      value: index.value + (Math.random() - 0.5) * 100,
      change: index.change + (Math.random() - 0.5) * 20,
      changePercent: index.changePercent + (Math.random() - 0.5) * 0.5,
      lastUpdated: new Date().toISOString(),
    }));

    res.json({
      success: true,
      message: 'Market indices retrieved successfully',
      data: liveIndices,
      timestamp: new Date().toISOString(),
    });

    console.log('✅ Market indices data sent successfully');
  } catch (error) {
    console.error('❌ Error fetching market indices:', error);
    res.status(500).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to fetch market indices',
    });
  }
});

export default router;
