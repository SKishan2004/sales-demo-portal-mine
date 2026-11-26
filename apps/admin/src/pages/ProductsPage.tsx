import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2,
  Copy,
  Edit3,
  Eye,
  Filter,
  Globe,
  Plus,
  Search,
  Star,
  Trash2,
} from 'lucide-react';
import type {
  CategoryDTO,
  ProductDetailDTO,
  ProductTypeDTO,
} from '@mobileum/shared';
import { adminApi } from '@/api/adminApi';
import { ApiStatusBanner, type StatusFeedback } from '@/components/ApiStatusBanner';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import {
  PREVIEW_CATEGORIES,
  PREVIEW_PRODUCTS,
  PREVIEW_PRODUCT_TYPES,
} from '@/data/adminPreviewData';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function ProductsPage() {
  const { mode, hasPermission } = useAuth();
  const [products, setProducts] = useState<ProductDetailDTO[]>([]);
  const [categories, setCategories] = useState<CategoryDTO[]>([]);
  const [productTypes, setProductTypes] = useState<ProductTypeDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<StatusFeedback | null>(null);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft'>('all');

  const [deleteTarget, setDeleteTarget] = useState<ProductDetailDTO | null>(null);
  const [publishTarget, setPublishTarget] = useState<ProductDetailDTO | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const canCreate = hasPermission('products:create');
  const canUpdate = hasPermission('products:update');
  const canDelete = hasPermission('products:delete');
  const canPublish = hasPermission('products:publish');

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      const [prodRes, catRes, typeRes] = await Promise.all([
        adminApi.getProducts(),
        adminApi.getCategories(),
        adminApi.getProductTypes(),
      ]);
      if (!active) return;

      if (prodRes.ok && prodRes.data) {
        setProducts(prodRes.data.items);
      } else if (mode === 'ui_preview') {
        setProducts(PREVIEW_PRODUCTS);
      }

      if (catRes.ok && catRes.data) {
        setCategories(catRes.data.items);
      } else if (mode === 'ui_preview') {
        setCategories(PREVIEW_CATEGORIES);
      }

      if (typeRes.ok && typeRes.data) {
        setProductTypes(typeRes.data.items);
      } else if (mode === 'ui_preview') {
        setProductTypes(PREVIEW_PRODUCT_TYPES);
      }
      setLoading(false);
    };
    void load();
    return () => {
      active = false;
    };
  }, [mode]);

  const filtered = products
    .filter((p) => {
      if (categoryFilter !== 'all' && p.categoryId !== categoryFilter) return false;
      if (typeFilter !== 'all' && p.productTypeId !== typeFilter) return false;
      if (statusFilter !== 'all' && p.publicationStatus !== statusFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          p.slug.toLowerCase().includes(q) ||
          p.shortDescription.toLowerCase().includes(q)
        );
      }
      return true;
    })
    .sort((a, b) => a.displayOrder - b.displayOrder);

  const handleToggleFeatured = async (product: ProductDetailDTO) => {
    if (!canUpdate) return;
    setBusyId(product.id);
    const res = await adminApi.updateProduct(product.id, {
      featured: !product.featured,
    });
    setBusyId(null);
    if (!res.ok) {
      setFeedback({
        type: res.awaitingBackend ? 'warning' : 'error',
        message: res.error ?? 'Unable to update featured status.',
      });
      return;
    }
    setProducts((prev) =>
      prev.map((item) =>
        item.id === product.id ? { ...item, featured: !item.featured } : item,
      ),
    );
  };

  const handleDuplicate = async (product: ProductDetailDTO) => {
    if (!canCreate) return;
    setBusyId(product.id);
    const res = await adminApi.duplicateProduct(product.id);
    setBusyId(null);
    if (!res.ok) {
      setFeedback({
        type: res.awaitingBackend ? 'warning' : 'error',
        message: res.error ?? 'Unable to duplicate product.',
      });
      return;
    }
    if (res.data?.product) {
      setProducts((prev) => [...prev, res.data!.product]);
      setFeedback({ type: 'info', message: `Duplicated "${product.name}" as draft.` });
    }
  };

  const handleConfirmPublishToggle = async () => {
    if (!publishTarget || !canPublish) return;
    const isPublishing = publishTarget.publicationStatus !== 'published';
    setBusyId(publishTarget.id);
    const res = isPublishing
      ? await adminApi.publishProduct(publishTarget.id)
      : await adminApi.unpublishProduct(publishTarget.id);
    setBusyId(null);
    setPublishTarget(null);

    if (!res.ok) {
      setFeedback({
        type: res.awaitingBackend ? 'warning' : 'error',
        message: res.error ?? 'Unable to update publication status.',
      });
      return;
    }

    setProducts((prev) =>
      prev.map((item) =>
        item.id === publishTarget.id
          ? {
              ...item,
              publicationStatus: isPublishing ? 'published' : 'draft',
            }
          : item,
      ),
    );
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget || !canDelete) return;
    setBusyId(deleteTarget.id);
    const res = await adminApi.deleteProduct(deleteTarget.id);
    setBusyId(null);
    setDeleteTarget(null);

    if (!res.ok) {
      setFeedback({
        type: res.awaitingBackend ? 'warning' : 'error',
        message: res.error ?? 'Unable to delete product.',
      });
      return;
    }

    setProducts((prev) => prev.filter((item) => item.id !== deleteTarget.id));
    setFeedback({ type: 'info', message: `Deleted "${deleteTarget.name}".` });
  };

  return (
    <AdminLayout
      title="Products"
      subtitle="Manage drafts, publishing status, featured showcases, and ordering"
      actions={
        canCreate ? (
          <Button asChild size="sm">
            <Link to="/products/new">
              <Plus className="h-4 w-4" />
              Add Product
            </Link>
          </Button>
        ) : undefined
      }
    >
      <div className="space-y-5">
        <ApiStatusBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

        {/* Filter Toolbar */}
        <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 lg:grid-cols-12">
          <div className="relative lg:col-span-4">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products by name or slug..."
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#2563EB] focus:bg-white focus:outline-none"
            />
          </div>

          <div className="relative lg:col-span-3">
            <Filter className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              aria-label="Filter by category"
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm text-slate-800 focus:border-[#2563EB] focus:bg-white focus:outline-none"
            >
              <option value="all">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-3">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              aria-label="Filter by product type"
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 focus:border-[#2563EB] focus:bg-white focus:outline-none"
            >
              <option value="all">All Product Types</option>
              {productTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-2">
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as 'all' | 'published' | 'draft')
              }
              aria-label="Filter by status"
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 focus:border-[#2563EB] focus:bg-white focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
            </select>
          </div>
        </div>

        {/* Products Table */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-3.5">Product</th>
                  <th className="px-4 py-3.5">Category</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Featured</th>
                  <th className="px-4 py-3.5">Order</th>
                  <th className="px-4 py-3.5">Updated</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-slate-500">
                      Loading products...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-slate-500">
                      No products match the selected filters.
                    </td>
                  </tr>
                ) : (
                  filtered.map((product) => (
                    <tr
                      key={product.id}
                      className="transition-colors hover:bg-slate-50/70"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3.5">
                          <div className="h-12 w-20 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-[#F4F8FF]">
                            {product.thumbnailPath ? (
                              <img
                                src={product.thumbnailPath}
                                alt={product.name}
                                className="h-full w-full object-contain"
                              />
                            ) : null}
                          </div>
                          <div className="min-w-0">
                            <p className="max-w-[260px] truncate font-medium text-slate-900">
                              {product.name}
                            </p>
                            <p className="text-xs text-slate-500">
                              /{product.slug} • {product.productTypeName}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-4 text-xs text-slate-700">
                        {product.categoryName}
                      </td>

                      <td className="px-4 py-4">
                        <Badge
                          variant={
                            product.publicationStatus === 'published'
                              ? 'success'
                              : 'warning'
                          }
                        >
                          {product.publicationStatus === 'published'
                            ? 'Published'
                            : 'Draft'}
                        </Badge>
                      </td>

                      <td className="px-4 py-4">
                        <button
                          type="button"
                          disabled={!canUpdate || busyId === product.id}
                          onClick={() => void handleToggleFeatured(product)}
                          title={
                            canUpdate
                              ? 'Toggle featured status'
                              : 'Read-only permission'
                          }
                          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                            product.featured
                              ? 'border-[#BFDBFE] bg-[#EFF6FF] text-[#1D4ED8]'
                              : 'border-slate-200 bg-white text-slate-400 hover:text-slate-600'
                          } disabled:cursor-not-allowed disabled:opacity-60`}
                        >
                          <Star
                            className={`h-3 w-3 ${
                              product.featured ? 'fill-[#1D4ED8]' : ''
                            }`}
                          />
                          {product.featured ? 'Featured' : 'Standard'}
                        </button>
                      </td>

                      <td className="px-4 py-4 text-xs font-medium text-slate-700">
                        #{product.displayOrder}
                      </td>

                      <td className="px-4 py-4 text-xs text-slate-500">
                        {formatDate(product.updatedAt)}
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            asChild
                            title="Preview product"
                          >
                            <Link to={`/products/${product.id}/preview`}>
                              <Eye className="h-4 w-4 text-slate-600" />
                            </Link>
                          </Button>

                          <Button
                            variant="ghost"
                            size="icon"
                            asChild
                            title={canUpdate ? 'Edit product' : 'View product details'}
                          >
                            <Link to={`/products/${product.id}/edit`}>
                              <Edit3 className="h-4 w-4 text-[#1D4ED8]" />
                            </Link>
                          </Button>

                          {canCreate && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Duplicate product"
                              disabled={busyId === product.id}
                              onClick={() => void handleDuplicate(product)}
                            >
                              <Copy className="h-4 w-4 text-slate-600" />
                            </Button>
                          )}

                          {canPublish && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title={
                                product.publicationStatus === 'published'
                                  ? 'Unpublish product'
                                  : 'Publish product'
                              }
                              disabled={busyId === product.id}
                              onClick={() => setPublishTarget(product)}
                            >
                              {product.publicationStatus === 'published' ? (
                                <Globe className="h-4 w-4 text-emerald-600" />
                              ) : (
                                <CheckCircle2 className="h-4 w-4 text-amber-600" />
                              )}
                            </Button>
                          )}

                          {canDelete && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Delete product"
                              disabled={busyId === product.id}
                              onClick={() => setDeleteTarget(product)}
                            >
                              <Trash2 className="h-4 w-4 text-rose-600" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Confirm Publish / Unpublish */}
      <ConfirmDialog
        open={Boolean(publishTarget)}
        onOpenChange={(open) => !open && setPublishTarget(null)}
        title={
          publishTarget?.publicationStatus === 'published'
            ? 'Unpublish Product?'
            : 'Publish Product?'
        }
        description={
          publishTarget?.publicationStatus === 'published'
            ? `"${publishTarget?.name}" will immediately be removed from the public Sales Demo Portal. Uploaded screenshots and videos will remain preserved.`
            : `"${publishTarget?.name}" will become visible to authorized viewers on the public Sales Demo Portal.`
        }
        confirmLabel={
          publishTarget?.publicationStatus === 'published'
            ? 'Unpublish'
            : 'Publish Now'
        }
        onConfirm={() => void handleConfirmPublishToggle()}
      />

      {/* Confirm Delete */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Product?"
        description={`Are you sure you want to permanently delete "${deleteTarget?.name}" and its associated screenshots and videos? This cannot be undone.`}
        confirmLabel="Delete Product"
        destructive
        onConfirm={() => void handleConfirmDelete()}
      />
    </AdminLayout>
  );
}
