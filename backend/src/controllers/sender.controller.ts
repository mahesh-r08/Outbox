import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { smtpService } from '../services/smtp.service.js';
import { logger } from '../utils/logger.js';
import { encryptText } from '../utils/crypto.js';

export const createSenderSchema = z.object({
  name: z.string().min(1, 'Sender name is required'),
  email: z.string().email('Invalid sender email address').optional(),
  smtpHost: z.string().default('smtp.ethereal.email'),
  smtpPort: z.coerce.number().default(587),
  smtpUser: z.string().optional(),
  smtpPassword: z.string().optional(),
  hourlyLimit: z.coerce.number().min(1).max(10000).default(200),
  autoProvisionEthereal: z.boolean().optional().default(false),
});

export async function getSenders(req: Request, res: Response) {
  const userId = req.user!.id;

  const senders = await prisma.sender.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      userId: true,
      name: true,
      email: true,
      smtpHost: true,
      smtpPort: true,
      smtpUser: true,
      hourlyLimit: true,
      createdAt: true,
      updatedAt: true,
      // smtpPassword is intentionally excluded — never returned to client
    },
  });

  return res.json({
    success: true,
    data: senders,
  });
}

export async function createSender(req: Request, res: Response) {
  const userId = req.user!.id;

  const parsed = createSenderSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid sender configuration',
        details: parsed.error.errors,
      },
    });
  }

  const data = parsed.data;

  try {
    let email = data.email;
    let smtpHost = data.smtpHost;
    let smtpPort = data.smtpPort;
    let smtpUser = data.smtpUser;
    let smtpPasswordPlain = data.smtpPassword;

    // Auto-provision a free Ethereal mailbox when credentials are absent
    if (data.autoProvisionEthereal || !smtpUser || !smtpPasswordPlain) {
      const testAccount = await smtpService.createEtherealAccount();
      email = email || testAccount.user;
      smtpHost = testAccount.smtp.host;
      smtpPort = testAccount.smtp.port;
      smtpUser = testAccount.user;
      smtpPasswordPlain = testAccount.pass;
    }

    if (!email || !smtpUser || !smtpPasswordPlain) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'SMTP credentials are required' },
      });
    }

    // Verify SMTP connectivity before persisting
    try {
      await smtpService.verifySender({
        id: `verify-${userId}-${Date.now()}`,
        name: data.name,
        email,
        smtpHost,
        smtpPort,
        smtpUser,
        smtpPassword: smtpPasswordPlain,
      });
    } catch (smtpErr: unknown) {
      const message = smtpErr instanceof Error ? smtpErr.message : String(smtpErr);
      logger.warn({ err: message, smtpHost }, 'SMTP test connection failed during sender creation — proceeding anyway for Ethereal');
    }

    // Encrypt password at rest using AES-256-GCM before database persistence
    const smtpPasswordEncrypted = encryptText(smtpPasswordPlain);

    const sender = await prisma.sender.create({
      data: {
        userId,
        name: data.name,
        email,
        smtpHost,
        smtpPort,
        smtpUser,
        smtpPassword: smtpPasswordEncrypted,
        hourlyLimit: data.hourlyLimit,
      },
      select: {
        id: true,
        userId: true,
        name: true,
        email: true,
        smtpHost: true,
        smtpPort: true,
        smtpUser: true,
        hourlyLimit: true,
        createdAt: true,
        updatedAt: true,
        // smtpPassword excluded from response
      },
    });

    logger.info({ senderId: sender.id, userId, email: sender.email }, 'Created email sender (password encrypted at rest)');

    return res.status(201).json({
      success: true,
      data: sender,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err: message }, 'Error creating sender');
    return res.status(500).json({
      success: false,
      error: { code: 'SENDER_CREATION_FAILED', message },
    });
  }
}

export async function deleteSender(req: Request, res: Response) {
  const userId = req.user!.id;
  const { id } = req.params;

  const sender = await prisma.sender.findFirst({
    where: { id, userId },
  });

  if (!sender) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Sender mailbox not found or does not belong to your account' },
    });
  }

  // Clear cached transporter before deletion
  smtpService.removeTransporter(id);

  await prisma.sender.delete({
    where: { id },
  });

  logger.info({ senderId: id, userId }, 'Deleted sender mailbox');

  return res.json({
    success: true,
    data: { message: 'Sender mailbox deleted successfully' },
  });
}
