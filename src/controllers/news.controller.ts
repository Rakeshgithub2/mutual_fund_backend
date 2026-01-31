import { Request, Response } from 'express';
import { newsAggregationService } from '../services/newsAggregation.service';
import { News } from '../db/schemas';

/**
 * News Controller
 *
 * Endpoints:
 * - GET /api/news - Get latest news
 * - GET /api/news/category/:category - Get news by category
 * - GET /api/news/search - Search news
 * - POST /api/news/refresh - Refresh news (admin)
 */

/**
 * Get latest news
 * @route GET /api/news
 */
export const getLatestNews = async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;

    const news = await newsAggregationService.fetchLatestNews(limit);

    return res.json({
      success: true,
      message: 'Latest news retrieved successfully',
      data: news,
      metadata: {
        count: news.length,
        verifiedOnly: true,
        nonPromotional: true,
      },
    });
  } catch (error: any) {
    console.error('Error fetching latest news:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch news',
      error: error.message,
    });
  }
};

/**
 * Get news by category
 * @route GET /api/news/category/:category
 */
export const getNewsByCategory = async (req: Request, res: Response) => {
  try {
    const { category } = req.params;
    const limit = parseInt(req.query.limit as string) || 20;

    // Validate category
    const validCategories: News['category'][] = [
      'mutual_fund',
      'equity_market',
      'debt_market',
      'commodity',
      'amc_announcement',
      'regulatory',
      'general',
    ];

    if (!validCategories.includes(category as News['category'])) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category',
        validCategories,
      });
    }

    const news = await newsAggregationService.getNewsByCategory(
      category as News['category'],
      limit
    );

    return res.json({
      success: true,
      message: `${category} news retrieved successfully`,
      data: news,
      metadata: {
        count: news.length,
        category,
      },
    });
  } catch (error: any) {
    console.error(
      `Error fetching news for category ${req.params.category}:`,
      error
    );
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch news',
      error: error.message,
    });
  }
};

/**
 * Search news
 * @route GET /api/news/search
 */
export const searchNews = async (req: Request, res: Response) => {
  try {
    const query = req.query.q as string;
    const limit = parseInt(req.query.limit as string) || 20;

    if (!query) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required',
      });
    }

    const news = await newsAggregationService.searchNews(query, limit);

    return res.json({
      success: true,
      message: 'Search results retrieved successfully',
      data: news,
      metadata: {
        count: news.length,
        query,
      },
    });
  } catch (error: any) {
    console.error('Error searching news:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to search news',
      error: error.message,
    });
  }
};

/**
 * Refresh news from all sources (admin endpoint)
 * @route POST /api/news/refresh
 */
export const refreshNews = async (req: Request, res: Response) => {
  try {
    await newsAggregationService.aggregateNewsFromAllSources();

    return res.json({
      success: true,
      message: 'News refreshed successfully from all verified sources',
    });
  } catch (error: any) {
    console.error('Error refreshing news:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to refresh news',
      error: error.message,
    });
  }
};
