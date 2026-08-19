import { Request, Response } from 'express';
import crypto from 'node:crypto';
import { prisma } from '../lib/prisma.js';
import { redisClient } from '../lib/redis.js';
import { logger } from '../utils/logger.js';

export async function getMe(req: Request, res: Response) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
    });
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: {
      id: true,
      googleId: true,
      name: true,
      email: true,
      avatarUrl: true,
      createdAt: true,
    },
  });

  if (!user) {
    return res.status(404).json({
      success: false,
      error: { code: 'USER_NOT_FOUND', message: 'User record does not exist' },
    });
  }

  // Issue/refresh bearer session token
  const sessionToken = crypto.randomUUID();
  await redisClient.setex(`reachinbox:user_session:${sessionToken}`, 7 * 24 * 3600, user.id);

  return res.json({
    success: true,
    data: {
      ...user,
      token: sessionToken,
    },
  });
}

export async function exchangeOneTimeToken(req: Request, res: Response) {
  try {
    const { token } = req.body;
    if (!token || typeof token !== 'string') {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_TOKEN', message: 'Token is required' },
      });
    }

    const userId = await redisClient.get(`reachinbox:auth_token:${token}`);
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { code: 'EXPIRED_TOKEN', message: 'Auth token has expired or is invalid' },
      });
    }

    // Delete token immediately so it cannot be reused
    await redisClient.del(`reachinbox:auth_token:${token}`);

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User not found' },
      });
    }

    // Generate persistent bearer session token
    const sessionToken = crypto.randomUUID();
    await redisClient.setex(`reachinbox:user_session:${sessionToken}`, 7 * 24 * 3600, user.id);

    req.login(user, (err) => {
      if (err) {
        logger.error({ err }, 'Error during token login');
        return res.status(500).json({
          success: false,
          error: { code: 'LOGIN_FAILED', message: 'Failed to establish session' },
        });
      }

      req.session.save((saveErr) => {
        if (saveErr) {
          logger.error({ err: saveErr }, 'Error saving session on token exchange');
          return res.status(500).json({
            success: false,
            error: { code: 'SESSION_SAVE_FAILED', message: 'Failed to save session' },
          });
        }

        logger.info({ userId: user.id, email: user.email }, 'Session established via one-time token');
        return res.json({
          success: true,
          data: {
            ...user,
            token: sessionToken,
          },
        });
      });
    });
  } catch (error: any) {
    logger.error({ err: error.message }, 'Token exchange error');
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Internal server error' },
    });
  }
}

export async function logout(req: Request, res: Response) {
  req.logout((err) => {
    if (err) {
      logger.error({ err }, 'Error during logout');
      return res.status(500).json({
        success: false,
        error: { code: 'LOGOUT_FAILED', message: 'Failed to log out' },
      });
    }

    req.session.destroy(() => {
      res.clearCookie('reachinbox.sid');
      return res.json({
        success: true,
        data: { message: 'Logged out successfully' },
      });
    });
  });
}

export function googleCallback(req: Request, res: Response) {
  res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard`);
}

export async function demoLogin(req: Request, res: Response) {
  try {
    let user = await prisma.user.findFirst({
      where: { email: 'demo.user@reachinbox.ai' },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: 'demo.user@reachinbox.ai',
          name: 'Alex Rivera',
          avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        },
      });
    }

    req.login(user, (err) => {
      if (err) {
        logger.error({ err }, 'Error during demo login');
        return res.status(500).json({
          success: false,
          error: { code: 'LOGIN_FAILED', message: 'Failed to sign in demo user' },
        });
      }

      return res.json({
        success: true,
        data: user,
      });
    });
  } catch (error: any) {
    logger.error({ err: error.message }, 'Demo login failure');
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to sign in demo user' },
    });
  }
}

