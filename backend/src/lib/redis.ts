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
  const isTls = url.startsWith('rediss://');
  const options: RedisOptions = {
    ...redisOptions,
    ...(isTls ? { tls: { rejectUnauthorized: false } } : {}),
  };
  const client = new Redis(url, options);

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

export const getRedisConnectionConfig = (): RedisOptions => {
  const isTls = env.REDIS_URL.startsWith('rediss://');
  try {
    const parsed = new URL(env.REDIS_URL);
    return {
      ...redisOptions,
      host: parsed.hostname,
      port: parseInt(parsed.port || '6379', 10),
      username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
      password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
      ...(isTls ? { tls: { rejectUnauthorized: false } } : {}),
    };
  } catch {
    return { ...redisOptions };
  }
};

// Global client for app caching & rate limiting
export const redisClient = createRedisClient();
