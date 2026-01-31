import { Router, Request, Response } from 'express';
import { mongodb } from '../db/mongodb';

const router = Router();

// Get all market indices
router.get('/indices', async (req: Request, res: Response) => {
  try {
    await mongodb.connect();
    const collection = mongodb.getCollection('marketIndices');

    const indices = await collection
      .find({ isActive: true })
      .sort({ displayOrder: 1 })
      .toArray();

    res.json({
      success: true,
      data: indices,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error fetching market indices:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch market indices',
      message: error.message,
    });
  }
});

// Get market summary
router.get('/summary', async (req: Request, res: Response) => {
  try {
    await mongodb.connect();
    const collection = mongodb.getCollection('marketIndices');

    const indices = await collection
      .find({ isActive: true, isBroadMarket: true })
      .sort({ displayOrder: 1 })
      .limit(5)
      .toArray();

    res.json({
      success: true,
      data: indices,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error fetching market summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch market summary',
      message: error.message,
    });
  }
});

// Get market status
router.get('/status', async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const day = now.getDay();

    // Market hours: Mon-Fri 9:15 AM - 3:30 PM IST
    const isWeekday = day >= 1 && day <= 5;
    const currentTime = hours * 60 + minutes;
    const marketOpen = 9 * 60 + 15; // 9:15 AM
    const marketClose = 15 * 60 + 30; // 3:30 PM

    const isOpen =
      isWeekday && currentTime >= marketOpen && currentTime <= marketClose;

    res.json({
      success: true,
      data: {
        isOpen,
        message: isOpen
          ? 'Market is currently open'
          : 'Market is currently closed',
        nextOpen: !isOpen ? getNextMarketOpen(now) : null,
        timestamp: now.toISOString(),
      },
    });
  } catch (error: any) {
    console.error('Error fetching market status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch market status',
      message: error.message,
    });
  }
});

// Get index by symbol
router.get('/indices/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    await mongodb.connect();
    const collection = mongodb.getCollection('marketIndices');

    const index = await collection.findOne({
      symbol: symbol.toUpperCase(),
      isActive: true,
    });

    if (!index) {
      return res.status(404).json({
        success: false,
        error: 'Index not found',
        message: `No index found with symbol: ${symbol}`,
      });
    }

    res.json({
      success: true,
      data: index,
    });
  } catch (error: any) {
    console.error('Error fetching index:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch index',
      message: error.message,
    });
  }
});

function getNextMarketOpen(now: Date): string {
  const nextDay = new Date(now);
  nextDay.setDate(nextDay.getDate() + 1);
  nextDay.setHours(9, 15, 0, 0);

  // Skip weekends
  while (nextDay.getDay() === 0 || nextDay.getDay() === 6) {
    nextDay.setDate(nextDay.getDate() + 1);
  }

  return nextDay.toISOString();
}

export default router;
