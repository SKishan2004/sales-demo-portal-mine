import { Pool } from 'pg';
import { env } from './env.js';

let pool: Pool | null = null;

export function getPool(): Pool | null {
  if (!env.DATABASE_URL) {
    return null;
  }

  if (!pool) {
    pool = new Pool({
      connectionString: env.DATABASE_URL,
      max: env.PG_POOL_MAX,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
  }

  return pool;
}

export class DatabaseUnavailableError extends Error {
  statusCode = 503;
  constructor(message = 'PostgreSQL database is not configured or unreachable.') {
    super(message);
  }
}

export function requirePool(): Pool {
  const activePool = getPool();
  if (!activePool) {
    throw new DatabaseUnavailableError(
      'PostgreSQL DATABASE_URL is not configured. Configure .env and run database migrations.',
    );
  }
  return activePool;
}

export async function checkDatabaseHealth(): Promise<{
  configured: boolean;
  connected: boolean;
  error?: string;
}> {
  const activePool = getPool();
  if (!activePool) {
    return {
      configured: false,
      connected: false,
      error: 'DATABASE_URL is not configured',
    };
  }

  try {
    await activePool.query('SELECT 1');
    return { configured: true, connected: true };
  } catch (err) {
    return {
      configured: true,
      connected: false,
      error: err instanceof Error ? err.message : 'Database connection failed',
    };
  }
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
