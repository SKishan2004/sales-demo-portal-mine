import { Router } from 'express';
import { z } from 'zod';
import { requirePool } from '../config/database.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { logAdminActivity } from '../services/audit.service.js';
import { queryProductSummaries } from '../services/product.service.js';

export const adminOpsRouter = Router();
adminOpsRouter.use(requireAuth);

const settingsUpdateSchema = z.object({
  portalTitle: z.string().trim().min(2).max(180).optional(),
  defaultSort: z.enum(['display_order', 'recent', 'alpha']).optional(),
  maxImageSizeMb: z.number().int().min(1).max(100).optional(),
  maxVideoSizeMb: z.number().int().min(10).max(2048).optional(),
  sessionTtlHours: z.number().int().min(1).max(168).optional(),
});

adminOpsRouter.get(
  '/dashboard',
  requirePermission('dashboard:read'),
  async (_req, res, next) => {
    try {
      const pool = requirePool();
      const [countsRes, catRes, updatedRes, addedRes, logsRes] = await Promise.all([
        pool.query<{
          total_products: string;
          published_products: string;
          draft_products: string;
          total_categories: string;
          total_product_types: string;
          total_videos: string;
          total_screenshots: string;
          total_admins: string;
          active_admins: string;
        }>(`
          SELECT
            (SELECT COUNT(*)::text FROM products) AS total_products,
            (SELECT COUNT(*)::text FROM products WHERE publication_status = 'published') AS published_products,
            (SELECT COUNT(*)::text FROM products WHERE publication_status = 'draft') AS draft_products,
            (SELECT COUNT(*)::text FROM categories) AS total_categories,
            (SELECT COUNT(*)::text FROM product_types) AS total_product_types,
            (SELECT COUNT(*)::text FROM product_videos) AS total_videos,
            (SELECT COUNT(*)::text FROM product_images) AS total_screenshots,
            (SELECT COUNT(*)::text FROM admin_users) AS total_admins,
            (SELECT COUNT(*)::text FROM admin_users WHERE status = 'active') AS active_admins
        `),
        pool.query<{ id: string; name: string; product_count: string }>(
          `SELECT c.id, c.name, COUNT(p.id)::text AS product_count
           FROM categories c
           LEFT JOIN products p ON p.category_id = c.id
           GROUP BY c.id
           ORDER BY c.display_order ASC`,
        ),
        queryProductSummaries(pool, { sort: 'recent', page: 1, pageSize: 5 }),
        pool.query<{ id: string }>(
          `SELECT id FROM products ORDER BY created_at DESC LIMIT 5`,
        ),
        pool.query<{
          id: string;
          actor_name: string | null;
          actor_email: string | null;
          actor_role: string | null;
          action: string;
          entity_type: 'product' | 'category' | 'product_type' | 'media' | 'admin_user' | 'settings';
          entity_id: string | null;
          entity_name: string;
          details: string;
          created_at: Date;
        }>(`
          SELECT
            l.id,
            u.name AS actor_name,
            u.email AS actor_email,
            r.name AS actor_role,
            l.action,
            l.entity_type,
            l.entity_id,
            COALESCE(p.name, l.details_json->>'name', l.entity_type) AS entity_name,
            l.details_json::text AS details,
            l.created_at
          FROM product_activity_logs l
          LEFT JOIN admin_users u ON u.id = l.admin_user_id
          LEFT JOIN roles r ON r.id = u.role_id
          LEFT JOIN products p ON p.id = l.product_id
          ORDER BY l.created_at DESC
          LIMIT 8
        `),
      ]);

      const c = countsRes.rows[0]!;
      const addedAll = await queryProductSummaries(pool, { page: 1, pageSize: 100 });
      const addedOrder = addedRes.rows
        .map((r) => addedAll.items.find((item) => item.id === r.id))
        .filter((x): x is NonNullable<typeof x> => Boolean(x));

      res.json({
        metrics: {
          totalProducts: Number(c.total_products),
          publishedProducts: Number(c.published_products),
          draftProducts: Number(c.draft_products),
          totalCategories: Number(c.total_categories),
          totalProductTypes: Number(c.total_product_types),
          totalVideos: Number(c.total_videos),
          totalScreenshots: Number(c.total_screenshots),
          totalAdministrators: Number(c.total_admins),
          activeAdministrators: Number(c.active_admins),
        },
        categoryBreakdown: catRes.rows.map((row) => ({
          categoryId: row.id,
          categoryName: row.name,
          productCount: Number(row.product_count),
        })),
        recentlyUpdatedProducts: updatedRes.items,
        recentlyAddedProducts: addedOrder,
        recentActivity: logsRes.rows.map((l) => ({
          id: l.id,
          actorName: l.actor_name ?? 'System',
          actorEmail: l.actor_email,
          actorRole: l.actor_role,
          action: l.action,
          entityType: l.entity_type,
          entityId: l.entity_id,
          entityName: l.entity_name,
          details: l.details,
          createdAt: l.created_at.toISOString(),
        })),
      });
    } catch (err) {
      next(err);
    }
  },
);

adminOpsRouter.get(
  '/activity-logs',
  requirePermission('logs:read'),
  async (_req, res, next) => {
    try {
      const pool = requirePool();
      const rows = await pool.query<{
        id: string;
        actor_name: string | null;
        actor_email: string | null;
        actor_role: string | null;
        action: string;
        entity_type: 'product' | 'category' | 'product_type' | 'media' | 'admin_user' | 'settings';
        entity_id: string | null;
        entity_name: string;
        details: string;
        created_at: Date;
      }>(`
        SELECT * FROM (
          SELECT
            l.id,
            u.name AS actor_name,
            u.email AS actor_email,
            r.name AS actor_role,
            l.action,
            l.entity_type,
            l.entity_id,
            COALESCE(p.name, l.details_json->>'name', l.details_json->>'filename', l.entity_type) AS entity_name,
            l.details_json::text AS details,
            l.created_at
          FROM product_activity_logs l
          LEFT JOIN admin_users u ON u.id = l.admin_user_id
          LEFT JOIN roles r ON r.id = u.role_id
          LEFT JOIN products p ON p.id = l.product_id
          UNION ALL
          SELECT
            al.id,
            au.name AS actor_name,
            au.email AS actor_email,
            ar.name AS actor_role,
            al.action,
            al.entity_type,
            al.entity_id,
            COALESCE(tu.name, al.details_json->>'username', al.entity_type) AS entity_name,
            al.details_json::text AS details,
            al.created_at
          FROM admin_activity_logs al
          LEFT JOIN admin_users au ON au.id = al.actor_admin_id
          LEFT JOIN roles ar ON ar.id = au.role_id
          LEFT JOIN admin_users tu ON tu.id = al.target_admin_id
        ) combined
        ORDER BY created_at DESC
        LIMIT 200
      `);

      res.json({
        items: rows.rows.map((r) => ({
          id: r.id,
          actorName: r.actor_name ?? 'System',
          actorEmail: r.actor_email,
          actorRole: r.actor_role,
          action: r.action,
          entityType: r.entity_type,
          entityId: r.entity_id,
          entityName: r.entity_name,
          details: r.details,
          createdAt: r.created_at.toISOString(),
        })),
      });
    } catch (err) {
      next(err);
    }
  },
);

adminOpsRouter.get(
  '/settings',
  requirePermission('dashboard:read'),
  async (_req, res, next) => {
    try {
      const pool = requirePool();
      const rowRes = await pool.query<{
        portal_title: string;
        default_sort: 'display_order' | 'recent' | 'alpha';
        max_image_size_mb: number;
        max_video_size_mb: number;
        allowed_image_types: string[];
        allowed_video_types: string[];
        session_ttl_hours: number;
      }>(`SELECT * FROM portal_settings WHERE id = 1 LIMIT 1`);
      const s = rowRes.rows[0];
      res.json({
        settings: s
          ? {
              portalTitle: s.portal_title,
              defaultSort: s.default_sort,
              maxImageSizeMb: s.max_image_size_mb,
              maxVideoSizeMb: s.max_video_size_mb,
              allowedImageTypes: s.allowed_image_types,
              allowedVideoTypes: s.allowed_video_types,
              sessionTtlHours: s.session_ttl_hours,
            }
          : null,
      });
    } catch (err) {
      next(err);
    }
  },
);

adminOpsRouter.put(
  '/settings',
  requirePermission('roles:manage'),
  async (req, res, next) => {
    try {
      const parsed = settingsUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.errors[0]?.message ?? 'Invalid settings payload' });
        return;
      }
      const pool = requirePool();
      const adminId = req.adminSession!.user.id;
      const updated = await pool.query<{
        portal_title: string;
        default_sort: 'display_order' | 'recent' | 'alpha';
        max_image_size_mb: number;
        max_video_size_mb: number;
        allowed_image_types: string[];
        allowed_video_types: string[];
        session_ttl_hours: number;
      }>(
        `UPDATE portal_settings SET
           portal_title = COALESCE($1, portal_title),
           default_sort = COALESCE($2, default_sort),
           max_image_size_mb = COALESCE($3, max_image_size_mb),
           max_video_size_mb = COALESCE($4, max_video_size_mb),
           session_ttl_hours = COALESCE($5, session_ttl_hours),
           updated_by = $6,
           updated_at = NOW()
         WHERE id = 1
         RETURNING *`,
        [
          parsed.data.portalTitle ?? null,
          parsed.data.defaultSort ?? null,
          parsed.data.maxImageSizeMb ?? null,
          parsed.data.maxVideoSizeMb ?? null,
          parsed.data.sessionTtlHours ?? null,
          adminId,
        ],
      );
      const s = updated.rows[0]!;
      await logAdminActivity(pool, {
        actorAdminId: adminId,
        action: 'settings.updated',
        entityType: 'settings',
        details: parsed.data,
        ipAddress: req.ip ?? null,
      });
      res.json({
        settings: {
          portalTitle: s.portal_title,
          defaultSort: s.default_sort,
          maxImageSizeMb: s.max_image_size_mb,
          maxVideoSizeMb: s.max_video_size_mb,
          allowedImageTypes: s.allowed_image_types,
          allowedVideoTypes: s.allowed_video_types,
          sessionTtlHours: s.session_ttl_hours,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);
