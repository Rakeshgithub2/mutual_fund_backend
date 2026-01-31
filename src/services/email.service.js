/**
 * Email Service
 * Handles sending emails using Resend API or Gmail SMTP
 */

const { Resend } = require('resend');
const nodemailer = require('nodemailer');

// Check which email service to use
const USE_GMAIL = process.env.USE_GMAIL === 'true';

// Initialize Resend with graceful fallback if API key is missing
let resend;
try {
  if (process.env.RESEND_API_KEY && !USE_GMAIL) {
    resend = new Resend(process.env.RESEND_API_KEY);
  } else {
    console.warn('⚠️  RESEND_API_KEY not set - Email service will not work');
    resend = null;
  }
} catch (error) {
  console.error('❌ Failed to initialize Resend:', error.message);
  resend = null;
}

// Initialize Gmail transporter if enabled
let gmailTransporter;
if (USE_GMAIL) {
  try {
    if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
      gmailTransporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.GMAIL_USER,
          pass: process.env.GMAIL_APP_PASSWORD,
        },
      });
      console.log('✅ Gmail SMTP configured for:', process.env.GMAIL_USER);
    } else {
      console.warn(
        '⚠️  Gmail credentials not set - Email service will not work'
      );
      gmailTransporter = null;
    }
  } catch (error) {
    console.error('❌ Failed to initialize Gmail transporter:', error.message);
    gmailTransporter = null;
  }
}

class EmailService {
  /**
   * Send OTP email for password reset
   */
  static async sendPasswordResetOTP(email, otp, userName) {
    if (!resend) {
      console.warn(
        '⚠️  Email service not available - RESEND_API_KEY not configured'
      );
      return { success: false, error: 'Email service not configured' };
    }
    try {
      const { data, error } = await resend.emails.send({
        from: process.env.FROM_EMAIL || 'onboarding@resend.dev',
        to: email,
        subject: '🔐 Password Reset Code - MF Analyser',
        html: `
          <!DOCTYPE html>
          <html lang="en">
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <style>
                body { 
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
                  margin: 0;
                  padding: 40px 20px;
                  background-color: #f5f5f5;
                }
                .email-container {
                  max-width: 500px;
                  margin: 0 auto;
                  background: white;
                  padding: 40px;
                  border-radius: 12px;
                  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                  text-align: center;
                }
                h1 {
                  color: #333;
                  font-size: 24px;
                  margin-bottom: 20px;
                  font-weight: 700;
                }
                p {
                  color: #555;
                  font-size: 16px;
                  line-height: 1.6;
                  margin: 15px 0;
                }
                .otp-box {
                  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                  color: white;
                  font-size: 48px;
                  font-weight: 900;
                  letter-spacing: 10px;
                  padding: 25px 40px;
                  border-radius: 12px;
                  margin: 30px 0;
                  font-family: 'Courier New', monospace;
                  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
                }
                .bold {
                  font-weight: 700;
                  color: #333;
                }
                .footer {
                  margin-top: 30px;
                  padding-top: 20px;
                  border-top: 1px solid #eee;
                  color: #999;
                  font-size: 13px;
                }
              </style>
            </head>
            <body>
              <div class="email-container">
                <h1>🔐 Password Reset Code</h1>
                
                <p><span class="bold">Hello ${userName || 'there'},</span></p>
                
                <p>Your password reset code is:</p>
                
                <div class="otp-box">${otp}</div>
                
                <p><span class="bold">Valid for 10 minutes only.</span></p>
                
                <p>If you didn't request this, please ignore this email.</p>
                
                <div class="footer">
                  © ${new Date().getFullYear()} MF Analyser - Automated Email
                </div>
              </div>
            </body>
          </html>
        `,
      });

      if (error) {
        console.error('Email sending error:', error);
        return { success: false, error };
      }

      console.log('✅ Password reset OTP sent:', data);
      return { success: true, data };
    } catch (error) {
      console.error('Email service error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send welcome email to new users
   */
  static async sendWelcomeEmail(email, userInfo) {
    // Support both old and new API
    const userName =
      typeof userInfo === 'string'
        ? userInfo
        : userInfo?.name || userInfo?.firstName || 'Valued User';

    if (!resend) {
      console.warn(
        '⚠️  Email service not available - RESEND_API_KEY not configured'
      );
      return { success: false, error: 'Email service not configured' };
    }

    try {
      const { data, error } = await resend.emails.send({
        from: process.env.FROM_EMAIL || 'onboarding@resend.dev',
        to: email,
        subject:
          '🎉 Welcome to Mutual Funds Portal - Your Investment Journey Begins!',
        html: `
          <!DOCTYPE html>
          <html lang="en">
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { 
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                  line-height: 1.6; 
                  color: #333;
                  background-color: #f4f7fa;
                }
                .email-wrapper { 
                  max-width: 600px; 
                  margin: 40px auto; 
                  background: #ffffff;
                  border-radius: 12px;
                  overflow: hidden;
                  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                }
                .header { 
                  background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 50%, #06b6d4 100%);
                  padding: 60px 30px;
                  text-align: center;
                  position: relative;
                  overflow: hidden;
                }
                .header::before {
                  content: '';
                  position: absolute;
                  top: 0;
                  left: 0;
                  right: 0;
                  bottom: 0;
                  background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 120"><path fill="%23ffffff" fill-opacity="0.1" d="M0,0 L1200,0 L1200,80 Q600,120 0,80 Z"/></svg>') no-repeat bottom;
                  background-size: cover;
                }
                .header::after {
                  content: '';
                  position: absolute;
                  top: -50%;
                  right: -10%;
                  width: 300px;
                  height: 300px;
                  background: rgba(255,255,255,0.1);
                  border-radius: 50%;
                }
                .logo {
                  font-size: 48px;
                  font-weight: 900;
                  color: white;
                  margin-bottom: 15px;
                  text-shadow: 3px 3px 6px rgba(0,0,0,0.3);
                  letter-spacing: -1px;
                  position: relative;
                  z-index: 1;
                }
                .header h1 { 
                  color: white; 
                  font-size: 36px; 
                  font-weight: 800;
                  margin-bottom: 15px;
                  position: relative;
                  z-index: 1;
                  text-shadow: 2px 2px 4px rgba(0,0,0,0.2);
                }
                .header p {
                  color: rgba(255, 255, 255, 0.95);
                  font-size: 17px;
                  font-weight: 500;
                  position: relative;
                  z-index: 1;
                }
                .content { 
                  padding: 40px 30px;
                  background: #ffffff;
                }
                .greeting { 
                  font-size: 22px;
                  font-weight: 700;
                  color: #1a202c;
                  margin-bottom: 20px;
                }
                .message {
                  font-size: 15px;
                  color: #4a5568;
                  margin-bottom: 25px;
                  line-height: 1.8;
                }
                .features-grid {
                  display: grid;
                  grid-template-columns: 1fr 1fr;
                  gap: 20px;
                  margin: 30px 0;
                }
                .feature-card {
                  background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%);
                  border: 1px solid #e2e8f0;
                  border-radius: 10px;
                  padding: 20px;
                  text-align: center;
                }
                .feature-icon {
                  font-size: 36px;
                  margin-bottom: 10px;
                }
                .feature-title {
                  font-size: 14px;
                  font-weight: 700;
                  color: #2d3748;
                  margin-bottom: 8px;
                }
                .feature-desc {
                  font-size: 12px;
                  color: #718096;
                  line-height: 1.5;
                }
                .cta-button {
                  display: inline-block;
                  background: linear-gradient(135deg, #2563eb 0%, #06b6d4 100%);
                  color: white;
                  padding: 18px 50px;
                  text-decoration: none;
                  border-radius: 50px;
                  font-weight: 700;
                  font-size: 17px;
                  margin: 35px 0;
                  box-shadow: 0 8px 20px rgba(37, 99, 235, 0.4);
                  transition: all 0.3s ease;
                  text-transform: uppercase;
                  letter-spacing: 1px;
                }
                .cta-button:hover {
                  transform: translateY(-3px);
                  box-shadow: 0 12px 28px rgba(37, 99, 235, 0.5);
                }
                .highlight-box {
                  background: #ebf8ff;
                  border-left: 4px solid #4299e1;
                  border-radius: 6px;
                  padding: 20px;
                  margin: 30px 0;
                }
                .highlight-box h3 {
                  color: #2c5282;
                  font-size: 16px;
                  font-weight: 600;
                  margin-bottom: 12px;
                }
                .highlight-box ul {
                  margin: 10px 0;
                  padding-left: 20px;
                }
                .highlight-box li {
                  color: #2c5282;
                  font-size: 14px;
                  margin: 8px 0;
                }
                .stats-row {
                  display: flex;
                  justify-content: space-around;
                  margin: 30px 0;
                  padding: 25px;
                  background: #f7fafc;
                  border-radius: 10px;
                }
                .stat {
                  text-align: center;
                }
                .stat-number {
                  font-size: 28px;
                  font-weight: 700;
                  color: #667eea;
                  margin-bottom: 8px;
                }
                .stat-label {
                  font-size: 12px;
                  color: #718096;
                  font-weight: 600;
                  text-transform: uppercase;
                  letter-spacing: 1px;
                }
                .company-info {
                  background: #f7fafc;
                  border-top: 1px solid #e2e8f0;
                  padding: 30px;
                  text-align: center;
                }
                .company-name {
                  font-size: 20px;
                  font-weight: 700;
                  color: #667eea;
                  margin-bottom: 8px;
                }
                .company-tagline {
                  font-size: 14px;
                  color: #4a5568;
                  font-weight: 500;
                  margin-bottom: 20px;
                }
                .contact-info {
                  font-size: 12px;
                  color: #718096;
                  line-height: 1.8;
                }
                .footer {
                  padding: 25px 30px;
                  background: #2d3748;
                  color: #cbd5e0;
                  font-size: 12px;
                  text-align: center;
                }
                .footer-links {
                  margin: 15px 0;
                }
                .footer-links a {
                  color: #90cdf4;
                  text-decoration: none;
                  margin: 0 12px;
                  font-weight: 500;
                }
                .social-links {
                  margin: 15px 0;
                }
                .social-links a {
                  color: #cbd5e0;
                  text-decoration: none;
                  margin: 0 10px;
                  font-size: 20px;
                }
                .copyright {
                  color: #a0aec0;
                  margin-top: 15px;
                  font-size: 11px;
                }
              </style>
            </head>
            <body>div class="logo">MF ANALYSER</div>
                  <h1>🎉 Welcome Aboard!</h1>
                  <p>Your Smart Investment Journey Starts Now</p>
                </div>
                
                <div class="content">
                  <div class="greeting">Hello ${userName || 'there'}! 👋</div>
                  
                  <div class="message">
                    Welcome to <strong>MF Analyser</strong> – India's most intelligent mutual funds analysis platform! 
                    Your account is now active, and you're ready to make smarter investment decisions with our powerful 
                    tools and real-time insights.
                  </div>

                  <div style="text-align: center;">
                    <a href="${process.env.FRONTEND_URL || 'http://localhost:5001'}" class="cta-button">
                      🚀 Start Exploring Now
                  <div style="text-align: center;">
                    <a href="${process.env.FRONTEND_URL || 'http://localhost:5001'}/dashboard" class="cta-button">
                      🚀 Start Exploring Your Dashboard
                    </a>
                  </div>

                  <div class="features-grid">
                    <div class="feature-card">
                      <div class="feature-icon">📊</div>
                      <div class="feature-title">Track Investments</div>
                      <div class="feature-desc">Monitor your entire mutual fund portfolio in real-time</div>
                    </div>
                    <div class="feature-card">
                      <div class="feature-icon">📈</div>
                      <div class="feature-title">Performance Analytics</div>
                      <div class="feature-desc">Get detailed insights with advanced charts & metrics</div>
                    </div>
                    <div class="feature-card">
                      <div class="feature-icon">🎯</div>
                      <div class="feature-title">Goal Planning</div>
                      <div class="feature-desc">Set and achieve your financial goals systematically</div>
                    </div>
                    <div class="feature-card">
                      <div class="feature-icon">🔔</div>
                      <div class="feature-title">Smart Reminders</div>
                      <div class="feature-desc">Never miss SIP dates or important investment milestones</div>
                    </div>
                  </div>

                  <div class="stats-row">
                    <div class="stat">
                      <div class="stat-number">4,485+</div>
                      <div class="stat-label">Funds</div>
                    </div>
                    <div class="stat">
                      <div class="stat-number">100%</div>
                      <div class="stat-label">Free</div>
                    </div>
                    <div class="stat">
                      <div class="stat-number">24/7</div>
                      <div class="stat-label">Access</div>
                    </div>
                  </div>

                  <div class="highlight-box">
                    <h3>🎁 What's Included in Your Account:</h3>
                    <ul>
                      <li><strong>Fund Comparison Tool</strong> - Compare multiple funds side-by-side</li>
                      <li><strong>Portfolio Overlap Analysis</strong> - Avoid redundant investments</li>
                      <li><strong>Investment Calculators</strong> - SIP, Lumpsum, and Goal planning calculators</li>
                      <li><strong>Fund Manager Insights</strong> - Track top-performing fund managers</li>
                      <li><strong>AI-Powered Assistant</strong> - Get instant answers to your investment queries</li>
                      <li><strong>Real-time Market Data</strong> - Stay updated with live indices and market trends</li>
                    </ul>
                  </div>

                  <div class="message">
                    <strong>Need Help Getting Started?</strong><br>
                    Visit our <a href="${process.env.FRONTEND_URL || 'http://localhost:5001'}/help" style="color: #667eea; text-decoration: none;">Help Center</a> 
                    or reach out to our support team at <strong>support@mutualfundsportal.com</strong>
                  </div>

                  <div class="message" style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
                    <em>Pro Tip:</em> CompletF ANALYSER</div>
                  <div class="company-tagline">Analyze Smart. Invest Smarter.</div>
                  <div class="contact-info">
                    📧 support@mfanalyser.com<br>
                    📞 Toll-Free: 1800-MF-FUNDS (Mon-Sat, 9 AM - 6 PM IST)<br>
                    🌐 www.mfanalyser.com
                  </div>
                </div>

                <div class="footer">
                  <div class="social-links">
                    <a href="#">📘</a>
                    <a href="#">🐦</a>
                    <a href="#">📷</a>
                    <a href="#">💼</a>
                  </div>
                  <div class="footer-links">
                    <a href="${process.env.FRONTEND_URL}/help">Help Center</a>
                    <a href="${process.env.FRONTEND_URL}/privacy">Privacy Policy</a>
                    <a href="${process.env.FRONTEND_URL}/terms">Terms</a>
                    <a href="${process.env.FRONTEND_URL}/contact">Contact Us</a>
                  </div>
                  <div class="copyright">
                    © ${new Date().getFullYear()} MF Analysercy</a>
                    <a href="${process.env.FRONTEND_URL}/terms">Terms</a>
                    <a href="${process.env.FRONTEND_URL}/contact">Contact Us</a>
                  </div>
                  <div class="copyright">
                    © ${new Date().getFullYear()} Mutual Funds Portal Pvt. Ltd. All rights reserved.<br>
                    Registered Office: Financial District, Mumbai - 400001, India<br>
                    CIN: U65999MH2024PTC123456
                  </div>
                </div>
              </div>
            </body>
          </html>
        `,
      });

      if (error) {
        console.error('Welcome email error:', error);
        return { success: false, error };
      }

      return { success: true, data };
    } catch (error) {
      console.error('Email service error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send password changed confirmation
   */
  static async sendPasswordChangedEmail(email, userName) {
    try {
      const { data, error } = await resend.emails.send({
        from: process.env.FROM_EMAIL || 'onboarding@resend.dev',
        to: email,
        subject: 'Password Changed Successfully',
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
                .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>✅ Password Updated</h1>
                </div>
                <div class="content">
                  <p>Hi ${userName},</p>
                  <p>Your password has been successfully changed.</p>
                  <div class="warning">
                    <strong>⚠️ Didn't make this change?</strong>
                    <p>If you didn't change your password, please contact our support team immediately and secure your account.</p>
                  </div>
                  <p>Date: ${new Date().toLocaleString()}</p>
                </div>
                <div class="footer">
                  <p>© ${new Date().getFullYear()} Mutual Funds App. All rights reserved.</p>
                </div>
              </div>
            </body>
          </html>
        `,
      });

      if (error) {
        console.error('Password changed email error:', error);
        return { success: false, error };
      }

      return { success: true, data };
    } catch (error) {
      console.error('Email service error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Generic send email method
   */
  static async sendEmail({ to, subject, html, text }) {
    // Use Gmail if enabled
    if (USE_GMAIL) {
      if (!gmailTransporter) {
        console.warn(
          '⚠️  Gmail not configured - Please set GMAIL_USER and GMAIL_APP_PASSWORD'
        );
        return { success: false, error: 'Gmail not configured' };
      }

      try {
        const info = await gmailTransporter.sendMail({
          from: `"MF Analyser" <${process.env.GMAIL_USER}>`,
          to,
          subject,
          html: html || text,
          text,
        });

        console.log('✅ Email sent via Gmail:', info.messageId);
        return { success: true, data: { id: info.messageId } };
      } catch (error) {
        console.error('Gmail send error:', error);
        return { success: false, error: error.message };
      }
    }

    // Fallback to Resend
    if (!resend) {
      console.warn(
        '⚠️  Email service not available - RESEND_API_KEY not configured'
      );
      return { success: false, error: 'Email service not configured' };
    }

    try {
      const { data, error } = await resend.emails.send({
        from: process.env.FROM_EMAIL || 'onboarding@resend.dev',
        to,
        subject,
        html: html || text,
        text,
      });

      if (error) {
        console.error('Send email error:', error);
        return { success: false, error };
      }

      return { success: true, data };
    } catch (error) {
      console.error('Email service error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get singleton instance
   */
  static getInstance() {
    return EmailService;
  }
}

module.exports = EmailService;
