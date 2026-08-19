import { createEmailWorker } from './email.worker.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { redisClient } from '../lib/redis.js';

logger.info(
  {
    concurrency: env.WORKER_CONCURRENCY,
    minDelayMs: env.MIN_EMAIL_DELAY_MS,
    maxPerHour: env.MAX_EMAILS_PER_HOUR,
  },
  'Starting ReachInbox BullMQ Email Worker Process...'
);

const worker = createEmailWorker(env.WORKER_CONCURRENCY);

// Graceful shutdown handling
async function shutdown(signal: string) {
  logger.info({ signal }, 'Received shutdown signal. Stopping worker gracefully...');

  try {
    // 1. Stop accepting new jobs and wait for active jobs to finish (with timeout)
    await worker.close();
    logger.info('BullMQ worker closed.');

    // 2. Disconnect Prisma
    await prisma.$disconnect();
    logger.info('Prisma disconnected.');

    // 3. Disconnect Redis
    redisClient.disconnect();
    logger.info('Redis disconnected.');

    logger.info('Worker process exited cleanly.');
    process.exit(0);
  } catch (err: any) {
    logger.error({ err: err.message }, 'Error during worker shutdown');
    process.exit(1);
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled Promise Rejection in Worker');
});

process.on('uncaughtException', (err) => {
  logger.error({ err: err.message, stack: err.stack }, 'Uncaught Exception in Worker');
  shutdown('uncaughtException');
});
