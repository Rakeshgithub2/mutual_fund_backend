import { Resend } from 'resend';
import * as Handlebars from 'handlebars';

interface EmailTemplate {
  subject: string;
  html: string;
}

interface VerificationEmailData {
  name: string;
  verificationUrl: string;
}

interface AlertEmailData {
  name: string;
  fundName: string;
  alertType: string;
  condition: string;
  currentValue: string;
}

interface DigestEmailData {
  name: string;
  portfolioSummary: {
    totalValue: string;
    dayChange: string;
    dayChangePercent: string;
  };
  topPerformers: Array<{
    name: string;
    change: string;
  }>;
  alerts: Array<{
    fundName: string;
    message: string;
  }>;
}

interface WelcomeEmailData {
  name: string;
  authMethod: 'google' | 'email';
}

interface PasswordResetEmailData {
  name: string;
  resetUrl: string;
}

interface FeedbackEmailData {
  feedbackType: string;
  rating: number;
  name: string;
  email: string | null;
  message: string;
  userId: string | null;
  timestamp: Date;
}

export class EmailService {
  private resend: Resend | null;
  private fromEmail: string;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey || apiKey === 'your-resend-api-key-here') {
      console.warn(
        '⚠️  RESEND_API_KEY is not configured - email sending will be disabled'
      );
      this.resend = null;
    } else {
      this.resend = new Resend(apiKey);
    }

    this.fromEmail = process.env.FROM_EMAIL || 'noreply@mutualfunds.com';
  }

  /**
   * Send welcome email to newly registered user
   */
  async sendWelcomeEmail(
    to: string,
    data: WelcomeEmailData
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.resend) {
      console.log('Email service disabled - skipping welcome email');
      return { success: false, error: 'Email service not configured' };
    }

    try {
      const template = this.getWelcomeTemplate();
      const compiled = Handlebars.compile(template.html);
      const html = compiled(data);

      const result = await this.resend.emails.send({
        from: this.fromEmail,
        to,
        subject: template.subject,
        html,
      });

      console.log(`✓ Welcome email sent to ${to}:`, result.data?.id);
      return { success: true };
    } catch (error) {
      console.error(`Failed to send welcome email to ${to}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(
    to: string,
    data: PasswordResetEmailData
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.resend) {
      console.log('Email service disabled - skipping password reset email');
      return { success: false, error: 'Email service not configured' };
    }

    try {
      const template = this.getPasswordResetTemplate();
      const compiled = Handlebars.compile(template.html);
      const html = compiled(data);

      const result = await this.resend.emails.send({
        from: this.fromEmail,
        to,
        subject: template.subject,
        html,
      });

      console.log(`✓ Password reset email sent to ${to}:`, result.data?.id);
      return { success: true };
    } catch (error) {
      console.error(`Failed to send password reset email to ${to}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Send feedback notification email to admin
   */
  async sendFeedbackNotification(
    data: FeedbackEmailData
  ): Promise<{ success: boolean; error?: string }> {
    // Use nodemailer for feedback emails
    const nodemailer = require('nodemailer');

    // Check if email credentials are configured
    const emailUser = process.env.EMAIL_USER;
    const emailPassword = process.env.EMAIL_PASSWORD;
    const adminEmail = process.env.ADMIN_EMAIL || 'rakesh27082003@gmail.com';

    if (
      !emailUser ||
      !emailPassword ||
      emailPassword === 'your-app-specific-password'
    ) {
      console.warn(
        '⚠️  Email credentials not configured - feedback email will not be sent'
      );
      return { success: false, error: 'Email service not configured' };
    }

    try {
      // Create transporter
      const transporter = nodemailer.createTransport({
        service: process.env.EMAIL_SERVICE || 'gmail',
        auth: {
          user: emailUser,
          pass: emailPassword,
        },
      });

      // Generate star rating
      const stars = '⭐'.repeat(Math.floor(data.rating));
      const ratingText =
        data.rating > 0 ? `${data.rating}/5 ${stars}` : 'No rating';

      // Format feedback type
      const typeEmoji =
        {
          bug: '🐛',
          feature: '✨',
          general: '💬',
        }[data.feedbackType] || '💬';

      // Send email
      await transporter.sendMail({
        from: emailUser,
        to: adminEmail,
        replyTo: data.email || undefined,
        subject: `New Feedback: [${data.feedbackType.toUpperCase()}] - ${ratingText}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>New Feedback Received</title>
            <style>
              body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                line-height: 1.6; 
                color: #333;
                margin: 0;
                padding: 0;
                background-color: #f5f5f5;
              }
              .container { 
                max-width: 600px; 
                margin: 20px auto; 
                background: white;
                border-radius: 12px;
                overflow: hidden;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
              }
              .header { 
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white; 
                padding: 30px 20px; 
                text-align: center;
              }
              .header h1 {
                margin: 0;
                font-size: 24px;
                font-weight: 600;
              }
              .content { 
                padding: 30px;
              }
              .info-box { 
                background: #f8f9fa;
                border-left: 4px solid #667eea;
                padding: 20px;
                border-radius: 8px;
                margin: 20px 0;
              }
              .info-row {
                display: flex;
                margin: 10px 0;
                font-size: 14px;
              }
              .info-label {
                font-weight: 600;
                color: #495057;
                min-width: 120px;
              }
              .info-value {
                color: #212529;
              }
              .message-box {
                background: #fff;
                border: 1px solid #e9ecef;
                border-radius: 8px;
                padding: 20px;
                margin: 20px 0;
              }
              .message-box h3 {
                margin-top: 0;
                color: #495057;
                font-size: 16px;
              }
              .message-text {
                white-space: pre-wrap;
                color: #212529;
                line-height: 1.6;
                font-size: 14px;
              }
              .type-badge {
                display: inline-block;
                padding: 4px 12px;
                border-radius: 20px;
                font-size: 12px;
                font-weight: 600;
                text-transform: uppercase;
              }
              .type-bug {
                background: #fee;
                color: #c00;
              }
              .type-feature {
                background: #efe;
                color: #060;
              }
              .type-general {
                background: #eef;
                color: #006;
              }
              .rating {
                font-size: 20px;
                color: #ffc107;
              }
              .footer { 
                background: #f8f9fa;
                padding: 20px;
                text-align: center;
                font-size: 12px;
                color: #6c757d;
                border-top: 1px solid #e9ecef;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>${typeEmoji} New User Feedback Received</h1>
              </div>
              
              <div class="content">
                <div class="info-box">
                  <div class="info-row">
                    <span class="info-label">Feedback Type:</span>
                    <span class="info-value">
                      <span class="type-badge type-${data.feedbackType}">${typeEmoji} ${data.feedbackType.toUpperCase()}</span>
                    </span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">Rating:</span>
                    <span class="info-value rating">${ratingText}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">Name:</span>
                    <span class="info-value">${data.name}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">Email:</span>
                    <span class="info-value">${data.email || 'Not provided'}</span>
                  </div>
                  ${
                    data.userId
                      ? `
                  <div class="info-row">
                    <span class="info-label">User ID:</span>
                    <span class="info-value">${data.userId}</span>
                  </div>
                  `
                      : ''
                  }
                  <div class="info-row">
                    <span class="info-label">Submitted:</span>
                    <span class="info-value">${new Date(
                      data.timestamp
                    ).toLocaleString('en-US', {
                      dateStyle: 'full',
                      timeStyle: 'long',
                    })}</span>
                  </div>
                </div>
                
                <div class="message-box">
                  <h3>📝 Message:</h3>
                  <div class="message-text">${this.escapeHtml(data.message)}</div>
                </div>
              </div>
              
              <div class="footer">
                <p>This is an automated notification from your Mutual Funds Platform</p>
                <p>&copy; ${new Date().getFullYear()} Mutual Funds Portal. All rights reserved.</p>
              </div>
            </div>
          </body>
          </html>
        `,
      });

      console.log(`✓ Feedback notification email sent to ${adminEmail}`);
      return { success: true };
    } catch (error) {
      console.error('Failed to send feedback notification email:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Escape HTML to prevent XSS
   */
  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }

  async sendVerificationEmail(
    to: string,
    data: VerificationEmailData
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.resend) {
      console.log('Email service disabled - skipping verification email');
      return { success: false, error: 'Email service not configured' };
    }

    try {
      const template = this.getVerificationTemplate();
      const compiled = Handlebars.compile(template.html);
      const html = compiled(data);

      const result = await this.resend.emails.send({
        from: this.fromEmail,
        to,
        subject: template.subject,
        html,
      });

      console.log(`Verification email sent to ${to}:`, result.data?.id);
      return { success: true };
    } catch (error) {
      console.error(`Failed to send verification email to ${to}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async sendAlertEmail(
    to: string,
    data: AlertEmailData
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.resend) {
      console.log('Email service disabled - skipping alert email');
      return { success: false, error: 'Email service not configured' };
    }

    try {
      const template = this.getAlertTemplate();
      const compiled = Handlebars.compile(template.html);
      const html = compiled(data);

      const result = await this.resend.emails.send({
        from: this.fromEmail,
        to,
        subject: template.subject,
        html,
      });

      console.log(`Alert email sent to ${to}:`, result.data?.id);
      return { success: true };
    } catch (error) {
      console.error(`Failed to send alert email to ${to}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async sendDigestEmail(
    to: string,
    data: DigestEmailData
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.resend) {
      console.log('Email service disabled - skipping digest email');
      return { success: false, error: 'Email service not configured' };
    }

    try {
      const template = this.getDigestTemplate();
      const compiled = Handlebars.compile(template.html);
      const html = compiled(data);

      const result = await this.resend.emails.send({
        from: this.fromEmail,
        to,
        subject: template.subject,
        html,
      });

      console.log(`Digest email sent to ${to}:`, result.data?.id);
      return { success: true };
    } catch (error) {
      console.error(`Failed to send digest email to ${to}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private getWelcomeTemplate(): EmailTemplate {
    return {
      subject: '🎉 Welcome to Mutual Funds Platform!',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to Mutual Funds Platform</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
          <table cellpadding="0" cellspacing="0" width="100%" style="background-color: #f4f4f4; padding: 20px 0;">
            <tr>
              <td align="center">
                <table cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                  <tr>
                    <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center;">
                      <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Welcome to Mutual Funds Platform! 🎉</h1>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 40px 30px;">
                      <h2 style="color: #333333; margin-top: 0;">Hello {{name}}!</h2>
                      <p style="color: #666666; font-size: 16px; line-height: 1.6;">
                        Thank you for joining Mutual Funds Platform! We're excited to have you on board.
                      </p>
                      <p style="color: #666666; font-size: 16px; line-height: 1.6;">
                        You've successfully registered {{#if (eq authMethod 'google')}}using your Google account{{else}}with your email and password{{/if}}. You can now:
                      </p>
                      <ul style="color: #666666; font-size: 16px; line-height: 1.8;">
                        <li>📊 Browse thousands of mutual funds</li>
                        <li>💼 Build and track your investment portfolio</li>
                        <li>📈 Compare fund performance and overlap</li>
                        <li>🎯 Set financial goals and get recommendations</li>
                        <li>📱 Receive personalized alerts and insights</li>
                      </ul>
                      <div style="text-align: center; margin: 30px 0;">
                        <a href="${process.env.FRONTEND_URL || 'http://localhost:3001'}" 
                           style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 14px 30px; border-radius: 6px; font-weight: bold; font-size: 16px;">
                          Start Exploring
                        </a>
                      </div>
                      <p style="color: #666666; font-size: 14px; line-height: 1.6; margin-top: 30px;">
                        If you have any questions, feel free to reach out to our support team.
                      </p>
                      <p style="color: #666666; font-size: 14px; line-height: 1.6;">
                        Happy Investing!<br>
                        <strong>The Mutual Funds Platform Team</strong>
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style="background-color: #f8f9fa; padding: 20px 30px; text-align: center; border-top: 1px solid #e0e0e0;">
                      <p style="color: #999999; font-size: 12px; margin: 0;">
                        © ${new Date().getFullYear()} Mutual Funds Platform. All rights reserved.
                      </p>
                      <p style="color: #999999; font-size: 12px; margin: 10px 0 0 0;">
                        This is an automated email. Please do not reply.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    };
  }

  private getPasswordResetTemplate(): EmailTemplate {
    return {
      subject: '🔐 Reset Your Password',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Reset Your Password</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
          <table cellpadding="0" cellspacing="0" width="100%" style="background-color: #f4f4f4; padding: 20px 0;">
            <tr>
              <td align="center">
                <table cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                  <tr>
                    <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center;">
                      <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Password Reset Request 🔐</h1>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 40px 30px;">
                      <h2 style="color: #333333; margin-top: 0;">Hello {{name}},</h2>
                      <p style="color: #666666; font-size: 16px; line-height: 1.6;">
                        We received a request to reset your password. Click the button below to create a new password:
                      </p>
                      <div style="text-align: center; margin: 30px 0;">
                        <a href="{{resetUrl}}" 
                           style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 14px 30px; border-radius: 6px; font-weight: bold; font-size: 16px;">
                          Reset Password
                        </a>
                      </div>
                      <p style="color: #666666; font-size: 14px; line-height: 1.6;">
                        Or copy and paste this link into your browser:
                      </p>
                      <p style="color: #667eea; font-size: 14px; word-break: break-all;">
                        {{resetUrl}}
                      </p>
                      <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
                        <p style="color: #856404; font-size: 14px; margin: 0;">
                          ⚠️ <strong>Security Notice:</strong><br>
                          This link will expire in 1 hour. If you didn't request a password reset, please ignore this email.
                        </p>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td style="background-color: #f8f9fa; padding: 20px 30px; text-align: center; border-top: 1px solid #e0e0e0;">
                      <p style="color: #999999; font-size: 12px; margin: 0;">
                        © ${new Date().getFullYear()} Mutual Funds Platform. All rights reserved.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    };
  }

  private getVerificationTemplate(): EmailTemplate {
    return {
      subject: 'Verify Your Mutual Funds Account',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Account Verification</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
            .content { padding: 30px 20px; }
            .button { display: inline-block; background: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to Mutual Funds Portal</h1>
            </div>
            <div class="content">
              <h2>Hello {{name}},</h2>
              <p>Thank you for signing up! Please verify your email address to complete your account setup.</p>
              <p>Click the button below to verify your account:</p>
              <a href="{{verificationUrl}}" class="button">Verify Account</a>
              <p>If you didn't create an account, you can safely ignore this email.</p>
              <p>This verification link will expire in 24 hours.</p>
            </div>
            <div class="footer">
              <p>&copy; 2024 Mutual Funds Portal. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    };
  }

  private getAlertTemplate(): EmailTemplate {
    return {
      subject: 'Investment Alert - {{fundName}}',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Investment Alert</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #dc2626; color: white; padding: 20px; text-align: center; }
            .content { padding: 30px 20px; }
            .alert-box { background: #fef2f2; border: 1px solid #fecaca; padding: 15px; border-radius: 5px; margin: 20px 0; }
            .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🚨 Investment Alert</h1>
            </div>
            <div class="content">
              <h2>Hello {{name}},</h2>
              <p>Your alert for <strong>{{fundName}}</strong> has been triggered.</p>
              <div class="alert-box">
                <h3>Alert Details:</h3>
                <p><strong>Type:</strong> {{alertType}}</p>
                <p><strong>Condition:</strong> {{condition}}</p>
                <p><strong>Current Value:</strong> {{currentValue}}</p>
              </div>
              <p>Please review your investment strategy and consider appropriate action.</p>
              <p>Login to your account to manage your alerts and portfolio.</p>
            </div>
            <div class="footer">
              <p>&copy; 2024 Mutual Funds Portal. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    };
  }

  private getDigestTemplate(): EmailTemplate {
    return {
      subject: 'Your Daily Investment Digest',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Daily Digest</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #059669; color: white; padding: 20px; text-align: center; }
            .content { padding: 30px 20px; }
            .summary-box { background: #f0f9ff; border: 1px solid #7dd3fc; padding: 15px; border-radius: 5px; margin: 20px 0; }
            .performer { padding: 10px; border-bottom: 1px solid #e5e7eb; }
            .performer:last-child { border-bottom: none; }
            .positive { color: #059669; }
            .negative { color: #dc2626; }
            .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>📊 Daily Investment Digest</h1>
            </div>
            <div class="content">
              <h2>Hello {{name}},</h2>
              <p>Here's your daily portfolio summary:</p>
              
              <div class="summary-box">
                <h3>Portfolio Summary</h3>
                <p><strong>Total Value:</strong> {{portfolioSummary.totalValue}}</p>
                <p><strong>Today's Change:</strong> 
                  <span class="{{#if portfolioSummary.dayChange}}{{#if (gt portfolioSummary.dayChange 0)}}positive{{else}}negative{{/if}}{{/if}}">
                    {{portfolioSummary.dayChange}} ({{portfolioSummary.dayChangePercent}})
                  </span>
                </p>
              </div>

              {{#if topPerformers}}
              <h3>Top Performers</h3>
              {{#each topPerformers}}
              <div class="performer">
                <strong>{{name}}</strong>: <span class="positive">{{change}}</span>
              </div>
              {{/each}}
              {{/if}}

              {{#if alerts}}
              <h3>Active Alerts</h3>
              {{#each alerts}}
              <div class="performer">
                <strong>{{fundName}}</strong>: {{message}}
              </div>
              {{/each}}
              {{/if}}

              <p>Login to your account for detailed analysis and portfolio management.</p>
            </div>
            <div class="footer">
              <p>&copy; 2024 Mutual Funds Portal. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    };
  }

  /**
   * Send password reset OTP email
   */
  async sendPasswordResetOTP(
    to: string,
    data: { name: string; otp: string }
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.resend) {
      console.log('Email service disabled - skipping OTP email');
      return { success: false, error: 'Email service not configured' };
    }

    try {
      const template = this.getPasswordResetOTPTemplate();
      const compiled = Handlebars.compile(template.html);
      const html = compiled(data);

      const result = await this.resend.emails.send({
        from: this.fromEmail,
        to,
        subject: template.subject,
        html,
      });

      console.log('Password reset OTP email sent:', result);
      return { success: true };
    } catch (error: any) {
      console.error('Failed to send password reset OTP:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send password changed confirmation email
   */
  async sendPasswordChangedEmail(
    to: string,
    data: { name: string }
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.resend) {
      console.log('Email service disabled - skipping password changed email');
      return { success: false, error: 'Email service not configured' };
    }

    try {
      const template = this.getPasswordChangedTemplate();
      const compiled = Handlebars.compile(template.html);
      const html = compiled(data);

      const result = await this.resend.emails.send({
        from: this.fromEmail,
        to,
        subject: template.subject,
        html,
      });

      console.log('Password changed email sent:', result);
      return { success: true };
    } catch (error: any) {
      console.error('Failed to send password changed email:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Password reset OTP template
   */
  private getPasswordResetOTPTemplate(): EmailTemplate {
    return {
      subject: '🔐 Your Password Reset Code',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Password Reset OTP</title>
          <style>
            body { font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; padding: 30px; text-align: center; }
            .content { padding: 40px 30px; }
            .otp-box { background-color: #f8f9fa; border: 2px dashed #667eea; border-radius: 8px; padding: 30px; text-align: center; margin: 30px 0; }
            .otp-code { font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #667eea; font-family: 'Courier New', monospace; }
            .warning { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
            .button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 14px 30px; border-radius: 6px; font-weight: bold; margin: 20px 0; }
            .footer { background-color: #f8f9fa; padding: 20px 30px; text-align: center; border-top: 1px solid #e0e0e0; color: #999999; font-size: 12px; }
          </style>
        </head>
        <body>
          <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f4f4f4;">
            <tr>
              <td align="center" style="padding: 20px;">
                <table cellpadding="0" cellspacing="0" border="0" class="container" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                  <tr>
                    <td class="header" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; padding: 30px; text-align: center;">
                      <h1 style="margin: 0;">🔐 Password Reset</h1>
                    </td>
                  </tr>
                  <tr>
                    <td class="content" style="padding: 40px 30px;">
                      <h2 style="color: #333333; margin-top: 0;">Hello {{name}}!</h2>
                      <p style="color: #666666; font-size: 16px; line-height: 1.6;">
                        We received a request to reset your password. Use the OTP code below to reset your password:
                      </p>
                      
                      <div class="otp-box" style="background-color: #f8f9fa; border: 2px dashed #667eea; border-radius: 8px; padding: 30px; text-align: center; margin: 30px 0;">
                        <p style="color: #666666; margin: 0 0 15px 0; font-size: 14px;">Your OTP Code:</p>
                        <div class="otp-code" style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #667eea; font-family: 'Courier New', monospace;">
                          {{otp}}
                        </div>
                        <p style="color: #999999; margin: 15px 0 0 0; font-size: 12px;">This code will expire in 10 minutes</p>
                      </div>

                      <div class="warning" style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
                        <p style="margin: 0; color: #856404; font-size: 14px;">
                          ⚠️ <strong>Security Notice:</strong> If you didn't request this password reset, please ignore this email and ensure your account is secure.
                        </p>
                      </div>

                      <p style="color: #666666; font-size: 14px; line-height: 1.6;">
                        Enter this code on the password reset page to create a new password for your account.
                      </p>

                      <p style="color: #666666; font-size: 14px; line-height: 1.6; margin-top: 30px;">
                        Best regards,<br>
                        <strong>The Mutual Funds Platform Team</strong>
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td class="footer" style="background-color: #f8f9fa; padding: 20px 30px; text-align: center; border-top: 1px solid #e0e0e0;">
                      <p style="color: #999999; font-size: 12px; margin: 0;">
                        © ${new Date().getFullYear()} Mutual Funds Platform. All rights reserved.
                      </p>
                      <p style="color: #999999; font-size: 12px; margin: 10px 0 0 0;">
                        This is an automated email. Please do not reply.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    };
  }

  /**
   * Password changed confirmation template
   */
  private getPasswordChangedTemplate(): EmailTemplate {
    return {
      subject: '✅ Your Password Has Been Changed',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Password Changed</title>
          <style>
            body { font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #4caf50 0%, #45a049 100%); color: #ffffff; padding: 30px; text-align: center; }
            .content { padding: 40px 30px; }
            .success-box { background-color: #d4edda; border: 2px solid #c3e6cb; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0; color: #155724; }
            .footer { background-color: #f8f9fa; padding: 20px 30px; text-align: center; border-top: 1px solid #e0e0e0; color: #999999; font-size: 12px; }
          </style>
        </head>
        <body>
          <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f4f4f4;">
            <tr>
              <td align="center" style="padding: 20px;">
                <table cellpadding="0" cellspacing="0" border="0" class="container" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                  <tr>
                    <td class="header" style="background: linear-gradient(135deg, #4caf50 0%, #45a049 100%); color: #ffffff; padding: 30px; text-align: center;">
                      <h1 style="margin: 0;">✅ Password Changed</h1>
                    </td>
                  </tr>
                  <tr>
                    <td class="content" style="padding: 40px 30px;">
                      <h2 style="color: #333333; margin-top: 0;">Hello {{name}}!</h2>
                      
                      <div class="success-box" style="background-color: #d4edda; border: 2px solid #c3e6cb; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0; color: #155724;">
                        <h3 style="margin: 0 0 10px 0;">Your password has been successfully changed</h3>
                        <p style="margin: 0; font-size: 14px;">You can now login with your new password</p>
                      </div>

                      <p style="color: #666666; font-size: 16px; line-height: 1.6;">
                        Your account password was recently updated. If you made this change, you can safely ignore this email.
                      </p>

                      <p style="color: #666666; font-size: 16px; line-height: 1.6;">
                        <strong>If you did NOT make this change:</strong> Please contact our support team immediately, as your account may have been compromised.
                      </p>

                      <p style="color: #666666; font-size: 14px; line-height: 1.6; margin-top: 30px;">
                        Stay secure,<br>
                        <strong>The Mutual Funds Platform Team</strong>
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td class="footer" style="background-color: #f8f9fa; padding: 20px 30px; text-align: center; border-top: 1px solid #e0e0e0;">
                      <p style="color: #999999; font-size: 12px; margin: 0;">
                        © ${new Date().getFullYear()} Mutual Funds Platform. All rights reserved.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    };
  }
}

export const emailService = new EmailService();
