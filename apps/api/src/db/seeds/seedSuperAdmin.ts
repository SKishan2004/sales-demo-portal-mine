import argon2 from 'argon2';
import { closePool, getPool } from '../../config/database.js';

async function seedSuperAdmin(): Promise<void> {
  const pool = getPool();
  if (!pool) {
    throw new Error('DATABASE_URL must be configured before seeding Super Admin.');
  }

  const name = process.env.ADMIN_SEED_NAME?.trim() || 'Platform Super Admin';
  const email = process.env.ADMIN_SEED_EMAIL?.trim().toLowerCase();
  const rawUsername = process.env.ADMIN_SEED_USERNAME?.trim().toLowerCase();
  const username =
    rawUsername ||
    (email ? email.split('@')[0]?.replace(/[^a-z0-9_.-]/g, '') : '') ||
    'superadmin';
  const password = process.env.ADMIN_SEED_PASSWORD;

  if (!email || !password || password.length < 12) {
    throw new Error(
      'ADMIN_SEED_EMAIL and ADMIN_SEED_PASSWORD (minimum 12 characters) must be provided via environment variables.',
    );
  }

  const roleResult = await pool.query<{ id: string }>(
    `SELECT id FROM roles WHERE slug = 'super_admin' LIMIT 1`,
  );
  const roleId = roleResult.rows[0]?.id;
  if (!roleId) {
    throw new Error('super_admin role not found. Run npm run db:migrate first.');
  }

  const existing = await pool.query<{ id: string }>(
    `SELECT id
     FROM admin_users
     WHERE role_id = $1 OR LOWER(email) = $2 OR LOWER(username) = $3
     LIMIT 1`,
    [roleId, email, username],
  );

  if (existing.rows.length > 0) {
    console.log('[seed] Super Admin account already exists; skipping creation (idempotent).');
    await closePool();
    return;
  }

  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 1,
  });

  await pool.query(
    `INSERT INTO admin_users (name, email, username, password_hash, role_id, status)
     VALUES ($1, $2, $3, $4, $5, 'active')`,
    [name, email, username, passwordHash, roleId],
  );

  console.log(`[seed] Bootstrapped Super Admin account for ${username} (${email}).`);
  await closePool();
}

seedSuperAdmin()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[seed] Failed:', err instanceof Error ? err.message : err);
    process.exit(1);
  });
