export interface UserDTO {
  id: string;
  googleId?: string | null;
  name: string;
  email: string;
  avatarUrl?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SenderDTO {
  id: string;
  userId: string;
  name: string;
  email: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  hourlyLimit: number;
  createdAt: Date;
  updatedAt: Date;
}

export type EmailStatus = 'scheduled' | 'queued' | 'processing' | 'sent' | 'failed' | 'cancelled' | 'rescheduled';
export type CampaignStatus = 'scheduled' | 'processing' | 'completed' | 'partially_failed' | 'failed' | 'cancelled';

export interface EmailCampaignDTO {
  id: string;
  userId: string;
  senderId: string;
  subject: string;
  body: string;
  startTime: Date;
  delayMs: number;
  hourlyLimit: number;
  totalRecipients: number;
  status: CampaignStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface ScheduledEmailDTO {
  id: string;
  campaignId: string;
  senderId: string;
  recipient: string;
  subject: string;
  body: string;
  scheduledAt: Date;
  sentAt?: Date | null;
  status: EmailStatus;
  attempts: number;
  lastError?: string | null;
  bullJobId?: string | null;
  messageId?: string | null;
  previewUrl?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SendEmailJobData {
  scheduledEmailId: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
