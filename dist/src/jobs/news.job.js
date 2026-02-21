/**
 * ═══════════════════════════════════════════════════════════════════════
 * NEWS UPDATE JOB
 * Fetches top 20 finance news daily at 6 AM
 * ═══════════════════════════════════════════════════════════════════════
 */

const axios = require('axios');
const MarketNews = require('../models/MarketNews.model');

class NewsUpdateJob {
  constructor() {
    this.apiKey = process.env.NEWSDATA_API_KEY;
    this.apiUrl = 'https://newsdata.io/api/1/news';
    this.limit = 20;
  }

  /**
   * Fetch latest finance news
   */
  async fetchNews() {
    try {
      console.log('\n📰 Fetching latest finance news...');

      if (!this.apiKey) {
        console.error('❌ NEWSDATA_API_KEY not configured');
        return { success: false, error: 'API key not configured' };
      }

      // Fetch news from NewsData.io API
      const response = await axios.get(this.apiUrl, {
        params: {
          apikey: this.apiKey,
          country: 'in', // India
          category: 'business',
          language: 'en',
          q: 'finance OR stock OR mutual fund OR investment',
          size: this.limit,
        },
        timeout: 15000,
      });

      if (response.data && response.data.results) {
        const newsArticles = response.data.results;
        console.log(`✅ Fetched ${newsArticles.length} news articles`);
        return { success: true, data: newsArticles };
      } else {
        console.error('❌ No news data in response');
        return { success: false, error: 'No news data found' };
      }
    } catch (error) {
      console.error('❌ Error fetching news:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Save news to database
   * Replaces old news with new news
   */
  async saveNews(newsArticles) {
    try {
      console.log('💾 Saving news to database...');

      // Delete all existing news
      const deleteResult = await MarketNews.deleteMany({});
      console.log(`🗑️  Deleted ${deleteResult.deletedCount} old news articles`);

      // Prepare news articles for insertion
      const newsToInsert = newsArticles.map((article) => ({
        title: article.title || 'Untitled',
        description: article.description || article.content || 'No description',
        source: article.source_id || article.source_name || 'Unknown',
        url: article.link || article.url || '#',
        category: this.categorizeNews(article.title, article.description),
        published_at: article.pubDate ? new Date(article.pubDate) : new Date(),
      }));

      // Insert new news articles
      const result = await MarketNews.insertMany(newsToInsert, {
        ordered: false,
      });

      console.log(`✅ Saved ${result.length} new news articles`);

      return {
        success: true,
        deleted: deleteResult.deletedCount,
        inserted: result.length,
      };
    } catch (error) {
      console.error('❌ Error saving news:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Categorize news based on content
   */
  categorizeNews(title, description) {
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

  /**
   * Run the complete news update job
   */
  async run() {
    try {
      console.log('\n🚀 Starting News Update Job...');
      console.log(
        `📅 ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`
      );

      // Fetch news
      const fetchResult = await this.fetchNews();
      if (!fetchResult.success) {
        console.error('❌ Failed to fetch news:', fetchResult.error);
        return { success: false, error: fetchResult.error };
      }

      // Save news to database
      const saveResult = await this.saveNews(fetchResult.data);
      if (!saveResult.success) {
        console.error('❌ Failed to save news:', saveResult.error);
        return { success: false, error: saveResult.error };
      }

      console.log('✅ News Update Job completed successfully');
      console.log(
        `📊 Summary: Deleted ${saveResult.deleted}, Inserted ${saveResult.inserted}`
      );

      return {
        success: true,
        deleted: saveResult.deleted,
        inserted: saveResult.inserted,
      };
    } catch (error) {
      console.error('❌ News Update Job failed:', error.message);
      return { success: false, error: error.message };
    }
  }
}

// Export instance
const newsUpdateJob = new NewsUpdateJob();

// Run job immediately if executed directly
if (require.main === module) {
  console.log('🔧 Running News Update Job manually...');
  newsUpdateJob
    .run()
    .then((result) => {
      console.log('\n📋 Result:', result);
      process.exit(result.success ? 0 : 1);
    })
    .catch((error) => {
      console.error('❌ Fatal error:', error);
      process.exit(1);
    });
}

module.exports = newsUpdateJob;
