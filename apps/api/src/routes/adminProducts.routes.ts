import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import {
  contentSectionInputSchema,
  externalLinkInputSchema,
  productInputSchema,
} from '@mobileum/shared';
import { requirePool } from '../config/database.js';
import { env } from '../config/env.js';
import { UUID_REGEX, removeProductStorageDir } from '../config/storage.js';
import {
  PREVIEW_COOKIE_NAME,
  requireAuth,
  requirePermission,
  sha256Hex,
} from '../middleware/auth.js';
import { logProductActivity } from '../services/audit.service.js';
import { hydrateProductDetail } from '../services/product.service.js';

export const adminProductsRouter = Router();
adminProductsRouter.use(requireAuth);

const featureInputSchema = z.object({
  title: z.string().trim().min(1).max(180),
  description: z.string().trim().max(2000).nullable().optional(),
  iconName: z.string().trim().max(64).nullable().optional(),
  displayOrder: z.number().int().min(0).default(0),
});

const useCaseInputSchema = z.object({
  title: z.string().trim().min(1).max(180),
  description: z.string().trim().max(2000).nullable().optional(),
  industrySegment: z.string().trim().max(120).nullable().optional(),
  displayOrder: z.number().int().min(0).default(0),
});

const productUpsertBodySchema = productInputSchema.extend({
  features: z.array(featureInputSchema).optional(),
  useCases: z.array(useCaseInputSchema).optional(),
  externalLinks: z.array(externalLinkInputSchema).optional(),
  sections: z.array(contentSectionInputSchema).optional(),
  imagesOrder: z
    .array(
      z.object({
        id: z.string().uuid(),
        caption: z.string().max(300).nullable().optional(),
        displayOrder: z.number().int().min(0),
        isPrimary: z.boolean(),
      }),
    )
    .optional(),
  videosOrder: z
    .array(
      z.object({
        id: z.string().uuid(),
        title: z.string().trim().min(1).max(200),
        description: z.string().max(2000).nullable().optional(),
        displayOrder: z.number().int().min(0),
      }),
    )
    .optional(),
});

const productPatchSchema = productUpsertBodySchema.partial();

adminProductsRouter.get(
  '/products',
  requirePermission('products:read'),
  async (_req, res, next) => {
    try {
      const pool = requirePool();
      const idRows = await pool.query<{ id: string }>(
        `SELECT id FROM products ORDER BY display_order ASC, updated_at DESC`,
      );
      const items = [];
      for (const r of idRows.rows) {
        const detail = await hydrateProductDetail(pool, 'p.id = $1', [r.id]);
        if (detail) items.push(detail);
      }
      res.json({ items });
    } catch (err) {
      next(err);
    }
  },
);

adminProductsRouter.get(
  '/products/:id',
  requirePermission('products:read'),
  async (req, res, next) => {
    try {
      const id = String(req.params.id ?? '');
      if (!UUID_REGEX.test(id)) {
        res.status(400).json({ error: 'Invalid product ID' });
        return;
      }
      const pool = requirePool();
      const product = await hydrateProductDetail(pool, 'p.id = $1', [id]);
      if (!product) {
        res.status(404).json({ error: 'Product not found' });
        return;
      }
      res.json({ product });
    } catch (err) {
      next(err);
    }
  },
);

adminProductsRouter.post(
  '/products',
  requirePermission('products:create'),
  async (req, res, next) => {
    try {
      const parsed = productUpsertBodySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.errors[0]?.message ?? 'Invalid product payload' });
        return;
      }
      const data = parsed.data;
      const pool = requirePool();
      const adminId = req.adminSession!.user.id;
      const client = await pool.connect();

      try {
        await client.query('BEGIN');
        const slugCheck = await client.query<{ id: string }>(
          `SELECT id FROM products WHERE slug = $1 LIMIT 1`,
          [data.slug],
        );
        if (slugCheck.rows.length > 0) {
          await client.query('ROLLBACK');
          res.status(409).json({ error: 'A product with this slug already exists' });
          return;
        }

        // Only users with products:publish can create directly as published
        const initialStatus =
          data.publicationStatus === 'published' &&
          req.adminSession!.user.permissions.includes('products:publish')
            ? 'published'
            : 'draft';

        const inserted = await client.query<{ id: string }>(
          `INSERT INTO products (
             name, slug, category_id, product_type_id, short_description,
             full_description, overview, problem_statement, solution,
             technical_capabilities, business_benefits, industry_segments,
             technologies_used, target_customers, publication_status, featured,
             display_order, created_by, updated_by, published_by, published_at
           )
           VALUES (
             $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
             $15, $16, $17, $18, $18, $19, $20
           )
           RETURNING id`,
          [
            data.name,
            data.slug,
            data.categoryId,
            data.productTypeId,
            data.shortDescription,
            data.fullDescription ?? null,
            data.overview ?? null,
            data.problemStatement ?? null,
            data.solution ?? null,
            data.technicalCapabilities ?? null,
            data.businessBenefits ?? null,
            data.industrySegments ?? null,
            data.technologiesUsed ?? null,
            data.targetCustomers ?? null,
            initialStatus,
            data.featured,
            data.displayOrder,
            adminId,
            initialStatus === 'published' ? adminId : null,
            initialStatus === 'published' ? new Date() : null,
          ],
        );

        const productId = inserted.rows[0]!.id;

        if (data.features?.length) {
          for (const [idx, feat] of data.features.entries()) {
            await client.query(
              `INSERT INTO product_features (product_id, title, description, icon_name, display_order)
               VALUES ($1, $2, $3, $4, $5)`,
              [productId, feat.title, feat.description ?? null, feat.iconName ?? null, idx + 1],
            );
          }
        }

        if (data.useCases?.length) {
          for (const [idx, uc] of data.useCases.entries()) {
            await client.query(
              `INSERT INTO product_use_cases (product_id, title, description, industry_segment, display_order)
               VALUES ($1, $2, $3, $4, $5)`,
              [productId, uc.title, uc.description ?? null, uc.industrySegment ?? null, idx + 1],
            );
          }
        }

        if (data.externalLinks?.length) {
          for (const [idx, lnk] of data.externalLinks.entries()) {
            await client.query(
              `INSERT INTO product_external_links (product_id, link_type, label, url, display_order)
               VALUES ($1, $2, $3, $4, $5)`,
              [productId, lnk.linkType, lnk.label, lnk.url, idx + 1],
            );
          }
        }

        if (data.sections?.length) {
          for (const [idx, sec] of data.sections.entries()) {
            await client.query(
              `INSERT INTO product_content_sections (product_id, section_key, section_type, title, content_json, is_visible, display_order)
               VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              [
                productId,
                sec.sectionKey,
                sec.sectionType,
                sec.title,
                JSON.stringify(sec.contentJson ?? {}),
                sec.isVisible,
                idx + 1,
              ],
            );
          }
        }

        await logProductActivity(client, {
          productId,
          adminUserId: adminId,
          action: 'product.created',
          entityType: 'product',
          details: { name: data.name, slug: data.slug, status: initialStatus },
        });

        await client.query('COMMIT');
        const product = await hydrateProductDetail(pool, 'p.id = $1', [productId]);
        res.status(201).json({ product });
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } catch (err) {
      next(err);
    }
  },
);

adminProductsRouter.put(
  '/products/:id',
  requirePermission('products:update'),
  async (req, res, next) => {
    try {
      const productId = String(req.params.id ?? '');
      if (!UUID_REGEX.test(productId)) {
        res.status(400).json({ error: 'Invalid product ID' });
        return;
      }

      const parsed = productPatchSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.errors[0]?.message ?? 'Invalid update payload' });
        return;
      }
      const data = parsed.data;
      const pool = requirePool();
      const adminId = req.adminSession!.user.id;
      const client = await pool.connect();

      try {
        await client.query('BEGIN');
        const existingRes = await client.query<{ id: string; slug: string; name: string }>(
          `SELECT id, slug, name FROM products WHERE id = $1 LIMIT 1 FOR UPDATE`,
          [productId],
        );
        const existing = existingRes.rows[0];
        if (!existing) {
          await client.query('ROLLBACK');
          res.status(404).json({ error: 'Product not found' });
          return;
        }

        if (data.slug && data.slug !== existing.slug) {
          const dup = await client.query<{ id: string }>(
            `SELECT id FROM products WHERE slug = $1 AND id <> $2 LIMIT 1`,
            [data.slug, productId],
          );
          if (dup.rows.length > 0) {
            await client.query('ROLLBACK');
            res.status(409).json({ error: 'Slug already in use by another product' });
            return;
          }
        }

        await client.query(
          `UPDATE products SET
             name = COALESCE($2, name),
             slug = COALESCE($3, slug),
             category_id = COALESCE($4, category_id),
             product_type_id = COALESCE($5, product_type_id),
             short_description = COALESCE($6, short_description),
             full_description = CASE WHEN $7::boolean THEN $8 ELSE full_description END,
             overview = CASE WHEN $9::boolean THEN $10 ELSE overview END,
             problem_statement = CASE WHEN $11::boolean THEN $12 ELSE problem_statement END,
             solution = CASE WHEN $13::boolean THEN $14 ELSE solution END,
             technical_capabilities = CASE WHEN $15::boolean THEN $16 ELSE technical_capabilities END,
             business_benefits = CASE WHEN $17::boolean THEN $18 ELSE business_benefits END,
             industry_segments = CASE WHEN $19::boolean THEN $20 ELSE industry_segments END,
             technologies_used = CASE WHEN $21::boolean THEN $22 ELSE technologies_used END,
             target_customers = CASE WHEN $23::boolean THEN $24 ELSE target_customers END,
             featured = COALESCE($25, featured),
             display_order = COALESCE($26, display_order),
             updated_by = $27,
             updated_at = NOW()
           WHERE id = $1`,
          [
            productId,
            data.name ?? null,
            data.slug ?? null,
            data.categoryId ?? null,
            data.productTypeId ?? null,
            data.shortDescription ?? null,
            'fullDescription' in data,
            data.fullDescription ?? null,
            'overview' in data,
            data.overview ?? null,
            'problemStatement' in data,
            data.problemStatement ?? null,
            'solution' in data,
            data.solution ?? null,
            'technicalCapabilities' in data,
            data.technicalCapabilities ?? null,
            'businessBenefits' in data,
            data.businessBenefits ?? null,
            'industrySegments' in data,
            data.industrySegments ?? null,
            'technologiesUsed' in data,
            data.technologiesUsed ?? null,
            'targetCustomers' in data,
            data.targetCustomers ?? null,
            typeof data.featured === 'boolean' ? data.featured : null,
            typeof data.displayOrder === 'number' ? data.displayOrder : null,
            adminId,
          ],
        );

        if (data.features) {
          await client.query(`DELETE FROM product_features WHERE product_id = $1`, [productId]);
          for (const [idx, feat] of data.features.entries()) {
            await client.query(
              `INSERT INTO product_features (product_id, title, description, icon_name, display_order)
               VALUES ($1, $2, $3, $4, $5)`,
              [productId, feat.title, feat.description ?? null, feat.iconName ?? null, idx + 1],
            );
          }
        }

        if (data.useCases) {
          await client.query(`DELETE FROM product_use_cases WHERE product_id = $1`, [productId]);
          for (const [idx, uc] of data.useCases.entries()) {
            await client.query(
              `INSERT INTO product_use_cases (product_id, title, description, industry_segment, display_order)
               VALUES ($1, $2, $3, $4, $5)`,
              [productId, uc.title, uc.description ?? null, uc.industrySegment ?? null, idx + 1],
            );
          }
        }

        if (data.externalLinks) {
          await client.query(`DELETE FROM product_external_links WHERE product_id = $1`, [productId]);
          for (const [idx, lnk] of data.externalLinks.entries()) {
            await client.query(
              `INSERT INTO product_external_links (product_id, link_type, label, url, display_order)
               VALUES ($1, $2, $3, $4, $5)`,
              [productId, lnk.linkType, lnk.label, lnk.url, idx + 1],
            );
          }
        }

        if (data.sections) {
          await client.query(`DELETE FROM product_content_sections WHERE product_id = $1`, [productId]);
          for (const [idx, sec] of data.sections.entries()) {
            await client.query(
              `INSERT INTO product_content_sections (product_id, section_key, section_type, title, content_json, is_visible, display_order)
               VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              [
                productId,
                sec.sectionKey,
                sec.sectionType,
                sec.title,
                JSON.stringify(sec.contentJson ?? {}),
                sec.isVisible,
                idx + 1,
              ],
            );
          }
        }

        if (data.imagesOrder) {
          for (const img of data.imagesOrder) {
            await client.query(
              `UPDATE product_images
               SET caption = $3, display_order = $4, is_primary = $5
               WHERE id = $1 AND product_id = $2`,
              [img.id, productId, img.caption ?? null, img.displayOrder, img.isPrimary],
            );
          }
        }

        if (data.videosOrder) {
          for (const vid of data.videosOrder) {
            await client.query(
              `UPDATE product_videos
               SET title = $3, description = $4, display_order = $5
               WHERE id = $1 AND product_id = $2`,
              [vid.id, productId, vid.title, vid.description ?? null, vid.displayOrder],
            );
          }
        }

        await logProductActivity(client, {
          productId,
          adminUserId: adminId,
          action: 'product.updated',
          entityType: 'product',
          details: { name: data.name ?? existing.name },
        });

        await client.query('COMMIT');
        const product = await hydrateProductDetail(pool, 'p.id = $1', [productId]);
        res.json({ product });
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } catch (err) {
      next(err);
    }
  },
);

adminProductsRouter.post(
  '/products/:id/duplicate',
  requirePermission('products:create'),
  async (req, res, next) => {
    try {
      const sourceId = String(req.params.id ?? '');
      if (!UUID_REGEX.test(sourceId)) {
        res.status(400).json({ error: 'Invalid product ID' });
        return;
      }

      const pool = requirePool();
      const source = await hydrateProductDetail(pool, 'p.id = $1', [sourceId]);
      if (!source) {
        res.status(404).json({ error: 'Source product not found' });
        return;
      }

      const adminId = req.adminSession!.user.id;
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const newSlug = `${source.slug}-copy-${Date.now().toString().slice(-4)}`;
        const inserted = await client.query<{ id: string }>(
          `INSERT INTO products (
             name, slug, category_id, product_type_id, short_description,
             full_description, overview, problem_statement, solution,
             technical_capabilities, business_benefits, industry_segments,
             technologies_used, target_customers, publication_status, featured,
             display_order, created_by, updated_by
           )
           VALUES (
             $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
             'draft', FALSE, $15, $16, $16
           )
           RETURNING id`,
          [
            `${source.name} (Copy)`,
            newSlug,
            source.categoryId,
            source.productTypeId,
            source.shortDescription,
            source.fullDescription,
            source.overview,
            source.problemStatement,
            source.solution,
            source.technicalCapabilities,
            source.businessBenefits,
            source.industrySegments,
            source.technologiesUsed,
            source.targetCustomers,
            source.displayOrder + 1,
            adminId,
          ],
        );

        const newId = inserted.rows[0]!.id;
        for (const f of source.features) {
          await client.query(
            `INSERT INTO product_features (product_id, title, description, icon_name, display_order)
             VALUES ($1, $2, $3, $4, $5)`,
            [newId, f.title, f.description, f.iconName, f.displayOrder],
          );
        }
        for (const uc of source.useCases) {
          await client.query(
            `INSERT INTO product_use_cases (product_id, title, description, industry_segment, display_order)
             VALUES ($1, $2, $3, $4, $5)`,
            [newId, uc.title, uc.description, uc.industrySegment, uc.displayOrder],
          );
        }
        for (const s of source.sections) {
          await client.query(
            `INSERT INTO product_content_sections (product_id, section_key, section_type, title, content_json, is_visible, display_order)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [newId, s.sectionKey, s.sectionType, s.title, JSON.stringify(s.contentJson), s.isVisible, s.displayOrder],
          );
        }

        await logProductActivity(client, {
          productId: newId,
          adminUserId: adminId,
          action: 'product.duplicated',
          entityType: 'product',
          details: { sourceId, newSlug },
        });
        await client.query('COMMIT');
        const product = await hydrateProductDetail(pool, 'p.id = $1', [newId]);
        res.status(201).json({ product });
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } catch (err) {
      next(err);
    }
  },
);

adminProductsRouter.post(
  '/products/:id/publish',
  requirePermission('products:publish'),
  async (req, res, next) => {
    try {
      const productId = String(req.params.id ?? '');
      if (!UUID_REGEX.test(productId)) {
        res.status(400).json({ error: 'Invalid product ID' });
        return;
      }
      const pool = requirePool();
      const adminId = req.adminSession!.user.id;
      const result = await pool.query<{ id: string; name: string }>(
        `UPDATE products
         SET publication_status = 'published', published_by = $2, published_at = NOW(), updated_by = $2, updated_at = NOW()
         WHERE id = $1
         RETURNING id, name`,
        [productId, adminId],
      );
      if (result.rows.length === 0) {
        res.status(404).json({ error: 'Product not found' });
        return;
      }
      await logProductActivity(pool, {
        productId,
        adminUserId: adminId,
        action: 'product.published',
        entityType: 'product',
        details: { name: result.rows[0]!.name },
      });
      const product = await hydrateProductDetail(pool, 'p.id = $1', [productId]);
      res.json({ product });
    } catch (err) {
      next(err);
    }
  },
);

adminProductsRouter.post(
  '/products/:id/unpublish',
  requirePermission('products:publish'),
  async (req, res, next) => {
    try {
      const productId = String(req.params.id ?? '');
      if (!UUID_REGEX.test(productId)) {
        res.status(400).json({ error: 'Invalid product ID' });
        return;
      }
      const pool = requirePool();
      const adminId = req.adminSession!.user.id;
      const result = await pool.query<{ id: string; name: string }>(
        `UPDATE products
         SET publication_status = 'draft', updated_by = $2, updated_at = NOW()
         WHERE id = $1
         RETURNING id, name`,
        [productId, adminId],
      );
      if (result.rows.length === 0) {
        res.status(404).json({ error: 'Product not found' });
        return;
      }
      await logProductActivity(pool, {
        productId,
        adminUserId: adminId,
        action: 'product.unpublished',
        entityType: 'product',
        details: { name: result.rows[0]!.name },
      });
      const product = await hydrateProductDetail(pool, 'p.id = $1', [productId]);
      res.json({ product });
    } catch (err) {
      next(err);
    }
  },
);

adminProductsRouter.delete(
  '/products/:id',
  requirePermission('products:delete'),
  async (req, res, next) => {
    try {
      const productId = String(req.params.id ?? '');
      if (!UUID_REGEX.test(productId)) {
        res.status(400).json({ error: 'Invalid product ID' });
        return;
      }
      const pool = requirePool();
      const adminId = req.adminSession!.user.id;
      const deleted = await pool.query<{ id: string; name: string }>(
        `DELETE FROM products WHERE id = $1 RETURNING id, name`,
        [productId],
      );
      if (deleted.rows.length === 0) {
        res.status(404).json({ error: 'Product not found' });
        return;
      }
      removeProductStorageDir(productId);
      await logProductActivity(pool, {
        productId: null,
        adminUserId: adminId,
        action: 'product.deleted',
        entityType: 'product',
        entityId: productId,
        details: { name: deleted.rows[0]!.name },
      });
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  },
);

// Secure short-lived preview authorization via HttpOnly cookie (no URL query tokens)
adminProductsRouter.post(
  '/products/:id/preview-authorization',
  requirePermission('products:preview'),
  async (req, res, next) => {
    try {
      const productId = String(req.params.id ?? '');
      if (!UUID_REGEX.test(productId)) {
        res.status(400).json({ error: 'Invalid product ID' });
        return;
      }
      const pool = requirePool();
      const adminId = req.adminSession!.user.id;
      const rawAuth = crypto.randomBytes(32).toString('hex');
      const ttlMs = env.PREVIEW_TOKEN_TTL_MINUTES * 60 * 1000;
      const expiresAt = new Date(Date.now() + ttlMs);

      await pool.query(
        `INSERT INTO product_preview_authorizations (product_id, admin_user_id, auth_hash, expires_at)
         VALUES ($1, $2, $3, $4)`,
        [productId, adminId, sha256Hex(rawAuth), expiresAt],
      );

      res.cookie(PREVIEW_COOKIE_NAME, rawAuth, {
        httpOnly: true,
        secure: env.COOKIE_SECURE,
        sameSite: env.COOKIE_SAME_SITE,
        path: '/',
        maxAge: ttlMs,
      });

      res.json({ authorized: true, expiresAt: expiresAt.toISOString() });
    } catch (err) {
      next(err);
    }
  },
);

adminProductsRouter.get(
  '/products/:id/preview',
  requirePermission('products:preview'),
  async (req, res, next) => {
    try {
      const productId = String(req.params.id ?? '');
      if (!UUID_REGEX.test(productId)) {
        res.status(400).json({ error: 'Invalid product ID' });
        return;
      }
      const rawAuth = req.cookies?.[PREVIEW_COOKIE_NAME];
      if (!rawAuth || typeof rawAuth !== 'string') {
        res.status(403).json({ error: 'Preview authorization cookie required' });
        return;
      }
      const pool = requirePool();
      const authCheck = await pool.query<{ id: string }>(
        `SELECT id FROM product_preview_authorizations
         WHERE product_id = $1 AND admin_user_id = $2 AND auth_hash = $3
           AND revoked_at IS NULL AND expires_at > NOW()
         LIMIT 1`,
        [productId, req.adminSession!.user.id, sha256Hex(rawAuth)],
      );
      if (authCheck.rows.length === 0) {
        res.status(403).json({ error: 'Preview authorization expired or invalid' });
        return;
      }
      const product = await hydrateProductDetail(pool, 'p.id = $1', [productId]);
      if (!product) {
        res.status(404).json({ error: 'Product not found' });
        return;
      }
      res.json({ product });
    } catch (err) {
      next(err);
    }
  },
);
