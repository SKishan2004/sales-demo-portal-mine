import { z } from 'zod';
import { EXTERNAL_LINK_TYPES, PUBLICATION_STATUS, SECTION_TYPES } from '../constants/index.js';

export const slugSchema = z
  .string()
  .min(2)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens');

export const loginSchema = z.object({
  identifier: z.string().trim().min(2, 'Email or username is required').max(150),
  password: z.string().min(1, 'Password is required').max(200),
});

export const categoryInputSchema = z.object({
  name: z.string().trim().min(2).max(100),
  slug: slugSchema,
  description: z.string().trim().max(500).nullable().optional(),
  displayOrder: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

export const productTypeInputSchema = z.object({
  name: z.string().trim().min(2).max(100),
  slug: slugSchema,
  description: z.string().trim().max(500).nullable().optional(),
  displayOrder: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

export const externalLinkInputSchema = z.object({
  linkType: z.enum(EXTERNAL_LINK_TYPES),
  label: z.string().trim().min(1).max(100),
  url: z.string().url().refine((u) => u.startsWith('https://') || u.startsWith('http://'), {
    message: 'URL must use http or https',
  }),
  displayOrder: z.number().int().min(0).default(0),
});

export const contentSectionInputSchema = z.object({
  sectionKey: z.string().trim().min(1).max(80),
  sectionType: z.enum(SECTION_TYPES),
  title: z.string().trim().min(1).max(150),
  contentJson: z.record(z.unknown()).default({}),
  isVisible: z.boolean().default(true),
  displayOrder: z.number().int().min(0).default(0),
});

export const productInputSchema = z.object({
  name: z.string().trim().min(2).max(160),
  slug: slugSchema,
  categoryId: z.string().uuid(),
  productTypeId: z.string().uuid(),
  shortDescription: z.string().trim().min(10).max(500),
  fullDescription: z.string().trim().max(10000).nullable().optional(),
  overview: z.string().trim().max(10000).nullable().optional(),
  problemStatement: z.string().trim().max(10000).nullable().optional(),
  solution: z.string().trim().max(10000).nullable().optional(),
  technicalCapabilities: z.string().trim().max(10000).nullable().optional(),
  businessBenefits: z.string().trim().max(10000).nullable().optional(),
  industrySegments: z.string().trim().max(2000).nullable().optional(),
  technologiesUsed: z.string().trim().max(2000).nullable().optional(),
  targetCustomers: z.string().trim().max(2000).nullable().optional(),
  featured: z.boolean().default(false),
  displayOrder: z.number().int().min(0).default(0),
  publicationStatus: z
    .enum([PUBLICATION_STATUS.DRAFT, PUBLICATION_STATUS.PUBLISHED])
    .default(PUBLICATION_STATUS.DRAFT),
});
