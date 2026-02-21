/**
 * ═══════════════════════════════════════════════════════════════════════
 * NEWS INGESTION JOB - Daily at 6 AM IST
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Fetches latest 20 news from NewsData.io API
 * Deletes news older than 7 days
 */

require('dotenv').config();
const mongoose = require('mongoose');
const axios = require('axios');
const MarketNews = require('../src/models/MarketNews.model');

const DATABASE_URL = process.env.DATABASE_URL;
const NEWS_API_KEY = process.env.NEWS_API_KEY; // NewsData.io key

async function updateNews() {
  try {
    console.log('📰 Starting news update job...');
    console.log(
      `🕐 Current time: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`
    );

    if (
      !NEWS_API_KEY ||
      NEWS_API_KEY === 'YOUR_KEY' ||
      NEWS_API_KEY === 'demo_key' ||
      NEWS_API_KEY === 'YOUR_NEWSAPI_KEY_HERE'
    ) {
      console.error('❌ NEWS_API_KEY not configured in .env file');
      console.log(
        '   Please get a free API key from: https://newsdata.io/register'
      );
      console.log('   Then set in .env: NEWS_API_KEY=your_actual_key');
      return { success: false, error: 'API key not configured' };
    }

    console.log('📥 Fetching latest financial news using NewsData.io...');

    const response = await axios.get('https://newsdata.io/api/1/latest', {
      params: {
        apikey: NEWS_API_KEY,
        q: 'finance OR stock market OR mutual funds OR sensex OR nifty OR gold OR investment',
        country: 'in',
        language: 'en',
        category: 'business',
      },
      timeout: 15000,
    });

    if (!response.data || !response.data.results) {
      throw new Error('Invalid response from NewsData.io API');
    }

    const articles = response.data.results.slice(0, 20); // Get latest 20
    console.log(`✅ Fetched ${articles.length} latest news articles`);

    // Prepare news data
    const newsData = articles.map((article) => {
      // Categorize based on content
      let category = 'finance';
      const titleLower = (article.title || '').toLowerCase();
      const descLower = (article.description || '').toLowerCase();
      const contentLower = (article.content || '').toLowerCase();

      if (
        titleLower.includes('stock') ||
        descLower.includes('stock') ||
        contentLower.includes('stock')
      )
        category = 'stock';
      else if (
        titleLower.includes('mutual fund') ||
        descLower.includes('mutual fund') ||
        contentLower.includes('mutual fund')
      )
        category = 'mutualfund';
      else if (
        titleLower.includes('gold') ||
        descLower.includes('gold') ||
        contentLower.includes('gold')
      )
        category = 'gold';

      return {
        title: article.title || 'No Title',
        description: article.description || article.content || 'No Description',
        content:
          article.content ||
          article.description ||
          'Full article content not available. Visit source link to read more.',
        source: article.source_id || article.source_name || 'Unknown',
        url: article.link || article.source_url,
        category,
        published_at: new Date(article.pubDate),
      };
    });

    // Delete all existing news to replace with fresh daily news
    console.log('🗑️  Deleting old news...');
    const deleteResult = await MarketNews.deleteMany({});
    console.log(`✅ Deleted ${deleteResult.deletedCount} old articles`);

    // Insert new 20 news articles
    const inserted = await MarketNews.insertMany(newsData, { ordered: false });
    console.log(`✅ Inserted ${inserted.length} new articles`);

    // Show current count
    const totalNews = await MarketNews.countDocuments();
    console.log(`📊 Total news in database: ${totalNews}`);

    return {
      success: true,
      inserted: inserted.length,
      deleted: deleteResult.deletedCount,
      total: totalNews,
    };
  } catch (error) {
    console.error('❌ News update failed:', error.message);

    if (error.response) {
      console.error('   API Response:', error.response.status);
      console.error(
        '   API Data:',
        JSON.stringify(error.response.data, null, 2)
      );

      if (error.response.status === 429) {
        console.error(
          '   ⚠️  Rate limit exceeded. NewsData.io free tier: 200 requests/day'
        );
        console.error('   ⚠️  Upgrade at: https://newsdata.io/pricing');
      } else if (
        error.response.status === 401 ||
        error.response.status === 403
      ) {
        console.error('   ⚠️  Invalid or unauthorized API key.');
        console.error('   Get a FREE API key at: https://newsdata.io/register');
        console.error('   Then update .env file: NEWS_API_KEY=your_key_here');
      }
    }

    console.error(
      '\n⚠️  NO MOCK DATA - Please fix the API key to get real news!'
    );
    return { success: false, error: error.message };
  }
}

module.exports = { updateNews };

// Run standalone
if (require.main === module) {
  mongoose.connect(DATABASE_URL).then(async () => {
    await updateNews();
    await mongoose.connection.close();
    process.exit(0);
  });
}
