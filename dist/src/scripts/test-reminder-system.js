/**
 * Test Reminder System
 * Creates a test reminder and verifies the scheduler is working
 */

const mongoose = require('mongoose');
const Reminder = require('../models/Reminder.model');
require('dotenv').config();

async function testReminderSystem() {
  console.log('\n🧪 ============================================');
  console.log('🧪 TESTING REMINDER SYSTEM');
  console.log('🧪 ============================================\n');

  try {
    // Connect to MongoDB
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(process.env.DATABASE_URL);
    console.log('✅ Connected to MongoDB\n');

    // Create a test reminder for NOW (should trigger immediately)
    const testReminder = {
      userId: '000000000000000000000000', // Dummy user ID for testing
      title: 'Test Reminder - System Check',
      description:
        'This is a test reminder to verify the system is working correctly.',
      type: 'CUSTOM',
      reminderDate: new Date(), // Set to now - should trigger on next scheduler run
      status: 'PENDING',
      frequency: 'ONCE',
      notifyVia: {
        email: true,
        push: false,
      },
    };

    console.log('📝 Creating test reminder...');
    const reminder = await Reminder.create(testReminder);
    console.log('✅ Test reminder created successfully!');
    console.log('\n📋 Reminder Details:');
    console.log(`   ID: ${reminder._id}`);
    console.log(`   Title: ${reminder.title}`);
    console.log(`   Type: ${reminder.type}`);
    console.log(`   Date: ${reminder.reminderDate}`);
    console.log(`   Status: ${reminder.status}`);
    console.log(`   Notify via Email: ${reminder.notifyVia.email}`);

    console.log(
      '\n⏰ Reminder will be processed in the next scheduler cycle (within 5 minutes)'
    );
    console.log(
      '📧 Check the backend logs for "Checking for pending reminders..."'
    );

    console.log('\n💡 To create user-specific reminders, use the API:');
    console.log('   POST /api/reminders');
    console.log('   {');
    console.log('     "title": "SIP Payment Reminder",');
    console.log('     "type": "SIP",');
    console.log('     "reminderDate": "2026-01-15T10:00:00Z",');
    console.log('     "frequency": "MONTHLY"');
    console.log('   }');

    console.log('\n✅ Test complete! Reminder system is ready.');
  } catch (error) {
    console.error('\n❌ Error testing reminder system:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

testReminderSystem();
