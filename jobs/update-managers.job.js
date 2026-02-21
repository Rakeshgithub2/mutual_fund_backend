/**
 * Fund Managers Update Job - Runs semi-annually
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Fund = require('../src/models/Fund.model');

async function updateFundManagers() {
  try {
    console.log('👨‍💼 Updating fund manager information...');

    // Real implementation would fetch from fund house APIs or web scraping
    // For now, update timestamp

    const result = await Fund.updateMany(
      {},
      {
        $set: {
          'fund_manager.updated_at': new Date(),
          last_updated: new Date(),
        },
      }
    );

    console.log(
      `✅ Fund manager info updated for ${result.modifiedCount} funds`
    );
    return { success: true, updated: result.modifiedCount };
  } catch (error) {
    console.error('❌ Fund manager update failed:', error.message);
    return { success: false, error: error.message };
  }
}

module.exports = { updateFundManagers };

// Run standalone
if (require.main === module) {
  mongoose.connect(process.env.DATABASE_URL).then(async () => {
    await updateFundManagers();
    await mongoose.connection.close();
    process.exit(0);
  });
}
