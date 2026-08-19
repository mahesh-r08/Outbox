export interface User {
  id: string;
  googleId?: string | null;
  name: string;
  email: string;
  avatarUrl?: string | null;
  createdAt: string;
}

export interface Sender {
  id: string;
  userId: string;
  name: string;
  email: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  hourlyLimit: number;
  createdAt: string;
  updatedAt: string;
}

export type EmailStatus = 'scheduled' | 'queued' | 'processing' | 'sent' | 'failed' | 'cancelled' | 'rescheduled';

export interface ScheduledEmail {
  id: string;
  campaignId: string;
  senderId: string;
  recipient: string;
  subject: string;
  body: string;
  scheduledAt: string;
  sentAt?: string | null;
  status: EmailStatus;
  attempts: number;
  lastError?: string | null;
  messageId?: string | null;
  previewUrl?: string | null;
  createdAt: string;
  updatedAt: string;
  sender?: {
    id: string;
    name: string;
    email: string;
  };
  campaign?: {
    id: string;
    delayMs: number;
    hourlyLimit: number;
  };
}

export interface EmailCampaign {
  id: string;
  userId: string;
  senderId: string;
  subject: string;
  body: string;
  startTime: string;
  delayMs: number;
  hourlyLimit: number;
  totalRecipients: number;
  status: string;
  createdAt: string;
}

export interface ScheduleEmailPayload {
  senderId: string;
  subject: string;
  body: string;
  recipients: string[];
  startTime: string;
  delayMs: number;
  hourlyLimit: number;
}

export interface MetricsSummary {
  total: number;
  scheduled: number;
  processing: number;
  sent: number;
  failed: number;
  totalCampaigns: number;
  totalSenders: number;
  deliveryRate: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
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
