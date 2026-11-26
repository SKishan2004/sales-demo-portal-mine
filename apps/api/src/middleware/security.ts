import type { NextFunction, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import cors from 'cors';
import multer from 'multer';
import { DatabaseUnavailableError } from '../config/database.js';
import { env } from '../config/env.js';

export const helmetMiddleware = helmet({
  crossOriginResourcePolicy: { policy: 'same-site' },
});

export const corsMiddleware = cors({
  origin(origin, callback) {
    if (!origin || env.corsOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error('CORS origin not permitted'));
  },
  credentials: true,
});

export const loginRateLimiter = rateLimit({
  windowMs: env.LOGIN_RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
  max: env.LOGIN_RATE_LIMIT_MAX_ATTEMPTS,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many authentication attempts. Please wait and try again.',
  },
});

export function csrfOriginGuard(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);
  if (safeMethods.has(req.method)) {
    next();
    return;
  }

  const origin = req.headers.origin;
  if (origin && !env.corsOrigins.includes(origin)) {
    res.status(403).json({ error: 'Forbidden request origin' });
    return;
  }

  next();
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: 'API route not found' });
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof DatabaseUnavailableError) {
    res.status(503).json({ error: err.message });
    return;
  }

  if (err instanceof multer.MulterError) {
    const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    res.status(status).json({ error: err.message });
    return;
  }

  const message =
    env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err instanceof Error
        ? err.message
        : 'Unknown error';
  console.error('[api:error]', err);
  res.status(500).json({ error: message });
}
