import type {
  ExternalLinkType,
  PermissionKey,
  PublicationStatus,
  RoleSlug,
  SectionType,
} from '../constants/index.js';

export interface CategoryDTO {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  iconPath: string | null;
  displayOrder: number;
  isActive: boolean;
  productCount?: number;
}

export interface ProductTypeDTO {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  displayOrder: number;
  isActive: boolean;
  productCount?: number;
}

export interface ProductImageDTO {
  id: string;
  productId: string;
  filePath: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  width: number | null;
  height: number | null;
  displayOrder: number;
  caption: string | null;
  isPrimary: boolean;
  createdAt?: string;
}

export interface ProductVideoDTO {
  id: string;
  productId: string;
  filePath: string;
  thumbnailPath: string | null;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  durationSeconds: number | null;
  title: string;
  description: string | null;
  displayOrder: number;
  createdAt?: string;
}

export interface ProductFeatureDTO {
  id: string;
  title: string;
  description: string | null;
  iconName: string | null;
  displayOrder: number;
}

export interface ProductUseCaseDTO {
  id: string;
  title: string;
  description: string | null;
  industrySegment: string | null;
  displayOrder: number;
}

export interface ProductContentSectionDTO {
  id: string;
  sectionKey: string;
  sectionType: SectionType;
  title: string;
  contentJson: Record<string, unknown>;
  isVisible: boolean;
  displayOrder: number;
}

export interface ProductExternalLinkDTO {
  id: string;
  linkType: ExternalLinkType;
  label: string;
  url: string;
  displayOrder: number;
}

export interface ProductSummaryDTO {
  id: string;
  name: string;
  slug: string;
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  productTypeId: string;
  productTypeName: string;
  productTypeSlug: string;
  shortDescription: string;
  thumbnailPath: string | null;
  logoPath: string | null;
  publicationStatus: PublicationStatus;
  featured: boolean;
  displayOrder: number;
  publishedAt: string | null;
  updatedAt: string;
}

export interface ProductDetailDTO extends ProductSummaryDTO {
  fullDescription: string | null;
  overview: string | null;
  problemStatement: string | null;
  solution: string | null;
  technicalCapabilities: string | null;
  businessBenefits: string | null;
  industrySegments: string | null;
  technologiesUsed: string | null;
  targetCustomers: string | null;
  images: ProductImageDTO[];
  videos: ProductVideoDTO[];
  features: ProductFeatureDTO[];
  useCases: ProductUseCaseDTO[];
  sections: ProductContentSectionDTO[];
  externalLinks: ProductExternalLinkDTO[];
}

export interface RoleDTO {
  id: string;
  slug: RoleSlug;
  name: string;
  description: string | null;
  permissions: PermissionKey[];
}

export interface AdminUserDTO {
  id: string;
  name: string;
  email: string;
  username: string;
  roleSlug: RoleSlug;
  roleName: string;
  status: 'active' | 'inactive';
  canPublishOverride: boolean | null;
  permissions: PermissionKey[];
  lastLoginAt: string | null;
  createdAt: string;
}

export interface ActivityLogDTO {
  id: string;
  actorName: string;
  actorEmail: string | null;
  actorRole: string | null;
  action: string;
  entityType: 'product' | 'category' | 'product_type' | 'media' | 'admin_user' | 'settings';
  entityId: string | null;
  entityName: string;
  details: string;
  createdAt: string;
}

export interface MediaLibraryItemDTO {
  id: string;
  productId: string;
  productName: string;
  productStatus: PublicationStatus;
  mediaKind: 'image' | 'video' | 'thumbnail';
  filePath: string;
  thumbnailPath?: string | null;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  captionOrTitle: string | null;
  createdAt: string;
}

export interface DashboardSummaryDTO {
  metrics: {
    totalProducts: number;
    publishedProducts: number;
    draftProducts: number;
    totalCategories: number;
    totalProductTypes: number;
    totalVideos: number;
    totalScreenshots: number;
    totalAdministrators: number;
    activeAdministrators: number;
  };
  categoryBreakdown: Array<{
    categoryId: string;
    categoryName: string;
    productCount: number;
  }>;
  recentlyUpdatedProducts: ProductSummaryDTO[];
  recentlyAddedProducts: ProductSummaryDTO[];
  recentActivity: ActivityLogDTO[];
}

export interface PortalSettingsDTO {
  portalTitle: string;
  defaultSort: 'display_order' | 'recent' | 'alpha';
  maxImageSizeMb: number;
  maxVideoSizeMb: number;
  allowedImageTypes: string[];
  allowedVideoTypes: string[];
  sessionTtlHours: number;
}

export interface HealthResponseDTO {
  status: 'ok' | 'degraded';
  service: string;
  timestamp: string;
  database: {
    configured: boolean;
    connected: boolean;
    error?: string;
  };
  storage: {
    directory: string;
    writable: boolean;
  };
}
