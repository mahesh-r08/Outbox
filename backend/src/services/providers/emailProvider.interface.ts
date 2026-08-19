export interface SendEmailPayload {
  to: string;
  subject: string;
  body: string;
}

export interface SendEmailResult {
  messageId: string;
  previewUrl: string | null;
}

export interface SenderCredentials {
  id: string;
  name: string;
  email: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPassword: string;
}

/**
 * Universal Email Provider Interface.
 * Allows decoupling scheduling logic from specific delivery backends (Ethereal, SES, SendGrid, Mailgun, Postmark).
 */
export interface EmailProvider {
  sendEmail(sender: SenderCredentials, payload: SendEmailPayload): Promise<SendEmailResult>;
  verifyConnection(sender: SenderCredentials): Promise<boolean>;
  closeConnection(senderId: string): void;
}
