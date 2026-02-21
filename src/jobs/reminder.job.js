/**
 * Reminder Job
 * Checks and sends reminders every 5 minutes
 */

const Reminder = require('../models/Reminder.model');
const DateUtil = require('../utils/date.util');

class ReminderJob {
  /**
   * Get pending reminders
   */
  async getPendingReminders() {
    try {
      const now = new Date();

      console.log(
        `🔍 Checking for reminders. Current time: ${now.toISOString()}`
      );
      console.log(
        `🔍 Current time (IST): ${now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`
      );

      const reminders = await Reminder.find({
        status: 'PENDING',
        reminderDate: { $lte: now },
      })
        .populate('userId', 'email firstName lastName name')
        .populate('linkedGoal')
        .lean();

      console.log(`📋 Found ${reminders.length} pending reminders`);

      if (reminders.length > 0) {
        console.log('📝 Pending reminders:');
        reminders.forEach((r, i) => {
          console.log(
            `  ${i + 1}. ${r.title} - Scheduled: ${new Date(r.reminderDate).toISOString()}`
          );
          console.log(`     User: ${r.userId?.email || 'No email'}`);
          console.log(`     Notify via email: ${r.notifyVia?.email}`);
        });
      }

      return reminders;
    } catch (error) {
      console.error('❌ Error fetching reminders:', error.message);
      throw error;
    }
  }

  /**
   * Send reminder notification
   */
  async sendReminder(reminder) {
    try {
      if (!reminder.userId || !reminder.userId.email) {
        console.error(`❌ Reminder ${reminder._id}: No user email found`);
        return false;
      }

      console.log(
        `📧 Sending reminder: "${reminder.title}" to ${reminder.userId.email}`
      );

      // Email notification
      if (reminder.notifyVia && reminder.notifyVia.email) {
        await this.sendEmailNotification(reminder);
      } else {
        console.log(
          `⚠️  Email notification disabled for reminder: ${reminder.title}`
        );
      }

      // Push notification (if implemented)
      if (reminder.notifyVia && reminder.notifyVia.push) {
        await this.sendPushNotification(reminder);
      }

      // Update reminder status
      await Reminder.findByIdAndUpdate(reminder._id, {
        status: 'SENT',
        lastSentAt: new Date(),
        $inc: { sentCount: 1 },
      });

      console.log(
        `✅ Reminder processed and marked as SENT: ${reminder.title}`
      );

      // If recurring, schedule next occurrence
      if (reminder.frequency !== 'ONCE') {
        await this.scheduleNextReminder(reminder);
      }

      return true;
    } catch (error) {
      console.error(
        `❌ Error sending reminder ${reminder._id}:`,
        error.message
      );
      console.error('Stack:', error.stack);
      return false;
    }
  }

  /**
   * Send email notification
   */
  async sendEmailNotification(reminder) {
    try {
      const EmailService = require('../services/email.service');

      const emailContent = this.generateEmailContent(reminder);
      const userName =
        reminder.userId.name ||
        `${reminder.userId.firstName || ''} ${reminder.userId.lastName || ''}`.trim() ||
        'User';

      console.log(
        `📧 Attempting to send reminder email to: ${reminder.userId.email}`
      );
      console.log(`📋 Reminder details:`, {
        title: reminder.title,
        type: reminder.type,
        scheduledFor: reminder.reminderDate,
      });

      // Send email using the existing email service
      const result = await EmailService.sendEmail({
        to: reminder.userId.email,
        subject: emailContent.subject,
        html: this.generateHTMLEmail(reminder, userName),
      });

      if (result.success) {
        console.log(
          `✅ Reminder email sent successfully to: ${reminder.userId.email}`
        );
      } else {
        console.error(`❌ Failed to send reminder email:`, result.error);
        throw new Error(result.error || 'Email sending failed');
      }

      return true;
    } catch (error) {
      console.error('❌ Error sending reminder email:', error.message);
      console.error('Stack:', error.stack);
      throw error;
    }
  }

  /**
   * Send push notification
   */
  async sendPushNotification(reminder) {
    try {
      // Placeholder - integrate with push notification service
      // Example: FCM, OneSignal, etc.

      console.log(`📱 Push notification would be sent for: ${reminder.title}`);
      return true;
    } catch (error) {
      console.error('❌ Error sending push notification:', error.message);
      throw error;
    }
  }

  /**
   * Generate email content
   */
  generateEmailContent(reminder) {
    const userName =
      reminder.userId.name || reminder.userId.firstName || 'User';

    let subject = '';
    let body = '';

    switch (reminder.type) {
      case 'SIP':
        subject = `🔔 SIP Reminder: ${reminder.sipDetails?.fundSchemeCode || 'Your Investment'}`;
        body = `Hi ${userName},\n\nThis is a reminder for your SIP investment of ₹${reminder.sipDetails?.amount || '0'} scheduled for today.\n\n`;
        break;

      case 'GOAL_REVIEW':
        subject = `🎯 Goal Review: ${reminder.title}`;
        body = `Hi ${userName},\n\nTime to review your investment goal: ${reminder.title}\n\n`;
        if (reminder.linkedGoal) {
          body += `Target Amount: ₹${reminder.linkedGoal.targetAmount}\n`;
          body += `Target Date: ${new Date(reminder.linkedGoal.targetDate).toLocaleDateString('en-IN')}\n\n`;
        }
        break;

      case 'REBALANCE':
        subject = `⚖️ Portfolio Rebalancing Reminder`;
        body = `Hi ${userName},\n\nIt's time to review and rebalance your portfolio.\n\n`;
        break;

      case 'CUSTOM':
        subject = `🔔 Reminder: ${reminder.title}`;
        body = `Hi ${userName},\n\n${reminder.description || reminder.title}\n\n`;
        break;

      default:
        subject = `🔔 Reminder: ${reminder.title}`;
        body = `Hi ${userName},\n\n${reminder.description || reminder.title}\n\n`;
    }

    body += `Best regards,\nMF Analyser Team`;

    return { subject, body };
  }

  /**
   * Generate HTML email
   */
  generateHTMLEmail(reminder, userName) {
    const emailContent = this.generateEmailContent(reminder);

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${emailContent.subject}</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px;">⏰ Reminder</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="color: #333333; margin: 0 0 20px 0; font-size: 20px;">${reminder.title}</h2>
              <p style="color: #666666; line-height: 1.6; margin: 0 0 20px 0;">
                Hi ${userName},
              </p>
              <p style="color: #666666; line-height: 1.6; margin: 0 0 20px 0;">
                ${reminder.description || emailContent.body}
              </p>
              
              ${
                reminder.type === 'SIP'
                  ? `
              <div style="background-color: #f8f9fa; border-left: 4px solid #667eea; padding: 15px; margin: 20px 0;">
                <p style="margin: 0; color: #333333;"><strong>Amount:</strong> ₹${reminder.sipDetails?.amount || '0'}</p>
                <p style="margin: 10px 0 0 0; color: #333333;"><strong>Due Date:</strong> ${new Date(reminder.reminderDate).toLocaleDateString('en-IN')}</p>
              </div>
              `
                  : ''
              }
              
              ${
                reminder.type === 'GOAL_REVIEW' && reminder.linkedGoal
                  ? `
              <div style="background-color: #f8f9fa; border-left: 4px solid #28a745; padding: 15px; margin: 20px 0;">
                <p style="margin: 0; color: #333333;"><strong>Goal:</strong> ${reminder.linkedGoal.name || reminder.title}</p>
                <p style="margin: 10px 0 0 0; color: #333333;"><strong>Target Amount:</strong> ₹${reminder.linkedGoal.targetAmount}</p>
                <p style="margin: 10px 0 0 0; color: #333333;"><strong>Target Date:</strong> ${new Date(reminder.linkedGoal.targetDate).toLocaleDateString('en-IN')}</p>
              </div>
              `
                  : ''
              }
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f9fa; padding: 20px 30px; text-align: center; border-top: 1px solid #e9ecef;">
              <p style="color: #999999; margin: 0; font-size: 12px;">
                This is an automated reminder from MutualFunds.in
              </p>
              <p style="color: #999999; margin: 10px 0 0 0; font-size: 12px;">
                © ${new Date().getFullYear()} MutualFunds.in. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();
  }

  /**
   * Schedule next reminder for recurring reminders
   */
  async scheduleNextReminder(reminder) {
    try {
      const nextDate = this.calculateNextDate(
        reminder.reminderDate,
        reminder.frequency
      );

      await Reminder.findByIdAndUpdate(reminder._id, {
        status: 'PENDING',
        reminderDate: nextDate,
        nextScheduledAt: nextDate,
      });

      console.log(
        `📅 Next reminder scheduled for: ${DateUtil.formatDate(nextDate)}`
      );
    } catch (error) {
      console.error('❌ Error scheduling next reminder:', error.message);
    }
  }

  /**
   * Calculate next reminder date
   */
  calculateNextDate(currentDate, frequency) {
    const current = new Date(currentDate);

    switch (frequency) {
      case 'DAILY':
        current.setDate(current.getDate() + 1);
        break;
      case 'WEEKLY':
        current.setDate(current.getDate() + 7);
        break;
      case 'MONTHLY':
        current.setMonth(current.getMonth() + 1);
        break;
      case 'QUARTERLY':
        current.setMonth(current.getMonth() + 3);
        break;
      case 'YEARLY':
        current.setFullYear(current.getFullYear() + 1);
        break;
    }

    return current;
  }

  /**
   * Main job execution
   */
  async execute() {
    const startTime = Date.now();
    console.log('🚀 Starting reminder job...');
    console.log(`⏰ Time: ${DateUtil.formatDateTime(new Date())}`);

    try {
      // Get pending reminders
      const reminders = await this.getPendingReminders();

      if (reminders.length === 0) {
        console.log('✅ No pending reminders');
        return {
          success: true,
          remindersSent: 0,
        };
      }

      // Send reminders
      let sent = 0;
      let failed = 0;

      for (const reminder of reminders) {
        const success = await this.sendReminder(reminder);
        if (success) {
          sent++;
        } else {
          failed++;
        }
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      console.log('✅ Reminder job completed');
      console.log(`📊 Stats: ${sent} sent, ${failed} failed`);
      console.log(`⏱️ Duration: ${duration}s`);

      return {
        success: true,
        remindersSent: sent,
        remindersFailed: failed,
        duration: duration,
      };
    } catch (error) {
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      console.error('❌ Reminder job failed');
      console.error(`Error: ${error.message}`);
      console.error(`⏱️ Duration: ${duration}s`);

      return {
        success: false,
        error: error.message,
        duration: duration,
      };
    }
  }
}

// Export singleton instance
const reminderJob = new ReminderJob();

module.exports = reminderJob;
