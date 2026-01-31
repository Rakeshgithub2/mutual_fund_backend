import { Router, Request, Response } from 'express';
import nodemailer from 'nodemailer';

const router = Router();

// Email configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'your-email@gmail.com',
    pass: process.env.EMAIL_PASSWORD || 'your-app-password',
  },
});

// POST /api/feedback - Submit user feedback
router.post('/', async (req: Request, res: Response) => {
  try {
    const { feedback, timestamp } = req.body;

    if (!feedback || !feedback.trim()) {
      return res.status(400).json({ error: 'Feedback is required' });
    }

    // Log feedback to console
    console.log('\n' + '='.repeat(80));
    console.log('📬 NEW USER FEEDBACK RECEIVED');
    console.log('='.repeat(80));
    console.log(`Date: ${new Date(timestamp).toLocaleString()}`);
    console.log(`\nFeedback:\n${feedback}`);
    console.log('='.repeat(80) + '\n');

    // Send email to rakeshd01042024@gmail.com
    try {
      // Check if email is configured
      if (
        !process.env.EMAIL_PASSWORD ||
        process.env.EMAIL_PASSWORD === 'your-gmail-app-password-here'
      ) {
        console.warn(
          '⚠️  EMAIL_PASSWORD not configured - email will not be sent'
        );
        console.warn(
          '⚠️  Please create a Gmail App Password and update .env file'
        );
        console.warn('⚠️  Visit: https://myaccount.google.com/apppasswords');

        // Return success but skip email
        return res.status(200).json({
          success: true,
          message: 'Feedback received (email not configured)',
          warning:
            'Email notifications are not configured. Please set up Gmail App Password.',
        });
      }

      await transporter.sendMail({
        from: process.env.EMAIL_USER || 'noreply@mutualfunds.com',
        to: process.env.ADMIN_EMAIL || 'rakeshd01042024@gmail.com',
        subject: '📬 New User Feedback',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 2px solid #4F46E5; border-radius: 10px;">
            <h2 style="color: #4F46E5; border-bottom: 2px solid #4F46E5; padding-bottom: 10px;">
              📬 New User Feedback
            </h2>
            
            <div style="margin: 20px 0; padding: 15px; background-color: #F3F4F6; border-radius: 8px;">
              <p style="margin: 5px 0;"><strong>📅 Date:</strong> ${new Date(timestamp).toLocaleString()}</p>
            </div>
            
            <div style="margin: 20px 0;">
              <h3 style="color: #1F2937;">Feedback Message:</h3>
              <div style="padding: 15px; background-color: #FFFFFF; border-left: 4px solid #4F46E5; border-radius: 4px;">
                <p style="white-space: pre-wrap; color: #374151; line-height: 1.6;">${feedback}</p>
              </div>
            </div>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #E5E7EB; text-align: center; color: #6B7280; font-size: 12px;">
              <p>This is an automated message from your Mutual Funds Platform</p>
            </div>
          </div>
        `,
      });
      console.log('✅ Email sent successfully to rakeshd01042024@gmail.com');
    } catch (emailError) {
      console.error('❌ Failed to send email:', emailError);
      // Continue even if email fails - feedback is still logged
    }

    res.status(200).json({
      success: true,
      message: 'Feedback received successfully',
    });
  } catch (error) {
    console.error('Error processing feedback:', error);
    res.status(500).json({
      error: 'Failed to process feedback',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
