import express, { Express, Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import session from 'express-session';
import passport from 'passport';
import RedisStore from 'connect-redis';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import { redisClient } from './lib/redis.js';
import { configurePassport } from './config/passport.js';
import { errorHandler } from './middleware/errorHandler.js';
import { logger } from './utils/logger.js';
import { prisma } from './lib/prisma.js';

// Routes
import authRoutes from './routes/auth.routes.js';
import senderRoutes from './routes/sender.routes.js';
import emailRoutes from './routes/email.routes.js';

export function createApp(): Express {
  const app = express();

  // Trust proxy (needed for rate limiting behind reverse proxies)
  app.set('trust proxy', 1);

  // Security headers
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'"],
          frameSrc: ["'none'"],
        },
      },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    })
  );

  // Strict CORS — never use wildcard with credentials
  const allowedOrigins = [
    env.FRONTEND_URL,
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ].filter(Boolean);

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, curl, server-to-server)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        logger.warn({ origin }, 'CORS: blocked request from unknown origin');
        callback(new Error(`CORS: origin '${origin}' not allowed`));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  // Body parsers with strict limits
  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true, limit: '5mb' }));

  // Redis-backed session store
  let sessionStore: RedisStore | undefined;
  try {
    sessionStore = new RedisStore({
      client: redisClient,
      prefix: 'reachinbox:sess:',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn({ err: message }, 'RedisStore initialization failed — sessions will not persist across restarts');
  }

  app.use(
    session({
      store: sessionStore,
      name: 'reachinbox.sid',
      secret: env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: env.COOKIE_SECURE || env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
      },
    })
  );

  // Initialize Passport
  configurePassport();
  app.use(passport.initialize());
  app.use(passport.session());

  // ── HTTP Rate Limiting ─────────────────────────────────────────────────────
  // Auth endpoints: tighter limit to prevent brute force
  const authRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: {
        code: 'TOO_MANY_REQUESTS',
        message: 'Too many requests. Please try again later.',
      },
    },
  });

  // General API endpoints
  const apiRateLimit = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: {
        code: 'TOO_MANY_REQUESTS',
        message: 'Too many requests. Please try again later.',
      },
    },
  });

  // ── Liveness probe — always returns 200 if process is alive ───────────────
  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: env.NODE_ENV,
    });
  });

  // ── Readiness probe — checks external dependencies ────────────────────────
  app.get('/ready', async (_req: Request, res: Response) => {
    let dbStatus = 'disconnected';
    let redisStatus = 'disconnected';
    let ready = true;

    try {
      await prisma.$queryRaw`SELECT 1`;
      dbStatus = 'connected';
    } catch {
      dbStatus = 'error';
      ready = false;
    }

    try {
      const pong = await redisClient.ping();
      redisStatus = pong === 'PONG' ? 'connected' : 'error';
      if (redisStatus === 'error') ready = false;
    } catch {
      redisStatus = 'error';
      ready = false;
    }

    const statusCode = ready ? 200 : 503;
    return res.status(statusCode).json({
      status: ready ? 'ready' : 'not_ready',
      timestamp: new Date().toISOString(),
      database: dbStatus,
      redis: redisStatus,
      environment: env.NODE_ENV,
    });
  });

  // ── API Routes ─────────────────────────────────────────────────────────────
  app.use('/api/auth', authRateLimit, authRoutes);
  app.use('/api/senders', apiRateLimit, senderRoutes);
  app.use('/api/emails', apiRateLimit, emailRoutes);

  // 404 handler for undefined routes
  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'The requested endpoint does not exist.' },
    });
  });

  // Centralized Error Handling
  app.use(errorHandler);

  return app;
}
