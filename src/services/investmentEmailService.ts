import { Resend } from 'resend';

interface InvestmentConfirmationData {
  userEmail: string;
  userName: string;
  fundName: string;
  amount: number;
  units: number;
  nav: number;
  orderId: string;
  transactionDate: Date;
  investmentType: 'LUMPSUM' | 'SIP';
}

interface SIPConfirmationData {
  userEmail: string;
  userName: string;
  fundName: string;
  monthlyAmount: number;
  frequency: string;
  startDate: Date;
  mandateId: string;
}

export class InvestmentEmailService {
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

  async sendInvestmentConfirmation(
    data: InvestmentConfirmationData
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.resend) {
      console.warn(
        'Email service not configured - skipping investment confirmation email'
      );
      return { success: false, error: 'Email service not configured' };
    }

    try {
      const html = this.getInvestmentConfirmationTemplate(data);

      const result = await this.resend.emails.send({
        from: this.fromEmail,
        to: data.userEmail,
        subject: `Investment Confirmation - ${data.fundName}`,
        html,
      });

      console.log(
        `Investment confirmation email sent to ${data.userEmail}:`,
        result.data?.id
      );
      return { success: true };
    } catch (error) {
      console.error(
        `Failed to send investment confirmation to ${data.userEmail}:`,
        error
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async sendSIPConfirmation(
    data: SIPConfirmationData
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.resend) {
      console.warn(
        'Email service not configured - skipping SIP confirmation email'
      );
      return { success: false, error: 'Email service not configured' };
    }

    try {
      const html = this.getSIPConfirmationTemplate(data);

      const result = await this.resend.emails.send({
        from: this.fromEmail,
        to: data.userEmail,
        subject: `SIP Mandate Created - ${data.fundName}`,
        html,
      });

      console.log(
        `SIP confirmation email sent to ${data.userEmail}:`,
        result.data?.id
      );
      return { success: true };
    } catch (error) {
      console.error(
        `Failed to send SIP confirmation to ${data.userEmail}:`,
        error
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async sendInvestmentFailure(
    userEmail: string,
    userName: string,
    fundName: string,
    reason: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.resend) {
      console.warn(
        'Email service not configured - skipping investment failure email'
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
          <title>Investment Failed</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #dc2626; color: white; padding: 20px; text-align: center; }
            .content { padding: 30px 20px; }
            .alert-box { background: #fef2f2; border: 1px solid #fecaca; padding: 15px; border-radius: 5px; margin: 20px 0; }
            .button { display: inline-block; background: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>⚠️ Investment Processing Failed</h1>
            </div>
            <div class="content">
              <h2>Hello ${userName},</h2>
              <p>We encountered an issue while processing your investment in <strong>${fundName}</strong>.</p>
              
              <div class="alert-box">
                <h3>Reason:</h3>
                <p>${reason}</p>
              </div>

              <p>Your payment has not been charged. Please try again or contact support if the issue persists.</p>
              
              <a href="${process.env.FRONTEND_URL}/invest" class="button">Try Again</a>
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
        subject: 'Investment Processing Failed',
        html,
      });

      console.log(
        `Investment failure email sent to ${userEmail}:`,
        result.data?.id
      );
      return { success: true };
    } catch (error) {
      console.error(
        `Failed to send investment failure email to ${userEmail}:`,
        error
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private getInvestmentConfirmationTemplate(
    data: InvestmentConfirmationData
  ): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Investment Confirmation</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #059669; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px 20px; }
          .info-box { background: #f0fdf4; border: 1px solid #86efac; padding: 20px; border-radius: 5px; margin: 20px 0; }
          .info-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #d1fae5; }
          .info-row:last-child { border-bottom: none; }
          .label { font-weight: 600; color: #065f46; }
          .value { text-align: right; }
          .highlight { font-size: 24px; font-weight: bold; color: #059669; }
          .button { display: inline-block; background: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Investment Successful!</h1>
          </div>
          <div class="content">
            <h2>Hello ${data.userName},</h2>
            <p>Your ${data.investmentType === 'LUMPSUM' ? 'lumpsum investment' : 'SIP investment'} has been successfully processed.</p>
            
            <div class="info-box">
              <h3>Investment Details:</h3>
              
              <div class="info-row">
                <span class="label">Fund Name</span>
                <span class="value">${data.fundName}</span>
              </div>
              
              <div class="info-row">
                <span class="label">Investment Amount</span>
                <span class="value highlight">₹${data.amount.toLocaleString('en-IN')}</span>
              </div>
              
              <div class="info-row">
                <span class="label">NAV Price</span>
                <span class="value">₹${data.nav.toFixed(4)}</span>
              </div>
              
              <div class="info-row">
                <span class="label">Units Allotted</span>
                <span class="value">${data.units.toFixed(4)}</span>
              </div>
              
              <div class="info-row">
                <span class="label">Order ID</span>
                <span class="value">${data.orderId}</span>
              </div>
              
              <div class="info-row">
                <span class="label">Transaction Date</span>
                <span class="value">${data.transactionDate.toLocaleDateString('en-IN')}</span>
              </div>
            </div>

            <p><strong>Note:</strong> Units will be credited to your account within 2-3 business days.</p>
            
            <p>You can track your investment in your portfolio.</p>
            
            <a href="${process.env.FRONTEND_URL}/portfolio" class="button">View Portfolio</a>
          </div>
          <div class="footer">
            <p>Thank you for investing with us!</p>
            <p>&copy; 2024 Mutual Funds Portal. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private getSIPConfirmationTemplate(data: SIPConfirmationData): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>SIP Confirmation</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #7c3aed; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px 20px; }
          .info-box { background: #faf5ff; border: 1px solid #d8b4fe; padding: 20px; border-radius: 5px; margin: 20px 0; }
          .info-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e9d5ff; }
          .info-row:last-child { border-bottom: none; }
          .label { font-weight: 600; color: #6b21a8; }
          .value { text-align: right; }
          .highlight { font-size: 24px; font-weight: bold; color: #7c3aed; }
          .button { display: inline-block; background: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #666; }
          .tip-box { background: #dbeafe; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎯 SIP Mandate Created!</h1>
          </div>
          <div class="content">
            <h2>Hello ${data.userName},</h2>
            <p>Your Systematic Investment Plan (SIP) has been successfully set up.</p>
            
            <div class="info-box">
              <h3>SIP Details:</h3>
              
              <div class="info-row">
                <span class="label">Fund Name</span>
                <span class="value">${data.fundName}</span>
              </div>
              
              <div class="info-row">
                <span class="label">Monthly Amount</span>
                <span class="value highlight">₹${data.monthlyAmount.toLocaleString('en-IN')}</span>
              </div>
              
              <div class="info-row">
                <span class="label">Frequency</span>
                <span class="value">${data.frequency}</span>
              </div>
              
              <div class="info-row">
                <span class="label">Start Date</span>
                <span class="value">${data.startDate.toLocaleDateString('en-IN')}</span>
              </div>
              
              <div class="info-row">
                <span class="label">Mandate ID</span>
                <span class="value">${data.mandateId}</span>
              </div>
            </div>

            <div class="tip-box">
              <strong>💡 SIP Benefits:</strong>
              <ul style="margin: 10px 0; padding-left: 20px;">
                <li>Rupee Cost Averaging</li>
                <li>Power of Compounding</li>
                <li>Disciplined Investing</li>
                <li>Flexibility to Pause/Stop Anytime</li>
              </ul>
            </div>

            <p><strong>Next Steps:</strong></p>
            <ul>
              <li>Your first installment will be processed on ${data.startDate.toLocaleDateString('en-IN')}</li>
              <li>You'll receive a confirmation email after each investment</li>
              <li>Ensure sufficient balance in your bank account</li>
            </ul>
            
            <a href="${process.env.FRONTEND_URL}/portfolio" class="button">View Portfolio</a>
          </div>
          <div class="footer">
            <p>Happy Investing! 🚀</p>
            <p>&copy; 2024 Mutual Funds Portal. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}

export const investmentEmailService = new InvestmentEmailService();

// Convenience wrappers to keep backwards compatibility with controllers
// that expect named function exports: sendInvestmentConfirmation, sendSIPConfirmation, sendInvestmentFailure
export const sendInvestmentConfirmation = async (
  userEmail: string,
  userName: string,
  payload: {
    fundName: string;
    amount: number;
    units: number;
    nav: number;
    transactionId?: string;
  }
): Promise<{ success: boolean; error?: string }> => {
  return investmentEmailService.sendInvestmentConfirmation({
    userEmail,
    userName,
    fundName: payload.fundName,
    amount: payload.amount,
    units: payload.units,
    nav: payload.nav,
    orderId: payload.transactionId || '',
    transactionDate: new Date(),
    investmentType: 'LUMPSUM',
  });
};

export const sendSIPConfirmation = async (
  userEmail: string,
  userName: string,
  payload: {
    fundName: string;
    amount: number;
    sipDate?: number;
    frequency?: string;
    units?: number;
    nav?: number;
    transactionId?: string;
  }
): Promise<{ success: boolean; error?: string }> => {
  return investmentEmailService.sendSIPConfirmation({
    userEmail,
    userName,
    fundName: payload.fundName,
    monthlyAmount: payload.amount,
    frequency: payload.frequency || 'MONTHLY',
    startDate: new Date(),
    mandateId: payload.transactionId || '',
  });
};

export const sendInvestmentFailure = async (
  userEmail: string,
  userName: string,
  fundNameOrReason: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> => {
  // Support both legacy calls: (email, name, reason)
  // and newer calls: (email, name, fundName, reason)
  const fundName = reason ? fundNameOrReason : 'Unknown Fund';
  const finalReason = reason ?? fundNameOrReason;
  return investmentEmailService.sendInvestmentFailure(
    userEmail,
    userName,
    fundName,
    finalReason
  );
};
