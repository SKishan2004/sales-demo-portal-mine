import express from 'express';
import cookieParser from 'cookie-parser';
import {
  corsMiddleware,
  csrfOriginGuard,
  errorHandler,
  helmetMiddleware,
  notFoundHandler,
} from './middleware/security.js';
import { adminOpsRouter } from './routes/adminOps.routes.js';
import { adminProductsRouter } from './routes/adminProducts.routes.js';
import { adminTaxonomyRouter } from './routes/adminTaxonomy.routes.js';
import { adminUsersRouter } from './routes/adminUsers.routes.js';
import { authRouter } from './routes/auth.routes.js';
import { healthRouter } from './routes/health.routes.js';
import { adminMediaRouter, publicMediaRouter } from './routes/media.routes.js';
import { publicRouter } from './routes/public.routes.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.use(helmetMiddleware);
  app.use(corsMiddleware);
  app.use(cookieParser());
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(csrfOriginGuard);

  // Health endpoint
  app.use('/api', healthRouter);

  // Media delivery & HTTP 206 streaming (both /api/media/* and /media/*)
  app.use('/api/media', publicMediaRouter);
  app.use('/media', publicMediaRouter);

  // Public Showcase APIs (both /api/public/* and /api/* aliases; specific routes mounted before :slug)
  app.use('/api/public', publicRouter);
  app.use('/api', publicRouter);

  // Admin Authentication, Products, Media, Taxonomy, Users & Ops
  app.use('/api/admin', authRouter);
  app.use('/api/admin', adminProductsRouter);
  app.use('/api/admin', adminMediaRouter);
  app.use('/api/admin', adminTaxonomyRouter);
  app.use('/api/admin', adminUsersRouter);
  app.use('/api/admin', adminOpsRouter);

  app.use('/api', notFoundHandler);
  app.use(errorHandler);

  return app;
}
