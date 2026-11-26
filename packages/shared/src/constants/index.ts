export const MOBILEUM_BRAND = {
  companyName: 'Mobileum',
  portalTitle: 'Sales Demo Portal',
  adminTitle: 'Sales Demo Portal Admin',
  colors: {
    navy950: '#040916',
    navy900: '#071126',
    navy800: '#0B1A38',
    charcoal900: '#111827',
    charcoal800: '#1E293B',
    mobileumBlue: '#002BFF',
    mobileumCyan: '#3AD4F5',
    mobileumIndigo: '#6D7BFF',
    slate50: '#F8FAFC',
    slate200: '#E2E8F0',
    slate400: '#94A3B8',
  },
} as const;

export const ROLE_SLUGS = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  CONTENT_MANAGER: 'content_manager',
  VIEWER: 'viewer',
} as const;

export type RoleSlug = (typeof ROLE_SLUGS)[keyof typeof ROLE_SLUGS];

export const PERMISSIONS = {
  DASHBOARD_READ: 'dashboard:read',
  PRODUCTS_READ: 'products:read',
  PRODUCTS_CREATE: 'products:create',
  PRODUCTS_UPDATE: 'products:update',
  PRODUCTS_DELETE: 'products:delete',
  PRODUCTS_PUBLISH: 'products:publish',
  PRODUCTS_PREVIEW: 'products:preview',
  MEDIA_UPLOAD: 'media:upload',
  MEDIA_DELETE: 'media:delete',
  CATEGORIES_READ: 'categories:read',
  CATEGORIES_MANAGE: 'categories:manage',
  PRODUCT_TYPES_READ: 'product_types:read',
  PRODUCT_TYPES_MANAGE: 'product_types:manage',
  USERS_READ: 'users:read',
  USERS_MANAGE: 'users:manage',
  ROLES_MANAGE: 'roles:manage',
  LOGS_READ: 'logs:read',
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ROLE_PERMISSION_MATRIX: Record<RoleSlug, readonly PermissionKey[]> = {
  super_admin: Object.values(PERMISSIONS),
  admin: [
    PERMISSIONS.DASHBOARD_READ,
    PERMISSIONS.PRODUCTS_READ,
    PERMISSIONS.PRODUCTS_CREATE,
    PERMISSIONS.PRODUCTS_UPDATE,
    PERMISSIONS.PRODUCTS_DELETE,
    PERMISSIONS.PRODUCTS_PUBLISH,
    PERMISSIONS.PRODUCTS_PREVIEW,
    PERMISSIONS.MEDIA_UPLOAD,
    PERMISSIONS.MEDIA_DELETE,
    PERMISSIONS.CATEGORIES_READ,
    PERMISSIONS.CATEGORIES_MANAGE,
    PERMISSIONS.PRODUCT_TYPES_READ,
    PERMISSIONS.PRODUCT_TYPES_MANAGE,
    PERMISSIONS.LOGS_READ,
  ],
  content_manager: [
    PERMISSIONS.DASHBOARD_READ,
    PERMISSIONS.PRODUCTS_READ,
    PERMISSIONS.PRODUCTS_CREATE,
    PERMISSIONS.PRODUCTS_UPDATE,
    PERMISSIONS.PRODUCTS_PREVIEW,
    PERMISSIONS.MEDIA_UPLOAD,
    PERMISSIONS.MEDIA_DELETE,
    PERMISSIONS.CATEGORIES_READ,
    PERMISSIONS.PRODUCT_TYPES_READ,
    PERMISSIONS.LOGS_READ,
  ],
  // Strictly read-only access per security specification
  viewer: [
    PERMISSIONS.DASHBOARD_READ,
    PERMISSIONS.PRODUCTS_READ,
    PERMISSIONS.CATEGORIES_READ,
    PERMISSIONS.PRODUCT_TYPES_READ,
    PERMISSIONS.LOGS_READ,
  ],
};

export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
] as const;

export const ALLOWED_VIDEO_MIME_TYPES = ['video/mp4'] as const;

export const PUBLICATION_STATUS = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
} as const;

export type PublicationStatus =
  (typeof PUBLICATION_STATUS)[keyof typeof PUBLICATION_STATUS];

export const SECTION_TYPES = [
  'overview',
  'problem_statement',
  'solution',
  'features',
  'architecture',
  'workflow',
  'technical_capabilities',
  'business_benefits',
  'use_cases',
  'integrations',
  'screenshots',
  'videos',
  'custom',
] as const;

export type SectionType = (typeof SECTION_TYPES)[number];

export const EXTERNAL_LINK_TYPES = [
  'live_demo',
  'official_website',
  'related_website',
  'documentation',
  'presentation',
  'resource',
] as const;

export type ExternalLinkType = (typeof EXTERNAL_LINK_TYPES)[number];
