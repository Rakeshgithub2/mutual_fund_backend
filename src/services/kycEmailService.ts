import { Resend } from 'resend';

interface KYCSubmissionData {
  userEmail: string;
  userName: string;
  submissionId: string;
  submissionDate: Date;
}

interface KYCApprovalData {
  userEmail: string;
  userName: string;
  approvalDate: Date;
}

interface KYCRejectionData {
  userEmail: string;
  userName: string;
  reason: string;
  rejectionDate: Date;
}

export class KYCEmailService {
  private resend: Resend | null;
  private fromEmail: string;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.warn(
        '⚠️  RESEND_API_KEY is not configured - email sending will be disabled'
      );
      this.resend = null;
    } else {
      this.resend = new Resend(apiKey);
    }

    this.fromEmail = process.env.FROM_EMAIL || 'noreply@mutualfunds.com';
  }

  async sendKYCSubmission(
    data: KYCSubmissionData
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.resend) {
      console.warn(
        'Email service not configured - skipping KYC submission email'
      );
      return { success: false, error: 'Email service not configured' };
    }

    try {
      const html = this.getKYCSubmissionTemplate(data);

      const result = await this.resend.emails.send({
        from: this.fromEmail,
        to: data.userEmail,
        subject: 'KYC Submission Confirmed',
        html,
      });

      console.log(
        `KYC submission email sent to ${data.userEmail}:`,
        result.data?.id
      );
      return { success: true };
    } catch (error) {
      console.error(
        `Failed to send KYC submission email to ${data.userEmail}:`,
        error
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async sendKYCApproval(
    data: KYCApprovalData
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.resend) {
      console.warn(
        'Email service not configured - skipping KYC approval email'
      );
      return { success: false, error: 'Email service not configured' };
    }

    try {
      const html = this.getKYCApprovalTemplate(data);

      const result = await this.resend.emails.send({
        from: this.fromEmail,
        to: data.userEmail,
        subject: '✅ KYC Approved - Start Investing Now!',
        html,
      });

      console.log(
        `KYC approval email sent to ${data.userEmail}:`,
        result.data?.id
      );
      return { success: true };
    } catch (error) {
      console.error(
        `Failed to send KYC approval email to ${data.userEmail}:`,
        error
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async sendKYCRejection(
    data: KYCRejectionData
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.resend) {
      console.warn(
        'Email service not configured - skipping KYC rejection email'
      );
      return { success: false, error: 'Email service not configured' };
    }

    try {
      const html = this.getKYCRejectionTemplate(data);

      const result = await this.resend.emails.send({
        from: this.fromEmail,
        to: data.userEmail,
        subject: 'KYC Verification Issue - Action Required',
        html,
      });

      console.log(
        `KYC rejection email sent to ${data.userEmail}:`,
        result.data?.id
      );
      return { success: true };
    } catch (error) {
      console.error(
        `Failed to send KYC rejection email to ${data.userEmail}:`,
        error
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async sendKYCReminder(
    userEmail: string,
    userName: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.resend) {
      console.warn(
        'Email service not configured - skipping KYC reminder email'
      );
      return { success: false, error: 'Email service not configured' };
    }

    try {
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Complete Your KYC</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #f59e0b; color: white; padding: 20px; text-align: center; }
            .content { padding: 30px 20px; }
            .button { display: inline-block; background: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .benefit-box { background: #fef3c7; border: 1px solid #fbbf24; padding: 15px; border-radius: 5px; margin: 20px 0; }
            .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>⏰ Complete Your KYC</h1>
            </div>
            <div class="content">
              <h2>Hello ${userName},</h2>
              <p>We noticed that you haven't completed your KYC verification yet.</p>
              
              <div class="benefit-box">
                <h3>Why Complete KYC?</h3>
                <ul style="margin: 10px 0; padding-left: 20px;">
                  <li>Required by SEBI regulations</li>
                  <li>Start investing in mutual funds</li>
                  <li>One-time process</li>
                  <li>Quick approval (24-48 hours)</li>
                </ul>
              </div>

              <p><strong>What You Need:</strong></p>
              <ul>
                <li>PAN Card</li>
                <li>Aadhaar Card</li>
                <li>Bank Account Details</li>
                <li>Cancelled Cheque/Bank Statement</li>
              </ul>
              
              <a href="${process.env.FRONTEND_URL}/kyc" class="button">Complete KYC Now</a>

              <p style="margin-top: 30px; font-size: 14px; color: #666;">
                Takes only 5 minutes to complete!
              </p>
            </div>
            <div class="footer">
              <p>&copy; 2024 Mutual Funds Portal. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      const result = await this.resend.emails.send({
        from: this.fromEmail,
        to: userEmail,
        subject: 'Reminder: Complete Your KYC',
        html,
      });

      console.log(`KYC reminder email sent to ${userEmail}:`, result.data?.id);
      return { success: true };
    } catch (error) {
      console.error(
        `Failed to send KYC reminder email to ${userEmail}:`,
        error
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private getKYCSubmissionTemplate(data: KYCSubmissionData): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>KYC Submission Confirmed</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #3b82f6; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px 20px; }
          .info-box { background: #eff6ff; border: 1px solid #93c5fd; padding: 20px; border-radius: 5px; margin: 20px 0; }
          .timeline { margin: 20px 0; }
          .timeline-item { display: flex; align-items: start; margin: 15px 0; }
          .timeline-icon { width: 30px; height: 30px; background: #3b82f6; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 15px; flex-shrink: 0; }
          .timeline-content { flex: 1; }
          .button { display: inline-block; background: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📄 KYC Submitted Successfully</h1>
          </div>
          <div class="content">
            <h2>Hello ${data.userName},</h2>
            <p>Thank you for submitting your KYC documents. Your application is now under review.</p>
            
            <div class="info-box">
              <h3>Submission Details:</h3>
              <p><strong>Submission ID:</strong> ${data.submissionId}</p>
              <p><strong>Submitted On:</strong> ${data.submissionDate.toLocaleDateString(
                'en-IN',
                {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                }
              )}</p>
              <p><strong>Expected Approval:</strong> 24-48 hours</p>
            </div>

            <h3>What Happens Next?</h3>
            <div class="timeline">
              <div class="timeline-item">
                <div class="timeline-icon">1</div>
                <div class="timeline-content">
                  <strong>Document Verification</strong>
                  <p style="margin: 5px 0; color: #666;">Our team verifies your submitted documents</p>
                </div>
              </div>
              <div class="timeline-item">
                <div class="timeline-icon">2</div>
                <div class="timeline-content">
                  <strong>KYC Approval</strong>
                  <p style="margin: 5px 0; color: #666;">You'll receive an approval email</p>
                </div>
              </div>
              <div class="timeline-item">
                <div class="timeline-icon">3</div>
                <div class="timeline-content">
                  <strong>Start Investing</strong>
                  <p style="margin: 5px 0; color: #666;">Begin your investment journey</p>
                </div>
              </div>
            </div>

            <p><strong>Note:</strong> If we need any additional information, we'll reach out to you via email.</p>
            
            <a href="${process.env.FRONTEND_URL}/kyc" class="button">Check KYC Status</a>
          </div>
          <div class="footer">
            <p>&copy; 2024 Mutual Funds Portal. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private getKYCApprovalTemplate(data: KYCApprovalData): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>KYC Approved</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #10b981; color: white; padding: 30px 20px; text-align: center; }
          .content { padding: 30px 20px; }
          .success-badge { font-size: 60px; text-align: center; margin: 20px 0; }
          .info-box { background: #d1fae5; border: 1px solid #6ee7b7; padding: 20px; border-radius: 5px; margin: 20px 0; }
          .cta-section { background: #f0f9ff; padding: 20px; border-radius: 5px; margin: 20px 0; text-align: center; }
          .button { display: inline-block; background: #2563eb; color: white; padding: 15px 40px; text-decoration: none; border-radius: 5px; margin: 10px; font-size: 16px; }
          .button-secondary { background: #059669; }
          .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 KYC Approved!</h1>
          </div>
          <div class="content">
            <div class="success-badge">✅</div>
            
            <h2 style="text-align: center; color: #059669;">Congratulations ${data.userName}!</h2>
            <p style="text-align: center; font-size: 18px;">Your KYC has been successfully verified and approved.</p>
            
            <div class="info-box">
              <h3>Approval Details:</h3>
              <p><strong>Approved On:</strong> ${data.approvalDate.toLocaleDateString(
                'en-IN',
                {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                }
              )}</p>
              <p><strong>Status:</strong> <span style="color: #059669; font-weight: bold;">Active</span></p>
              <p><strong>Valid For:</strong> Lifetime (unless regulatory changes)</p>
            </div>

            <div class="cta-section">
              <h3>You're All Set! 🚀</h3>
              <p>Start building your wealth through mutual fund investments</p>
              
              <a href="${process.env.FRONTEND_URL}/search" class="button">Explore Funds</a>
              <a href="${process.env.FRONTEND_URL}/portfolio" class="button button-secondary">View Portfolio</a>
            </div>

            <h3>What You Can Do Now:</h3>
            <ul style="line-height: 2;">
              <li>✅ Invest in mutual funds (Lumpsum & SIP)</li>
              <li>✅ Set up automatic investments</li>
              <li>✅ Track your portfolio in real-time</li>
              <li>✅ Generate tax reports</li>
              <li>✅ Receive investment alerts</li>
            </ul>

            <p style="margin-top: 30px; padding: 15px; background: #fef3c7; border-radius: 5px;">
              <strong>💡 Pro Tip:</strong> Start with a SIP to benefit from rupee cost averaging and the power of compounding!
            </p>
          </div>
          <div class="footer">
            <p>Happy Investing! 🎯</p>
            <p>&copy; 2024 Mutual Funds Portal. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private getKYCRejectionTemplate(data: KYCRejectionData): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>KYC Verification Issue</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #dc2626; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px 20px; }
          .alert-box { background: #fef2f2; border-left: 4px solid #dc2626; padding: 20px; margin: 20px 0; }
          .info-box { background: #eff6ff; border: 1px solid #93c5fd; padding: 20px; border-radius: 5px; margin: 20px 0; }
          .button { display: inline-block; background: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⚠️ KYC Verification Issue</h1>
          </div>
          <div class="content">
            <h2>Hello ${data.userName},</h2>
            <p>We were unable to verify your KYC documents at this time.</p>
            
            <div class="alert-box">
              <h3>Reason for Rejection:</h3>
              <p style="font-size: 16px; margin: 10px 0;">${data.reason}</p>
            </div>

            <div class="info-box">
              <h3>What You Need to Do:</h3>
              <ol style="line-height: 2; padding-left: 20px;">
                <li>Review the rejection reason carefully</li>
                <li>Correct the issues mentioned</li>
                <li>Resubmit your KYC documents</li>
                <li>Wait for verification (24-48 hours)</li>
              </ol>
            </div>

            <h3>Common Issues & Solutions:</h3>
            <ul style="line-height: 2;">
              <li><strong>Unclear Documents:</strong> Upload high-quality, clear scans</li>
              <li><strong>Wrong Document Type:</strong> Ensure you upload the correct documents</li>
              <li><strong>Mismatch in Details:</strong> Name, DOB, and PAN should match across all documents</li>
              <li><strong>Expired Documents:</strong> Use valid, non-expired documents</li>
            </ul>

            <p>If you need help, our support team is here to assist you.</p>
            
            <a href="${process.env.FRONTEND_URL}/kyc" class="button">Resubmit KYC</a>

            <p style="margin-top: 30px; font-size: 14px; color: #666;">
              <strong>Need Help?</strong> Contact us at support@mutualfunds.com
            </p>
          </div>
          <div class="footer">
            <p>&copy; 2024 Mutual Funds Portal. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}

export const kycEmailService = new KYCEmailService();

// Backwards-compatible wrappers used by controllers
export const sendKYCSubmission = async (
  userEmail: string,
  userName: string
): Promise<{ success: boolean; error?: string }> => {
  return kycEmailService.sendKYCSubmission({
    userEmail,
    userName,
    submissionId: `KYC${Date.now()}`,
    submissionDate: new Date(),
  });
};

export const sendKYCApproval = async (
  userEmail: string,
  userName: string
): Promise<{ success: boolean; error?: string }> => {
  return kycEmailService.sendKYCApproval({
    userEmail,
    userName,
    approvalDate: new Date(),
  });
};

export const sendKYCRejection = async (
  userEmail: string,
  userName: string,
  reason: string
): Promise<{ success: boolean; error?: string }> => {
  return kycEmailService.sendKYCRejection({
    userEmail,
    userName,
    reason,
    rejectionDate: new Date(),
  });
};
