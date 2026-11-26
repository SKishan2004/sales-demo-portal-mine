import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { closePool, getPool } from '../config/database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, 'migrations');

async function runMigrations(): Promise<void> {
  const pool = getPool();
  if (!pool) {
    throw new Error('DATABASE_URL is required to execute database migrations.');
  }

  const client = await pool.connect();
  try {
    // Prevent concurrent migration runs across instances
    await client.query('SELECT pg_advisory_lock(8842101)');

    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        checksum CHAR(64) NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    const files = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      const checksum = crypto.createHash('sha256').update(sql).digest('hex');

      const existing = await client.query<{ checksum: string }>(
        'SELECT checksum FROM schema_migrations WHERE version = $1',
        [file],
      );

      if (existing.rows.length > 0) {
        if (existing.rows[0]?.checksum !== checksum) {
          throw new Error(
            `Migration checksum mismatch for already-applied migration: ${file}`,
          );
        }
        console.log(`[migrate] Skipping already applied migration: ${file}`);
        continue;
      }

      console.log(`[migrate] Applying migration: ${file}`);
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2)',
          [file, checksum],
        );
        await client.query('COMMIT');
        console.log(`[migrate] Applied: ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock(8842101)').catch(() => {});
    client.release();
    await closePool();
  }
}

runMigrations()
  .then(() => {
    console.log('[migrate] All database migrations are up to date.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('[migrate] Migration failed:', err);
    process.exit(1);
  });
