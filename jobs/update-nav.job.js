/**
 * NAV Update Job - Runs every 1 hour
 */

require('dotenv').config();
const mongoose = require('mongoose');
const axios = require('axios');
const Fund = require('../src/models/Fund.model');

async function updateAllNAV() {
  try {
    console.log('📥 Fetching latest NAV data from AMFI...');

    const response = await axios.get(
      'https://www.amfiindia.com/spages/NAVAll.txt',
      {
        timeout: 30000,
      }
    );

    const lines = response.data.split('\n');
    const navUpdates = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (
        !trimmed ||
        !trimmed.includes(';') ||
        trimmed.startsWith('Scheme Code')
      )
        continue;

      const parts = trimmed.split(';');
      if (parts.length < 7) continue;

      const [schemeCode, , , , , navValue, navDate] = parts;
      const nav = parseFloat(navValue);

      if (!isNaN(nav) && navValue !== 'N.A.') {
        navUpdates.push({
          scheme_code: schemeCode.trim(),
          nav,
          nav_date: navDate.trim(),
          last_updated: new Date(),
        });
      }
    }

    console.log(`📊 Updating NAV for ${navUpdates.length} funds...`);

    const bulkOps = navUpdates.map((update) => ({
      updateOne: {
        filter: { scheme_code: update.scheme_code },
        update: {
          $set: {
            nav: update.nav,
            nav_date: update.nav_date,
            last_updated: update.last_updated,
          },
        },
      },
    }));

    // Process in batches
    const batchSize = 1000;
    let updated = 0;

    for (let i = 0; i < bulkOps.length; i += batchSize) {
      const batch = bulkOps.slice(i, i + batchSize);
      await Fund.bulkWrite(batch, { ordered: false });
      updated += batch.length;
    }

    console.log(`✅ NAV updated for ${updated} funds`);
    return { success: true, updated };
  } catch (error) {
    console.error('❌ NAV update failed:', error.message);
    return { success: false, error: error.message };
  }
}

module.exports = { updateAllNAV };

// Run standalone
if (require.main === module) {
  mongoose.connect(process.env.DATABASE_URL).then(async () => {
    await updateAllNAV();
    await mongoose.connection.close();
    process.exit(0);
  });
}
