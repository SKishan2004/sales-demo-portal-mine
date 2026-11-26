import { Router } from 'express';
import { categoryInputSchema, productTypeInputSchema } from '@mobileum/shared';
import { requirePool } from '../config/database.js';
import { UUID_REGEX } from '../config/storage.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { logProductActivity } from '../services/audit.service.js';

export const adminTaxonomyRouter = Router();
adminTaxonomyRouter.use(requireAuth);

// Categories
adminTaxonomyRouter.get(
  '/categories',
  requirePermission('categories:read'),
  async (_req, res, next) => {
    try {
      const pool = requirePool();
      const rows = await pool.query<{
        id: string;
        name: string;
        slug: string;
        description: string | null;
        icon_path: string | null;
        display_order: number;
        is_active: boolean;
        product_count: string;
      }>(
        `SELECT c.*, COUNT(p.id)::text AS product_count
         FROM categories c
         LEFT JOIN products p ON p.category_id = c.id
         GROUP BY c.id
         ORDER BY c.display_order ASC, c.name ASC`,
      );
      res.json({
        items: rows.rows.map((r) => ({
          id: r.id,
          name: r.name,
          slug: r.slug,
          description: r.description,
          iconPath: r.icon_path,
          displayOrder: r.display_order,
          isActive: r.is_active,
          productCount: Number(r.product_count),
        })),
      });
    } catch (err) {
      next(err);
    }
  },
);

adminTaxonomyRouter.post(
  '/categories',
  requirePermission('categories:manage'),
  async (req, res, next) => {
    try {
      const parsed = categoryInputSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.errors[0]?.message ?? 'Invalid category payload' });
        return;
      }
      const pool = requirePool();
      const dup = await pool.query<{ id: string }>(
        `SELECT id FROM categories WHERE slug = $1 LIMIT 1`,
        [parsed.data.slug],
      );
      if (dup.rows.length > 0) {
        res.status(409).json({ error: 'Category slug already exists' });
        return;
      }
      const inserted = await pool.query<{
        id: string;
        name: string;
        slug: string;
        description: string | null;
        icon_path: string | null;
        display_order: number;
        is_active: boolean;
      }>(
        `INSERT INTO categories (name, slug, description, display_order, is_active)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [
          parsed.data.name,
          parsed.data.slug,
          parsed.data.description ?? null,
          parsed.data.displayOrder,
          parsed.data.isActive,
        ],
      );
      const row = inserted.rows[0]!;
      await logProductActivity(pool, {
        productId: null,
        adminUserId: req.adminSession!.user.id,
        action: 'category.created',
        entityType: 'category',
        entityId: row.id,
        details: { name: row.name, slug: row.slug },
      });
      res.status(201).json({
        category: {
          id: row.id,
          name: row.name,
          slug: row.slug,
          description: row.description,
          iconPath: row.icon_path,
          displayOrder: row.display_order,
          isActive: row.is_active,
          productCount: 0,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

adminTaxonomyRouter.put(
  '/categories/:id',
  requirePermission('categories:manage'),
  async (req, res, next) => {
    try {
      const id = String(req.params.id ?? '');
      if (!UUID_REGEX.test(id)) {
        res.status(400).json({ error: 'Invalid category ID' });
        return;
      }
      const parsed = categoryInputSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.errors[0]?.message ?? 'Invalid category update' });
        return;
      }
      const pool = requirePool();
      const updated = await pool.query<{
        id: string;
        name: string;
        slug: string;
        description: string | null;
        icon_path: string | null;
        display_order: number;
        is_active: boolean;
      }>(
        `UPDATE categories SET
           name = COALESCE($2, name),
           slug = COALESCE($3, slug),
           description = CASE WHEN $4::boolean THEN $5 ELSE description END,
           display_order = COALESCE($6, display_order),
           is_active = COALESCE($7, is_active),
           updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [
          id,
          parsed.data.name ?? null,
          parsed.data.slug ?? null,
          'description' in parsed.data,
          parsed.data.description ?? null,
          typeof parsed.data.displayOrder === 'number' ? parsed.data.displayOrder : null,
          typeof parsed.data.isActive === 'boolean' ? parsed.data.isActive : null,
        ],
      );
      const row = updated.rows[0];
      if (!row) {
        res.status(404).json({ error: 'Category not found' });
        return;
      }
      await logProductActivity(pool, {
        productId: null,
        adminUserId: req.adminSession!.user.id,
        action: 'category.updated',
        entityType: 'category',
        entityId: row.id,
        details: { name: row.name },
      });
      res.json({
        category: {
          id: row.id,
          name: row.name,
          slug: row.slug,
          description: row.description,
          iconPath: row.icon_path,
          displayOrder: row.display_order,
          isActive: row.is_active,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

adminTaxonomyRouter.delete(
  '/categories/:id',
  requirePermission('categories:manage'),
  async (req, res, next) => {
    try {
      const id = String(req.params.id ?? '');
      if (!UUID_REGEX.test(id)) {
        res.status(400).json({ error: 'Invalid category ID' });
        return;
      }
      const pool = requirePool();
      const refCheck = await pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM products WHERE category_id = $1`,
        [id],
      );
      const associated = Number(refCheck.rows[0]?.count ?? '0');
      if (associated > 0) {
        res.status(409).json({
          error: `Cannot delete category while ${associated} product(s) are assigned to it.`,
        });
        return;
      }
      const deleted = await pool.query<{ name: string }>(
        `DELETE FROM categories WHERE id = $1 RETURNING name`,
        [id],
      );
      if (deleted.rows.length === 0) {
        res.status(404).json({ error: 'Category not found' });
        return;
      }
      await logProductActivity(pool, {
        productId: null,
        adminUserId: req.adminSession!.user.id,
        action: 'category.deleted',
        entityType: 'category',
        entityId: id,
        details: { name: deleted.rows[0]!.name },
      });
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  },
);

// Product Types
adminTaxonomyRouter.get(
  '/product-types',
  requirePermission('product_types:read'),
  async (_req, res, next) => {
    try {
      const pool = requirePool();
      const rows = await pool.query<{
        id: string;
        name: string;
        slug: string;
        description: string | null;
        display_order: number;
        is_active: boolean;
        product_count: string;
      }>(
        `SELECT pt.*, COUNT(p.id)::text AS product_count
         FROM product_types pt
         LEFT JOIN products p ON p.product_type_id = pt.id
         GROUP BY pt.id
         ORDER BY pt.display_order ASC, pt.name ASC`,
      );
      res.json({
        items: rows.rows.map((r) => ({
          id: r.id,
          name: r.name,
          slug: r.slug,
          description: r.description,
          displayOrder: r.display_order,
          isActive: r.is_active,
          productCount: Number(r.product_count),
        })),
      });
    } catch (err) {
      next(err);
    }
  },
);

adminTaxonomyRouter.post(
  '/product-types',
  requirePermission('product_types:manage'),
  async (req, res, next) => {
    try {
      const parsed = productTypeInputSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.errors[0]?.message ?? 'Invalid product type payload' });
        return;
      }
      const pool = requirePool();
      const inserted = await pool.query<{
        id: string;
        name: string;
        slug: string;
        description: string | null;
        display_order: number;
        is_active: boolean;
      }>(
        `INSERT INTO product_types (name, slug, description, display_order, is_active)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [
          parsed.data.name,
          parsed.data.slug,
          parsed.data.description ?? null,
          parsed.data.displayOrder,
          parsed.data.isActive,
        ],
      );
      const row = inserted.rows[0]!;
      await logProductActivity(pool, {
        productId: null,
        adminUserId: req.adminSession!.user.id,
        action: 'product_type.created',
        entityType: 'product_type',
        entityId: row.id,
        details: { name: row.name },
      });
      res.status(201).json({
        productType: {
          id: row.id,
          name: row.name,
          slug: row.slug,
          description: row.description,
          displayOrder: row.display_order,
          isActive: row.is_active,
          productCount: 0,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

adminTaxonomyRouter.put(
  '/product-types/:id',
  requirePermission('product_types:manage'),
  async (req, res, next) => {
    try {
      const id = String(req.params.id ?? '');
      if (!UUID_REGEX.test(id)) {
        res.status(400).json({ error: 'Invalid product type ID' });
        return;
      }
      const parsed = productTypeInputSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid product type payload' });
        return;
      }
      const pool = requirePool();
      const updated = await pool.query<{
        id: string;
        name: string;
        slug: string;
        description: string | null;
        display_order: number;
        is_active: boolean;
      }>(
        `UPDATE product_types SET
           name = COALESCE($2, name),
           slug = COALESCE($3, slug),
           display_order = COALESCE($4, display_order),
           is_active = COALESCE($5, is_active),
           updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [
          id,
          parsed.data.name ?? null,
          parsed.data.slug ?? null,
          typeof parsed.data.displayOrder === 'number' ? parsed.data.displayOrder : null,
          typeof parsed.data.isActive === 'boolean' ? parsed.data.isActive : null,
        ],
      );
      const row = updated.rows[0];
      if (!row) {
        res.status(404).json({ error: 'Product type not found' });
        return;
      }
      res.json({
        productType: {
          id: row.id,
          name: row.name,
          slug: row.slug,
          description: row.description,
          displayOrder: row.display_order,
          isActive: row.is_active,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

adminTaxonomyRouter.delete(
  '/product-types/:id',
  requirePermission('product_types:manage'),
  async (req, res, next) => {
    try {
      const id = String(req.params.id ?? '');
      if (!UUID_REGEX.test(id)) {
        res.status(400).json({ error: 'Invalid product type ID' });
        return;
      }
      const pool = requirePool();
      const refCheck = await pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM products WHERE product_type_id = $1`,
        [id],
      );
      if (Number(refCheck.rows[0]?.count ?? '0') > 0) {
        res.status(409).json({
          error: 'Cannot delete product type currently referenced by products.',
        });
        return;
      }
      const deleted = await pool.query(`DELETE FROM product_types WHERE id = $1 RETURNING id`, [id]);
      if (deleted.rows.length === 0) {
        res.status(404).json({ error: 'Product type not found' });
        return;
      }
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  },
);
