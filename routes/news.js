const express = require('express');
const router = express.Router();
const newsService = require('../services/newsService');

/**
 * @route   GET /api/news
 * @desc    Get all financial news with language support
 * @access  Public
 */
router.get('/', async (req, res) => {
  try {
    const { language = 'english', limit } = req.query;

    const news = await newsService.getNews(language);

    console.log('Raw articles from DB:', news?.articles?.length || 0);
    if (news?.articles?.[0]) {
      console.log('Sample article keys:', Object.keys(news.articles[0]));
      console.log(
        'Sample article data:',
        JSON.stringify(news.articles[0], null, 2)
      );
    }

    // Map articles to frontend-expected format
    const mappedArticles = (news?.articles || []).map((article) => ({
      id: article?._id?.toString() || article?.id || '',
      title: article?.title || '',
      description: article?.summary || article?.description || '',
      content: article?.fullContent || article?.content || '',
      source: article?.source || '',
      category: article?.category || 'general',
      published_at:
        article?.publishedAt ||
        article?.published_at ||
        new Date().toISOString(),
      url: article?.url || '',
      image_url: article?.imageUrl || article?.image_url || '',
    }));

    console.log('Mapped articles count:', mappedArticles?.length);
    if (mappedArticles?.[0]) {
      console.log('Sample mapped:', JSON.stringify(mappedArticles[0], null, 2));
    }

    res.json({
      success: true,
      data: {
        articles: mappedArticles,
        lastUpdated: news?.lastUpdated || new Date(),
        totalCount: mappedArticles.length,
      },
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
 * @route   GET /api/news/:id
 * @desc    Get full article details by ID
 * @access  Public
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const article = await newsService.getArticleById(id);

    if (!article) {
      return res.status(404).json({
        success: false,
        message: 'Article not found',
      });
    }

    res.json({
      success: true,
      data: article,
    });
  } catch (error) {
    console.error('Error fetching article:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch article',
      error: error.message,
    });
  }
});

/**
 * @route   POST /api/news/refresh
 * @desc    Manually trigger news refresh
 * @access  Public
 */
router.post('/refresh', async (req, res) => {
  try {
    await newsService.fetchAndStoreNews();

    res.json({
      success: true,
      message: 'News refreshed successfully',
    });
  } catch (error) {
    console.error('Error refreshing news:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to refresh news',
      error: error.message,
    });
  }
});

module.exports = router;
