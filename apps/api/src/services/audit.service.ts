import type { Pool, PoolClient } from 'pg';

type Queryable = Pool | PoolClient;

export async function logProductActivity(
  db: Queryable,
  params: {
    productId: string | null;
    adminUserId: string | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    details?: Record<string, unknown>;
  },
): Promise<void> {
  await db.query(
    `INSERT INTO product_activity_logs (product_id, admin_user_id, action, entity_type, entity_id, details_json)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      params.productId,
      params.adminUserId,
      params.action,
      params.entityType,
      params.entityId ?? params.productId,
      JSON.stringify(params.details ?? {}),
    ],
  );
}

export async function logAdminActivity(
  db: Queryable,
  params: {
    actorAdminId: string | null;
    targetAdminId?: string | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    details?: Record<string, unknown>;
    ipAddress?: string | null;
  },
): Promise<void> {
  await db.query(
    `INSERT INTO admin_activity_logs (actor_admin_id, target_admin_id, action, entity_type, entity_id, details_json, ip_address)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      params.actorAdminId,
      params.targetAdminId ?? null,
      params.action,
      params.entityType,
      params.entityId ?? null,
      JSON.stringify(params.details ?? {}),
      params.ipAddress ?? null,
    ],
  );
}
