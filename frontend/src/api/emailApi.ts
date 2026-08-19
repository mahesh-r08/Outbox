import { apiClient } from './client.js';
import type {
  ScheduledEmail,
  ScheduleEmailPayload,
  MetricsSummary,
  PaginatedResponse,
  ApiResponse,
} from '../types/index.js';

export interface EmailQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
}

export async function scheduleEmails(payload: ScheduleEmailPayload): Promise<{
  campaignId: string;
  totalRecipients: number;
  scheduledCount: number;
  startTime: string;
}> {
  const res = await apiClient.post<ApiResponse<any>>('/emails/schedule', payload);
  return res.data.data;
}

export async function getScheduledEmails(
  params?: EmailQueryParams
): Promise<PaginatedResponse<ScheduledEmail>> {
  const res = await apiClient.get<ApiResponse<PaginatedResponse<ScheduledEmail>>>(
    '/emails/scheduled',
    { params }
  );
  return res.data.data!;
}

export async function getSentEmails(
  params?: EmailQueryParams
): Promise<PaginatedResponse<ScheduledEmail>> {
  const res = await apiClient.get<ApiResponse<PaginatedResponse<ScheduledEmail>>>(
    '/emails/sent',
    { params }
  );
  return res.data.data!;
}

export async function cancelEmail(id: string): Promise<ScheduledEmail> {
  const res = await apiClient.post<ApiResponse<ScheduledEmail>>(`/emails/${id}/cancel`);
  return res.data.data!;
}

export async function getMetrics(): Promise<MetricsSummary> {
  const res = await apiClient.get<ApiResponse<MetricsSummary>>('/emails/metrics');
  return res.data.data!;
}
