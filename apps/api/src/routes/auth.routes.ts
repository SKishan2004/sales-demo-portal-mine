import crypto from 'node:crypto';
import argon2 from 'argon2';
import { Router } from 'express';
import { z } from 'zod';
import { loginSchema, type PermissionKey, type RoleSlug } from '@mobileum/shared';
import { requirePool } from '../config/database.js';
import { env } from '../config/env.js';
import {
  PREVIEW_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  deriveEffectivePermissions,
  requireAuth,
  sha256Hex,
} from '../middleware/auth.js';
import { loginRateLimiter } from '../middleware/security.js';
import { logAdminActivity } from '../services/audit.service.js';

export const authRouter = Router();

const forgotPasswordSchema = z.object({
  identifier: z.string().trim().min(2).max(150),
});

const resetPasswordSchema = z.object({
  token: z.string().trim().min(32).max(200),
  newPassword: z.string().min(12).max(200),
});

function getSessionCookieOptions(maxAgeMs: number) {
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAME_SITE,
    path: '/',
    maxAge: maxAgeMs,
  } as const;
}

authRouter.post('/login', loginRateLimiter, async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid login input' });
      return;
    }

    const pool = requirePool();
    const identifier = parsed.data.identifier.toLowerCase();

    const userRes = await pool.query<{
      id: string;
      name: string;
      email: string;
      username: string;
      password_hash: string;
      status: 'active' | 'inactive';
      can_publish_override: boolean | null;
      created_at: Date;
      role_slug: RoleSlug;
      role_name: string;
      permissions: PermissionKey[];
    }>(
      `SELECT
         u.id, u.name, u.email, u.username, u.password_hash, u.status,
         u.can_publish_override, u.created_at,
         r.slug AS role_slug, r.name AS role_name,
         COALESCE(ARRAY_AGG(p.key) FILTER (WHERE p.key IS NOT NULL), '{}') AS permissions
       FROM admin_users u
       JOIN roles r ON r.id = u.role_id
       LEFT JOIN role_permissions rp ON rp.role_id = r.id
       LEFT JOIN permissions p ON p.id = rp.permission_id
       WHERE LOWER(u.email) = $1 OR LOWER(u.username) = $1
       GROUP BY u.id, r.id
       LIMIT 1`,
      [identifier],
    );

    const row = userRes.rows[0];
    if (!row || row.status !== 'active') {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const validPassword = await argon2.verify(row.password_hash, parsed.data.password);
    if (!validPassword) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const settingsRes = await pool.query<{ session_ttl_hours: number }>(
      `SELECT session_ttl_hours FROM portal_settings WHERE id = 1`,
    ).catch(() => ({ rows: [] as Array<{ session_ttl_hours: number }> }));
    const ttlHours = settingsRes.rows[0]?.session_ttl_hours ?? env.SESSION_TTL_HOURS;
    const ttlMs = ttlHours * 60 * 60 * 1000;

    const rawSessionToken = crypto.randomBytes(48).toString('hex');
    const rawCsrfToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + ttlMs);

    await pool.query(
      `INSERT INTO admin_sessions (admin_user_id, token_hash, csrf_token_hash, ip_address, user_agent, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        row.id,
        sha256Hex(rawSessionToken),
        sha256Hex(rawCsrfToken),
        req.ip ?? null,
        req.get('user-agent') ?? null,
        expiresAt,
      ],
    );

    await pool.query(`UPDATE admin_users SET last_login_at = NOW() WHERE id = $1`, [
      row.id,
    ]);

    await logAdminActivity(pool, {
      actorAdminId: row.id,
      targetAdminId: row.id,
      action: 'admin.login',
      entityType: 'admin_user',
      entityId: row.id,
      details: { username: row.username },
      ipAddress: req.ip ?? null,
    });

    res.cookie(SESSION_COOKIE_NAME, rawSessionToken, getSessionCookieOptions(ttlMs));

    const effectivePermissions = deriveEffectivePermissions(
      row.role_slug,
      row.permissions,
      row.can_publish_override,
    );

    res.json({
      user: {
        id: row.id,
        name: row.name,
        email: row.email,
        username: row.username,
        roleSlug: row.role_slug,
        roleName: row.role_name,
        status: row.status,
        canPublishOverride: row.can_publish_override,
        permissions: effectivePermissions,
        lastLoginAt: new Date().toISOString(),
        createdAt: row.created_at.toISOString(),
      },
      csrfToken: rawCsrfToken,
    });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/logout', requireAuth, async (req, res, next) => {
  try {
    const pool = requirePool();
    const session = req.adminSession!;

    await pool.query(
      `UPDATE admin_sessions SET revoked_at = NOW() WHERE id = $1`,
      [session.sessionId],
    );

    await logAdminActivity(pool, {
      actorAdminId: session.user.id,
      targetAdminId: session.user.id,
      action: 'admin.logout',
      entityType: 'admin_user',
      entityId: session.user.id,
      details: { username: session.user.username },
      ipAddress: req.ip ?? null,
    });

    res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
    res.clearCookie(PREVIEW_COOKIE_NAME, { path: '/' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

authRouter.get('/me', requireAuth, async (req, res, next) => {
  try {
    const pool = requirePool();
    const session = req.adminSession!;
    // Issue a fresh CSRF secret bound to the active session on /me reload
    const freshCsrf = crypto.randomBytes(32).toString('hex');
    await pool.query(
      `UPDATE admin_sessions SET csrf_token_hash = $1 WHERE id = $2`,
      [sha256Hex(freshCsrf), session.sessionId],
    );

    res.json({
      user: session.user,
      csrfToken: freshCsrf,
    });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/forgot-password', loginRateLimiter, async (req, res, next) => {
  try {
    const parsed = forgotPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Valid email or username is required' });
      return;
    }

    const pool = requirePool();
    const identifier = parsed.data.identifier.toLowerCase();

    const userRes = await pool.query<{ id: string }>(
      `SELECT id FROM admin_users WHERE (LOWER(email) = $1 OR LOWER(username) = $1) AND status = 'active' LIMIT 1`,
      [identifier],
    );

    const userId = userRes.rows[0]?.id;
    if (userId) {
      const rawToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
      await pool.query(
        `INSERT INTO password_reset_tokens (admin_user_id, token_hash, expires_at)
         VALUES ($1, $2, $3)`,
        [userId, sha256Hex(rawToken), expiresAt],
      );
      await logAdminActivity(pool, {
        actorAdminId: userId,
        targetAdminId: userId,
        action: 'admin.password_reset_requested',
        entityType: 'admin_user',
        entityId: userId,
        ipAddress: req.ip ?? null,
      });
    }

    // Generic response to prevent account enumeration
    res.json({
      ok: true,
      message:
        'If an active administrator account matches that identifier, a password reset request has been recorded. Contact your Super Admin if internal email delivery is not configured.',
    });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/reset-password', loginRateLimiter, async (req, res, next) => {
  try {
    const parsed = resetPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Valid reset token and password (min 12 chars) required' });
      return;
    }

    const pool = requirePool();
    const tokenHash = sha256Hex(parsed.data.token);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const tokenRes = await client.query<{ id: string; admin_user_id: string }>(
        `SELECT id, admin_user_id
         FROM password_reset_tokens
         WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()
         LIMIT 1
         FOR UPDATE`,
        [tokenHash],
      );
      const tokenRow = tokenRes.rows[0];
      if (!tokenRow) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: 'Reset token is invalid or expired' });
        return;
      }

      const newHash = await argon2.hash(parsed.data.newPassword, {
        type: argon2.argon2id,
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 1,
      });

      await client.query(`UPDATE admin_users SET password_hash = $1, updated_at = NOW() WHERE id = $2`, [
        newHash,
        tokenRow.admin_user_id,
      ]);
      await client.query(`UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1`, [
        tokenRow.id,
      ]);
      await client.query(
        `UPDATE admin_sessions SET revoked_at = NOW() WHERE admin_user_id = $1 AND revoked_at IS NULL`,
        [tokenRow.admin_user_id],
      );
      await logAdminActivity(client, {
        actorAdminId: tokenRow.admin_user_id,
        targetAdminId: tokenRow.admin_user_id,
        action: 'admin.password_reset_completed',
        entityType: 'admin_user',
        entityId: tokenRow.admin_user_id,
        ipAddress: req.ip ?? null,
      });
      await client.query('COMMIT');
      res.json({ ok: true });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
});

authRouter.get('/sessions', requireAuth, async (req, res, next) => {
  try {
    const pool = requirePool();
    const session = req.adminSession!;
    const rows = await pool.query<{
      id: string;
      ip_address: string | null;
      user_agent: string | null;
      expires_at: Date;
      created_at: Date;
    }>(
      `SELECT id, ip_address, user_agent, expires_at, created_at
       FROM admin_sessions
       WHERE admin_user_id = $1 AND revoked_at IS NULL AND expires_at > NOW()
       ORDER BY created_at DESC`,
      [session.user.id],
    );
    res.json({
      items: rows.rows.map((r) => ({
        id: r.id,
        ipAddress: r.ip_address,
        userAgent: r.user_agent,
        expiresAt: r.expires_at.toISOString(),
        createdAt: r.created_at.toISOString(),
        isCurrent: r.id === session.sessionId,
      })),
    });
  } catch (err) {
    next(err);
  }
});

authRouter.delete('/sessions/:id', requireAuth, async (req, res, next) => {
  try {
    const pool = requirePool();
    const session = req.adminSession!;
    const result = await pool.query(
      `UPDATE admin_sessions
       SET revoked_at = NOW()
       WHERE id = $1 AND admin_user_id = $2 AND revoked_at IS NULL
       RETURNING id`,
      [req.params.id, session.user.id],
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Active session not found' });
      return;
    }

    if (req.params.id === session.sessionId) {
      res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
    }

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
