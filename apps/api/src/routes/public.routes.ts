import { Router } from 'express';
import { requirePool } from '../config/database.js';
import {
  hydrateProductDetail,
  queryProductSummaries,
} from '../services/product.service.js';

export const publicRouter = Router();

// Specific routes MUST be registered before /products/:slug
publicRouter.get('/featured', async (_req, res, next) => {
  try {
    const pool = requirePool();
    const result = await queryProductSummaries(pool, {
      publicOnly: true,
      featuredOnly: true,
      sort: 'display_order',
      page: 1,
      pageSize: 50,
    });
    res.json({ items: result.items });
  } catch (err) {
    next(err);
  }
});

publicRouter.get('/products/featured', async (_req, res, next) => {
  try {
    const pool = requirePool();
    const result = await queryProductSummaries(pool, {
      publicOnly: true,
      featuredOnly: true,
      sort: 'display_order',
      page: 1,
      pageSize: 50,
    });
    res.json({ items: result.items });
  } catch (err) {
    next(err);
  }
});

publicRouter.get('/categories', async (_req, res, next) => {
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
      `SELECT
         c.*,
         COUNT(p.id) FILTER (WHERE p.publication_status = 'published')::text AS product_count
       FROM categories c
       LEFT JOIN products p ON p.category_id = c.id
       WHERE c.is_active = TRUE
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
});

publicRouter.get('/product-types', async (_req, res, next) => {
  try {
    const pool = requirePool();
    const rows = await pool.query<{
      id: string;
      name: string;
      slug: string;
      description: string | null;
      display_order: number;
      is_active: boolean;
    }>(
      `SELECT * FROM product_types WHERE is_active = TRUE ORDER BY display_order ASC, name ASC`,
    );

    res.json({
      items: rows.rows.map((r) => ({
        id: r.id,
        name: r.name,
        slug: r.slug,
        description: r.description,
        displayOrder: r.display_order,
        isActive: r.is_active,
      })),
    });
  } catch (err) {
    next(err);
  }
});

publicRouter.get('/products', async (req, res, next) => {
  try {
    const pool = requirePool();
    const search = typeof req.query.search === 'string' ? req.query.search : '';
    const categorySlug =
      typeof req.query.category === 'string' ? req.query.category : undefined;
    const productTypeSlug =
      typeof req.query.productType === 'string'
        ? req.query.productType
        : undefined;
    const featuredOnly = req.query.featured === 'true';
    const rawSort = req.query.sort;
    const sort =
      rawSort === 'alpha' || rawSort === 'recent' ? rawSort : 'display_order';
    const page = Number(req.query.page ?? 1) || 1;
    const pageSize = Number(req.query.pageSize ?? 6) || 6;

    const result = await queryProductSummaries(pool, {
      publicOnly: true,
      search,
      categorySlug,
      productTypeSlug,
      featuredOnly,
      sort,
      page,
      pageSize,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

publicRouter.get('/products/:slug', async (req, res, next) => {
  try {
    const pool = requirePool();
    const slug = req.params.slug;
    const product = await hydrateProductDetail(
      pool,
      `p.slug = $1 AND p.publication_status = 'published'`,
      [slug],
    );

    if (!product) {
      res.status(404).json({ error: 'Published product not found' });
      return;
    }

    const ordered = await queryProductSummaries(pool, {
      publicOnly: true,
      sort: 'display_order',
      page: 1,
      pageSize: 100,
    });
    const idx = ordered.items.findIndex((item) => item.slug === slug);
    const previous = idx > 0 ? ordered.items[idx - 1] ?? null : null;
    const nextItem =
      idx >= 0 && idx < ordered.items.length - 1
        ? ordered.items[idx + 1] ?? null
        : null;
    const related = ordered.items
      .filter((item) => item.slug !== slug)
      .sort((a, b) => {
        const aSame = a.categoryId === product.categoryId ? 0 : 1;
        const bSame = b.categoryId === product.categoryId ? 0 : 1;
        return aSame - bSame || a.displayOrder - b.displayOrder;
      })
      .slice(0, 3);

    res.json({ product, previous, next: nextItem, related });
  } catch (err) {
    next(err);
  }
});
