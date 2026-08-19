import { describe, it, expect } from 'vitest';
import { scheduleEmailSchema } from '../../src/controllers/email.controller.js';

describe('Email Scheduling Zod Schema & Validation', () => {
  it('validates a correct scheduling payload', () => {
    const validPayload = {
      senderId: '123e4567-e89b-12d3-a456-426614174000',
      subject: 'Growth Outreach Campaign',
      body: 'Hello, this is a test cold email.',
      recipients: ['sarah@example.com', 'mike@company.io'],
      startTime: new Date().toISOString(),
      delayMs: 2000,
      hourlyLimit: 200,
    };

    const parsed = scheduleEmailSchema.safeParse(validPayload);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.recipients.length).toBe(2);
      expect(parsed.data.delayMs).toBe(2000);
      expect(parsed.data.hourlyLimit).toBe(200);
    }
  });

  it('rejects empty recipients list', () => {
    const invalidPayload = {
      senderId: '123e4567-e89b-12d3-a456-426614174000',
      subject: 'Outreach',
      body: 'Hello',
      recipients: [],
      startTime: new Date().toISOString(),
    };

    const parsed = scheduleEmailSchema.safeParse(invalidPayload);
    expect(parsed.success).toBe(false);
  });

  it('rejects invalid recipient email formats', () => {
    const invalidPayload = {
      senderId: '123e4567-e89b-12d3-a456-426614174000',
      subject: 'Outreach',
      body: 'Hello',
      recipients: ['not-an-email'],
      startTime: new Date().toISOString(),
    };

    const parsed = scheduleEmailSchema.safeParse(invalidPayload);
    expect(parsed.success).toBe(false);
  });

  it('rejects missing subject or body', () => {
    const invalidPayload = {
      senderId: '123e4567-e89b-12d3-a456-426614174000',
      subject: '',
      body: '',
      recipients: ['valid@example.com'],
      startTime: new Date().toISOString(),
    };

    const parsed = scheduleEmailSchema.safeParse(invalidPayload);
    expect(parsed.success).toBe(false);
  });
});
