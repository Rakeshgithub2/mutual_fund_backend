const axios = require('axios');
const { mongodb } = require('../src/db/mongodb');
const { translate } = require('./translationService');

// NewsData.io API configuration
// Get your free API key from https://newsdata.io (200 requests/day)
const NEWSDATA_API_KEY = process.env.NEWSDATA_API_KEY;

// News count configuration - use 8 for testing, 20 for production/scheduled
const NEWS_COUNT_TESTING = 8;
const NEWS_COUNT_PRODUCTION = 20;

// Financial keywords for filtering
const FINANCIAL_KEYWORDS = [
  'stock market',
  'mutual fund',
  'investment',
  'trading',
  'NSE',
  'BSE',
  'Sensex',
  'Nifty',
  'equity',
  'bonds',
  'shares',
  'portfolio',
  'dividend',
  'IPO',
  'market',
  'finance',
  'economy',
  'commodities',
  'gold',
  'crude oil',
  'cryptocurrency',
  'bitcoin',
  'ethereum',
];

/**
 * Fetch news from NewsData.io API
 * @param {number} count - Number of articles to fetch (default: 20 for scheduled, 8 for testing)
 */
const fetchFinancialNews = async (count = NEWS_COUNT_PRODUCTION) => {
  try {
    const NEWSDATA_API_KEY = process.env.NEWSDATA_API_KEY;

    if (!NEWSDATA_API_KEY || NEWSDATA_API_KEY === 'YOUR_KEY') {
      console.log('⚠️  NewsData API key not configured, using mock data');
      return getMockNews();
    }

    const response = await axios.get('https://newsdata.io/api/1/news', {
      params: {
        apikey: NEWSDATA_API_KEY,
        q: 'mutual funds OR stock market OR investment OR gold OR sensex OR nifty',
        language: 'en',
        country: 'in',
        category: 'business',
        size: count,
      },
      timeout: 15000,
    });

    if (!response.data || !response.data.results) {
      console.log('⚠️  Invalid API response, using mock data');
      return getMockNews();
    }

    // Convert NewsData.io format to our format
    return response.data.results.map((article) => ({
      title: article.title,
      description: article.description || article.title,
      content: article.content || article.description || article.title,
      source: { name: article.source_id || 'NewsData' },
      publishedAt: article.pubDate,
      urlToImage: article.image_url,
      url: article.link,
      author: article.creator ? article.creator[0] : null,
    }));
  } catch (error) {
    console.error('Error fetching from NewsData API:', error.message);
    // Fallback to mock data if API fails
    return getMockNews();
  }
};

/**
 * Categorize news article
 */
const categorizeArticle = (title, description) => {
  const content = (title + ' ' + description).toLowerCase();

  if (
    content.includes('stock') ||
    content.includes('share') ||
    content.includes('equity')
  ) {
    return 'stocks';
  } else if (
    content.includes('mutual fund') ||
    content.includes('sip') ||
    content.includes('investment')
  ) {
    return 'mutual-funds';
  } else if (
    content.includes('market') ||
    content.includes('sensex') ||
    content.includes('nifty')
  ) {
    return 'market';
  } else if (
    content.includes('economy') ||
    content.includes('gdp') ||
    content.includes('inflation')
  ) {
    return 'economy';
  } else if (
    content.includes('gold') ||
    content.includes('silver') ||
    content.includes('crude')
  ) {
    return 'commodities';
  } else if (
    content.includes('crypto') ||
    content.includes('bitcoin') ||
    content.includes('ethereum')
  ) {
    return 'crypto';
  }

  return 'market';
};

/**
 * Process and filter articles
 * @param {Array} articles - Raw articles from API
 * @param {number} count - Number of articles to return
 */
const processArticles = (articles, count = NEWS_COUNT_PRODUCTION) => {
  return articles
    .filter((article) => {
      // Filter out articles without title or description
      if (!article.title || !article.description) return false;

      // Check if article is finance-related
      const content = (article.title + ' ' + article.description).toLowerCase();
      return FINANCIAL_KEYWORDS.some((keyword) => content.includes(keyword));
    })
    .slice(0, count) // Take top N articles
    .map((article, index) => ({
      id: `news_${Date.now()}_${index}`,
      title: article.title,
      summary: article.description || article.title,
      fullContent: article.content || article.description || article.title,
      source: article.source?.name || 'Financial Times',
      category: categorizeArticle(article.title, article.description),
      publishedAt: article.publishedAt || new Date().toISOString(),
      imageUrl: article.urlToImage,
      url: article.url,
      language: 'english',
    }));
};

/**
 * Fetch and store news in database
 * Deletes old news before adding new ones
 * @param {boolean} isScheduled - If true, fetch 20 articles (scheduled job). If false, fetch 8 (testing)
 */
const fetchAndStoreNews = async (isScheduled = true) => {
  const articleCount = isScheduled ? NEWS_COUNT_PRODUCTION : NEWS_COUNT_TESTING;
  try {
    console.log('\n📰 ============================================');
    console.log(
      '📰 Starting Daily News Fetch at',
      new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
    );
    console.log('📰 ============================================\n');

    const db = mongodb.db;
    const newsCollection = db.collection('news');
    const translationsCollection = db.collection('news_translations');

    // Delete all old news first to save memory
    console.log('🗑️  Deleting old news articles to save memory...');
    const deleteResult = await newsCollection.deleteMany({});
    console.log(`✅ Deleted ${deleteResult.deletedCount} old articles`);

    // Delete old translations to save memory
    console.log('🗑️  Deleting old translations...');
    const deleteTransResult = await translationsCollection.deleteMany({});
    console.log(
      `✅ Deleted ${deleteTransResult.deletedCount} old translations`
    );

    // Fetch new news from API
    console.log(
      `📡 Fetching fresh news from API (mode: ${isScheduled ? 'scheduled/20' : 'testing/8'})...`
    );
    const rawArticles = await fetchFinancialNews(articleCount);
    console.log(`📥 Received ${rawArticles.length} raw articles from API`);

    // Process and filter to get exactly the requested count
    const processedArticles = processArticles(rawArticles, articleCount);
    console.log(
      `✅ Processed ${processedArticles.length} articles after filtering`
    );

    if (processedArticles.length === 0) {
      console.log('⚠️  No valid articles found, using mock data as fallback');
      const mockArticles = getMockNews();
      const processedMock = processNewsArticles(mockArticles);

      const newsDoc = {
        articles: processedMock,
        lastUpdated: new Date(),
        fetchedAt: new Date(),
        source: 'mock_data',
      };

      await newsCollection.replaceOne(
        { _id: 'latest_news' },
        { _id: 'latest_news', ...newsDoc },
        { upsert: true }
      );

      console.log(`✅ Stored ${processedMock.length} mock articles`);
      return processedMock;
    }

    // Store new articles in database with timestamp
    const newsDoc = {
      articles: processedArticles,
      lastUpdated: new Date(),
      fetchedAt: new Date(),
      totalArticles: processedArticles.length,
      source: 'news_api',
    };

    // Use replaceOne with upsert to ensure we always have the latest_news document
    await newsCollection.replaceOne(
      { _id: 'latest_news' },
      { _id: 'latest_news', ...newsDoc },
      { upsert: true }
    );

    console.log('💾 Stored articles in database');

    // Store translations for new articles
    console.log('🌐 Generating translations...');
    await storeTranslations(processedArticles);

    console.log('\n✅ ============================================');
    console.log(
      `✅ Successfully stored ${processedArticles.length} NEW articles`
    );
    console.log(`✅ Old articles deleted to save memory`);
    console.log(`✅ Next fetch: Tomorrow at 6:00 AM IST`);
    console.log('✅ ============================================\n');

    return processedArticles;
  } catch (error) {
    console.error('\n❌ ============================================');
    console.error('❌ Error fetching and storing news:', error.message);
    console.error('❌ ============================================\n');
    throw error;
  }
};

/**
 * Store translated versions
 */
const storeTranslations = async (articles) => {
  try {
    const db = mongodb.db;
    const translationsCollection = db.collection('news_translations');

    for (const article of articles) {
      // Translate to Hindi
      const hindiTitle = await translate(article.title, 'hindi');
      const hindiSummary = await translate(article.summary, 'hindi');

      // Translate to Kannada
      const kannadaTitle = await translate(article.title, 'kannada');
      const kannadaSummary = await translate(article.summary, 'kannada');

      // Store translations
      await translationsCollection.updateOne(
        { articleId: article.id },
        {
          $set: {
            articleId: article.id,
            translations: {
              hindi: {
                title: hindiTitle,
                summary: hindiSummary,
              },
              kannada: {
                title: kannadaTitle,
                summary: kannadaSummary,
              },
            },
            updatedAt: new Date(),
          },
        },
        { upsert: true }
      );
    }

    console.log('✅ Translations stored successfully');
  } catch (error) {
    console.error('Error storing translations:', error);
    // Don't throw - translations are optional
  }
};

/**
 * Get all news with language support
 */
const getNews = async (language = 'english') => {
  try {
    const db = mongodb.db;
    const MarketNews = require('../src/models/MarketNews.model');

    // Get latest news from MarketNews collection
    const articles = await MarketNews.find()
      .sort({ published_at: -1 })
      .limit(50)
      .lean();

    if (!articles || articles.length === 0) {
      return {
        articles: [],
        lastUpdated: new Date(),
      };
    }

    // Transform _id to id for frontend
    const transformedArticles = articles.map((article) => ({
      ...article,
      id: article._id.toString(),
    }));

    // If language is not English, get translations
    if (language !== 'english' && language !== 'en') {
      const translationsCollection = db.collection('news_translations');
      const langMap = {
        hindi: 'hi',
        hi: 'hi',
        kannada: 'kn',
        kn: 'kn',
      };

      const langCode = langMap[language.toLowerCase()] || language;

      // Get translations
      const translations = await translationsCollection
        .find({ language: langCode })
        .toArray();

      // Create translation map
      const translationMap = {};
      translations.forEach((t) => {
        translationMap[t.newsId] = t;
      });

      // Apply translations
      const translatedArticles = transformedArticles.map((article) => {
        const translation = translationMap[article.id];
        if (translation) {
          return {
            ...article,
            title: translation.title,
            description: translation.summary || article.description,
          };
        }
        return article;
      });

      return {
        articles: translatedArticles,
        lastUpdated: new Date(),
      };
    }

    return {
      articles: transformedArticles,
      lastUpdated: new Date(),
    };
  } catch (error) {
    console.error('Error getting news:', error);
    throw error;
  }
};

/**
 * Get news by ID with language support
 */
const getNewsById = async (id, language = 'english') => {
  try {
    const db = mongodb.db;
    const newsCollection = db.collection('news');
    const translationsCollection = db.collection('news_translations');

    // Get latest news
    const newsDoc = await newsCollection.findOne({ _id: 'latest_news' });

    if (!newsDoc || !newsDoc.articles) {
      // If no news in DB, fetch fresh
      const articles = await fetchAndStoreNews();
      return {
        articles,
        lastUpdated: new Date(),
      };
    }

    let articles = newsDoc.articles;

    // Apply translations if needed
    if (language !== 'english') {
      const translations = await translationsCollection.find({}).toArray();
      const translationMap = {};

      translations.forEach((t) => {
        translationMap[t.articleId] = t.translations[language];
      });

      articles = articles.map((article) => {
        if (translationMap[article.id]) {
          return {
            ...article,
            title: translationMap[article.id].title || article.title,
            summary: translationMap[article.id].summary || article.summary,
            language,
          };
        }
        return { ...article, language };
      });
    }

    return {
      articles,
      lastUpdated: newsDoc.lastUpdated,
    };
  } catch (error) {
    console.error('Error getting news:', error);
    throw error;
  }
};

/**
 * Get article by ID
 */
const getArticleById = async (id) => {
  try {
    const db = mongodb.db;
    const newsCollection = db.collection('news');

    const newsDoc = await newsCollection.findOne({ _id: 'latest_news' });

    if (!newsDoc || !newsDoc.articles) {
      return null;
    }

    // Find article by id field
    const article = newsDoc.articles.find((a) => a.id === id);

    if (article) {
      // Return article with proper structure mapping stored fields to expected fields
      return {
        id: article.id,
        title: article.title,
        description: article.summary || article.description,
        content: article.fullContent || article.content || article.summary,
        source: article.source,
        source_name: article.source,
        category: article.category,
        published_at: article.publishedAt || article.published_at,
        url: article.url,
        image_url: article.imageUrl || article.urlToImage || article.image_url,
        author: article.author,
      };
    }

    return null;
  } catch (error) {
    console.error('Error getting article by ID:', error);
    throw error;
  }
};

/**
 * Get related news
 */
const getRelatedNews = async (category, excludeId, limit = 5) => {
  try {
    const db = mongodb.db;
    const newsCollection = db.collection('news');

    const newsDoc = await newsCollection.findOne({ _id: 'latest_news' });

    if (!newsDoc || !newsDoc.articles) {
      return [];
    }

    return newsDoc.articles
      .filter((a) => a.category === category && a.id !== excludeId)
      .slice(0, limit)
      .map((a) => ({
        id: a.id,
        title: a.title,
        category: a.category,
        publishedAt: a.publishedAt,
      }));
  } catch (error) {
    console.error('Error getting related news:', error);
    return [];
  }
};

/**
 * Mock news data (fallback) - 20 diverse financial news articles
 */
const getMockNews = () => {
  const now = new Date();
  const hoursAgo = (hours) =>
    new Date(now.getTime() - hours * 3600000).toISOString();

  return [
    {
      title: 'Sensex Hits All-Time High: Market Rally Continues',
      description:
        'The BSE Sensex crossed 75,000 mark today driven by strong buying in banking and IT stocks.',
      content: 'Detailed analysis of market performance...',
      source: { name: 'Economic Times' },
      publishedAt: hoursAgo(1),
      urlToImage:
        'https://via.placeholder.com/400x200/0088cc/ffffff?text=Market+Rally',
      url: '#',
    },
    {
      title: 'Top 10 Mutual Funds to Invest in 2024',
      description:
        'Here are the best performing mutual funds across categories for long-term wealth creation.',
      content: 'Fund analysis and recommendations...',
      source: { name: 'Money Control' },
      publishedAt: hoursAgo(2),
      urlToImage:
        'https://via.placeholder.com/400x200/00aa00/ffffff?text=Mutual+Funds',
      url: '#',
    },
    {
      title: 'Gold Prices Surge to New Highs Amid Global Uncertainty',
      description:
        'Gold reaches ₹65,000 per 10 grams as investors seek safe haven assets.',
      content: 'Commodity market analysis...',
      source: { name: 'Mint' },
      publishedAt: hoursAgo(3),
      urlToImage:
        'https://via.placeholder.com/400x200/ffaa00/ffffff?text=Gold+Prices',
      url: '#',
    },
    {
      title: 'RBI Keeps Repo Rate Unchanged at 6.5%',
      description:
        'Central bank maintains status quo on policy rates amid inflation concerns.',
      content: 'Monetary policy impact...',
      source: { name: 'Business Standard' },
      publishedAt: hoursAgo(4),
      url: '#',
    },
    {
      title: 'Tech Stocks Lead Nifty 50 to Record High',
      description:
        'IT sector stocks surge on strong quarterly earnings and outlook.',
      content: 'Sector performance review...',
      source: { name: 'CNBC TV18' },
      publishedAt: hoursAgo(5),
      url: '#',
    },
    {
      title: 'SIP Inflows Hit Record ₹18,000 Crore in November',
      description:
        'Retail investors continue to pour money into equity mutual funds through SIPs.',
      content: 'Investment trends analysis...',
      source: { name: 'Economic Times' },
      publishedAt: hoursAgo(6),
      url: '#',
    },
    {
      title: 'Crude Oil Falls Below $75 on Demand Concerns',
      description:
        'Global oil prices decline amid worries about economic slowdown.',
      content: 'Energy market update...',
      source: { name: 'Bloomberg Quint' },
      publishedAt: hoursAgo(7),
      url: '#',
    },
    {
      title: 'Banking Stocks Rally on Strong Q3 Results',
      description:
        'Major banks report healthy profit growth and improving asset quality.',
      content: 'Banking sector analysis...',
      source: { name: 'Money Control' },
      publishedAt: hoursAgo(8),
      url: '#',
    },
    {
      title: 'Bitcoin Crosses $45,000: Crypto Market Rebounds',
      description:
        'Cryptocurrency markets see renewed interest from institutional investors.',
      content: 'Crypto market trends...',
      source: { name: 'CoinDesk India' },
      publishedAt: hoursAgo(9),
      url: '#',
    },
    {
      title: 'India GDP Growth Projected at 7.3% for FY2024',
      description: 'Economic growth remains robust despite global headwinds.',
      content: 'Economic outlook...',
      source: { name: 'Mint' },
      publishedAt: hoursAgo(10),
      url: '#',
    },
    {
      title: 'FII Investment in Indian Markets Reaches $12 Billion',
      description:
        'Foreign institutional investors show strong confidence in Indian equities.',
      content: 'Investment flow analysis...',
      source: { name: 'Business Standard' },
      publishedAt: hoursAgo(11),
      url: '#',
    },
    {
      title: 'Small Cap Funds Deliver 35% Returns in 2023',
      description:
        'Small and mid-cap mutual funds outperform large cap funds significantly.',
      content: 'Fund performance review...',
      source: { name: 'Value Research' },
      publishedAt: hoursAgo(12),
      url: '#',
    },
    {
      title: 'Real Estate Stocks Gain on Demand Recovery',
      description:
        'Property developers see stock prices rise on improving sales.',
      content: 'Real estate sector update...',
      source: { name: 'Economic Times' },
      publishedAt: hoursAgo(13),
      url: '#',
    },
    {
      title: 'SEBI Tightens Regulations on Mutual Fund Expense Ratios',
      description:
        'New rules aim to make mutual funds more cost-effective for investors.',
      content: 'Regulatory changes impact...',
      source: { name: 'Mint' },
      publishedAt: hoursAgo(14),
      url: '#',
    },
    {
      title: 'Auto Sector Stocks Rally on Record Sales',
      description: 'Vehicle manufacturers report strong festive season demand.',
      content: 'Auto industry performance...',
      source: { name: 'CNBC TV18' },
      publishedAt: hoursAgo(15),
      url: '#',
    },
    {
      title: 'Rupee Strengthens to 82.50 Against Dollar',
      description: 'Indian currency gains on improved economic indicators.',
      content: 'Currency market analysis...',
      source: { name: 'Bloomberg Quint' },
      publishedAt: hoursAgo(16),
      url: '#',
    },
    {
      title: 'IPO Market Sees Revival with 10 New Listings',
      description:
        'Primary market activity picks up as investor sentiment improves.',
      content: 'IPO market overview...',
      source: { name: 'Money Control' },
      publishedAt: hoursAgo(17),
      url: '#',
    },
    {
      title: 'Pharma Stocks Gain on Export Growth',
      description:
        'Pharmaceutical companies benefit from strong overseas demand.',
      content: 'Pharma sector analysis...',
      source: { name: 'Business Standard' },
      publishedAt: hoursAgo(18),
      url: '#',
    },
    {
      title: 'Index Funds See 50% Jump in Investor Interest',
      description: 'Passive investing gains popularity among retail investors.',
      content: 'Investment trends...',
      source: { name: 'Economic Times' },
      publishedAt: hoursAgo(19),
      url: '#',
    },
    {
      title: 'Inflation Rate Falls to 4.5%: Relief for Markets',
      description:
        'Consumer price index shows cooling inflation, boosting market sentiment.',
      content: 'Inflation impact analysis...',
      source: { name: 'Mint' },
      publishedAt: hoursAgo(20),
      url: '#',
    },
  ];
};

module.exports = {
  fetchAndStoreNews,
  getNews,
  getArticleById,
  getRelatedNews,
};
