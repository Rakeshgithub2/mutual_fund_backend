/**
 * Standalone NAV Update Worker
 *
 * Updates Net Asset Values for all mutual funds daily at 8 PM IST
 *
 * Usage:
 *   Development: node workers/nav-updater.js
 *   Production: pm2 start workers/nav-updater.js --name "nav-worker" --cron "0 20 * * *" --no-autorestart
 */

require('dotenv').config();
const mongoose = require('mongoose');

// Database connection
const DATABASE_URL =
  process.env.DATABASE_URL || 'mongodb://localhost:27017/mutual-funds';

async function updateNAVs() {
  try {
    console.log('\n🔄 Starting NAV Update...');
    console.log(
      `⏰ Time: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`
    );

    // Import the NAV update job
    const { updateAllNAV } = require('../src/jobs/update-nav.job');

    // Execute the update
    const result = await updateAllNAV();

    if (result && result.success) {
      console.log(`✅ NAV Update Complete!`);
      console.log(`   - Funds updated: ${result.updated || 0}`);
      console.log(`   - Failed: ${result.failed || 0}`);
      return { success: true, result };
    } else {
      console.error('❌ NAV update returned unsuccessful result');
      return { success: false, error: 'Update unsuccessful' };
    }
  } catch (error) {
    console.error('❌ NAV Update Error:', error.message);
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

    // Run the NAV update
    const result = await updateNAVs();

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

module.exports = { updateNAVs };
