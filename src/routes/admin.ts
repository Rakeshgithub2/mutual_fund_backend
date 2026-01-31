import { Router } from 'express';
import { Request, Response } from 'express';
import { newsService } from '../services/newsService';
import { formatResponse } from '../utils/response';

const router = Router();

// Refresh news from real API
router.post('/refresh/news', async (req: Request, res: Response) => {
  try {
    console.log('📰 Manual news refresh triggered');

    // Check if API key is configured
    if (!process.env.NEWSDATA_API_KEY) {
      return res.json(
        formatResponse(
          {
            processed: 0,
            errors: [
              'NewsData.io API key not configured. Please add NEWSDATA_API_KEY to .env file.',
            ],
            message:
              'Using static news data. To fetch real news, configure NEWSDATA_API_KEY in .env file.',
            apiInfo: 'Get free API key from: https://newsdata.io/register',
          },
          'News API key not configured'
        )
      );
    }

    const result = await newsService.ingestNews('business', [
      'mutual fund india',
      'mutual funds',
      'sip investment',
      'equity market india',
      'stock market india',
      'sensex',
      'nifty',
      'elss',
      'portfolio management',
    ]);

    return res.json(
      formatResponse(
        {
          processed: result.processed,
          errors: result.errors,
          message:
            result.processed > 0
              ? `Successfully fetched ${result.processed} news articles from NewsData.io API`
              : 'No new articles fetched. Check API key or try again later.',
        },
        result.processed > 0
          ? 'News refresh completed successfully'
          : 'News refresh completed with errors'
      )
    );
  } catch (error) {
    console.error('Error refreshing news:', error);
    return res.status(500).json({
      statusCode: 500,
      message: 'Failed to refresh news',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get refresh status
router.get('/refresh/status', async (req: Request, res: Response) => {
  try {
    const newsCount = await newsService.getRecentNews(1);

    return res.json(
      formatResponse(
        {
          newsApiConfigured: !!process.env.NEWSDATA_API_KEY,
          newsCount: newsCount.length,
          lastNewsDate: newsCount[0]?.publishedAt || null,
        },
        'Refresh status retrieved'
      )
    );
  } catch (error) {
    console.error('Error getting refresh status:', error);
    return res.status(500).json({
      statusCode: 500,
      message: 'Failed to get refresh status',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
