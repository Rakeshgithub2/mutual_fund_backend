/**
 * ═══════════════════════════════════════════════════════════════════════
 * MASTER SETUP SCRIPT
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Runs complete system setup in correct order:
 * 1. Add MongoDB indexes
 * 2. Run fund ingestion (15,000+ funds)
 * 3. Verify database
 * 4. Initialize cron jobs
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { addIndexes } = require('./add-indexes');
const { runIngestion } = require('./ingestion-engine');
const { verifyDatabase } = require('./verify-funds');
const cronScheduler = require('../cron/scheduler');

async function masterSetup() {
  try {
    console.log('═══════════════════════════════════════════════════════');
    console.log('🚀 MASTER SETUP - 15,000+ FUNDS SYSTEM');
    console.log('═══════════════════════════════════════════════════════\n');

    // Step 1: Add Indexes
    console.log('STEP 1: Adding MongoDB Indexes');
    console.log('───────────────────────────────────────────────────────\n');
    await addIndexes();

    // Step 2: Run Ingestion
    console.log('\nSTEP 2: Running Fund Ingestion');
    console.log('───────────────────────────────────────────────────────\n');
    await runIngestion();

    // Step 3: Verify Database
    console.log('\nSTEP 3: Verifying Database');
    console.log('───────────────────────────────────────────────────────\n');
    await verifyDatabase();

    // Step 4: Initialize Cron Jobs
    console.log('\nSTEP 4: Initializing Cron Jobs');
    console.log('───────────────────────────────────────────────────────\n');
    cronScheduler.initializeJobs();
    console.log('Schedule Information:');
    const scheduleInfo = cronScheduler.getScheduleInfo();
    Object.entries(scheduleInfo).forEach(([key, value]) => {
      console.log(`  ${key}: ${value}`);
    });

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('✅ MASTER SETUP COMPLETED SUCCESSFULLY');
    console.log('═══════════════════════════════════════════════════════\n');

    console.log('Next Steps:');
    console.log('  1. Start backend: npm run dev');
    console.log('  2. Cron jobs will run automatically');
    console.log('  3. Access API at: http://localhost:3002/api/funds\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Master setup failed:', error);
    process.exit(1);
  }
}

// Run setup
if (require.main === module) {
  masterSetup();
}

module.exports = { masterSetup };
