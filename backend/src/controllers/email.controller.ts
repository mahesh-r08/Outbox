import { Request, Response } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { scheduleBulkEmailJobs, cancelEmailJob } from '../queues/email.queue.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';

export const scheduleEmailSchema = z.object({
  senderId: z.string().min(1, 'Sender ID is required'),
  subject: z.string().min(1, 'Email subject is required'),
  body: z.string().min(1, 'Email body is required'),
  recipients: z
    .array(z.string().email('Invalid email address format'))
    .min(1, 'At least one valid recipient is required'),
  startTime: z
    .union([z.string(), z.date()])
    .transform((val) => new Date(val))
    .refine((date) => !isNaN(date.getTime()), {
      message: 'Invalid start time format',
    }),
  delayMs: z.coerce.number().min(0).default(2000),
  hourlyLimit: z.coerce.number().min(1).default(200),
});

export async function scheduleEmails(req: Request, res: Response) {
  const userId = req.user!.id;
  const parsed = scheduleEmailSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid email scheduling parameters',
        details: parsed.error.errors,
      },
    });
  }

  const { senderId, subject, body, recipients, startTime, delayMs, hourlyLimit } = parsed.data;

  // Verify sender belongs to authenticated user
  const sender = await prisma.sender.findFirst({
    where: { id: senderId, userId },
  });

  if (!sender) {
    return res.status(404).json({
      success: false,
      error: { code: 'SENDER_NOT_FOUND', message: 'Selected sender mailbox does not exist' },
    });
  }

  // Server-side deduplication and normalization
  const normalizedRecipients = Array.from(
    new Set(recipients.map((r) => r.trim().toLowerCase()))
  );

  if (normalizedRecipients.length === 0) {
    return res.status(400).json({
      success: false,
      error: { code: 'NO_VALID_RECIPIENTS', message: 'No valid recipient email addresses provided' },
    });
  }

  const baseStartTimeMs = Math.max(Date.now(), startTime.getTime());

  try {
    // 1. Create EmailCampaign record
    const campaign = await prisma.emailCampaign.create({
      data: {
        userId,
        senderId,
        subject,
        body,
        startTime: new Date(baseStartTimeMs),
        delayMs: delayMs || env.MIN_EMAIL_DELAY_MS,
        hourlyLimit: hourlyLimit || sender.hourlyLimit || env.MAX_EMAILS_PER_HOUR,
        totalRecipients: normalizedRecipients.length,
        status: 'scheduled',
      },
    });

    // 2. Prepare ScheduledEmail records with incremental delays
    const emailRecordsData = normalizedRecipients.map((recipient, index) => {
      const scheduledAt = new Date(baseStartTimeMs + index * delayMs);
      return {
        campaignId: campaign.id,
        senderId,
        recipient,
        subject,
        body,
        scheduledAt,
        status: 'scheduled',
      };
    });

    // Insert scheduled emails in database
    await prisma.scheduledEmail.createMany({
      data: emailRecordsData,
    });

    // Fetch the created records with IDs to enqueue in BullMQ
    const createdEmails = await prisma.scheduledEmail.findMany({
      where: { campaignId: campaign.id },
      select: { id: true, scheduledAt: true },
      orderBy: { scheduledAt: 'asc' },
    });

    // 3. Bulk enqueue delayed jobs in BullMQ
    const now = Date.now();
    const bullJobItems = createdEmails.map((email: { id: string; scheduledAt: Date }) => ({
      scheduledEmailId: email.id,
      delayMs: Math.max(0, email.scheduledAt.getTime() - now),
    }));

    await scheduleBulkEmailJobs(bullJobItems);

    logger.info(
      {
        campaignId: campaign.id,
        recipientCount: createdEmails.length,
        firstScheduledAt: createdEmails[0]?.scheduledAt,
        lastScheduledAt: createdEmails[createdEmails.length - 1]?.scheduledAt,
      },
      'Successfully scheduled email campaign'
    );

    return res.status(201).json({
      success: true,
      data: {
        campaignId: campaign.id,
        totalRecipients: normalizedRecipients.length,
        scheduledCount: createdEmails.length,
        startTime: new Date(baseStartTimeMs),
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err: message }, 'Failed to schedule emails');
    return res.status(500).json({
      success: false,
      error: { code: 'SCHEDULING_FAILED', message },
    });
  }
}

export async function getScheduledEmails(req: Request, res: Response) {
  const userId = req.user!.id;
  const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 10));
  const search = (req.query.search as string)?.trim() || '';
  const statusFilter = (req.query.status as string)?.trim();

  const skip = (page - 1) * limit;

  const validScheduledStatuses = ['scheduled', 'queued', 'processing', 'rescheduled'];
  const statusCondition = statusFilter
    ? statusFilter.split(',')
    : validScheduledStatuses;

  const whereClause: Prisma.ScheduledEmailWhereInput = {
    campaign: { userId },
    status: { in: statusCondition },
    ...(search
      ? {
          OR: [
            { recipient: { contains: search, mode: 'insensitive' } },
            { subject: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.scheduledEmail.findMany({
      where: whereClause,
      include: {
        sender: {
          select: { id: true, name: true, email: true },
        },
        campaign: {
          select: { id: true, delayMs: true, hourlyLimit: true },
        },
      },
      orderBy: { scheduledAt: 'asc' },
      skip,
      take: limit,
    }),
    prisma.scheduledEmail.count({ where: whereClause }),
  ]);

  return res.json({
    success: true,
    data: {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  });
}

export async function getSentEmails(req: Request, res: Response) {
  const userId = req.user!.id;
  const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 10));
  const search = (req.query.search as string)?.trim() || '';
  const statusFilter = (req.query.status as string)?.trim();

  const skip = (page - 1) * limit;

  const validSentStatuses = ['sent', 'failed'];
  const statusCondition = statusFilter
    ? statusFilter.split(',')
    : validSentStatuses;

  const whereClause: Prisma.ScheduledEmailWhereInput = {
    campaign: { userId },
    status: { in: statusCondition },
    ...(search
      ? {
          OR: [
            { recipient: { contains: search, mode: 'insensitive' } },
            { subject: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.scheduledEmail.findMany({
      where: whereClause,
      include: {
        sender: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { sentAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.scheduledEmail.count({ where: whereClause }),
  ]);

  return res.json({
    success: true,
    data: {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  });
}

export async function getSingleEmail(req: Request, res: Response) {
  const userId = req.user!.id;
  const { id } = req.params;

  const email = await prisma.scheduledEmail.findFirst({
    where: {
      id,
      campaign: { userId },
    },
    include: {
      sender: {
        select: { id: true, name: true, email: true },
      },
      campaign: true,
    },
  });

  if (!email) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Scheduled email not found' },
    });
  }

  return res.json({
    success: true,
    data: email,
  });
}

export async function cancelEmail(req: Request, res: Response) {
  const userId = req.user!.id;
  const { id } = req.params;

  const email = await prisma.scheduledEmail.findFirst({
    where: {
      id,
      campaign: { userId },
    },
  });

  if (!email) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Scheduled email not found' },
    });
  }

  if (email.status === 'sent') {
    return res.status(400).json({
      success: false,
      error: { code: 'ALREADY_SENT', message: 'Cannot cancel an email that has already been sent' },
    });
  }

  // Remove from BullMQ queue
  await cancelEmailJob(id);

  // Update DB status
  const updated = await prisma.scheduledEmail.update({
    where: { id },
    data: { status: 'cancelled' },
  });

  return res.json({
    success: true,
    data: updated,
  });
}

export async function getMetrics(req: Request, res: Response) {
  const userId = req.user!.id;

  const [counts, totalCampaigns, totalSenders] = await Promise.all([
    prisma.scheduledEmail.groupBy({
      by: ['status'],
      where: { campaign: { userId } },
      _count: { _all: true },
    }),
    prisma.emailCampaign.count({ where: { userId } }),
    prisma.sender.count({ where: { userId } }),
  ]);

  const statusMap = counts.reduce<Record<string, number>>((acc, curr) => {
    acc[curr.status] = curr._count._all;
    return acc;
  }, {});

  const scheduled = (statusMap['scheduled'] || 0) + (statusMap['queued'] || 0) + (statusMap['rescheduled'] || 0);
  const processing = statusMap['processing'] || 0;
  const sent = statusMap['sent'] || 0;
  const failed = statusMap['failed'] || 0;
  const total = scheduled + processing + sent + failed;

  return res.json({
    success: true,
    data: {
      total,
      scheduled,
      processing,
      sent,
      failed,
      totalCampaigns,
      totalSenders,
      deliveryRate: total > 0 && (sent + failed > 0) ? Math.round((sent / (sent + failed)) * 100) : 100,
    },
  });
}
