import { apiClient } from './client.js';
import type { Sender, ApiResponse } from '../types/index.js';

export interface CreateSenderPayload {
  name: string;
  email?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPassword?: string;
  hourlyLimit?: number;
  autoProvisionEthereal?: boolean;
}

export async function getSenders(): Promise<Sender[]> {
  const res = await apiClient.get<ApiResponse<Sender[]>>('/senders');
  return res.data.data || [];
}

export async function createSender(payload: CreateSenderPayload): Promise<Sender> {
  const res = await apiClient.post<ApiResponse<Sender>>('/senders', payload);
  return res.data.data!;
}

export async function deleteSender(id: string): Promise<void> {
  await apiClient.delete(`/senders/${id}`);
}
