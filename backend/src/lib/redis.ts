import { Redis, RedisOptions } from 'ioredis';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

export const redisOptions: RedisOptions = {
  maxRetriesPerRequest: null, // Required by BullMQ
  enableReadyCheck: false,
  retryStrategy(times) {
    const delay = Math.min(times * 200, 2000);
    logger.warn({ attempt: times, nextRetryMs: delay }, 'Retrying Redis connection...');
    return delay;
  },
};

export const createRedisClient = (customUrl?: string): Redis => {
  const url = customUrl || env.REDIS_URL;
  const client = new Redis(url, redisOptions);

  client.on('connect', () => {
    logger.info('Connected to Redis');
  });

  client.on('error', (err) => {
    logger.error({ err }, 'Redis connection error');
  });

  client.on('close', () => {
    logger.warn('Redis connection closed');
  });

  return client;
};

// Global client for app caching & rate limiting
export const redisClient = createRedisClient();
