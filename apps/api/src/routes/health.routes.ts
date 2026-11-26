import { Router } from 'express';
import type { HealthResponseDTO } from '@mobileum/shared';
import { checkDatabaseHealth } from '../config/database.js';
import { checkStorageHealth } from '../config/storage.js';

export const healthRouter = Router();

healthRouter.get('/health', async (_req, res) => {
  const [database, storage] = await Promise.all([
    checkDatabaseHealth(),
    Promise.resolve(checkStorageHealth()),
  ]);

  const healthy = storage.writable && (!database.configured || database.connected);

  const payload: HealthResponseDTO = {
    status: healthy ? 'ok' : 'degraded',
    service: 'mobileum-sales-demo-api',
    timestamp: new Date().toISOString(),
    database,
    storage,
  };

  res.status(healthy ? 200 : 503).json(payload);
});
