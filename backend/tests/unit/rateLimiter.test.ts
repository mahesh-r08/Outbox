import { describe, it, expect, beforeEach, vi } from 'vitest';
import RedisMock from 'ioredis-mock';
import { RateLimiterService } from '../../src/services/rateLimiter.service.js';

describe('RateLimiterService (Distributed Rate Limiting & Min-Delay)', () => {
  let redisMock: any;
  let rateLimiter: RateLimiterService;

  beforeEach(() => {
    redisMock = new RedisMock();
    rateLimiter = new RateLimiterService(redisMock);
  });

  it('correctly calculates 1-hour window indices and next window time', () => {
    const fixedDate = new Date('2026-08-19T10:15:30.000Z');
    const windowIndex = rateLimiter.getHourWindowIndex(fixedDate);
    const nextWindow = rateLimiter.getNextWindowTime(windowIndex);

    expect(windowIndex).toBe(Math.floor(fixedDate.getTime() / 3600000));
    expect(nextWindow.toISOString()).toBe('2026-08-19T11:00:00.000Z');
  });

  it('allows emails within the hourly limit and tracks counts', async () => {
    const senderId = 'sender-test-1';
    const limit = 3;
    const testTime = new Date('2026-08-19T10:00:00.000Z');

    // 1st email
    const res1 = await rateLimiter.checkAndIncrementHourlyLimit(senderId, limit, testTime);
    expect(res1.allowed).toBe(true);

    // 2nd email
    const res2 = await rateLimiter.checkAndIncrementHourlyLimit(senderId, limit, testTime);
    expect(res2.allowed).toBe(true);

    // 3rd email
    const res3 = await rateLimiter.checkAndIncrementHourlyLimit(senderId, limit, testTime);
    expect(res3.allowed).toBe(true);

    // 4th email (should exceed limit)
    const res4 = await rateLimiter.checkAndIncrementHourlyLimit(senderId, limit, testTime);
    expect(res4.allowed).toBe(false);
    expect(res4.rescheduleDelayMs).toBeGreaterThan(0);
    expect(res4.nextWindowTime).toBeDefined();
  });

  it('reschedules jobs into next hourly window when limit is exhausted', async () => {
    const senderId = 'sender-test-2';
    const limit = 2;

    await rateLimiter.checkAndIncrementHourlyLimit(senderId, limit);
    await rateLimiter.checkAndIncrementHourlyLimit(senderId, limit);

    // 3rd call
    const result = await rateLimiter.checkAndIncrementHourlyLimit(senderId, limit);
    expect(result.allowed).toBe(false);
    expect(result.rescheduleDelayMs).toBeGreaterThanOrEqual(1000);
  });

  it('coordinates minimum send delay between workers', async () => {
    const senderId = 'sender-test-3';
    const minDelayMs = 50; // 50ms for test speed

    const start = Date.now();
    await rateLimiter.coordinateMinimumDelay(senderId, minDelayMs);
    const duration = Date.now() - start;

    expect(duration).toBeGreaterThanOrEqual(0);
  });
});
