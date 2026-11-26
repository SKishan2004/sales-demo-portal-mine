import type {
  CategoryDTO,
  ProductDetailDTO,
  ProductSummaryDTO,
  ProductTypeDTO,
} from '@mobileum/shared';

export type ProductSortOption = 'display_order' | 'recent' | 'alpha';

export interface ProductQueryParams {
  search?: string;
  categorySlug?: string;
  productTypeSlug?: string;
  featuredOnly?: boolean;
  sort?: ProductSortOption;
  page?: number;
  pageSize?: number;
}

export interface PaginatedProductsResponse {
  items: ProductSummaryDTO[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ProductAdjacentResult {
  product: ProductDetailDTO | null;
  previous: ProductSummaryDTO | null;
  next: ProductSummaryDTO | null;
  related: ProductSummaryDTO[];
}

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) || '/api';

async function fetchPublicJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}/public${path}`);
  const payload = (await response.json().catch(() => null)) as
    | (T & { error?: string })
    | null;

  if (!response.ok) {
    throw new Error(payload?.error ?? `Request failed (HTTP ${response.status})`);
  }

  return payload as T;
}

export const catalogueApi = {
  async getCategories(): Promise<CategoryDTO[]> {
    const res = await fetchPublicJson<{ items: CategoryDTO[] }>('/categories');
    return res.items;
  },

  async getProductTypes(): Promise<ProductTypeDTO[]> {
    const res = await fetchPublicJson<{ items: ProductTypeDTO[] }>('/product-types');
    return res.items;
  },

  async getFeaturedProducts(): Promise<ProductSummaryDTO[]> {
    const res = await fetchPublicJson<{ items: ProductSummaryDTO[] }>('/featured');
    return res.items;
  },

  async getProducts(
    params: ProductQueryParams = {},
  ): Promise<PaginatedProductsResponse> {
    const qs = new URLSearchParams();
    if (params.search?.trim()) qs.set('search', params.search.trim());
    if (params.categorySlug && params.categorySlug !== 'all') {
      qs.set('category', params.categorySlug);
    }
    if (params.productTypeSlug && params.productTypeSlug !== 'all') {
      qs.set('productType', params.productTypeSlug);
    }
    if (params.featuredOnly) qs.set('featured', 'true');
    if (params.sort) qs.set('sort', params.sort);
    if (params.page) qs.set('page', String(params.page));
    if (params.pageSize) qs.set('pageSize', String(params.pageSize));

    const query = qs.toString();
    return fetchPublicJson<PaginatedProductsResponse>(
      `/products${query ? `?${query}` : ''}`,
    );
  },

  async getProductBySlug(slug: string): Promise<ProductAdjacentResult> {
    try {
      return await fetchPublicJson<ProductAdjacentResult>(
        `/products/${encodeURIComponent(slug)}`,
      );
    } catch (err) {
      if (err instanceof Error && err.message.includes('not found')) {
        return { product: null, previous: null, next: null, related: [] };
      }
      throw err;
    }
  },
};
