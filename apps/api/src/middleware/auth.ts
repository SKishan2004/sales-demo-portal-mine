import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import type { AdminUserDTO, PermissionKey, RoleSlug } from '@mobileum/shared';
import { getPool } from '../config/database.js';

export const SESSION_COOKIE_NAME = 'mobileum_admin_session';
export const PREVIEW_COOKIE_NAME = 'mobileum_admin_preview';

export interface AuthenticatedSession {
  sessionId: string;
  csrfTokenHash: string;
  user: AdminUserDTO;
}

declare global {
  namespace Express {
    interface Request {
      adminSession?: AuthenticatedSession;
    }
  }
}

export function sha256Hex(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function deriveEffectivePermissions(
  roleSlug: RoleSlug,
  basePermissions: PermissionKey[],
  canPublishOverride: boolean | null,
): PermissionKey[] {
  const perms = new Set<PermissionKey>(basePermissions);
  if (roleSlug === 'content_manager') {
    if (canPublishOverride === true) {
      perms.add('products:publish');
    } else if (canPublishOverride === false) {
      perms.delete('products:publish');
    }
  }
  return Array.from(perms);
}

export async function resolveSessionFromRequest(
  req: Request,
): Promise<AuthenticatedSession | null> {
  const pool = getPool();
  if (!pool) return null;

  const rawToken = req.cookies?.[SESSION_COOKIE_NAME];
  if (!rawToken || typeof rawToken !== 'string') {
    return null;
  }

  const tokenHash = sha256Hex(rawToken);
  const result = await pool.query<{
    session_id: string;
    csrf_token_hash: string;
    user_id: string;
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
       s.id AS session_id,
       s.csrf_token_hash,
       u.id AS user_id,
       u.name,
       u.email,
       u.username,
       u.status,
       u.can_publish_override,
       u.last_login_at,
       u.created_at,
       r.slug AS role_slug,
       r.name AS role_name,
       COALESCE(ARRAY_AGG(p.key) FILTER (WHERE p.key IS NOT NULL), '{}') AS permissions
     FROM admin_sessions s
     JOIN admin_users u ON u.id = s.admin_user_id
     JOIN roles r ON r.id = u.role_id
     LEFT JOIN role_permissions rp ON rp.role_id = r.id
     LEFT JOIN permissions p ON p.id = rp.permission_id
     WHERE s.token_hash = $1
       AND s.revoked_at IS NULL
       AND s.expires_at > NOW()
     GROUP BY s.id, u.id, r.id
     LIMIT 1`,
    [tokenHash],
  );

  const row = result.rows[0];
  if (!row || row.status !== 'active') {
    return null;
  }

  const effectivePermissions = deriveEffectivePermissions(
    row.role_slug,
    row.permissions,
    row.can_publish_override,
  );

  return {
    sessionId: row.session_id,
    csrfTokenHash: row.csrf_token_hash,
    user: {
      id: row.user_id,
      name: row.name,
      email: row.email,
      username: row.username,
      roleSlug: row.role_slug,
      roleName: row.role_name,
      status: row.status,
      canPublishOverride: row.can_publish_override,
      permissions: effectivePermissions,
      lastLoginAt: row.last_login_at ? row.last_login_at.toISOString() : null,
      createdAt: row.created_at.toISOString(),
    },
  };
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const session = await resolveSessionFromRequest(req);
    if (!session) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Enforce CSRF token validation on state-changing requests
    const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);
    if (!safeMethods.has(req.method)) {
      const providedCsrf = req.headers['x-csrf-token'];
      if (
        !providedCsrf ||
        typeof providedCsrf !== 'string' ||
        sha256Hex(providedCsrf) !== session.csrfTokenHash
      ) {
        res.status(403).json({ error: 'Invalid or missing CSRF token' });
        return;
      }
    }

    req.adminSession = session;
    next();
  } catch (err) {
    next(err);
  }
}

export function requirePermission(permission: PermissionKey) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = req.adminSession?.user;
    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    if (!user.permissions.includes(permission)) {
      res.status(403).json({
        error: `Forbidden: missing required permission (${permission})`,
      });
      return;
    }
    next();
  };
}
