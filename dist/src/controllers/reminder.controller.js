/**
 * Reminder Controller
 * Handles user reminders
 */

const Reminder = require('../models/Reminder.model');
const User = require('../models/User.model');
const EmailService = require('../services/email.service');

class ReminderController {
  /**
   * Get all user reminders
   * GET /api/reminders?status=PENDING
   */
  static async getReminders(req, res) {
    try {
      const userId = req.user.userId;
      const { status } = req.query;

      console.log('📥 GET /api/reminders - User ID:', userId);
      console.log('   Status filter:', status || 'All');

      const query = { userId };
      if (status) query.status = status;

      const reminders = await Reminder.find(query)
        .populate('linkedGoal')
        .sort({ reminderDate: 1 })
        .lean();

      console.log(`✅ Found ${reminders.length} reminders for user`);
      if (reminders.length > 0) {
        console.log('   First reminder:', reminders[0].title);
      }

      res.json({
        success: true,
        data: reminders,
      });
    } catch (error) {
      console.error('Error fetching reminders:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch reminders',
        message: error.message,
      });
    }
  }

  /**
   * Get reminder by ID
   * GET /api/reminders/:id
   */
  static async getReminderById(req, res) {
    try {
      const userId = req.user.userId;
      const { id } = req.params;

      const reminder = await Reminder.findOne({ _id: id, userId })
        .populate('linkedGoal')
        .lean();

      if (!reminder) {
        return res.status(404).json({
          success: false,
          error: 'Reminder not found',
        });
      }

      res.json({
        success: true,
        data: reminder,
      });
    } catch (error) {
      console.error('Error fetching reminder:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch reminder',
        message: error.message,
      });
    }
  }

  /**
   * Create new reminder
   * POST /api/reminders
   */
  static async createReminder(req, res) {
    try {
      const userId = req.user.userId;
      const {
        type,
        title,
        description,
        reminderDate,
        frequency = 'ONCE',
        notifyVia,
        linkedGoal,
        linkedFunds,
        sipDetails,
      } = req.body;

      console.log('📝 Creating new reminder...');
      console.log('   User ID:', userId);
      console.log('   Title:', title);
      console.log('   Type:', type);
      console.log('   Scheduled:', new Date(reminderDate).toISOString());
      console.log('   Frequency:', frequency);
      console.log('   Email Notify:', notifyVia?.email);

      // Validate required fields
      if (!type || !title || !reminderDate) {
        console.log('❌ Missing required fields');
        return res.status(400).json({
          success: false,
          error: 'Missing required fields',
          message: 'Type, title, and reminder date are required',
        });
      }

      // Create reminder
      const reminder = new Reminder({
        userId,
        type,
        title,
        description,
        reminderDate: new Date(reminderDate),
        frequency,
        notifyVia: notifyVia || { email: true, push: false },
        linkedGoal,
        linkedFunds: linkedFunds || [],
        sipDetails,
        status: 'PENDING',
      });

      await reminder.save();
      console.log('✅ Reminder saved to database:', reminder._id);
      console.log('   Status: PENDING');
      console.log(
        '   Will be sent at:',
        new Date(reminderDate).toLocaleString('en-IN', {
          timeZone: 'Asia/Kolkata',
        })
      );

      // Send confirmation email to user
      try {
        const user = await User.findById(userId).select(
          'email name firstName lastName'
        );
        console.log('📧 Attempting to send confirmation email...');
        console.log('   User found:', !!user);
        console.log('   User email:', user?.email);
        console.log('   Email notify enabled:', notifyVia?.email !== false);

        if (user && user.email && notifyVia?.email !== false) {
          const userName = user.name || user.firstName || 'User';
          const emailService = EmailService.getInstance();
          const formattedDate = new Date(reminderDate).toLocaleString('en-IN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
            timeZone: 'Asia/Kolkata',
          });

          const emailResult = await emailService.sendEmail({
            to: user.email,
            subject: '✅ Reminder Created Successfully - MF Analyser',
            html: `
              <!DOCTYPE html>
              <html>
                <head>
                  <meta charset="UTF-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                </head>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                    <h1 style="margin: 0; font-size: 28px;">🔔 Reminder Created</h1>
                  </div>
                  <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
                    <p style="font-size: 16px; margin-bottom: 20px;">Hello ${userName},</p>
                    <p style="font-size: 16px; margin-bottom: 20px;">Your reminder has been successfully created and saved!</p>
                    
                    <div style="background: white; border-left: 4px solid #667eea; padding: 20px; margin: 20px 0; border-radius: 5px;">
                      <h3 style="margin-top: 0; color: #667eea;">📋 Reminder Details</h3>
                      <p style="margin: 10px 0;"><strong>Title:</strong> ${title}</p>
                      ${description ? `<p style="margin: 10px 0;"><strong>Description:</strong> ${description}</p>` : ''}
                      <p style="margin: 10px 0;"><strong>Type:</strong> ${type}</p>
                      <p style="margin: 10px 0;"><strong>Scheduled For:</strong> ${formattedDate}</p>
                      <p style="margin: 10px 0;"><strong>Frequency:</strong> ${frequency}</p>
                    </div>

                    <div style="background: #e3f2fd; border-left: 4px solid #2196f3; padding: 15px; margin: 20px 0; border-radius: 5px;">
                      <p style="margin: 0; font-size: 14px;">
                        <strong>📧 You will receive an email notification at the scheduled time.</strong>
                      </p>
                    </div>

                    <p style="font-size: 14px; color: #666; margin-top: 20px;">
                      You can manage your reminders anytime by visiting the Reminders page on MF Analyser.
                    </p>
                    
                    <p style="font-size: 14px; color: #666; margin-top: 20px;">
                      Best regards,<br>
                      <strong>MF Analyser Team</strong>
                    </p>
                  </div>
                </body>
              </html>
            `,
          });

          if (emailResult && emailResult.success) {
            console.log(
              '✅ Confirmation email sent successfully to:',
              user.email
            );
          } else {
            console.error(
              '❌ Confirmation email failed:',
              emailResult?.error || 'Unknown error'
            );
          }
        } else {
          console.log('⚠️  Skipping confirmation email - conditions not met');
        }
      } catch (emailError) {
        console.error(
          '❌ Failed to send confirmation email:',
          emailError.message
        );
        console.error('   Stack:', emailError.stack);
        // Don't fail the request if email fails
      }

      res.status(201).json({
        success: true,
        message: 'Reminder created successfully and saved to database',
        data: reminder,
      });
    } catch (error) {
      console.error('Error creating reminder:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create reminder',
        message: error.message,
      });
    }
  }

  /**
   * Update reminder
   * PUT /api/reminders/:id
   */
  static async updateReminder(req, res) {
    try {
      const userId = req.user.userId;
      const { id } = req.params;
      const updates = req.body;

      // Remove fields that shouldn't be updated directly
      delete updates.userId;
      delete updates._id;
      delete updates.createdAt;

      const reminder = await Reminder.findOneAndUpdate(
        { _id: id, userId },
        { $set: updates },
        { new: true, runValidators: true }
      );

      if (!reminder) {
        return res.status(404).json({
          success: false,
          error: 'Reminder not found',
        });
      }

      res.json({
        success: true,
        message: 'Reminder updated successfully',
        data: reminder,
      });
    } catch (error) {
      console.error('Error updating reminder:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update reminder',
        message: error.message,
      });
    }
  }

  /**
   * Mark reminder as completed
   * PATCH /api/reminders/:id/complete
   */
  static async completeReminder(req, res) {
    try {
      const userId = req.user.userId;
      const { id } = req.params;

      const reminder = await Reminder.findOne({ _id: id, userId });

      if (!reminder) {
        return res.status(404).json({
          success: false,
          error: 'Reminder not found',
        });
      }

      await reminder.markAsCompleted();

      res.json({
        success: true,
        message: 'Reminder marked as completed',
        data: reminder,
      });
    } catch (error) {
      console.error('Error completing reminder:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to complete reminder',
        message: error.message,
      });
    }
  }

  /**
   * Delete reminder
   * DELETE /api/reminders/:id
   */
  static async deleteReminder(req, res) {
    try {
      const userId = req.user.userId;
      const { id } = req.params;

      const reminder = await Reminder.findOneAndDelete({ _id: id, userId });

      if (!reminder) {
        return res.status(404).json({
          success: false,
          error: 'Reminder not found',
        });
      }

      res.json({
        success: true,
        message: 'Reminder deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting reminder:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete reminder',
        message: error.message,
      });
    }
  }

  /**
   * Get upcoming reminders
   * GET /api/reminders/upcoming?days=7
   */
  static async getUpcomingReminders(req, res) {
    try {
      const userId = req.user.userId;
      const days = parseInt(req.query.days) || 7;

      const reminders = await Reminder.getUpcomingReminders(userId, days);

      res.json({
        success: true,
        data: reminders,
        meta: {
          days,
          count: reminders.length,
        },
      });
    } catch (error) {
      console.error('Error fetching upcoming reminders:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch upcoming reminders',
        message: error.message,
      });
    }
  }
}

module.exports = ReminderController;
