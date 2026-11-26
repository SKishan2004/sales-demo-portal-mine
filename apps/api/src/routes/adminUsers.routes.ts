import argon2 from 'argon2';
import { Router } from 'express';
import { z } from 'zod';
import { ROLE_SLUGS, type PermissionKey, type RoleSlug } from '@mobileum/shared';
import { requirePool } from '../config/database.js';
import { UUID_REGEX } from '../config/storage.js';
import {
  deriveEffectivePermissions,
  requireAuth,
  requirePermission,
} from '../middleware/auth.js';
import { logAdminActivity } from '../services/audit.service.js';

export const adminUsersRouter = Router();
adminUsersRouter.use(requireAuth);

const roleSlugEnum = z.enum([
  ROLE_SLUGS.SUPER_ADMIN,
  ROLE_SLUGS.ADMIN,
  ROLE_SLUGS.CONTENT_MANAGER,
  ROLE_SLUGS.VIEWER,
]);

const createUserSchema = z.object({
  name: z.string().trim().min(2).max(150),
  email: z.string().trim().email().max(255),
  username: z.string().trim().min(2).max(100).regex(/^[a-zA-Z0-9_.-]+$/),
  roleSlug: roleSlugEnum,
  status: z.enum(['active', 'inactive']).default('active'),
  canPublishOverride: z.boolean().nullable().optional(),
  initialPassword: z.string().min(12).max(200),
});

const updateRoleSchema = z.object({
  roleSlug: roleSlugEnum,
  canPublishOverride: z.boolean().nullable().optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(['active', 'inactive']),
});

const resetPasswordBodySchema = z.object({
  newPassword: z.string().min(12).max(200),
});

async function fetchUsersAndRoles() {
  const pool = requirePool();
  const [usersRes, rolesRes] = await Promise.all([
    pool.query<{
      id: string;
      name: string;
      email: string;
      username: string;
      status: 'active' | 'inactive';
      can_publish_override: boolean | null;
      last_login_at: Date | null;
      created_at: Date;
      role_slug: RoleSlug;
      role_name: string;
      permissions: PermissionKey[];
    }>(
      `SELECT
         u.id, u.name, u.email, u.username, u.status, u.can_publish_override,
         u.last_login_at, u.created_at,
         r.slug AS role_slug, r.name AS role_name,
         COALESCE(ARRAY_AGG(p.key) FILTER (WHERE p.key IS NOT NULL), '{}') AS permissions
       FROM admin_users u
       JOIN roles r ON r.id = u.role_id
       LEFT JOIN role_permissions rp ON rp.role_id = r.id
       LEFT JOIN permissions p ON p.id = rp.permission_id
       GROUP BY u.id, r.id
       ORDER BY u.created_at ASC`,
    ),
    pool.query<{
      id: string;
      slug: RoleSlug;
      name: string;
      description: string | null;
      permissions: PermissionKey[];
    }>(
      `SELECT
         r.id, r.slug, r.name, r.description,
         COALESCE(ARRAY_AGG(p.key) FILTER (WHERE p.key IS NOT NULL), '{}') AS permissions
       FROM roles r
       LEFT JOIN role_permissions rp ON rp.role_id = r.id
       LEFT JOIN permissions p ON p.id = rp.permission_id
       GROUP BY r.id
       ORDER BY r.created_at ASC`,
    ),
  ]);

  return {
    items: usersRes.rows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      username: row.username,
      roleSlug: row.role_slug,
      roleName: row.role_name,
      status: row.status,
      canPublishOverride: row.can_publish_override,
      permissions: deriveEffectivePermissions(
        row.role_slug,
        row.permissions,
        row.can_publish_override,
      ),
      lastLoginAt: row.last_login_at ? row.last_login_at.toISOString() : null,
      createdAt: row.created_at.toISOString(),
    })),
    roles: rolesRes.rows,
  };
}

adminUsersRouter.get(
  '/users',
  requirePermission('users:read'),
  async (_req, res, next) => {
    try {
      const data = await fetchUsersAndRoles();
      res.json(data);
    } catch (err) {
      next(err);
    }
  },
);

adminUsersRouter.get(
  '/roles',
  requirePermission('users:read'),
  async (_req, res, next) => {
    try {
      const data = await fetchUsersAndRoles();
      res.json({ items: data.roles });
    } catch (err) {
      next(err);
    }
  },
);

adminUsersRouter.post(
  '/users',
  requirePermission('users:manage'),
  async (req, res, next) => {
    try {
      const parsed = createUserSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.errors[0]?.message ?? 'Invalid administrator input' });
        return;
      }
      const pool = requirePool();
      const actorId = req.adminSession!.user.id;
      const email = parsed.data.email.toLowerCase();
      const username = parsed.data.username.toLowerCase();

      const dupCheck = await pool.query<{ id: string }>(
        `SELECT id FROM admin_users WHERE LOWER(email) = $1 OR LOWER(username) = $2 LIMIT 1`,
        [email, username],
      );
      if (dupCheck.rows.length > 0) {
        res.status(409).json({ error: 'Email or username is already registered' });
        return;
      }

      const roleRes = await pool.query<{ id: string }>(
        `SELECT id FROM roles WHERE slug = $1 LIMIT 1`,
        [parsed.data.roleSlug],
      );
      const roleId = roleRes.rows[0]?.id;
      if (!roleId) {
        res.status(400).json({ error: 'Selected role does not exist' });
        return;
      }

      const passwordHash = await argon2.hash(parsed.data.initialPassword, {
        type: argon2.argon2id,
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 1,
      });

      const inserted = await pool.query<{ id: string }>(
        `INSERT INTO admin_users (name, email, username, password_hash, role_id, status, can_publish_override, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [
          parsed.data.name,
          email,
          username,
          passwordHash,
          roleId,
          parsed.data.status,
          parsed.data.roleSlug === 'content_manager'
            ? Boolean(parsed.data.canPublishOverride)
            : null,
          actorId,
        ],
      );

      await logAdminActivity(pool, {
        actorAdminId: actorId,
        targetAdminId: inserted.rows[0]!.id,
        action: 'admin_user.created',
        entityType: 'admin_user',
        entityId: inserted.rows[0]!.id,
        details: { username, roleSlug: parsed.data.roleSlug },
        ipAddress: req.ip ?? null,
      });

      const all = await fetchUsersAndRoles();
      const user = all.items.find((u) => u.id === inserted.rows[0]!.id);
      res.status(201).json({ user });
    } catch (err) {
      next(err);
    }
  },
);

adminUsersRouter.patch(
  '/users/:id/role',
  requirePermission('roles:manage'),
  async (req, res, next) => {
    try {
      const targetId = String(req.params.id ?? '');
      if (!UUID_REGEX.test(targetId)) {
        res.status(400).json({ error: 'Invalid administrator ID' });
        return;
      }
      if (targetId === req.adminSession!.user.id) {
        res.status(403).json({ error: 'Self-role modification is not permitted' });
        return;
      }

      const parsed = updateRoleSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid role payload' });
        return;
      }

      const pool = requirePool();
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const targetRes = await client.query<{ role_slug: RoleSlug; status: string }>(
          `SELECT r.slug AS role_slug, u.status
           FROM admin_users u
           JOIN roles r ON r.id = u.role_id
           WHERE u.id = $1
           LIMIT 1
           FOR UPDATE`,
          [targetId],
        );
        const target = targetRes.rows[0];
        if (!target) {
          await client.query('ROLLBACK');
          res.status(404).json({ error: 'Administrator not found' });
          return;
        }

        if (
          target.role_slug === 'super_admin' &&
          parsed.data.roleSlug !== 'super_admin'
        ) {
          const countRes = await client.query<{ count: string }>(
            `SELECT COUNT(*)::text AS count
             FROM admin_users u
             JOIN roles r ON r.id = u.role_id
             WHERE r.slug = 'super_admin' AND u.status = 'active'`,
          );
          if (Number(countRes.rows[0]?.count ?? '0') <= 1) {
            await client.query('ROLLBACK');
            res.status(409).json({
              error: 'Cannot demote the last active Super Administrator',
            });
            return;
          }
        }

        const roleRes = await client.query<{ id: string }>(
          `SELECT id FROM roles WHERE slug = $1 LIMIT 1`,
          [parsed.data.roleSlug],
        );
        const newRoleId = roleRes.rows[0]?.id;
        if (!newRoleId) {
          await client.query('ROLLBACK');
          res.status(400).json({ error: 'Role not found' });
          return;
        }

        await client.query(
          `UPDATE admin_users
           SET role_id = $2, can_publish_override = $3, updated_at = NOW()
           WHERE id = $1`,
          [
            targetId,
            newRoleId,
            parsed.data.roleSlug === 'content_manager'
              ? Boolean(parsed.data.canPublishOverride)
              : null,
          ],
        );

        await logAdminActivity(client, {
          actorAdminId: req.adminSession!.user.id,
          targetAdminId: targetId,
          action: 'admin_user.role_updated',
          entityType: 'admin_user',
          entityId: targetId,
          details: { roleSlug: parsed.data.roleSlug },
          ipAddress: req.ip ?? null,
        });
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }

      const all = await fetchUsersAndRoles();
      const user = all.items.find((u) => u.id === targetId);
      res.json({ user });
    } catch (err) {
      next(err);
    }
  },
);

adminUsersRouter.patch(
  '/users/:id/status',
  requirePermission('users:manage'),
  async (req, res, next) => {
    try {
      const targetId = String(req.params.id ?? '');
      if (!UUID_REGEX.test(targetId)) {
        res.status(400).json({ error: 'Invalid administrator ID' });
        return;
      }
      if (targetId === req.adminSession!.user.id) {
        res.status(403).json({ error: 'You cannot deactivate your own account' });
        return;
      }

      const parsed = updateStatusSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid status payload' });
        return;
      }

      const pool = requirePool();
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const targetRes = await client.query<{ role_slug: RoleSlug }>(
          `SELECT r.slug AS role_slug
           FROM admin_users u
           JOIN roles r ON r.id = u.role_id
           WHERE u.id = $1
           LIMIT 1
           FOR UPDATE`,
          [targetId],
        );
        const target = targetRes.rows[0];
        if (!target) {
          await client.query('ROLLBACK');
          res.status(404).json({ error: 'Administrator not found' });
          return;
        }

        if (
          target.role_slug === 'super_admin' &&
          parsed.data.status === 'inactive'
        ) {
          const countRes = await client.query<{ count: string }>(
            `SELECT COUNT(*)::text AS count
             FROM admin_users u
             JOIN roles r ON r.id = u.role_id
             WHERE r.slug = 'super_admin' AND u.status = 'active'`,
          );
          if (Number(countRes.rows[0]?.count ?? '0') <= 1) {
            await client.query('ROLLBACK');
            res.status(409).json({
              error: 'Cannot deactivate the last active Super Administrator',
            });
            return;
          }
        }

        await client.query(
          `UPDATE admin_users SET status = $2, updated_at = NOW() WHERE id = $1`,
          [targetId, parsed.data.status],
        );

        if (parsed.data.status === 'inactive') {
          await client.query(
            `UPDATE admin_sessions SET revoked_at = NOW() WHERE admin_user_id = $1 AND revoked_at IS NULL`,
            [targetId],
          );
        }

        await logAdminActivity(client, {
          actorAdminId: req.adminSession!.user.id,
          targetAdminId: targetId,
          action:
            parsed.data.status === 'active'
              ? 'admin_user.activated'
              : 'admin_user.deactivated',
          entityType: 'admin_user',
          entityId: targetId,
          ipAddress: req.ip ?? null,
        });
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }

      const all = await fetchUsersAndRoles();
      const user = all.items.find((u) => u.id === targetId);
      res.json({ user });
    } catch (err) {
      next(err);
    }
  },
);

adminUsersRouter.post(
  '/users/:id/revoke-sessions',
  requirePermission('users:manage'),
  async (req, res, next) => {
    try {
      const targetId = String(req.params.id ?? '');
      if (!UUID_REGEX.test(targetId)) {
        res.status(400).json({ error: 'Invalid administrator ID' });
        return;
      }
      const pool = requirePool();
      await pool.query(
        `UPDATE admin_sessions SET revoked_at = NOW() WHERE admin_user_id = $1 AND revoked_at IS NULL`,
        [targetId],
      );
      await logAdminActivity(pool, {
        actorAdminId: req.adminSession!.user.id,
        targetAdminId: targetId,
        action: 'admin_user.sessions_revoked',
        entityType: 'admin_user',
        entityId: targetId,
        ipAddress: req.ip ?? null,
      });
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  },
);

adminUsersRouter.post(
  '/users/:id/reset-password',
  requirePermission('users:manage'),
  async (req, res, next) => {
    try {
      const targetId = String(req.params.id ?? '');
      if (!UUID_REGEX.test(targetId)) {
        res.status(400).json({ error: 'Invalid administrator ID' });
        return;
      }
      const parsed = resetPasswordBodySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Password must be at least 12 characters' });
        return;
      }
      const pool = requirePool();
      const hash = await argon2.hash(parsed.data.newPassword, {
        type: argon2.argon2id,
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 1,
      });
      const updated = await pool.query(
        `UPDATE admin_users SET password_hash = $2, updated_at = NOW() WHERE id = $1 RETURNING id`,
        [targetId, hash],
      );
      if (updated.rows.length === 0) {
        res.status(404).json({ error: 'Administrator not found' });
        return;
      }
      await pool.query(
        `UPDATE admin_sessions SET revoked_at = NOW() WHERE admin_user_id = $1 AND revoked_at IS NULL`,
        [targetId],
      );
      await logAdminActivity(pool, {
        actorAdminId: req.adminSession!.user.id,
        targetAdminId: targetId,
        action: 'admin_user.password_reset',
        entityType: 'admin_user',
        entityId: targetId,
        ipAddress: req.ip ?? null,
      });
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  },
);

adminUsersRouter.get(
  '/users/:id/activity',
  requirePermission('users:read'),
  async (req, res, next) => {
    try {
      const targetId = String(req.params.id ?? '');
      if (!UUID_REGEX.test(targetId)) {
        res.status(400).json({ error: 'Invalid administrator ID' });
        return;
      }
      const pool = requirePool();
      const rows = await pool.query<{
        id: string;
        action: string;
        entity_type: string;
        entity_id: string | null;
        details_json: Record<string, unknown>;
        created_at: Date;
      }>(
        `SELECT id, action, entity_type, entity_id, details_json, created_at
         FROM admin_activity_logs
         WHERE actor_admin_id = $1 OR target_admin_id = $1
         ORDER BY created_at DESC
         LIMIT 50`,
        [targetId],
      );
      res.json({
        items: rows.rows.map((r) => ({
          id: r.id,
          action: r.action,
          entityType: r.entity_type,
          entityId: r.entity_id,
          details: JSON.stringify(r.details_json),
          createdAt: r.created_at.toISOString(),
        })),
      });
    } catch (err) {
      next(err);
    }
  },
);
