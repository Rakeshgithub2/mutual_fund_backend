/**
 * ═══════════════════════════════════════════════════════════════════════
 * NEWS API ROUTES
 * ═══════════════════════════════════════════════════════════════════════
 */

const express = require('express');
const router = express.Router();
const MarketNews = require('../models/MarketNews.model');

/**
 * GET /api/news
 * Get latest news articles
 *
 * Query params:
 * - category: stock|mutualfund|gold|finance
 * - limit: number of articles (default: 20)
 */
router.get('/', async (req, res) => {
  try {
    const { category, limit = 20 } = req.query;

    const query = {};
    if (category) {
      query.category = category;
    }

    const news = await MarketNews.find(query)
      .sort({ published_at: -1 })
      .limit(parseInt(limit))
      .lean();

    res.json({
      success: true,
      count: news.length,
      data: news,
    });
  } catch (error) {
    console.error('Error fetching news:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch news',
      error: error.message,
    });
  }
});

/**
 * GET /api/news/:id
 * Get single news article
 */
router.get('/:id', async (req, res) => {
  try {
    const news = await MarketNews.findById(req.params.id).lean();

    if (!news) {
      return res.status(404).json({
        success: false,
        message: 'News article not found',
      });
    }

    res.json({
      success: true,
      data: news,
    });
  } catch (error) {
    console.error('Error fetching news:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch news',
      error: error.message,
    });
  }
});

/**
 * POST /api/news/refresh
 * Manually trigger news update
 */
router.post('/refresh', async (req, res) => {
  try {
    console.log('📰 Manual news refresh triggered...');
    const axios = require('axios');

    const NEWSDATA_API_KEY = process.env.NEWSDATA_API_KEY;

    if (!NEWSDATA_API_KEY) {
      return res.status(400).json({
        success: false,
        message: 'NEWSDATA_API_KEY not configured',
      });
    }

    // Fetch fresh news from NewsData.io
    const response = await axios.get('https://newsdata.io/api/1/news', {
      params: {
        apikey: NEWSDATA_API_KEY,
        q: 'mutual funds OR stock market OR investment OR sensex OR nifty',
        language: 'en',
        country: 'in',
        category: 'business',
        size: 20,
      },
      timeout: 15000,
    });

    if (response.data && response.data.results) {
      // Delete old news
      await MarketNews.deleteMany({});

      // Insert new news
      const newsToInsert = response.data.results.map((article) => ({
        title: article.title || 'Untitled',
        description: article.description || article.content || 'No description',
        source: article.source_id || article.source_name || 'NewsData',
        url: article.link || article.url || '#',
        category: categorizeNews(article.title, article.description),
        published_at: article.pubDate ? new Date(article.pubDate) : new Date(),
      }));

      await MarketNews.insertMany(newsToInsert);

      res.json({
        success: true,
        message: 'News refreshed successfully',
        count: newsToInsert.length,
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'No news data received from API',
      });
    }
  } catch (error) {
    console.error('Error refreshing news:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to refresh news',
      error: error.message,
    });
  }
});

// Helper function to categorize news
function categorizeNews(title, description) {
  const text = `${title} ${description}`.toLowerCase();

  if (
    text.includes('stock') ||
    text.includes('equity') ||
    text.includes('share')
  ) {
    return 'stock';
  } else if (
    text.includes('mutual fund') ||
    text.includes('mf') ||
    text.includes('sip')
  ) {
    return 'mutualfund';
  } else if (text.includes('gold') || text.includes('commodity')) {
    return 'gold';
  } else {
    return 'finance';
  }
}

module.exports = router;
