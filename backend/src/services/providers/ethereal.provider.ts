import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import type {
  EmailProvider,
  SenderCredentials,
  SendEmailPayload,
  SendEmailResult,
} from './emailProvider.interface.js';
import { logger } from '../../utils/logger.js';
import { maskEmail } from '../../utils/crypto.js';

export class EtherealEmailProvider implements EmailProvider {
  private transporterPool: Map<string, Transporter> = new Map();

  /**
   * Get or initialize a pooled Nodemailer transporter for a sender.
   */
  private getTransporter(sender: SenderCredentials): Transporter {
    const existing = this.transporterPool.get(sender.id);
    if (existing) {
      return existing;
    }

    const isGmail =
      sender.smtpHost?.toLowerCase().includes('gmail') ||
      sender.email?.toLowerCase().endsWith('@gmail.com') ||
      sender.smtpUser?.toLowerCase().endsWith('@gmail.com');

    const transportConfig: any = isGmail
      ? {
          service: 'gmail',
          auth: {
            user: sender.smtpUser,
            pass: sender.smtpPassword,
          },
          tls: { rejectUnauthorized: false },
        }
      : {
          host: sender.smtpHost || 'smtp.ethereal.email',
          port: sender.smtpPort || 587,
          secure: sender.smtpPort === 465,
          auth: {
            user: sender.smtpUser,
            pass: sender.smtpPassword,
          },
          tls: { rejectUnauthorized: false },
          connectionTimeout: 10000,
          greetingTimeout: 10000,
          socketTimeout: 15000,
          pool: true,
          maxConnections: 5,
          maxMessages: 100,
        };

    const transporter = nodemailer.createTransport(transportConfig);
    this.transporterPool.set(sender.id, transporter);
    return transporter;
  }

  /**
   * Verify SMTP credentials for a sender mailbox with fast timeout.
   */
  public async verifyConnection(sender: SenderCredentials): Promise<boolean> {
    try {
      const transporter = this.getTransporter(sender);
      // Fast timeout of 4 seconds so API requests never hang
      const verifyPromise = transporter.verify();
      const timeoutPromise = new Promise<boolean>((_, reject) =>
        setTimeout(() => reject(new Error('Connection timeout (4s)')), 4000)
      );

      await Promise.race([verifyPromise, timeoutPromise]);
      return true;
    } catch (err: any) {
      logger.warn(
        { senderId: sender.id, err: err.message },
        'SMTP connection verification warning — proceeding with registration'
      );
      return false;
    }
  }

  /**
   * Send an email payload via SMTP and extract the Ethereal message ID / preview URL.
   */
  public async sendEmail(
    sender: SenderCredentials,
    payload: SendEmailPayload
  ): Promise<SendEmailResult> {
    const transporter = this.getTransporter(sender);

    const mailOptions = {
      from: `"${sender.name}" <${sender.email}>`,
      to: payload.to,
      subject: payload.subject,
      text: payload.body,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
          <div style="border-bottom: 2px solid #8b5cf6; padding-bottom: 14px; margin-bottom: 20px;">
            <span style="color: #6d28d9; font-size: 18px; font-weight: 700; letter-spacing: -0.5px;">ReachInbox Outreach</span>
          </div>
          <div style="white-space: pre-wrap; font-size: 15px; line-height: 1.6; color: #334155;">${payload.body.replace(/\n/g, '<br/>')}</div>
          <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #f1f5f9; font-size: 12px; color: #94a3b8; display: flex; justify-content: space-between;">
            <span>Sent via ReachInbox Production Engine</span>
            <span>Sender: ${sender.email}</span>
          </div>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    const previewUrl = nodemailer.getTestMessageUrl(info) || null;

    logger.info(
      {
        messageId: info.messageId,
        recipientMasked: maskEmail(payload.to),
        senderEmail: sender.email,
        hasPreviewUrl: Boolean(previewUrl),
      },
      'Email successfully dispatched via SMTP provider'
    );

    return {
      messageId: info.messageId,
      previewUrl: typeof previewUrl === 'string' ? previewUrl : null,
    };
  }

  /**
   * Close and clear a pooled transporter when credentials update or on shutdown.
   */
  public closeConnection(senderId: string): void {
    const transporter = this.transporterPool.get(senderId);
    if (transporter) {
      transporter.close();
      this.transporterPool.delete(senderId);
    }
  }

  /**
   * Provision a free test account from Ethereal SMTP.
   */
  public static async createTestAccount(): Promise<{
    user: string;
    pass: string;
    smtp: { host: string; port: number; secure: boolean };
    web: string;
  }> {
    return nodemailer.createTestAccount();
  }
}
