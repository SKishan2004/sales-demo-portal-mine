import fs from 'node:fs';
import path from 'node:path';
import { env } from './env.js';

export const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function checkStorageHealth(): { directory: string; writable: boolean } {
  const dirs = [
    path.join(env.resolvedStorageDir, 'products'),
    path.join(env.resolvedStorageDir, 'categories'),
    path.join(env.resolvedStorageDir, 'shared'),
    path.join(env.resolvedStorageDir, '.tmp'),
  ];
  try {
    for (const dir of dirs) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.accessSync(env.resolvedStorageDir, fs.constants.W_OK);
    return { directory: env.resolvedStorageDir, writable: true };
  } catch {
    return { directory: env.resolvedStorageDir, writable: false };
  }
}

export function getTempUploadDir(): string {
  const dir = path.resolve(env.resolvedStorageDir, '.tmp');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Immutable UUID-scoped product media directory:
 * storage/products/{product-uuid}/{images|videos|thumbnails|chunks}/
 */
export function getProductMediaDir(
  productId: string,
  kind: 'images' | 'videos' | 'thumbnails' | 'chunks',
): string {
  if (!UUID_REGEX.test(productId)) {
    throw new Error('Invalid product UUID for media path resolution');
  }

  const targetDir = path.resolve(
    env.resolvedStorageDir,
    'products',
    productId.toLowerCase(),
    kind,
  );
  const rootDir = path.resolve(env.resolvedStorageDir);

  if (!targetDir.startsWith(rootDir + path.sep)) {
    throw new Error('Resolved media path escapes configured storage root');
  }

  fs.mkdirSync(targetDir, { recursive: true });
  return targetDir;
}

export function getCategoryMediaDir(): string {
  const targetDir = path.resolve(env.resolvedStorageDir, 'categories');
  fs.mkdirSync(targetDir, { recursive: true });
  return targetDir;
}

export function resolveSafeStoragePath(relativeSubPath: string): string | null {
  const normalized = relativeSubPath.replace(/^\/+/, '');
  const resolved = path.resolve(env.resolvedStorageDir, normalized);
  const root = path.resolve(env.resolvedStorageDir);
  if (!resolved.startsWith(root + path.sep)) {
    return null;
  }
  return resolved;
}

export function removeProductStorageDir(productId: string): void {
  if (!UUID_REGEX.test(productId)) return;
  const dir = path.resolve(env.resolvedStorageDir, 'products', productId.toLowerCase());
  const root = path.resolve(env.resolvedStorageDir);
  if (dir.startsWith(root + path.sep) && fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
