import { Queue, QueueEvents } from 'bullmq';
import { getRedisConnectionConfig } from '../lib/redis.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import type { SendEmailJobData } from '../types/index.js';

export const EMAIL_QUEUE_NAME = 'email-send';

export const emailQueue = new Queue<SendEmailJobData>(EMAIL_QUEUE_NAME, {
  connection: getRedisConnectionConfig(),
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: false,
    removeOnFail: false,
  },
});

export const emailQueueEvents = new QueueEvents(EMAIL_QUEUE_NAME, {
  connection: getRedisConnectionConfig(),
});

emailQueueEvents.on('failed', ({ jobId, failedReason }) => {
  logger.error({ jobId, failedReason }, 'BullMQ Job permanently failed or exhausted attempts');
});

emailQueueEvents.on('completed', ({ jobId }) => {
  logger.debug({ jobId }, 'BullMQ Job completed');
});

/**
 * Schedule a single email delayed job
 */
export async function scheduleEmailJob(
  scheduledEmailId: string,
  delayMs: number
): Promise<string> {
  const safeDelay = Math.max(0, Math.floor(delayMs));
  const job = await emailQueue.add(
    'send-email',
    { scheduledEmailId },
    {
      jobId: scheduledEmailId,
      delay: safeDelay,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
    }
  );

  logger.info(
    {
      jobId: job.id,
      scheduledEmailId,
      delayMs: safeDelay,
      executeAt: new Date(Date.now() + safeDelay).toISOString(),
    },
    'Enqueued BullMQ delayed email job'
  );

  return job.id!;
}

/**
 * Bulk enqueue delayed jobs efficiently
 */
export async function scheduleBulkEmailJobs(
  items: Array<{ scheduledEmailId: string; delayMs: number }>
) {
  const bullJobs = items.map((item) => ({
    name: 'send-email',
    data: { scheduledEmailId: item.scheduledEmailId },
    opts: {
      jobId: item.scheduledEmailId,
      delay: Math.max(0, Math.floor(item.delayMs)),
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      removeOnComplete: false,
      removeOnFail: false,
    },
  }));

  const jobs = await emailQueue.addBulk(bullJobs);
  logger.info({ count: jobs.length }, 'Bulk enqueued BullMQ delayed email jobs');
  return jobs;
}

/**
 * Cancel and remove a scheduled BullMQ job
 */
export async function cancelEmailJob(scheduledEmailId: string): Promise<boolean> {
  try {
    const job = await emailQueue.getJob(scheduledEmailId);
    if (job) {
      await job.remove();
      logger.info({ scheduledEmailId }, 'Removed BullMQ job for cancelled email');
      return true;
    }
    return false;
  } catch (err: any) {
    logger.warn({ scheduledEmailId, err: err.message }, 'Failed to remove job from BullMQ queue');
    return false;
  }
}

/**
 * Reschedule a job with a new delay (used when hourly rate limit is hit)
 */
export async function rescheduleEmailJob(
  scheduledEmailId: string,
  delayMs: number
): Promise<void> {
  const safeDelay = Math.max(1000, Math.floor(delayMs));
  // Remove previous job if exists
  await cancelEmailJob(scheduledEmailId);

  await emailQueue.add(
    'send-email',
    { scheduledEmailId },
    {
      jobId: scheduledEmailId,
      delay: safeDelay,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
    }
  );

  logger.info(
    {
      scheduledEmailId,
      delayMs: safeDelay,
      nextExecutionTime: new Date(Date.now() + safeDelay).toISOString(),
    },
    'Rescheduled BullMQ job to future window'
  );
}
