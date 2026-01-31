/**
 * Reminder Scheduler
 * Checks for pending reminders every 5 minutes and sends notifications
 * Supports user-specified dates and times for real-time reminders
 */

const cron = require('node-cron');
const ReminderJob = require('../jobs/reminder.job');

let reminderScheduler = null;
const reminderJob = new ReminderJob();

/**
 * Start the reminder scheduler
 * Runs every 5 minutes to check for pending reminders
 */
function startReminderScheduler() {
  console.log('\n⏰ ============================================');
  console.log('⏰ INITIALIZING REMINDER SCHEDULER');
  console.log('⏰ ============================================');
  console.log('⏰ Checking for reminders every 5 minutes');
  console.log('⏰ Supports user-specified dates and times');
  console.log('⏰ ============================================\n');

  // Check for pending reminders every 5 minutes
  // Cron pattern: */5 * * * * = every 5 minutes
  reminderScheduler = cron.schedule(
    '*/5 * * * *',
    async () => {
      try {
        const now = new Date().toLocaleString('en-IN', {
          timeZone: 'Asia/Kolkata',
        });
        console.log(`\n⏰ [${now}] Checking for pending reminders...`);

        // Get all pending reminders
        const reminders = await reminderJob.getPendingReminders();

        if (reminders.length === 0) {
          console.log('✅ No pending reminders at this time');
          return;
        }

        console.log(`📋 Processing ${reminders.length} reminder(s)...`);

        // Process each reminder
        let successCount = 0;
        let failureCount = 0;

        for (const reminder of reminders) {
          try {
            const success = await reminderJob.sendReminder(reminder);
            if (success) {
              successCount++;
            } else {
              failureCount++;
            }
          } catch (error) {
            console.error(
              `❌ Failed to process reminder ${reminder._id}:`,
              error.message
            );
            failureCount++;
          }
        }

        console.log('\n📊 Reminder Processing Summary:');
        console.log(`   ✅ Sent: ${successCount}`);
        console.log(`   ❌ Failed: ${failureCount}`);
        console.log(`   📋 Total: ${reminders.length}\n`);
      } catch (error) {
        console.error('\n❌ Error in reminder scheduler:', error.message);
      }
    },
    {
      scheduled: true,
      timezone: 'Asia/Kolkata', // IST timezone
    }
  );

  console.log('✅ Reminder scheduler started successfully');
  console.log('📧 Will send emails based on user-specified dates/times');

  return reminderScheduler;
}

/**
 * Stop the reminder scheduler
 */
function stopReminderScheduler() {
  if (reminderScheduler) {
    reminderScheduler.stop();
    console.log('⏸️  Reminder scheduler stopped');
  }
}

/**
 * Check if scheduler is running
 */
function isSchedulerRunning() {
  return reminderScheduler !== null;
}

module.exports = {
  startReminderScheduler,
  stopReminderScheduler,
  isSchedulerRunning,
};
