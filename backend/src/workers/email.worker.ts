import { Worker, Job } from 'bullmq';
import { redisOptions } from '../lib/redis.js';
import { prisma } from '../lib/prisma.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';
import { smtpService } from '../services/smtp.service.js';
import { rateLimiterService } from '../services/rateLimiter.service.js';
import { rescheduleEmailJob, EMAIL_QUEUE_NAME } from '../queues/email.queue.js';
import { maskEmail } from '../utils/crypto.js';
import type { SendEmailJobData } from '../types/index.js';

/**
 * Updates campaign status when all its recipient emails finish processing.
 */
async function checkAndUpdateCampaignStatus(campaignId: string) {
  try {
    const counts = await prisma.scheduledEmail.groupBy({
      by: ['status'],
      where: { campaignId },
      _count: { _all: true },
    });

    const statusCounts = counts.reduce<Record<string, number>>((acc, curr) => {
      acc[curr.status] = curr._count._all;
      return acc;
    }, {});

    const pending = (statusCounts['scheduled'] || 0) + (statusCounts['queued'] || 0) + (statusCounts['processing'] || 0) + (statusCounts['rescheduled'] || 0);
    const sent = statusCounts['sent'] || 0;
    const failed = statusCounts['failed'] || 0;

    if (pending === 0) {
      let finalStatus = 'completed';
      if (failed > 0 && sent > 0) {
        finalStatus = 'partially_failed';
      } else if (failed > 0 && sent === 0) {
        finalStatus = 'failed';
      }

      await prisma.emailCampaign.update({
        where: { id: campaignId },
        data: { status: finalStatus },
      });

      logger.info({ campaignId, finalStatus, sent, failed }, 'Campaign processing finished');
    } else {
      await prisma.emailCampaign.update({
        where: { id: campaignId },
        data: { status: 'processing' },
      });
    }
  } catch (err: any) {
    logger.warn({ campaignId, err: err.message }, 'Failed to update campaign summary status');
  }
}

/**
 * Process a single email sending job
 */
export async function processEmailJob(job: Job<SendEmailJobData>): Promise<void> {
  const { scheduledEmailId } = job.data;
  const startTime = Date.now();

  logger.info(
    {
      jobId: job.id,
      scheduledEmailId,
      attempt: job.attemptsMade + 1,
    },
    'Processing email sending job'
  );

  // 1. Multi-layer Idempotency: Atomically claim the email in DB
  const claimResult = await prisma.scheduledEmail.updateMany({
    where: {
      id: scheduledEmailId,
      status: { in: ['scheduled', 'queued', 'rescheduled'] },
    },
    data: {
      status: 'processing',
      attempts: { increment: 1 },
      bullJobId: job.id,
    },
  });

  if (claimResult.count === 0) {
    // Check why claim failed
    const current = await prisma.scheduledEmail.findUnique({
      where: { id: scheduledEmailId },
      select: { status: true, messageId: true },
    });

    if (current?.status === 'sent') {
      logger.info(
        { scheduledEmailId, messageId: current.messageId },
        'IDEMPOTENCY SAFEGUARD: Email already sent. Skipping duplicate job execution.'
      );
      return;
    }

    if (current?.status === 'cancelled') {
      logger.info({ scheduledEmailId }, 'Email was cancelled by user. Skipping.');
      return;
    }

    logger.warn(
      { scheduledEmailId, currentStatus: current?.status },
      'Could not atomically claim email. Skipping to prevent duplicate send.'
    );
    return;
  }

  // 2. Fetch full email, sender, and campaign details
  const emailRecord = await prisma.scheduledEmail.findUnique({
    where: { id: scheduledEmailId },
    include: {
      sender: true,
      campaign: true,
    },
  });

  if (!emailRecord) {
    logger.error({ scheduledEmailId }, 'Scheduled email not found in DB');
    return;
  }

  const { sender, campaign } = emailRecord;
  const hourlyLimit = sender.hourlyLimit || campaign.hourlyLimit || env.MAX_EMAILS_PER_HOUR;

  // 3. Distributed Hourly Rate Limiter Check (Atomic Redis Counter)
  const rateLimitResult = await rateLimiterService.checkAndIncrementHourlyLimit(
    sender.id,
    hourlyLimit
  );

  if (!rateLimitResult.allowed) {
    logger.warn(
      {
        scheduledEmailId,
        senderId: sender.id,
        currentCount: rateLimitResult.currentCount,
        limit: hourlyLimit,
        rescheduleDelayMs: rateLimitResult.rescheduleDelayMs,
      },
      'Rate limit exhausted for sender. Rescheduling job.'
    );

    // Revert state to 'rescheduled' with new target execution time
    await prisma.scheduledEmail.update({
      where: { id: scheduledEmailId },
      data: {
        status: 'rescheduled',
        scheduledAt: rateLimitResult.nextWindowTime || new Date(Date.now() + 3600000),
      },
    });

    // Reschedule in BullMQ
    await rescheduleEmailJob(
      scheduledEmailId,
      rateLimitResult.rescheduleDelayMs || 3600000
    );

    return;
  }

  try {
    // 4. Distributed Minimum Delay Enforcement (Redis Slot Coordination)
    const configuredDelay = campaign.delayMs || env.MIN_EMAIL_DELAY_MS;
    await rateLimiterService.coordinateMinimumDelay(sender.id, configuredDelay);

    // 5. Send email via Nodemailer SMTP / Ethereal
    const sendResult = await smtpService.sendEmail(sender, {
      to: emailRecord.recipient,
      subject: emailRecord.subject,
      body: emailRecord.body,
    });

    // 6. Atomic Success Update in Database
    await prisma.scheduledEmail.update({
      where: { id: scheduledEmailId },
      data: {
        status: 'sent',
        sentAt: new Date(),
        messageId: sendResult.messageId,
        previewUrl: sendResult.previewUrl,
        lastError: null,
      },
    });

    const durationMs = Date.now() - startTime;
    logger.info(
      {
        jobId: job.id,
        scheduledEmailId,
        campaignId: campaign.id,
        senderId: sender.id,
        recipientMasked: maskEmail(emailRecord.recipient),
        messageId: sendResult.messageId,
        hasPreviewUrl: Boolean(sendResult.previewUrl),
        durationMs,
      },
      'Email successfully sent and persisted'
    );

    // 7. Check if parent campaign has completed
    await checkAndUpdateCampaignStatus(campaign.id);
  } catch (err: any) {
    const isFinalAttempt = (job.attemptsMade + 1) >= (job.opts.attempts || 3);

    logger.error(
      {
        jobId: job.id,
        scheduledEmailId,
        attempt: job.attemptsMade + 1,
        isFinalAttempt,
        err: err.message,
      },
      'Error during email delivery'
    );

    if (isFinalAttempt) {
      // Mark permanently failed
      await prisma.scheduledEmail.update({
        where: { id: scheduledEmailId },
        data: {
          status: 'failed',
          lastError: err.message || 'Unknown SMTP error',
        },
      });
      await checkAndUpdateCampaignStatus(campaign.id);
    } else {
      // Revert status to queued so BullMQ retry can claim it
      await prisma.scheduledEmail.update({
        where: { id: scheduledEmailId },
        data: {
          status: 'queued',
          lastError: err.message || 'Transient error, awaiting retry',
        },
      });
    }

    // Re-throw so BullMQ triggers exponential backoff
    throw err;
  }
}

/**
 * Create and configure BullMQ Worker instance
 */
export function createEmailWorker(concurrency: number = env.WORKER_CONCURRENCY): Worker<SendEmailJobData> {
  const worker = new Worker<SendEmailJobData>(
    EMAIL_QUEUE_NAME,
    async (job) => {
      await processEmailJob(job);
    },
    {
      concurrency,
      connection: {
        ...redisOptions,
        host: new URL(env.REDIS_URL).hostname,
        port: parseInt(new URL(env.REDIS_URL).port || '6379', 10),
        password: new URL(env.REDIS_URL).password || undefined,
      },
      lockDuration: 30000,
      stalledInterval: 15000,
      maxStalledCount: 2,
    }
  );

  worker.on('active', (job) => {
    logger.debug({ jobId: job.id }, 'Worker started processing job');
  });

  worker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'Worker finished processing job successfully');
  });

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err: err.message }, 'Worker job failed');
  });

  worker.on('error', (err) => {
    logger.error({ err: err.message }, 'BullMQ Worker internal error');
  });

  worker.on('stalled', (jobId) => {
    logger.warn({ jobId }, 'BullMQ Job stalled and will be recovered');
  });

  return worker;
}
