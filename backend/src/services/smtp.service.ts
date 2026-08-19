import { EtherealEmailProvider } from './providers/ethereal.provider.js';
import type {
  EmailProvider,
  SenderCredentials,
  SendEmailPayload,
  SendEmailResult,
} from './providers/emailProvider.interface.js';
import { decryptText } from '../utils/crypto.js';
import { logger } from '../utils/logger.js';

class SmtpService {
  private provider: EmailProvider;

  constructor(customProvider?: EmailProvider) {
    this.provider = customProvider || new EtherealEmailProvider();
  }

  /**
   * Helper to ensure password is decrypted before SMTP connection.
   */
  private prepareSenderCredentials(sender: SenderCredentials): SenderCredentials {
    return {
      ...sender,
      smtpPassword: decryptText(sender.smtpPassword),
    };
  }

  /**
   * Verify SMTP connectivity using the configured provider.
   */
  public async verifySender(sender: SenderCredentials): Promise<boolean> {
    const prepared = this.prepareSenderCredentials(sender);
    return this.provider.verifyConnection(prepared);
  }

  /**
   * Send email using the configured provider.
   */
  public async sendEmail(
    sender: SenderCredentials,
    payload: SendEmailPayload
  ): Promise<SendEmailResult> {
    const prepared = this.prepareSenderCredentials(sender);
    return this.provider.sendEmail(prepared, payload);
  }

  /**
   * Provision a free test account from Ethereal SMTP.
   */
  public async createEtherealAccount() {
    return EtherealEmailProvider.createTestAccount();
  }

  /**
   * Clear pooled transporter for a sender when configuration changes.
   */
  public removeTransporter(senderId: string): void {
    this.provider.closeConnection(senderId);
  }
}

export const smtpService = new SmtpService();
