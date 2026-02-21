/**
 * Standalone News Fetcher Worker
 *
 * Fetches latest finance news from NewsData.io API daily at 6 AM IST
 *
 * Usage:
 *   Development: node workers/news-fetcher.js
 *   Production: pm2 start workers/news-fetcher.js --name "news-worker" --cron "0 6 * * *" --no-autorestart
 */

require('dotenv').config();
const mongoose = require('mongoose');

// Database connection
const DATABASE_URL =
  process.env.DATABASE_URL || 'mongodb://localhost:27017/mutual-funds';

async function fetchNews() {
  try {
    console.log('\n📰 Starting News Fetch...');
    console.log(
      `⏰ Time: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`
    );

    // Check if API key is configured
    if (!process.env.NEWSDATA_API_KEY) {
      throw new Error('NEWSDATA_API_KEY not configured in .env file');
    }

    // Import the news job
    const NewsUpdateJob = require('../src/jobs/news.job');
    const newsJob = new NewsUpdateJob();

    // Fetch and save news
    const fetchResult = await newsJob.fetchNews();

    if (!fetchResult.success) {
      throw new Error(fetchResult.error || 'Failed to fetch news');
    }

    console.log(`✅ Fetched ${fetchResult.data.length} news articles`);

    // Save to database
    const saveResult = await newsJob.saveNews(fetchResult.data);

    if (!saveResult.success) {
      throw new Error(saveResult.error || 'Failed to save news');
    }

    console.log(`✅ News Fetch Complete!`);
    console.log(`   - New articles: ${saveResult.inserted || 0}`);
    console.log(`   - Duplicates skipped: ${saveResult.skipped || 0}`);

    return {
      success: true,
      fetched: fetchResult.data.length,
      inserted: saveResult.inserted,
      skipped: saveResult.skipped,
    };
  } catch (error) {
    console.error('❌ News Fetch Error:', error.message);
    throw error;
  }
}

async function main() {
  let connection = null;

  try {
    // Connect to MongoDB
    console.log('📡 Connecting to MongoDB...');
    connection = await mongoose.connect(DATABASE_URL, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });
    console.log('✅ MongoDB connected');

    // Run the news fetch
    const result = await fetchNews();

    // Close connection
    await mongoose.connection.close();
    console.log('📡 MongoDB disconnected');

    // Exit with appropriate code
    process.exit(result.success ? 0 : 1);
  } catch (error) {
    console.error('\n❌ Fatal Error:', error.message);
    console.error(error.stack);

    // Attempt to close connection
    if (connection) {
      try {
        await mongoose.connection.close();
      } catch (closeError) {
        console.error('Error closing connection:', closeError.message);
      }
    }

    process.exit(1);
  }
}

// Handle unhandled rejections
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled Rejection:', error);
  process.exit(1);
});

// Run the worker
if (require.main === module) {
  main();
}

module.exports = { fetchNews };
