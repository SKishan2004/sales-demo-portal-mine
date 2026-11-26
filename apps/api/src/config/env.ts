import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../../..');

const rootEnvPath = path.join(repoRoot, '.env');
if (fs.existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath });
} else {
  dotenv.config();
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.string().trim().optional(),
  PG_POOL_MAX: z.coerce.number().int().min(1).max(100).default(20),
  MEDIA_STORAGE_DIR: z.string().trim().default(path.join(repoRoot, 'storage')),
  MAX_IMAGE_SIZE_MB: z.coerce.number().int().min(1).max(100).default(15),
  MAX_VIDEO_SIZE_MB: z.coerce.number().int().min(1).max(2048).default(500),
  SESSION_SECRET: z
    .string()
    .min(16)
    .default('dev_only_session_secret_change_before_production_use'),
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(168).default(12),
  PREVIEW_TOKEN_TTL_MINUTES: z.coerce.number().int().min(1).max(60).default(15),
  COOKIE_SECURE: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
  COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  CORS_ORIGIN: z
    .string()
    .default('http://localhost:5173,http://localhost:5174'),
  LOGIN_RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().int().min(1).max(60).default(15),
  LOGIN_RATE_LIMIT_MAX_ATTEMPTS: z.coerce.number().int().min(3).max(100).default(10),
});

const parsed = envSchema.parse(process.env);

export const env = {
  ...parsed,
  repoRoot,
  resolvedStorageDir: path.isAbsolute(parsed.MEDIA_STORAGE_DIR)
    ? parsed.MEDIA_STORAGE_DIR
    : path.resolve(repoRoot, parsed.MEDIA_STORAGE_DIR),
  corsOrigins: parsed.CORS_ORIGIN.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
};
