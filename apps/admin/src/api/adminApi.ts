import type {
  ActivityLogDTO,
  AdminUserDTO,
  CategoryDTO,
  DashboardSummaryDTO,
  MediaLibraryItemDTO,
  PortalSettingsDTO,
  ProductDetailDTO,
  ProductImageDTO,
  ProductTypeDTO,
  ProductVideoDTO,
  RoleDTO,
  RoleSlug,
} from '@mobileum/shared';

export interface ApiResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
  awaitingBackend?: boolean;
}

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) || '/api';

// In-memory CSRF token tied to the active HttpOnly session (never persisted to localStorage)
let activeCsrfToken: string | null = null;

export function setCsrfToken(token: string | null): void {
  activeCsrfToken = token;
}

async function requestJson<T>(
  path: string,
  init: RequestInit = {},
): Promise<ApiResult<T>> {
  try {
    const headers = new Headers(init.headers);
    if (!headers.has('Content-Type') && !(init.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }
    const method = (init.method ?? 'GET').toUpperCase();
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && activeCsrfToken) {
      headers.set('X-CSRF-Token', activeCsrfToken);
    }

    const response = await fetch(`${API_BASE}/admin${path}`, {
      ...init,
      credentials: 'include',
      headers,
    });

    if (response.status === 404 && path === '/me') {
      return {
        ok: false,
        status: 404,
        awaitingBackend: true,
        error: 'Authentication endpoint unavailable.',
      };
    }

    const body = (await response.json().catch(() => null)) as
      | (T & { error?: string; csrfToken?: string })
      | null;

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        awaitingBackend: response.status === 503,
        error: body?.error ?? `Request failed (HTTP ${response.status})`,
      };
    }

    if (body && typeof body.csrfToken === 'string') {
      activeCsrfToken = body.csrfToken;
    }

    return {
      ok: true,
      status: response.status,
      data: body as T,
    };
  } catch {
    return {
      ok: false,
      status: 0,
      awaitingBackend: true,
      error: 'Unable to reach /api/admin. Confirm the backend API server is running.',
    };
  }
}

function uploadWithProgress<T>(
  path: string,
  formData: FormData,
  onProgress?: (pct: number) => void,
): Promise<ApiResult<T>> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE}/admin${path}`);
    xhr.withCredentials = true;
    if (activeCsrfToken) {
      xhr.setRequestHeader('X-CSRF-Token', activeCsrfToken);
    }

    xhr.upload.onprogress = (evt) => {
      if (evt.lengthComputable && onProgress) {
        onProgress(Math.round((evt.loaded / evt.total) * 100));
      }
    };

    xhr.onload = () => {
      let body: (T & { error?: string }) | null = null;
      try {
        body = JSON.parse(xhr.responseText) as T & { error?: string };
      } catch {
        body = null;
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve({ ok: true, status: xhr.status, data: body as T });
      } else {
        resolve({
          ok: false,
          status: xhr.status,
          awaitingBackend: xhr.status === 503,
          error: body?.error ?? `Upload failed (HTTP ${xhr.status})`,
        });
      }
    };

    xhr.onerror = () => {
      resolve({
        ok: false,
        status: 0,
        awaitingBackend: true,
        error: 'Network error while uploading file.',
      });
    };

    xhr.send(formData);
  });
}

export const adminApi = {
  // Authentication & Sessions
  login: (payload: { identifier: string; password: string; rememberMe?: boolean }) =>
    requestJson<{ user: AdminUserDTO; csrfToken: string }>('/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  logout: async () => {
    const res = await requestJson<{ ok: boolean }>('/logout', { method: 'POST' });
    activeCsrfToken = null;
    return res;
  },

  getMe: () =>
    requestJson<{ user: AdminUserDTO; csrfToken: string }>('/me', { method: 'GET' }),

  forgotPassword: (identifier: string) =>
    requestJson<{ ok: boolean; message: string }>('/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ identifier }),
    }),

  resetPassword: (token: string, newPassword: string) =>
    requestJson<{ ok: boolean }>('/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, newPassword }),
    }),

  getSessions: () =>
    requestJson<{
      items: Array<{
        id: string;
        ipAddress: string | null;
        userAgent: string | null;
        expiresAt: string;
        createdAt: string;
        isCurrent: boolean;
      }>;
    }>('/sessions', { method: 'GET' }),

  revokeSession: (id: string) =>
    requestJson<{ ok: boolean }>(`/sessions/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  // Dashboard
  getDashboard: () =>
    requestJson<DashboardSummaryDTO>('/dashboard', { method: 'GET' }),

  // Products
  getProducts: () =>
    requestJson<{ items: ProductDetailDTO[] }>('/products', { method: 'GET' }),

  getProduct: (id: string) =>
    requestJson<{ product: ProductDetailDTO }>(`/products/${encodeURIComponent(id)}`, {
      method: 'GET',
    }),

  createProduct: (payload: Record<string, unknown>) =>
    requestJson<{ product: ProductDetailDTO }>('/products', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateProduct: (id: string, payload: Record<string, unknown>) =>
    requestJson<{ product: ProductDetailDTO }>(`/products/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  deleteProduct: (id: string) =>
    requestJson<{ ok: boolean }>(`/products/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  duplicateProduct: (id: string) =>
    requestJson<{ product: ProductDetailDTO }>(
      `/products/${encodeURIComponent(id)}/duplicate`,
      { method: 'POST' },
    ),

  publishProduct: (id: string) =>
    requestJson<{ product: ProductDetailDTO }>(
      `/products/${encodeURIComponent(id)}/publish`,
      { method: 'POST' },
    ),

  unpublishProduct: (id: string) =>
    requestJson<{ product: ProductDetailDTO }>(
      `/products/${encodeURIComponent(id)}/unpublish`,
      { method: 'POST' },
    ),

  authorizePreview: (id: string) =>
    requestJson<{ authorized: boolean; expiresAt: string }>(
      `/products/${encodeURIComponent(id)}/preview-authorization`,
      { method: 'POST' },
    ),

  // Media
  getMediaLibrary: () =>
    requestJson<{ items: MediaLibraryItemDTO[] }>('/media', { method: 'GET' }),

  uploadProductImage: (
    productId: string,
    formData: FormData,
    onProgress?: (pct: number) => void,
  ) =>
    uploadWithProgress<{ images: ProductImageDTO[] }>(
      `/products/${encodeURIComponent(productId)}/images`,
      formData,
      onProgress,
    ),

  uploadProductThumbnail: (productId: string, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return uploadWithProgress<{ filePath: string }>(
      `/products/${encodeURIComponent(productId)}/thumbnail`,
      fd,
    );
  },

  uploadProductVideo: (
    productId: string,
    formData: FormData,
    onProgress?: (pct: number) => void,
  ) =>
    uploadWithProgress<{ video: ProductVideoDTO }>(
      `/products/${encodeURIComponent(productId)}/videos`,
      formData,
      onProgress,
    ),

  uploadCategoryIcon: (categoryId: string, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return uploadWithProgress<{ filePath: string }>(
      `/categories/${encodeURIComponent(categoryId)}/icon`,
      fd,
    );
  },

  deleteMedia: (mediaId: string) =>
    requestJson<{ ok: boolean }>(`/media/${encodeURIComponent(mediaId)}`, {
      method: 'DELETE',
    }),

  // Categories & Product Types
  getCategories: () =>
    requestJson<{ items: CategoryDTO[] }>('/categories', { method: 'GET' }),

  createCategory: (payload: Record<string, unknown>) =>
    requestJson<{ category: CategoryDTO }>('/categories', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateCategory: (id: string, payload: Record<string, unknown>) =>
    requestJson<{ category: CategoryDTO }>(`/categories/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  deleteCategory: (id: string) =>
    requestJson<{ ok: boolean }>(`/categories/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  getProductTypes: () =>
    requestJson<{ items: ProductTypeDTO[] }>('/product-types', { method: 'GET' }),

  createProductType: (payload: Record<string, unknown>) =>
    requestJson<{ productType: ProductTypeDTO }>('/product-types', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Users & Roles (Super Admin)
  getUsers: () =>
    requestJson<{ items: AdminUserDTO[]; roles: RoleDTO[] }>('/users', {
      method: 'GET',
    }),

  createUser: (payload: {
    name: string;
    email: string;
    username: string;
    roleSlug: RoleSlug;
    status: 'active' | 'inactive';
    canPublishOverride?: boolean | null;
    initialPassword: string;
  }) =>
    requestJson<{ user: AdminUserDTO }>('/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateUserRole: (
    id: string,
    payload: { roleSlug: RoleSlug; canPublishOverride?: boolean | null },
  ) =>
    requestJson<{ user: AdminUserDTO }>(`/users/${encodeURIComponent(id)}/role`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  updateUserStatus: (id: string, status: 'active' | 'inactive') =>
    requestJson<{ user: AdminUserDTO }>(`/users/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  revokeUserSessions: (id: string) =>
    requestJson<{ ok: boolean }>(`/users/${encodeURIComponent(id)}/revoke-sessions`, {
      method: 'POST',
    }),

  resetUserPassword: (id: string, newPassword: string) =>
    requestJson<{ ok: boolean }>(`/users/${encodeURIComponent(id)}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ newPassword }),
    }),

  // Activity Logs & Settings
  getActivityLogs: () =>
    requestJson<{ items: ActivityLogDTO[] }>('/activity-logs', { method: 'GET' }),

  getSettings: () =>
    requestJson<{ settings: PortalSettingsDTO }>('/settings', { method: 'GET' }),

  updateSettings: (payload: Partial<PortalSettingsDTO>) =>
    requestJson<{ settings: PortalSettingsDTO }>('/settings', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
};
