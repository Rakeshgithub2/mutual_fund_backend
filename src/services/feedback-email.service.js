const nodemailer = require('nodemailer');

/**
 * Send professional feedback email to admin
 */
async function sendFeedbackEmail(feedbackData) {
  const transport = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER || 'rakeshd01042024@gmail.com',
      pass: process.env.EMAIL_PASSWORD || 'koxlczqwxmdfbkzs',
    },
  });

  const emailHTML = `
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
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            padding: 40px 30px;
            text-align: center;
          }
          .header h1 { 
            color: white; 
            font-size: 28px; 
            font-weight: 700;
            margin-bottom: 8px;
          }
          .header p {
            color: rgba(255, 255, 255, 0.95);
            font-size: 14px;
          }
          .content { 
            padding: 40px 30px;
            background: #ffffff;
          }
          .feedback-header {
            background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%);
            border-left: 4px solid #10b981;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 30px;
          }
          .feedback-label {
            font-size: 12px;
            color: #718096;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 8px;
          }
          .feedback-value {
            font-size: 16px;
            color: #2d3748;
            font-weight: 600;
            margin-bottom: 15px;
          }
          .rating-stars {
            font-size: 24px;
            color: #f59e0b;
            margin: 10px 0;
          }
          .feedback-section {
            margin: 25px 0;
            padding: 20px;
            background: #f7fafc;
            border-radius: 8px;
          }
          .section-title {
            font-size: 14px;
            color: #4a5568;
            font-weight: 700;
            margin-bottom: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .section-content {
            font-size: 15px;
            color: #2d3748;
            line-height: 1.8;
            padding: 15px;
            background: white;
            border-radius: 6px;
            border: 1px solid #e2e8f0;
          }
          .meta-info {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            margin: 20px 0;
          }
          .meta-item {
            padding: 15px;
            background: #ebf8ff;
            border-radius: 6px;
            border-left: 3px solid #4299e1;
          }
          .meta-label {
            font-size: 11px;
            color: #2c5282;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 6px;
          }
          .meta-value {
            font-size: 14px;
            color: #1a365d;
            font-weight: 600;
          }
          .footer {
            padding: 25px 30px;
            background: #2d3748;
            color: #cbd5e0;
            font-size: 12px;
            text-align: center;
          }
          .company-name {
            font-size: 16px;
            font-weight: 700;
            color: #90cdf4;
            margin-bottom: 10px;
          }
          .copyright {
            color: #a0aec0;
            margin-top: 10px;
            font-size: 11px;
          }
        </style>
      </head>
      <body>
        <div class="email-wrapper">
          <div class="header">
            <h1>📝 New Feedback Received</h1>
            <p>User feedback from Mutual Funds Portal</p>
          </div>
          
          <div class="content">
            <div class="feedback-header">
              <div class="feedback-label">Feedback Type</div>
              <div class="feedback-value">${feedbackData.type || 'General Feedback'}</div>
              <div class="rating-stars">
                ${'⭐'.repeat(feedbackData.rating || 5)}${'☆'.repeat(5 - (feedbackData.rating || 5))}
              </div>
              <div class="feedback-label" style="margin-top: 10px;">Rating: ${feedbackData.rating || 5}/5</div>
            </div>

            <div class="meta-info">
              <div class="meta-item">
                <div class="meta-label">User Name</div>
                <div class="meta-value">${feedbackData.userName || feedbackData.name || 'Anonymous'}</div>
              </div>
              <div class="meta-item">
                <div class="meta-label">Email Address</div>
                <div class="meta-value">${feedbackData.email || 'Not provided'}</div>
              </div>
              <div class="meta-item">
                <div class="meta-label">Submitted On</div>
                <div class="meta-value">${new Date().toLocaleDateString(
                  'en-IN',
                  {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  }
                )}</div>
              </div>
              <div class="meta-item">
                <div class="meta-label">Platform</div>
                <div class="meta-value">${feedbackData.platform || 'Web Portal'}</div>
              </div>
            </div>

            <div class="feedback-section">
              <div class="section-title">💬 Feedback Message</div>
              <div class="section-content">
                ${feedbackData.message || feedbackData.comment || 'No detailed message provided.'}
              </div>
            </div>

            ${
              feedbackData.suggestions
                ? `
              <div class="feedback-section">
                <div class="section-title">💡 Suggestions for Improvement</div>
                <div class="section-content">
                  ${feedbackData.suggestions}
                </div>
              </div>
            `
                : ''
            }

            <div style="margin-top: 30px; padding: 20px; background: #fffbeb; border-left: 4px solid #f59e0b; border-radius: 6px;">
              <strong style="color: #92400e;">📊 Quick Stats:</strong><br>
              <div style="margin-top: 10px; font-size: 13px; color: #78350f;">
                User Satisfaction: <strong>${(((feedbackData.rating || 5) / 5) * 100).toFixed(0)}%</strong><br>
                Feedback ID: <strong>#${Date.now().toString(36).toUpperCase()}</strong><br>
                Status: <strong>New (Requires Review)</strong>
              </div>
            </div>
          </div>

          <div class="footer">
            <div class="company-name">Mutual Funds Portal</div>
            <div class="copyright">
              © ${new Date().getFullYear()} Mutual Funds Portal. Internal Communication.<br>
              This email contains user feedback and should be reviewed promptly.
            </div>
          </div>
        </div>
      </body>
    </html>
  `;

  try {
    const info = await transport.sendMail({
      from: `"Mutual Funds Portal" <${process.env.EMAIL_USER || 'rakeshd01042024@gmail.com'}>`,
      to: process.env.ADMIN_EMAIL || 'rakeshd01042024@gmail.com',
      subject: `📝 New ${feedbackData.rating >= 4 ? 'Positive' : feedbackData.rating >= 3 ? 'Neutral' : 'Critical'} Feedback - ${feedbackData.rating}⭐`,
      html: emailHTML,
      replyTo: feedbackData.email || undefined,
    });

    console.log('✅ Feedback email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Feedback email failed:', error.message);
    return { success: false, error: error.message };
  }
}

module.exports = { sendFeedbackEmail };

// Test if run directly
if (require.main === module) {
  require('dotenv').config();

  console.log('🧪 Testing Professional Feedback Email...\n');

  sendFeedbackEmail({
    type: 'Product Improvement',
    rating: 5,
    userName: 'Rakesh Kumar',
    email: 'test.user@example.com',
    platform: 'Web Portal',
    message:
      'The platform is fantastic! The fund comparison tool is very helpful and the UI is intuitive. I especially love the goal planning feature.',
    suggestions:
      'It would be great to have a mobile app for on-the-go portfolio tracking.',
  }).then((result) => {
    if (result.success) {
      console.log('✅ Feedback email sent successfully!');
      console.log('📬 Check inbox: rakeshd01042024@gmail.com\n');
    } else {
      console.log('❌ Failed:', result.error);
    }
    process.exit(0);
  });
}
