import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import { requirePool } from '../config/database.js';
import { env } from '../config/env.js';
import {
  UUID_REGEX,
  getCategoryMediaDir,
  getProductMediaDir,
  getTempUploadDir,
  resolveSafeStoragePath,
} from '../config/storage.js';
import {
  PREVIEW_COOKIE_NAME,
  requireAuth,
  requirePermission,
  resolveSessionFromRequest,
  sha256Hex,
} from '../middleware/auth.js';
import { logProductActivity } from '../services/audit.service.js';
import { inspectFileSignature, safeUnlink } from '../utils/fileSecurity.js';

export const adminMediaRouter = Router();
export const publicMediaRouter = Router();

const tempStorage = multer.diskStorage({
  destination(_req, _file, cb) {
    cb(null, getTempUploadDir());
  },
  filename(_req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '');
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

const uploadImageMulter = multer({
  storage: tempStorage,
  limits: {
    fileSize: env.MAX_IMAGE_SIZE_MB * 1024 * 1024,
    files: 12,
  },
});

const uploadVideoMulter = multer({
  storage: tempStorage,
  limits: {
    fileSize: env.MAX_VIDEO_SIZE_MB * 1024 * 1024,
    files: 2,
  },
});

function sanitizeBaseName(original: string): string {
  const stem = path.basename(original, path.extname(original));
  const cleaned = stem.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return (cleaned || 'asset').slice(0, 48);
}

// ==============================================================================
// Admin Media Routes
// ==============================================================================
adminMediaRouter.use(requireAuth);

adminMediaRouter.get(
  '/media',
  requirePermission('products:read'),
  async (_req, res, next) => {
    try {
      const pool = requirePool();
      const [imgRes, vidRes] = await Promise.all([
        pool.query<{
          id: string;
          product_id: string;
          product_name: string;
          product_status: 'draft' | 'published';
          file_path: string;
          original_filename: string;
          mime_type: string;
          file_size: string;
          caption: string | null;
          is_primary: boolean;
          created_at: Date;
        }>(`
          SELECT
            pi.id, pi.product_id, p.name AS product_name, p.publication_status AS product_status,
            pi.file_path, pi.original_filename, pi.mime_type, pi.file_size,
            pi.caption, pi.is_primary, pi.created_at
          FROM product_images pi
          JOIN products p ON p.id = pi.product_id
          ORDER BY pi.created_at DESC
        `),
        pool.query<{
          id: string;
          product_id: string;
          product_name: string;
          product_status: 'draft' | 'published';
          file_path: string;
          thumbnail_path: string | null;
          original_filename: string;
          mime_type: string;
          file_size: string;
          title: string;
          created_at: Date;
        }>(`
          SELECT
            pv.id, pv.product_id, p.name AS product_name, p.publication_status AS product_status,
            pv.file_path, pv.thumbnail_path, pv.original_filename, pv.mime_type,
            pv.file_size, pv.title, pv.created_at
          FROM product_videos pv
          JOIN products p ON p.id = pv.product_id
          ORDER BY pv.created_at DESC
        `),
      ]);

      const items = [
        ...imgRes.rows.map((i) => ({
          id: i.id,
          productId: i.product_id,
          productName: i.product_name,
          productStatus: i.product_status,
          mediaKind: i.is_primary ? ('thumbnail' as const) : ('image' as const),
          filePath: i.file_path,
          originalFilename: i.original_filename,
          mimeType: i.mime_type,
          fileSize: Number(i.file_size),
          captionOrTitle: i.caption,
          createdAt: i.created_at.toISOString(),
        })),
        ...vidRes.rows.map((v) => ({
          id: v.id,
          productId: v.product_id,
          productName: v.product_name,
          productStatus: v.product_status,
          mediaKind: 'video' as const,
          filePath: v.file_path,
          thumbnailPath: v.thumbnail_path,
          originalFilename: v.original_filename,
          mimeType: v.mime_type,
          fileSize: Number(v.file_size),
          captionOrTitle: v.title,
          createdAt: v.created_at.toISOString(),
        })),
      ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

      res.json({ items });
    } catch (err) {
      next(err);
    }
  },
);

adminMediaRouter.post(
  '/products/:id/images',
  requirePermission('media:upload'),
  uploadImageMulter.array('images', 12),
  async (req, res, next) => {
    const uploadedFiles = (req.files as Express.Multer.File[] | undefined) ?? [];
    try {
      const productId = String(req.params.id ?? '');
      if (!UUID_REGEX.test(productId)) {
        uploadedFiles.forEach((f) => safeUnlink(f.path));
        res.status(400).json({ error: 'Invalid product ID' });
        return;
      }
      if (uploadedFiles.length === 0) {
        res.status(400).json({ error: 'No image files uploaded' });
        return;
      }

      const pool = requirePool();
      const prodCheck = await pool.query<{ id: string }>(
        `SELECT id FROM products WHERE id = $1 LIMIT 1`,
        [productId],
      );
      if (prodCheck.rows.length === 0) {
        uploadedFiles.forEach((f) => safeUnlink(f.path));
        res.status(404).json({ error: 'Product not found' });
        return;
      }

      const maxOrderRes = await pool.query<{ max_order: number | null }>(
        `SELECT MAX(display_order) AS max_order FROM product_images WHERE product_id = $1`,
        [productId],
      );
      let nextOrder = (maxOrderRes.rows[0]?.max_order ?? 0) + 1;
      const hasPrimaryRes = await pool.query<{ id: string }>(
        `SELECT id FROM product_images WHERE product_id = $1 AND is_primary = TRUE LIMIT 1`,
        [productId],
      );
      let needsPrimary = hasPrimaryRes.rows.length === 0;

      const destDir = getProductMediaDir(productId, 'images');
      const createdImages = [];

      for (const file of uploadedFiles) {
        const sig = inspectFileSignature(file.path);
        if (!sig || sig.kind !== 'image') {
          uploadedFiles.forEach((f) => safeUnlink(f.path));
          res.status(400).json({
            error: `Invalid image signature for "${file.originalname}". Only valid PNG, JPEG, and WebP images are permitted.`,
          });
          return;
        }

        const safeName = `${crypto.randomUUID()}-${sanitizeBaseName(file.originalname)}.${sig.ext}`;
        const finalPath = path.join(destDir, safeName);
        fs.renameSync(file.path, finalPath);

        const publicUrl = `/api/media/products/${productId.toLowerCase()}/images/${safeName}`;
        const isPrimary = needsPrimary;
        needsPrimary = false;

        const inserted = await pool.query<{
          id: string;
          file_path: string;
          original_filename: string;
          mime_type: string;
          file_size: string;
          display_order: number;
          is_primary: boolean;
          created_at: Date;
        }>(
          `INSERT INTO product_images (product_id, file_path, original_filename, mime_type, file_size, display_order, is_primary)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING *`,
          [
            productId,
            publicUrl,
            file.originalname,
            sig.mimeType,
            file.size,
            nextOrder++,
            isPrimary,
          ],
        );

        const row = inserted.rows[0]!;
        createdImages.push({
          id: row.id,
          productId,
          filePath: row.file_path,
          originalFilename: row.original_filename,
          mimeType: row.mime_type,
          fileSize: Number(row.file_size),
          width: null,
          height: null,
          displayOrder: row.display_order,
          caption: null,
          isPrimary: row.is_primary,
          createdAt: row.created_at.toISOString(),
        });
      }

      await logProductActivity(pool, {
        productId,
        adminUserId: req.adminSession!.user.id,
        action: 'media.image_uploaded',
        entityType: 'media',
        details: { count: createdImages.length },
      });

      res.status(201).json({ images: createdImages });
    } catch (err) {
      uploadedFiles.forEach((f) => safeUnlink(f.path));
      next(err);
    }
  },
);

adminMediaRouter.post(
  '/products/:id/thumbnail',
  requirePermission('media:upload'),
  uploadImageMulter.single('file'),
  async (req, res, next) => {
    const file = req.file;
    try {
      const productId = String(req.params.id ?? '');
      if (!UUID_REGEX.test(productId) || !file) {
        safeUnlink(file?.path);
        res.status(400).json({ error: 'Valid product ID and image file required' });
        return;
      }

      const sig = inspectFileSignature(file.path);
      if (!sig || sig.kind !== 'image') {
        safeUnlink(file.path);
        res.status(400).json({ error: 'Invalid image signature (PNG/JPEG/WebP only)' });
        return;
      }

      const destDir = getProductMediaDir(productId, 'thumbnails');
      const safeName = `${crypto.randomUUID()}-${sanitizeBaseName(file.originalname)}.${sig.ext}`;
      fs.renameSync(file.path, path.join(destDir, safeName));
      const publicUrl = `/api/media/products/${productId.toLowerCase()}/thumbnails/${safeName}`;

      const pool = requirePool();
      await pool.query(
        `UPDATE products SET thumbnail_path = $2, updated_at = NOW() WHERE id = $1`,
        [productId, publicUrl],
      );
      res.status(201).json({ filePath: publicUrl });
    } catch (err) {
      safeUnlink(file?.path);
      next(err);
    }
  },
);

adminMediaRouter.post(
  '/products/:id/videos',
  requirePermission('media:upload'),
  uploadVideoMulter.fields([
    { name: 'video', maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 },
  ]),
  async (req, res, next) => {
    const filesMap = (req.files as Record<string, Express.Multer.File[]> | undefined) ?? {};
    const videoFile = filesMap.video?.[0];
    const thumbFile = filesMap.thumbnail?.[0];
    try {
      const productId = String(req.params.id ?? '');
      if (!UUID_REGEX.test(productId) || !videoFile) {
        safeUnlink(videoFile?.path);
        safeUnlink(thumbFile?.path);
        res.status(400).json({ error: 'Valid product ID and MP4 video file required' });
        return;
      }

      const videoSig = inspectFileSignature(videoFile.path);
      if (!videoSig || videoSig.kind !== 'video') {
        safeUnlink(videoFile.path);
        safeUnlink(thumbFile?.path);
        res.status(400).json({
          error: 'Invalid video file signature. Only valid MP4 streams are permitted.',
        });
        return;
      }

      const pool = requirePool();
      const prodCheck = await pool.query<{ id: string }>(
        `SELECT id FROM products WHERE id = $1 LIMIT 1`,
        [productId],
      );
      if (prodCheck.rows.length === 0) {
        safeUnlink(videoFile.path);
        safeUnlink(thumbFile?.path);
        res.status(404).json({ error: 'Product not found' });
        return;
      }

      let thumbUrl: string | null = null;
      if (thumbFile) {
        const thumbSig = inspectFileSignature(thumbFile.path);
        if (!thumbSig || thumbSig.kind !== 'image') {
          safeUnlink(videoFile.path);
          safeUnlink(thumbFile.path);
          res.status(400).json({ error: 'Invalid video poster image signature' });
          return;
        }
        const thumbDir = getProductMediaDir(productId, 'thumbnails');
        const safeThumb = `${crypto.randomUUID()}-${sanitizeBaseName(thumbFile.originalname)}.${thumbSig.ext}`;
        fs.renameSync(thumbFile.path, path.join(thumbDir, safeThumb));
        thumbUrl = `/api/media/products/${productId.toLowerCase()}/thumbnails/${safeThumb}`;
      }

      const videoDir = getProductMediaDir(productId, 'videos');
      const safeVid = `${crypto.randomUUID()}-${sanitizeBaseName(videoFile.originalname)}.mp4`;
      fs.renameSync(videoFile.path, path.join(videoDir, safeVid));
      const videoUrl = `/api/media/products/${productId.toLowerCase()}/videos/${safeVid}`;

      const maxOrderRes = await pool.query<{ max_order: number | null }>(
        `SELECT MAX(display_order) AS max_order FROM product_videos WHERE product_id = $1`,
        [productId],
      );
      const nextOrder = (maxOrderRes.rows[0]?.max_order ?? 0) + 1;
      const title =
        typeof req.body?.title === 'string' && req.body.title.trim()
          ? req.body.title.trim().slice(0, 200)
          : videoFile.originalname;
      const description =
        typeof req.body?.description === 'string' && req.body.description.trim()
          ? req.body.description.trim()
          : null;

      const inserted = await pool.query<{
        id: string;
        display_order: number;
        created_at: Date;
      }>(
        `INSERT INTO product_videos (product_id, file_path, thumbnail_path, original_filename, mime_type, file_size, title, description, display_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id, display_order, created_at`,
        [
          productId,
          videoUrl,
          thumbUrl,
          videoFile.originalname,
          videoSig.mimeType,
          videoFile.size,
          title,
          description,
          nextOrder,
        ],
      );

      await logProductActivity(pool, {
        productId,
        adminUserId: req.adminSession!.user.id,
        action: 'media.video_uploaded',
        entityType: 'media',
        entityId: inserted.rows[0]!.id,
        details: { filename: videoFile.originalname, title },
      });

      res.status(201).json({
        video: {
          id: inserted.rows[0]!.id,
          productId,
          filePath: videoUrl,
          thumbnailPath: thumbUrl,
          originalFilename: videoFile.originalname,
          mimeType: videoSig.mimeType,
          fileSize: videoFile.size,
          durationSeconds: null,
          title,
          description,
          displayOrder: inserted.rows[0]!.display_order,
          createdAt: inserted.rows[0]!.created_at.toISOString(),
        },
      });
    } catch (err) {
      safeUnlink(videoFile?.path);
      safeUnlink(thumbFile?.path);
      next(err);
    }
  },
);

adminMediaRouter.post(
  '/categories/:id/icon',
  requirePermission('categories:manage'),
  uploadImageMulter.single('file'),
  async (req, res, next) => {
    const file = req.file;
    try {
      const categoryId = String(req.params.id ?? '');
      if (!UUID_REGEX.test(categoryId) || !file) {
        safeUnlink(file?.path);
        res.status(400).json({ error: 'Valid category ID and icon file required' });
        return;
      }
      const sig = inspectFileSignature(file.path);
      if (!sig || sig.kind !== 'image') {
        safeUnlink(file.path);
        res.status(400).json({ error: 'Invalid category icon image format' });
        return;
      }
      const destDir = getCategoryMediaDir();
      const safeName = `${crypto.randomUUID()}-${sanitizeBaseName(file.originalname)}.${sig.ext}`;
      fs.renameSync(file.path, path.join(destDir, safeName));
      const publicUrl = `/api/media/categories/${safeName}`;

      const pool = requirePool();
      await pool.query(
        `UPDATE categories SET icon_path = $2, updated_at = NOW() WHERE id = $1`,
        [categoryId, publicUrl],
      );
      res.status(201).json({ filePath: publicUrl });
    } catch (err) {
      safeUnlink(file?.path);
      next(err);
    }
  },
);

adminMediaRouter.delete(
  '/media/:id',
  requirePermission('media:delete'),
  async (req, res, next) => {
    try {
      const mediaId = String(req.params.id ?? '');
      if (!UUID_REGEX.test(mediaId)) {
        res.status(400).json({ error: 'Invalid media ID' });
        return;
      }
      const pool = requirePool();

      // Check product_images first, then product_videos
      const imgRes = await pool.query<{
        id: string;
        product_id: string;
        file_path: string;
        original_filename: string;
        publication_status: 'draft' | 'published';
      }>(
        `SELECT pi.id, pi.product_id, pi.file_path, pi.original_filename, p.publication_status
         FROM product_images pi
         JOIN products p ON p.id = pi.product_id
         WHERE pi.id = $1
         LIMIT 1`,
        [mediaId],
      );

      if (imgRes.rows[0]) {
        const img = imgRes.rows[0];
        if (img.publication_status === 'published') {
          res.status(409).json({
            error: 'Cannot delete media attached to a published product. Unpublish the product first.',
          });
          return;
        }
        await pool.query(`DELETE FROM product_images WHERE id = $1`, [mediaId]);
        const rel = img.file_path.replace(/^\/api\/media\//, '');
        safeUnlink(resolveSafeStoragePath(rel));
        await logProductActivity(pool, {
          productId: img.product_id,
          adminUserId: req.adminSession!.user.id,
          action: 'media.image_deleted',
          entityType: 'media',
          entityId: mediaId,
          details: { filename: img.original_filename },
        });
        res.json({ ok: true });
        return;
      }

      const vidRes = await pool.query<{
        id: string;
        product_id: string;
        file_path: string;
        thumbnail_path: string | null;
        original_filename: string;
        publication_status: 'draft' | 'published';
      }>(
        `SELECT pv.id, pv.product_id, pv.file_path, pv.thumbnail_path, pv.original_filename, p.publication_status
         FROM product_videos pv
         JOIN products p ON p.id = pv.product_id
         WHERE pv.id = $1
         LIMIT 1`,
        [mediaId],
      );

      if (vidRes.rows[0]) {
        const vid = vidRes.rows[0];
        if (vid.publication_status === 'published') {
          res.status(409).json({
            error: 'Cannot delete video attached to a published product. Unpublish the product first.',
          });
          return;
        }
        await pool.query(`DELETE FROM product_videos WHERE id = $1`, [mediaId]);
        safeUnlink(resolveSafeStoragePath(vid.file_path.replace(/^\/api\/media\//, '')));
        if (vid.thumbnail_path) {
          safeUnlink(resolveSafeStoragePath(vid.thumbnail_path.replace(/^\/api\/media\//, '')));
        }
        await logProductActivity(pool, {
          productId: vid.product_id,
          adminUserId: req.adminSession!.user.id,
          action: 'media.video_deleted',
          entityType: 'media',
          entityId: mediaId,
          details: { filename: vid.original_filename },
        });
        res.json({ ok: true });
        return;
      }

      res.status(404).json({ error: 'Media record not found' });
    } catch (err) {
      next(err);
    }
  },
);

// ==============================================================================
// Controlled Media Delivery & HTTP 206 Partial Content Video Streaming
// ==============================================================================
function getMimeTypeForFilename(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.mp4') return 'video/mp4';
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  return 'application/octet-stream';
}

function streamFileWithRange(req: Request, res: Response, absPath: string, filename: string): void {
  if (!fs.existsSync(absPath)) {
    res.status(404).json({ error: 'Media file not found' });
    return;
  }

  const stat = fs.statSync(absPath);
  const fileSize = stat.size;
  const contentType = getMimeTypeForFilename(filename);
  const range = req.headers.range;

  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Type', contentType);
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (!match) {
      res.status(416).setHeader('Content-Range', `bytes */${fileSize}`).end();
      return;
    }

    const start = match[1] ? Number(match[1]) : 0;
    const end = match[2] ? Math.min(Number(match[2]), fileSize - 1) : fileSize - 1;

    if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= fileSize) {
      res.status(416).setHeader('Content-Range', `bytes */${fileSize}`).end();
      return;
    }

    const chunkSize = end - start + 1;
    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
    res.setHeader('Content-Length', chunkSize);

    const stream = fs.createReadStream(absPath, { start, end });
    stream.on('error', () => {
      if (!res.headersSent) res.status(500).end();
    });
    req.on('close', () => stream.destroy());
    stream.pipe(res);
    return;
  }

  res.status(200);
  res.setHeader('Content-Length', fileSize);
  const stream = fs.createReadStream(absPath);
  stream.on('error', () => {
    if (!res.headersSent) res.status(500).end();
  });
  req.on('close', () => stream.destroy());
  stream.pipe(res);
}

publicMediaRouter.get('/products/:productId/:kind/:filename', async (req, res, next) => {
  try {
    const productId = String(req.params.productId ?? '');
    const kind = String(req.params.kind ?? '');
    const filename = String(req.params.filename ?? '');
    if (!UUID_REGEX.test(productId)) {
      res.status(400).json({ error: 'Invalid product ID' });
      return;
    }
    if (!['images', 'videos', 'thumbnails'].includes(kind)) {
      res.status(400).json({ error: 'Invalid media kind' });
      return;
    }
    if (filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
      res.status(400).json({ error: 'Invalid filename' });
      return;
    }

    const pool = requirePool();
    const prodRes = await pool.query<{ publication_status: 'draft' | 'published' }>(
      `SELECT publication_status FROM products WHERE id = $1 LIMIT 1`,
      [productId],
    );
    const prod = prodRes.rows[0];
    if (!prod) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    if (prod.publication_status !== 'published') {
      const adminSession = await resolveSessionFromRequest(req);
      let previewAuthorized = false;
      if (adminSession) {
        const rawPreview = req.cookies?.[PREVIEW_COOKIE_NAME];
        if (typeof rawPreview === 'string') {
          const authCheck = await pool.query<{ id: string }>(
            `SELECT id FROM product_preview_authorizations
             WHERE product_id = $1 AND admin_user_id = $2 AND auth_hash = $3
               AND revoked_at IS NULL AND expires_at > NOW()
             LIMIT 1`,
            [productId, adminSession.user.id, sha256Hex(rawPreview)],
          );
          previewAuthorized = authCheck.rows.length > 0;
        }
        // Any authenticated admin with products:read may inspect draft media in Admin CMS
        if (adminSession.user.permissions.includes('products:read')) {
          previewAuthorized = true;
        }
      }
      if (!previewAuthorized) {
        res.status(403).json({ error: 'Draft media requires administrator access' });
        return;
      }
      res.setHeader('Cache-Control', 'private, no-store');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=3600');
    }

    const absPath = resolveSafeStoragePath(
      path.join('products', productId.toLowerCase(), kind, filename),
    );
    if (!absPath) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    streamFileWithRange(req, res, absPath, filename);
  } catch (err) {
    next(err);
  }
});

publicMediaRouter.get('/categories/:filename', (req, res) => {
  const filename = String(req.params.filename ?? '');
  if (filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
    res.status(400).json({ error: 'Invalid filename' });
    return;
  }
  const absPath = resolveSafeStoragePath(path.join('categories', filename));
  if (!absPath) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }
  res.setHeader('Cache-Control', 'public, max-age=3600');
  streamFileWithRange(req, res, absPath, filename);
});
