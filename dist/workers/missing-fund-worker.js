/**
 * 24/7 Fund Ingestion Worker
 *
 * This worker runs on Oracle VM and continuously:
 * 1. Checks for missing funds in queue
 * 2. Fetches them from AMFI/MFAPI
 * 3. Saves to MongoDB
 * 4. Updates NAV data nightly
 *
 * Deploy with: pm2 start missing-fund-worker.js --name mf-ingestor
 */

const axios = require('axios');
const { MongoClient } = require('mongodb');

// Configuration
const MONGODB_URI =
  process.env.DATABASE_URL || 'mongodb://localhost:27017/mutual_funds_db';
const MFAPI_BASE = 'https://api.mfapi.in/mf';
const CHECK_INTERVAL = 5 * 60 * 1000; // Check every 5 minutes
const NAV_UPDATE_HOUR = 20; // 8 PM daily NAV update

let db = null;
let client = null;

/**
 * Connect to MongoDB with retry logic
 */
async function connectDB() {
  if (db) return db;

  try {
    console.log('🔄 Connecting to MongoDB...');
    client = new MongoClient(MONGODB_URI, {
      maxPoolSize: 5,
      minPoolSize: 1,
      serverSelectionTimeoutMS: 10000,
    });

    await client.connect();
    db = client.db();
    console.log('✅ MongoDB connected');
    return db;
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    throw error;
  }
}

/**
 * Fetch fund details from MFAPI
 */
async function fetchFundFromMFAPI(schemeCode) {
  try {
    console.log(`🌐 Fetching scheme ${schemeCode} from MFAPI...`);

    const response = await axios.get(`${MFAPI_BASE}/${schemeCode}`, {
      timeout: 10000,
      headers: { 'User-Agent': 'MF-Ingestion-Worker/1.0' },
    });

    const { data } = response;
    if (!data?.meta || !data?.data || data.data.length === 0) {
      console.log(`⚠️ No data for scheme ${schemeCode}`);
      return null;
    }

    const meta = data.meta;
    const latestNav = data.data[0];

    return {
      schemeCode: meta.scheme_code,
      schemeName: meta.scheme_name,
      amc: meta.fund_house,
      category: normalizeCategory(meta.scheme_category),
      subCategory: meta.scheme_type || 'Other',
      nav: {
        value: parseFloat(latestNav.nav),
        date: new Date(latestNav.date),
      },
      navHistory: data.data.slice(0, 365).map((nav) => ({
        date: new Date(nav.date),
        value: parseFloat(nav.nav),
      })),
      isActive: true,
      dataSource: 'MFAPI',
      lastFetched: new Date(),
      createdAt: new Date(),
    };
  } catch (error) {
    console.error(`❌ Error fetching ${schemeCode}:`, error.message);
    return null;
  }
}

/**
 * Normalize category names
 */
function normalizeCategory(category) {
  if (!category) return 'Other';
  const lower = category.toLowerCase();

  if (lower.includes('equity')) return 'Equity';
  if (lower.includes('debt')) return 'Debt';
  if (lower.includes('hybrid')) return 'Hybrid';
  if (lower.includes('commodity')) return 'Commodity';

  return 'Other';
}

/**
 * Process missing funds queue
 */
async function processMissingFundsQueue() {
  try {
    const db = await connectDB();
    const queueCollection = db.collection('missing_funds_queue');
    const fundCollection = db.collection('fund_master');

    // Get pending items from queue (limit 10 per batch)
    const pendingItems = await queueCollection
      .find({ status: 'pending' })
      .sort({ requestedAt: 1 })
      .limit(10)
      .toArray();

    if (pendingItems.length === 0) {
      console.log('📭 No pending funds in queue');
      return;
    }

    console.log(`📦 Processing ${pendingItems.length} missing funds...`);

    for (const item of pendingItems) {
      // Mark as processing
      await queueCollection.updateOne(
        { _id: item._id },
        { $set: { status: 'processing', processedAt: new Date() } }
      );

      // Check if fund already exists
      const existingFund = await fundCollection.findOne({
        $or: [
          { schemeCode: item.schemeCode },
          { schemeName: { $regex: item.searchQuery, $options: 'i' } },
        ],
      });

      if (existingFund) {
        console.log(
          `✅ Fund already exists: ${item.schemeCode || item.searchQuery}`
        );
        await queueCollection.updateOne(
          { _id: item._id },
          { $set: { status: 'completed', completedAt: new Date() } }
        );
        continue;
      }

      // Fetch from MFAPI
      let fundData = null;

      if (item.schemeCode) {
        fundData = await fetchFundFromMFAPI(item.schemeCode);
      } else if (item.searchQuery) {
        // Try to search AMFI database for scheme codes matching query
        fundData = await searchAndFetchFund(item.searchQuery);
      }

      if (fundData) {
        // Save to database
        await fundCollection.updateOne(
          { schemeCode: fundData.schemeCode },
          { $set: fundData },
          { upsert: true }
        );

        console.log(`✅ Saved fund: ${fundData.schemeName}`);

        await queueCollection.updateOne(
          { _id: item._id },
          {
            $set: {
              status: 'completed',
              completedAt: new Date(),
              result: fundData.schemeCode,
            },
          }
        );
      } else {
        // Mark as failed
        await queueCollection.updateOne(
          { _id: item._id },
          {
            $set: {
              status: 'failed',
              failedAt: new Date(),
              error: 'Fund not found in MFAPI',
            },
          }
        );
        console.log(
          `❌ Failed to fetch: ${item.schemeCode || item.searchQuery}`
        );
      }

      // Rate limiting
      await sleep(2000); // 2 seconds between requests
    }

    console.log('✅ Queue processing complete');
  } catch (error) {
    console.error('❌ Error processing queue:', error);
  }
}

/**
 * Search for fund and fetch if found
 */
async function searchAndFetchFund(query) {
  try {
    // Try common scheme codes patterns
    // This is a simplified version - you can expand with actual AMFI search
    console.log(`🔍 Searching for: ${query}`);

    // For now, return null - implement AMFI search if needed
    return null;
  } catch (error) {
    console.error('Search error:', error.message);
    return null;
  }
}

/**
 * Update NAV for all funds (runs daily)
 */
async function updateAllNAVs() {
  try {
    const db = await connectDB();
    const fundCollection = db.collection('fund_master');

    // Get all active funds with scheme codes
    const funds = await fundCollection
      .find({
        isActive: true,
        schemeCode: { $exists: true, $ne: null },
      })
      .project({ schemeCode: 1, schemeName: 1 })
      .limit(100) // Limit to avoid rate limiting
      .toArray();

    console.log(`📊 Updating NAV for ${funds.length} funds...`);

    let updated = 0;
    let failed = 0;

    for (const fund of funds) {
      try {
        const response = await axios.get(`${MFAPI_BASE}/${fund.schemeCode}`, {
          timeout: 5000,
        });

        const data = response.data;
        if (data?.data && data.data.length > 0) {
          const latestNav = data.data[0];

          await fundCollection.updateOne(
            { schemeCode: fund.schemeCode },
            {
              $set: {
                'nav.value': parseFloat(latestNav.nav),
                'nav.date': new Date(latestNav.date),
                lastUpdated: new Date(),
              },
            }
          );

          updated++;
          if (updated % 10 === 0) {
            console.log(`✅ Updated ${updated}/${funds.length} NAVs...`);
          }
        }

        // Rate limiting
        await sleep(1000);
      } catch (error) {
        failed++;
        console.error(`Failed to update ${fund.schemeCode}:`, error.message);
      }
    }

    console.log(`✅ NAV update complete: ${updated} updated, ${failed} failed`);
  } catch (error) {
    console.error('❌ NAV update error:', error);
  }
}

/**
 * Check if it's time for daily NAV update
 */
function shouldRunNAVUpdate() {
  const now = new Date();
  const hour = now.getHours();

  // Run at 8 PM IST
  return hour === NAV_UPDATE_HOUR;
}

let lastNAVUpdateDate = null;

/**
 * Sleep utility
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Main worker loop
 */
async function mainLoop() {
  console.log('🚀 Fund Ingestion Worker started');
  console.log(`⏰ Check interval: ${CHECK_INTERVAL / 1000 / 60} minutes`);
  console.log(`📊 NAV update time: ${NAV_UPDATE_HOUR}:00 daily`);

  // Initial connection
  await connectDB();

  // Create queue collection if not exists
  const db = await connectDB();
  await db.createCollection('missing_funds_queue').catch(() => {});

  // Create index on queue
  await db
    .collection('missing_funds_queue')
    .createIndex({ status: 1, requestedAt: 1 });

  while (true) {
    try {
      // Process missing funds queue
      await processMissingFundsQueue();

      // Check if it's time for daily NAV update
      const today = new Date().toDateString();
      if (shouldRunNAVUpdate() && lastNAVUpdateDate !== today) {
        console.log('📊 Starting daily NAV update...');
        await updateAllNAVs();
        lastNAVUpdateDate = today;
      }

      // Wait before next check
      console.log(`⏳ Sleeping for ${CHECK_INTERVAL / 1000 / 60} minutes...`);
      await sleep(CHECK_INTERVAL);
    } catch (error) {
      console.error('❌ Error in main loop:', error);
      console.log('⏳ Retrying in 1 minute...');
      await sleep(60000);
    }
  }
}

/**
 * Handle graceful shutdown
 */
process.on('SIGINT', async () => {
  console.log('\n📴 Shutting down gracefully...');
  if (client) {
    await client.close();
    console.log('✅ MongoDB connection closed');
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n📴 Shutting down gracefully...');
  if (client) {
    await client.close();
    console.log('✅ MongoDB connection closed');
  }
  process.exit(0);
});

// Start the worker
mainLoop().catch((error) => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
