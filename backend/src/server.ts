import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { prisma } from './lib/prisma.js';
import { redisClient } from './lib/redis.js';
import { createEmailWorker } from './workers/email.worker.js';

const app = createApp();

// Start BullMQ Email Worker
const emailWorker = createEmailWorker(env.WORKER_CONCURRENCY);
logger.info(
  { concurrency: env.WORKER_CONCURRENCY },
  '⚙️ BullMQ Email Queue Worker initialized and listening for scheduled jobs'
);

const server = app.listen(env.PORT, () => {
  logger.info(
    {
      port: env.PORT,
      env: env.NODE_ENV,
      apiUrl: env.API_URL,
      frontendUrl: env.FRONTEND_URL,
    },
    '🚀 ReachInbox API Server started successfully'
  );
});

// Graceful shutdown handling
async function gracefulShutdown(signal: string) {
  logger.info({ signal }, 'Received shutdown signal. Gracefully stopping HTTP server...');

  server.close(async () => {
    logger.info('HTTP server closed.');

    try {
      await emailWorker.close();
      logger.info('BullMQ worker closed.');

      await prisma.$disconnect();
      logger.info('Prisma disconnected.');

      redisClient.disconnect();
      logger.info('Redis disconnected.');

      logger.info('API server exited cleanly.');
      process.exit(0);
    } catch (err: any) {
      logger.error({ err: err.message }, 'Error during graceful shutdown');
      process.exit(1);
    }
  });

  // Force close if graceful shutdown takes too long
  setTimeout(() => {
    logger.error('Shutdown timed out. Forcing termination.');
    process.exit(1);
  }, 10000);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled Rejection at Server');
});

process.on('uncaughtException', (err) => {
  logger.error({ err: err.message, stack: err.stack }, 'Uncaught Exception at Server');
  gracefulShutdown('uncaughtException');
});
