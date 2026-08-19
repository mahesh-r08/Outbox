import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  logger.error(
    {
      err: err.message,
      stack: env.NODE_ENV !== 'production' ? err.stack : undefined,
      url: req.url,
      method: req.method,
    },
    'Centralized Request Error Handler'
  );

  const statusCode = err.status || err.statusCode || 500;
  const errorCode = err.code || 'INTERNAL_SERVER_ERROR';
  const message = err.message || 'An unexpected error occurred';

  res.status(statusCode).json({
    success: false,
    error: {
      code: errorCode,
      message: message,
      details: env.NODE_ENV === 'development' ? err.details || err.stack : undefined,
    },
  });
}
