import type { Pool, PoolClient } from 'pg';
import type {
  ProductContentSectionDTO,
  ProductDetailDTO,
  ProductExternalLinkDTO,
  ProductFeatureDTO,
  ProductImageDTO,
  ProductSummaryDTO,
  ProductUseCaseDTO,
  ProductVideoDTO,
  PublicationStatus,
  SectionType,
  ExternalLinkType,
} from '@mobileum/shared';

type Db = Pool | PoolClient;

interface ProductRow {
  id: string;
  name: string;
  slug: string;
  category_id: string;
  category_name: string;
  category_slug: string;
  product_type_id: string;
  product_type_name: string;
  product_type_slug: string;
  short_description: string;
  full_description: string | null;
  overview: string | null;
  problem_statement: string | null;
  solution: string | null;
  technical_capabilities: string | null;
  business_benefits: string | null;
  industry_segments: string | null;
  technologies_used: string | null;
  target_customers: string | null;
  thumbnail_path: string | null;
  logo_path: string | null;
  publication_status: PublicationStatus;
  featured: boolean;
  display_order: number;
  published_at: Date | null;
  updated_at: Date;
}

function mapSummary(row: ProductRow): ProductSummaryDTO {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    categoryId: row.category_id,
    categoryName: row.category_name,
    categorySlug: row.category_slug,
    productTypeId: row.product_type_id,
    productTypeName: row.product_type_name,
    productTypeSlug: row.product_type_slug,
    shortDescription: row.short_description,
    thumbnailPath: row.thumbnail_path,
    logoPath: row.logo_path,
    publicationStatus: row.publication_status,
    featured: row.featured,
    displayOrder: row.display_order,
    publishedAt: row.published_at ? row.published_at.toISOString() : null,
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function queryProductSummaries(
  db: Db,
  options: {
    publicOnly?: boolean;
    search?: string;
    categorySlug?: string;
    productTypeSlug?: string;
    featuredOnly?: boolean;
    sort?: 'display_order' | 'recent' | 'alpha';
    page?: number;
    pageSize?: number;
  } = {},
): Promise<{
  items: ProductSummaryDTO[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}> {
  const {
    publicOnly = false,
    search = '',
    categorySlug,
    productTypeSlug,
    featuredOnly = false,
    sort = 'display_order',
    page = 1,
    pageSize = 24,
  } = options;

  const where: string[] = [];
  const params: unknown[] = [];

  if (publicOnly) {
    where.push(`p.publication_status = 'published'`);
  }
  if (categorySlug && categorySlug !== 'all') {
    params.push(categorySlug);
    where.push(`c.slug = $${params.length}`);
  }
  if (productTypeSlug && productTypeSlug !== 'all') {
    params.push(productTypeSlug);
    where.push(`pt.slug = $${params.length}`);
  }
  if (featuredOnly) {
    where.push(`p.featured = TRUE`);
  }
  if (search.trim()) {
    params.push(`%${search.trim()}%`);
    const idx = params.length;
    where.push(
      `(p.name ILIKE $${idx} OR p.short_description ILIKE $${idx} OR c.name ILIKE $${idx} OR pt.name ILIKE $${idx})`,
    );
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  const orderSql =
    sort === 'alpha'
      ? 'ORDER BY p.name ASC'
      : sort === 'recent'
        ? 'ORDER BY COALESCE(p.published_at, p.updated_at) DESC'
        : 'ORDER BY p.display_order ASC, p.updated_at DESC';

  const countRes = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM products p
     JOIN categories c ON c.id = p.category_id
     JOIN product_types pt ON pt.id = p.product_type_id
     ${whereSql}`,
    params,
  );
  const total = Number(countRes.rows[0]?.count ?? '0');
  const safePageSize = Math.min(Math.max(1, pageSize), 100);
  const totalPages = Math.max(1, Math.ceil(total / safePageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const offset = (safePage - 1) * safePageSize;

  const rowsRes = await db.query<ProductRow>(
    `SELECT
       p.*,
       c.name AS category_name,
       c.slug AS category_slug,
       pt.name AS product_type_name,
       pt.slug AS product_type_slug
     FROM products p
     JOIN categories c ON c.id = p.category_id
     JOIN product_types pt ON pt.id = p.product_type_id
     ${whereSql}
     ${orderSql}
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, safePageSize, offset],
  );

  return {
    items: rowsRes.rows.map(mapSummary),
    total,
    page: safePage,
    pageSize: safePageSize,
    totalPages,
  };
}

export async function hydrateProductDetail(
  db: Db,
  whereClause: string,
  params: unknown[],
): Promise<ProductDetailDTO | null> {
  const prodRes = await db.query<ProductRow>(
    `SELECT
       p.*,
       c.name AS category_name,
       c.slug AS category_slug,
       pt.name AS product_type_name,
       pt.slug AS product_type_slug
     FROM products p
     JOIN categories c ON c.id = p.category_id
     JOIN product_types pt ON pt.id = p.product_type_id
     WHERE ${whereClause}
     LIMIT 1`,
    params,
  );

  const row = prodRes.rows[0];
  if (!row) return null;

  const [imagesRes, videosRes, featuresRes, useCasesRes, sectionsRes, linksRes] =
    await Promise.all([
      db.query<{
        id: string;
        product_id: string;
        file_path: string;
        original_filename: string;
        mime_type: string;
        file_size: string;
        width: number | null;
        height: number | null;
        display_order: number;
        caption: string | null;
        is_primary: boolean;
        created_at: Date;
      }>(
        `SELECT * FROM product_images WHERE product_id = $1 ORDER BY display_order ASC, created_at ASC`,
        [row.id],
      ),
      db.query<{
        id: string;
        product_id: string;
        file_path: string;
        thumbnail_path: string | null;
        original_filename: string;
        mime_type: string;
        file_size: string;
        duration_seconds: number | null;
        title: string;
        description: string | null;
        display_order: number;
        created_at: Date;
      }>(
        `SELECT * FROM product_videos WHERE product_id = $1 ORDER BY display_order ASC, created_at ASC`,
        [row.id],
      ),
      db.query<{
        id: string;
        title: string;
        description: string | null;
        icon_name: string | null;
        display_order: number;
      }>(
        `SELECT * FROM product_features WHERE product_id = $1 ORDER BY display_order ASC`,
        [row.id],
      ),
      db.query<{
        id: string;
        title: string;
        description: string | null;
        industry_segment: string | null;
        display_order: number;
      }>(
        `SELECT * FROM product_use_cases WHERE product_id = $1 ORDER BY display_order ASC`,
        [row.id],
      ),
      db.query<{
        id: string;
        section_key: string;
        section_type: SectionType;
        title: string;
        content_json: Record<string, unknown>;
        is_visible: boolean;
        display_order: number;
      }>(
        `SELECT * FROM product_content_sections WHERE product_id = $1 ORDER BY display_order ASC`,
        [row.id],
      ),
      db.query<{
        id: string;
        link_type: ExternalLinkType;
        label: string;
        url: string;
        display_order: number;
      }>(
        `SELECT * FROM product_external_links WHERE product_id = $1 ORDER BY display_order ASC`,
        [row.id],
      ),
    ]);

  const images: ProductImageDTO[] = imagesRes.rows.map((img) => ({
    id: img.id,
    productId: img.product_id,
    filePath: img.file_path,
    originalFilename: img.original_filename,
    mimeType: img.mime_type,
    fileSize: Number(img.file_size),
    width: img.width,
    height: img.height,
    displayOrder: img.display_order,
    caption: img.caption,
    isPrimary: img.is_primary,
    createdAt: img.created_at.toISOString(),
  }));

  const videos: ProductVideoDTO[] = videosRes.rows.map((v) => ({
    id: v.id,
    productId: v.product_id,
    filePath: v.file_path,
    thumbnailPath: v.thumbnail_path,
    originalFilename: v.original_filename,
    mimeType: v.mime_type,
    fileSize: Number(v.file_size),
    durationSeconds: v.duration_seconds,
    title: v.title,
    description: v.description,
    displayOrder: v.display_order,
    createdAt: v.created_at.toISOString(),
  }));

  const features: ProductFeatureDTO[] = featuresRes.rows.map((f) => ({
    id: f.id,
    title: f.title,
    description: f.description,
    iconName: f.icon_name,
    displayOrder: f.display_order,
  }));

  const useCases: ProductUseCaseDTO[] = useCasesRes.rows.map((uc) => ({
    id: uc.id,
    title: uc.title,
    description: uc.description,
    industrySegment: uc.industry_segment,
    displayOrder: uc.display_order,
  }));

  const sections: ProductContentSectionDTO[] = sectionsRes.rows.map((s) => ({
    id: s.id,
    sectionKey: s.section_key,
    sectionType: s.section_type,
    title: s.title,
    contentJson: s.content_json ?? {},
    isVisible: s.is_visible,
    displayOrder: s.display_order,
  }));

  const externalLinks: ProductExternalLinkDTO[] = linksRes.rows.map((l) => ({
    id: l.id,
    linkType: l.link_type,
    label: l.label,
    url: l.url,
    displayOrder: l.display_order,
  }));

  const summary = mapSummary(row);
  return {
    ...summary,
    thumbnailPath:
      summary.thumbnailPath ??
      images.find((i) => i.isPrimary)?.filePath ??
      images[0]?.filePath ??
      null,
    fullDescription: row.full_description,
    overview: row.overview,
    problemStatement: row.problem_statement,
    solution: row.solution,
    technicalCapabilities: row.technical_capabilities,
    businessBenefits: row.business_benefits,
    industrySegments: row.industry_segments,
    technologiesUsed: row.technologies_used,
    targetCustomers: row.target_customers,
    images,
    videos,
    features,
    useCases,
    sections,
    externalLinks,
  };
}
