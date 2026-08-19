import { Redis } from 'ioredis';
import { redisClient } from '../lib/redis.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';

export interface RateLimitCheckResult {
  allowed: boolean;
  currentCount: number;
  limit: number;
  rescheduleDelayMs?: number;
  nextWindowTime?: Date;
}

export class RateLimiterService {
  private redis: Redis;

  constructor(customRedis?: Redis) {
    this.redis = customRedis || redisClient;
  }

  /**
   * Calculates the current 1-hour window key index.
   * e.g., timestamp divided by 3,600,000 ms.
   */
  public getHourWindowIndex(date: Date = new Date()): number {
    return Math.floor(date.getTime() / (60 * 60 * 1000));
  }

  /**
   * Gets the start time of the next 1-hour window.
   */
  public getNextWindowTime(hourWindowIndex: number): Date {
    return new Date((hourWindowIndex + 1) * 60 * 60 * 1000);
  }

  /**
   * Atomically checks and increments the sender's hourly email rate limit counter.
   * If limit is exceeded, returns allowed: false and the exact millisecond delay until the next window.
   */
  public async checkAndIncrementHourlyLimit(
    senderId: string,
    limit: number = env.MAX_EMAILS_PER_HOUR,
    currentTime: Date = new Date()
  ): Promise<RateLimitCheckResult> {
    const windowIndex = this.getHourWindowIndex(currentTime);
    const key = `email-rate:${senderId}:${windowIndex}`;
    const ttlSeconds = 2 * 60 * 60; // 2 hours TTL

    // Lua script ensures atomic check-and-increment
    const luaScript = `
      local current = redis.call('GET', KEYS[1])
      if current and tonumber(current) >= tonumber(ARGV[1]) then
        return {0, tonumber(current)}
      end
      local val = redis.call('INCR', KEYS[1])
      if val == 1 then
        redis.call('EXPIRE', KEYS[1], tonumber(ARGV[2]))
      end
      return {1, val}
    `;

    try {
      const result = (await this.redis.eval(
        luaScript,
        1,
        key,
        limit.toString(),
        ttlSeconds.toString()
      )) as [number, number];

      const [isAllowed, count] = result;

      if (isAllowed === 1) {
        return {
          allowed: true,
          currentCount: count,
          limit,
        };
      }

      // Limit reached: calculate time remaining until the next hour window
      const nextWindow = this.getNextWindowTime(windowIndex);
      const delayMs = Math.max(1000, nextWindow.getTime() - Date.now() + Math.floor(Math.random() * 500));

      logger.warn(
        {
          senderId,
          windowIndex,
          currentCount: count,
          limit,
          rescheduleDelayMs: delayMs,
          nextWindowTime: nextWindow.toISOString(),
        },
        'Hourly rate limit reached for sender. Rescheduling job to next window.'
      );

      return {
        allowed: false,
        currentCount: count,
        limit,
        rescheduleDelayMs: delayMs,
        nextWindowTime: nextWindow,
      };
    } catch (err: any) {
      logger.error({ senderId, err: err.message }, 'Redis rate limit check error');
      // If Redis fails, allow processing with warning or handle safely
      return { allowed: true, currentCount: 0, limit };
    }
  }

  /**
   * Ensures minimum interval (MIN_EMAIL_DELAY_MS) between successive email sends for a sender
   * across all worker threads/processes.
   * Returns wait time in milliseconds (0 if ready immediately).
   */
  public async coordinateMinimumDelay(
    senderId: string,
    minDelayMs: number = env.MIN_EMAIL_DELAY_MS
  ): Promise<number> {
    const key = `email-last-send:${senderId}`;
    const now = Date.now();

    const luaScript = `
      local key = KEYS[1]
      local now = tonumber(ARGV[1])
      local minDelay = tonumber(ARGV[2])
      local lastSend = tonumber(redis.call('GET', key) or 0)
      local diff = now - lastSend
      if diff < minDelay then
        return minDelay - diff
      else
        redis.call('SET', key, now, 'PX', 86400000)
        return 0
      end
    `;

    try {
      const waitMs = (await this.redis.eval(
        luaScript,
        1,
        key,
        now.toString(),
        minDelayMs.toString()
      )) as number;

      if (waitMs > 0) {
        logger.debug({ senderId, waitMs }, 'Coordinating minimum send delay across workers');
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        // Update the last send timestamp after waiting
        await this.redis.set(key, Date.now().toString(), 'PX', 86400000);
      }

      return waitMs;
    } catch (err: any) {
      logger.error({ senderId, err: err.message }, 'Error coordinating minimum delay in Redis');
      return 0;
    }
  }

  /**
   * Resets rate limiter key for testing or admin manual clear.
   */
  public async resetRateLimits(senderId: string): Promise<void> {
    const windowIndex = this.getHourWindowIndex();
    const key = `email-rate:${senderId}:${windowIndex}`;
    const delayKey = `email-last-send:${senderId}`;
    await this.redis.del(key, delayKey);
  }
}

export const rateLimiterService = new RateLimiterService();
