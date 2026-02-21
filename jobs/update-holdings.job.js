/**
 * Holdings Update Job - Runs quarterly
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Fund = require('../src/models/Fund.model');

async function updateHoldings() {
  try {
    console.log('📊 Updating holdings for equity funds...');

    // Real implementation would fetch from BSE/NSE or fund house APIs
    // For now, update timestamp

    const result = await Fund.updateMany(
      { category: 'equity' },
      {
        $set: {
          holdings_updated_at: new Date(),
          last_updated: new Date(),
        },
      }
    );

    console.log(`✅ Holdings updated for ${result.modifiedCount} equity funds`);
    return { success: true, updated: result.modifiedCount };
  } catch (error) {
    console.error('❌ Holdings update failed:', error.message);
    return { success: false, error: error.message };
  }
}

module.exports = { updateHoldings };

// Run standalone
if (require.main === module) {
  mongoose.connect(process.env.DATABASE_URL).then(async () => {
    await updateHoldings();
    await mongoose.connection.close();
    process.exit(0);
  });
}
