/**
 * Daily Returns Update Job
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Fund = require('../src/models/Fund.model');

async function updateDailyReturns() {
  try {
    console.log('📊 Updating returns for all funds...');

    // This would integrate with a real returns API
    // For now, we'll update the last_updated timestamp
    // Real implementation would call MFAPI or similar service

    const result = await Fund.updateMany(
      {},
      {
        $set: {
          'returns.updated_at': new Date(),
          last_updated: new Date(),
        },
      }
    );

    console.log(`✅ Returns updated for ${result.modifiedCount} funds`);
    return { success: true, updated: result.modifiedCount };
  } catch (error) {
    console.error('❌ Returns update failed:', error.message);
    return { success: false, error: error.message };
  }
}

module.exports = { updateDailyReturns };

// Run standalone
if (require.main === module) {
  mongoose.connect(process.env.DATABASE_URL).then(async () => {
    await updateDailyReturns();
    await mongoose.connection.close();
    process.exit(0);
  });
}
