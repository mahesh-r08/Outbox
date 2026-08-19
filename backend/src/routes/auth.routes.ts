import { Router, Request, Response, NextFunction } from 'express';
import passport from 'passport';
import crypto from 'node:crypto';
import { getMe, logout, googleCallback, demoLogin, exchangeOneTimeToken } from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { env } from '../config/env.js';
import { redisClient } from '../lib/redis.js';
import { logger } from '../utils/logger.js';

const router = Router();

// Google OAuth Login
router.get('/google', (req: Request, res: Response, next: NextFunction) => {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    return res.status(503).json({
      success: false,
      error: {
        code: 'GOOGLE_OAUTH_NOT_CONFIGURED',
        message: 'Google OAuth is not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in the server environment.',
      },
    });
  }
  return passport.authenticate('google', {
    scope: ['profile', 'email'],
    prompt: 'select_account',
  })(req, res, next);
});

// Google OAuth Callback
router.get('/google/callback', (req: Request, res: Response, next: NextFunction) => {
  passport.authenticate('google', async (err: any, user: any, info: any) => {
    if (err || !user) {
      logger.warn({ err: err?.message || err, info }, 'Google OAuth authentication failed');
      const errorMsg = err?.message || 'oauth_failed';
      return res.redirect(`${env.FRONTEND_URL}/login?error=${encodeURIComponent(errorMsg)}`);
    }

    try {
      const oneTimeToken = crypto.randomUUID();
      await redisClient.setex(`reachinbox:auth_token:${oneTimeToken}`, 60, user.id);
      logger.info({ userId: user.id, email: user.email }, 'Google OAuth verified, created one-time exchange token');
      return res.redirect(`${env.FRONTEND_URL}/dashboard?auth_token=${oneTimeToken}`);
    } catch (tokenErr: any) {
      logger.error({ err: tokenErr }, 'Failed to generate one-time auth token');
      return res.redirect(`${env.FRONTEND_URL}/dashboard`);
    }
  })(req, res, next);
});

// One-time token exchange (ensures session cookie is set on frontend origin)
router.post('/exchange-token', exchangeOneTimeToken);

// Demo login for quick local testing without Google OAuth dependency
router.post('/demo', demoLogin);

// Get current authenticated user profile
router.get('/me', requireAuth, getMe);

// Logout — destroys session
router.post('/logout', requireAuth, logout);

export default router;
