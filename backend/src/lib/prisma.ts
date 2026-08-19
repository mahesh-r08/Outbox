import pkg from '@prisma/client';
import type { PrismaClient as PrismaClientType } from '@prisma/client';
const { PrismaClient } = pkg;
import { logger } from '../utils/logger.js';

const globalForPrisma = global as unknown as { prisma: PrismaClientType };

export const prisma: PrismaClientType =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: [
      { emit: 'event', level: 'query' },
      { emit: 'event', level: 'error' },
      { emit: 'event', level: 'info' },
      { emit: 'event', level: 'warn' },
    ],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Log slow queries or errors if not in test
prisma.$on('error' as never, (e: any) => {
  logger.error({ err: e }, 'Prisma Database Error');
});
