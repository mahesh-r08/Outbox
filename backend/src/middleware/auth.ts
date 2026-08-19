import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { redisClient } from '../lib/redis.js';

declare global {
  namespace Express {
    interface User {
      id: string;
      googleId?: string | null;
      name: string;
      email: string;
      avatarUrl?: string | null;
    }
  }
}

/**
 * Strict authentication guard.
 * Validates active session via Passport/Redis or Bearer token header.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  // 1. Check Passport session
  if (req.isAuthenticated && req.isAuthenticated() && req.user) {
    return next();
  }

  // 2. Check Bearer Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token) {
      try {
        const userId = await redisClient.get(`reachinbox:user_session:${token}`);
        if (userId) {
          const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, googleId: true, name: true, email: true, avatarUrl: true },
          });
          if (user) {
            req.user = user as Express.User;
            return next();
          }
        }
      } catch {
        // Fall through to 401
      }
    }
  }

  return res.status(401).json({
    success: false,
    error: {
      code: 'UNAUTHORIZED',
      message: 'Authentication required. Please sign in with Google.',
    },
  });
}
