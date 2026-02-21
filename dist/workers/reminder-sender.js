/**
 * Standalone Reminder Sender Worker
 *
 * Checks for pending reminders and sends email notifications every hour
 *
 * Usage:
 *   Development: node workers/reminder-sender.js
 *   Production: pm2 start workers/reminder-sender.js --name "reminder-worker" --cron "0 * * * *" --no-autorestart
 */

require('dotenv').config();
const mongoose = require('mongoose');

// Database connection
const DATABASE_URL =
  process.env.DATABASE_URL || 'mongodb://localhost:27017/mutual-funds';

async function sendReminders() {
  try {
    console.log('\n🔔 Checking for Pending Reminders...');
    console.log(
      `⏰ Time: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`
    );

    // Check if email is configured
    if (!process.env.RESEND_API_KEY && !process.env.EMAIL_USER) {
      console.warn(
        '⚠️  No email service configured (RESEND_API_KEY or EMAIL_USER not set)'
      );
      console.warn(
        '   Reminders will be marked as sent but emails will not be delivered'
      );
    }

    // Import the reminder job
    const ReminderJob = require('../src/jobs/reminder.job');
    const reminderJob = new ReminderJob();

    // Get pending reminders
    const pendingReminders = await reminderJob.getPendingReminders();

    if (pendingReminders.length === 0) {
      console.log('✅ No pending reminders found');
      return { success: true, sent: 0, failed: 0 };
    }

    console.log(`📋 Found ${pendingReminders.length} pending reminder(s)`);

    // Send reminders
    let sent = 0;
    let failed = 0;

    for (const reminder of pendingReminders) {
      try {
        const result = await reminderJob.sendReminder(reminder);
        if (result) {
          sent++;
          console.log(
            `  ✅ Sent: "${reminder.title}" to ${reminder.userId?.email}`
          );
        } else {
          failed++;
          console.log(`  ❌ Failed: "${reminder.title}"`);
        }
      } catch (error) {
        failed++;
        console.error(
          `  ❌ Error sending reminder "${reminder.title}":`,
          error.message
        );
      }
    }

    console.log(`\n✅ Reminder Check Complete!`);
    console.log(`   - Sent: ${sent}`);
    console.log(`   - Failed: ${failed}`);

    return { success: true, sent, failed };
  } catch (error) {
    console.error('❌ Reminder Check Error:', error.message);
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

    // Run the reminder check
    const result = await sendReminders();

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

module.exports = { sendReminders };
