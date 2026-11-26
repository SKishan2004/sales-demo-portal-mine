import { useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Edit3,
  FolderKanban,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import {
  categoryInputSchema,
  type CategoryDTO,
  type ProductTypeDTO,
} from '@mobileum/shared';
import { adminApi } from '@/api/adminApi';
import { ApiStatusBanner, type StatusFeedback } from '@/components/ApiStatusBanner';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/context/AuthContext';
import {
  PREVIEW_CATEGORIES,
  PREVIEW_PRODUCT_TYPES,
} from '@/data/adminPreviewData';

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function CategoriesPage() {
  const { mode, hasPermission } = useAuth();
  const canManageCategories = hasPermission('categories:manage');
  const canManageTypes = hasPermission('product_types:manage');

  const [tab, setTab] = useState<'categories' | 'types'>('categories');
  const [categories, setCategories] = useState<CategoryDTO[]>([]);
  const [productTypes, setProductTypes] = useState<ProductTypeDTO[]>([]);
  const [search, setSearch] = useState('');
  const [feedback, setFeedback] = useState<StatusFeedback | null>(null);

  // Category modal state
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<CategoryDTO | null>(null);
  const [catName, setCatName] = useState('');
  const [catSlug, setCatSlug] = useState('');
  const [catDesc, setCatDesc] = useState('');
  const [catOrder, setCatOrder] = useState(1);
  const [catIconPreview, setCatIconPreview] = useState<string | null>(null);
  const [catIconFile, setCatIconFile] = useState<File | null>(null);
  const [catError, setCatError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CategoryDTO | null>(null);

  // Product Type modal state
  const [typeModalOpen, setTypeModalOpen] = useState(false);
  const [typeName, setTypeName] = useState('');
  const [typeSlug, setTypeSlug] = useState('');
  const [typeDesc, setTypeDesc] = useState('');
  const [typeError, setTypeError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const [catRes, typeRes] = await Promise.all([
        adminApi.getCategories(),
        adminApi.getProductTypes(),
      ]);
      if (!active) return;

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
    };
    void load();
    return () => {
      active = false;
    };
  }, [mode]);

  const openNewCategory = () => {
    setEditingCat(null);
    setCatName('');
    setCatSlug('');
    setCatDesc('');
    setCatOrder(categories.length + 1);
    setCatIconPreview(null);
    setCatIconFile(null);
    setCatError(null);
    setCatModalOpen(true);
  };

  const openEditCategory = (cat: CategoryDTO) => {
    setEditingCat(cat);
    setCatName(cat.name);
    setCatSlug(cat.slug);
    setCatDesc(cat.description ?? '');
    setCatOrder(cat.displayOrder);
    setCatIconPreview(cat.iconPath);
    setCatIconFile(null);
    setCatError(null);
    setCatModalOpen(true);
  };

  const handleSaveCategory = async () => {
    const parsed = categoryInputSchema.safeParse({
      name: catName,
      slug: catSlug,
      description: catDesc || null,
      displayOrder: catOrder,
      isActive: true,
    });
    if (!parsed.success) {
      setCatError(parsed.error.errors[0]?.message ?? 'Invalid category fields');
      return;
    }

    const res = editingCat
      ? await adminApi.updateCategory(editingCat.id, parsed.data)
      : await adminApi.createCategory(parsed.data);

    setCatModalOpen(false);
    if (!res.ok) {
      setFeedback({
        type: res.awaitingBackend ? 'warning' : 'error',
        message: res.error ?? 'Unable to save category.',
      });
      return;
    }

    if (res.data?.category) {
      let savedCat = res.data.category;
      if (catIconFile) {
        const iconRes = await adminApi.uploadCategoryIcon(savedCat.id, catIconFile);
        if (iconRes.ok && iconRes.data?.filePath) {
          savedCat = { ...savedCat, iconPath: iconRes.data.filePath };
        }
      }
      if (editingCat) {
        setCategories((prev) =>
          prev.map((c) => (c.id === editingCat.id ? savedCat : c)),
        );
      } else {
        setCategories((prev) => [...prev, savedCat]);
      }
    }
  };

  const handleDeleteCategory = async () => {
    if (!deleteTarget) return;
    if ((deleteTarget.productCount ?? 0) > 0) {
      setDeleteTarget(null);
      setFeedback({
        type: 'error',
        message: `Cannot delete "${deleteTarget.name}" because ${deleteTarget.productCount} product(s) are currently assigned to this category.`,
      });
      return;
    }

    const res = await adminApi.deleteCategory(deleteTarget.id);
    setDeleteTarget(null);
    if (!res.ok) {
      setFeedback({
        type: res.awaitingBackend ? 'warning' : 'error',
        message: res.error ?? 'Unable to delete category.',
      });
      return;
    }
    setCategories((prev) => prev.filter((c) => c.id !== deleteTarget.id));
  };

  const handleCreateType = async () => {
    if (!typeName.trim() || !typeSlug.trim()) {
      setTypeError('Product type name and slug are required.');
      return;
    }
    const res = await adminApi.createProductType({
      name: typeName.trim(),
      slug: typeSlug.trim(),
      description: typeDesc.trim() || null,
      displayOrder: productTypes.length + 1,
      isActive: true,
    });
    setTypeModalOpen(false);
    if (!res.ok) {
      setFeedback({
        type: res.awaitingBackend ? 'warning' : 'error',
        message: res.error ?? 'Unable to create product type.',
      });
      return;
    }
    if (res.data?.productType) {
      setProductTypes((prev) => [...prev, res.data!.productType]);
    }
  };

  const filteredCategories = categories
    .filter((c) => c.name.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => a.displayOrder - b.displayOrder);

  return (
    <AdminLayout
      title="Categories & Product Types"
      subtitle="Dynamically manage solution categories and product types"
      actions={
        tab === 'categories' && canManageCategories ? (
          <Button size="sm" onClick={openNewCategory}>
            <Plus className="h-4 w-4" />
            Add Category
          </Button>
        ) : tab === 'types' && canManageTypes ? (
          <Button
            size="sm"
            onClick={() => {
              setTypeName('');
              setTypeSlug('');
              setTypeDesc('');
              setTypeError(null);
              setTypeModalOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Add Product Type
          </Button>
        ) : undefined
      }
    >
      <div className="space-y-5">
        <ApiStatusBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-1.5 rounded-xl border border-slate-200 bg-white p-1">
            <button
              type="button"
              onClick={() => setTab('categories')}
              className={`rounded-lg px-4 py-1.5 text-xs font-medium transition-colors ${
                tab === 'categories'
                  ? 'bg-[#EFF6FF] text-[#1D4ED8]'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Categories ({categories.length})
            </button>
            <button
              type="button"
              onClick={() => setTab('types')}
              className={`rounded-lg px-4 py-1.5 text-xs font-medium transition-colors ${
                tab === 'types'
                  ? 'bg-[#EFF6FF] text-[#1D4ED8]'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Product Types ({productTypes.length})
            </button>
          </div>

          {tab === 'categories' && (
            <div className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter categories..."
                className="h-9 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#2563EB] focus:outline-none"
              />
            </div>
          )}
        </div>

        {tab === 'categories' ? (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-5 py-3.5">Category</th>
                    <th className="px-4 py-3.5">Description</th>
                    <th className="px-4 py-3.5">Products</th>
                    <th className="px-4 py-3.5">Order</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCategories.map((cat, idx) => (
                    <tr key={cat.id} className="hover:bg-slate-50/70">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] text-[#1D4ED8]">
                            {cat.iconPath ? (
                              <img src={cat.iconPath} alt="" className="h-5 w-5 object-contain" />
                            ) : (
                              <FolderKanban className="h-4 w-4" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">{cat.name}</p>
                            <p className="text-xs text-slate-500">/{cat.slug}</p>
                          </div>
                        </div>
                      </td>
                      <td className="max-w-md px-4 py-4 text-xs text-slate-600">
                        {cat.description ?? '—'}
                      </td>
                      <td className="px-4 py-4">
                        <Badge variant="neutral">{cat.productCount ?? 0} products</Badge>
                      </td>
                      <td className="px-4 py-4 text-xs font-medium text-slate-700">
                        #{cat.displayOrder}
                      </td>
                      <td className="px-5 py-4 text-right">
                        {canManageCategories && (
                          <div className="inline-flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={idx === 0}
                              title="Move up"
                              onClick={() =>
                                void adminApi.updateCategory(cat.id, {
                                  displayOrder: Math.max(1, cat.displayOrder - 1),
                                }).then((res) => {
                                  if (!res.ok) {
                                    setFeedback({
                                      type: res.awaitingBackend ? 'warning' : 'error',
                                      message: res.error ?? 'Reorder failed.',
                                    });
                                  }
                                })
                              }
                            >
                              <ArrowUp className="h-4 w-4 text-slate-500" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={idx === filteredCategories.length - 1}
                              title="Move down"
                              onClick={() =>
                                void adminApi.updateCategory(cat.id, {
                                  displayOrder: cat.displayOrder + 1,
                                }).then((res) => {
                                  if (!res.ok) {
                                    setFeedback({
                                      type: res.awaitingBackend ? 'warning' : 'error',
                                      message: res.error ?? 'Reorder failed.',
                                    });
                                  }
                                })
                              }
                            >
                              <ArrowDown className="h-4 w-4 text-slate-500" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditCategory(cat)}
                              title="Edit category"
                            >
                              <Edit3 className="h-4 w-4 text-[#1D4ED8]" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteTarget(cat)}
                              title="Delete category"
                            >
                              <Trash2 className="h-4 w-4 text-rose-600" />
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {productTypes.map((t) => (
              <div
                key={t.id}
                className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold text-slate-900">{t.name}</h3>
                    <Badge variant="neutral">{t.productCount ?? 0} products</Badge>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">/{t.slug}</p>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
                  <span>Order #{t.displayOrder}</span>
                  <Badge variant={t.isActive ? 'success' : 'neutral'}>
                    {t.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add / Edit Category Modal */}
      <Dialog open={catModalOpen} onOpenChange={setCatModalOpen}>
        <DialogContent>
          <DialogTitle>{editingCat ? 'Edit Category' : 'Add Category'}</DialogTitle>
          <DialogDescription>
            Categories dynamically structure the public Sales Demo Portal catalogue.
          </DialogDescription>

          <div className="mt-4 space-y-4">
            {catError && (
              <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {catError}
              </p>
            )}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700">Category Name *</label>
              <Input
                value={catName}
                onChange={(e) => {
                  setCatName(e.target.value);
                  if (!editingCat) setCatSlug(slugify(e.target.value));
                }}
                placeholder="e.g. Cloud Security Solutions"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700">Slug *</label>
              <Input
                value={catSlug}
                onChange={(e) => setCatSlug(slugify(e.target.value))}
                placeholder="cloud-security-solutions"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700">Description</label>
              <Textarea
                value={catDesc}
                onChange={(e) => setCatDesc(e.target.value)}
                placeholder="Brief summary of solutions in this category..."
                className="min-h-[76px]"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700">Display Order</label>
                <Input
                  type="number"
                  min={0}
                  value={catOrder}
                  onChange={(e) => setCatOrder(Number(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700">Category Icon</label>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setCatIconFile(f);
                      setCatIconPreview(URL.createObjectURL(f));
                    }
                  }}
                  className="block w-full text-xs text-slate-600 file:mr-2 file:rounded-lg file:border-0 file:bg-[#EFF6FF] file:px-2.5 file:py-1.5 file:text-xs file:font-medium file:text-[#1D4ED8]"
                />
                {catIconPreview && (
                  <img src={catIconPreview} alt="Icon" className="h-8 w-8 rounded object-contain" />
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCatModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleSaveCategory()}>
              {editingCat ? 'Save Changes' : 'Create Category'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Product Type Modal */}
      <Dialog open={typeModalOpen} onOpenChange={setTypeModalOpen}>
        <DialogContent>
          <DialogTitle>Add Product Type</DialogTitle>
          <DialogDescription>
            Create a new software or solution classification for future products.
          </DialogDescription>
          <div className="mt-4 space-y-4">
            {typeError && (
              <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {typeError}
              </p>
            )}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700">Type Name *</label>
              <Input
                value={typeName}
                onChange={(e) => {
                  setTypeName(e.target.value);
                  setTypeSlug(slugify(e.target.value));
                }}
                placeholder="e.g. Edge Microservices"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700">Slug *</label>
              <Input
                value={typeSlug}
                onChange={(e) => setTypeSlug(slugify(e.target.value))}
                placeholder="edge-microservices"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700">Description</label>
              <Textarea
                value={typeDesc}
                onChange={(e) => setTypeDesc(e.target.value)}
                className="min-h-[72px]"
              />
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setTypeModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleCreateType()}>Create Type</Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Delete Category?"
        description={`Confirm deleting "${deleteTarget?.name}". Categories with assigned products cannot be deleted.`}
        confirmLabel="Delete"
        destructive
        onConfirm={() => void handleDeleteCategory()}
      />
    </AdminLayout>
  );
}
