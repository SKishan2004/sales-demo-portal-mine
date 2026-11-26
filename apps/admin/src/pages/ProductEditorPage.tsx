import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CheckCircle2,
  Eye,
  Globe,
  Plus,
  Save,
  Trash2,
} from 'lucide-react';
import {
  EXTERNAL_LINK_TYPES,
  productInputSchema,
  type CategoryDTO,
  type ExternalLinkType,
  type ProductContentSectionDTO,
  type ProductExternalLinkDTO,
  type ProductFeatureDTO,
  type ProductImageDTO,
  type ProductTypeDTO,
  type ProductUseCaseDTO,
  type ProductVideoDTO,
} from '@mobileum/shared';
import { adminApi } from '@/api/adminApi';
import { ApiStatusBanner, type StatusFeedback } from '@/components/ApiStatusBanner';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { ScreenshotsTab, VideosTab } from '@/components/products/ProductMediaTabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/context/AuthContext';
import {
  PREVIEW_CATEGORIES,
  PREVIEW_PRODUCTS,
  PREVIEW_PRODUCT_TYPES,
} from '@/data/adminPreviewData';

type EditorTab =
  | 'basic'
  | 'overview'
  | 'screenshots'
  | 'videos'
  | 'features'
  | 'use_cases'
  | 'links'
  | 'publishing';

const TABS: Array<{ id: EditorTab; label: string }> = [
  { id: 'basic', label: 'Basic Info' },
  { id: 'overview', label: 'Product Overview' },
  { id: 'screenshots', label: 'Screenshots' },
  { id: 'videos', label: 'Demo Videos' },
  { id: 'features', label: 'Features' },
  { id: 'use_cases', label: 'Use Cases' },
  { id: 'links', label: 'External Links' },
  { id: 'publishing', label: 'Layout & Publishing' },
];

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const DEFAULT_SECTIONS: ProductContentSectionDTO[] = [
  { id: 'sec-1', sectionKey: 'overview', sectionType: 'overview', title: 'Product Overview', contentJson: {}, isVisible: true, displayOrder: 1 },
  { id: 'sec-2', sectionKey: 'screenshots', sectionType: 'screenshots', title: 'Screenshot Gallery', contentJson: {}, isVisible: true, displayOrder: 2 },
  { id: 'sec-3', sectionKey: 'problem_statement', sectionType: 'problem_statement', title: 'Problem & Solution', contentJson: {}, isVisible: true, displayOrder: 3 },
  { id: 'sec-4', sectionKey: 'features', sectionType: 'features', title: 'Key Features', contentJson: {}, isVisible: true, displayOrder: 4 },
  { id: 'sec-5', sectionKey: 'videos', sectionType: 'videos', title: 'Demonstration Videos', contentJson: {}, isVisible: true, displayOrder: 5 },
  { id: 'sec-6', sectionKey: 'use_cases', sectionType: 'use_cases', title: 'Use Cases', contentJson: {}, isVisible: true, displayOrder: 6 },
];

export function ProductEditorPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id;
  const navigate = useNavigate();
  const { mode, hasPermission } = useAuth();

  const canEdit = isNew ? hasPermission('products:create') : hasPermission('products:update');
  const canPublish = hasPermission('products:publish');
  const readOnly = !canEdit;

  const [activeTab, setActiveTab] = useState<EditorTab>('basic');
  const [categories, setCategories] = useState<CategoryDTO[]>([]);
  const [productTypes, setProductTypes] = useState<ProductTypeDTO[]>([]);
  const [feedback, setFeedback] = useState<StatusFeedback | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [confirmPublishOpen, setConfirmPublishOpen] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [categoryId, setCategoryId] = useState('');
  const [productTypeId, setProductTypeId] = useState('');
  const [shortDescription, setShortDescription] = useState('');
  const [fullDescription, setFullDescription] = useState('');
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [featured, setFeatured] = useState(false);
  const [displayOrder, setDisplayOrder] = useState(1);
  const [publicationStatus, setPublicationStatus] = useState<'draft' | 'published'>('draft');

  // Narrative
  const [overview, setOverview] = useState('');
  const [problemStatement, setProblemStatement] = useState('');
  const [solution, setSolution] = useState('');
  const [technicalCapabilities, setTechnicalCapabilities] = useState('');
  const [businessBenefits, setBusinessBenefits] = useState('');
  const [industrySegments, setIndustrySegments] = useState('');
  const [technologiesUsed, setTechnologiesUsed] = useState('');
  const [targetCustomers, setTargetCustomers] = useState('');

  // Dynamic collections
  const [images, setImages] = useState<ProductImageDTO[]>([]);
  const [videos, setVideos] = useState<ProductVideoDTO[]>([]);
  const [features, setFeatures] = useState<ProductFeatureDTO[]>([]);
  const [useCases, setUseCases] = useState<ProductUseCaseDTO[]>([]);
  const [externalLinks, setExternalLinks] = useState<ProductExternalLinkDTO[]>([]);
  const [sections, setSections] = useState<ProductContentSectionDTO[]>(DEFAULT_SECTIONS);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const [catRes, typeRes] = await Promise.all([
        adminApi.getCategories(),
        adminApi.getProductTypes(),
      ]);
      if (!active) return;

      const cats = catRes.ok && catRes.data ? catRes.data.items : mode === 'ui_preview' ? PREVIEW_CATEGORIES : [];
      const types = typeRes.ok && typeRes.data ? typeRes.data.items : mode === 'ui_preview' ? PREVIEW_PRODUCT_TYPES : [];
      setCategories(cats);
      setProductTypes(types);

      if (isNew) {
        if (cats[0]) setCategoryId(cats[0].id);
        if (types[0]) setProductTypeId(types[0].id);
        return;
      }

      const prodRes = await adminApi.getProduct(id!);
      if (!active) return;
      const loaded =
        prodRes.ok && prodRes.data
          ? prodRes.data.product
          : mode === 'ui_preview'
            ? PREVIEW_PRODUCTS.find((p) => p.id === id) ?? null
            : null;

      if (loaded) {
        setName(loaded.name);
        setSlug(loaded.slug);
        setSlugEdited(true);
        setCategoryId(loaded.categoryId);
        setProductTypeId(loaded.productTypeId);
        setShortDescription(loaded.shortDescription);
        setFullDescription(loaded.fullDescription ?? '');
        setThumbnailPreview(loaded.thumbnailPath);
        setLogoPreview(loaded.logoPath);
        setFeatured(loaded.featured);
        setDisplayOrder(loaded.displayOrder);
        setPublicationStatus(loaded.publicationStatus);
        setOverview(loaded.overview ?? '');
        setProblemStatement(loaded.problemStatement ?? '');
        setSolution(loaded.solution ?? '');
        setTechnicalCapabilities(loaded.technicalCapabilities ?? '');
        setBusinessBenefits(loaded.businessBenefits ?? '');
        setIndustrySegments(loaded.industrySegments ?? '');
        setTechnologiesUsed(loaded.technologiesUsed ?? '');
        setTargetCustomers(loaded.targetCustomers ?? '');
        setImages(loaded.images);
        setVideos(loaded.videos);
        setFeatures(loaded.features);
        setUseCases(loaded.useCases);
        setExternalLinks(loaded.externalLinks);
        setSections(loaded.sections.length > 0 ? loaded.sections : DEFAULT_SECTIONS);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [id, isNew, mode]);

  const handleNameChange = (nextName: string) => {
    setName(nextName);
    if (!slugEdited) {
      setSlug(slugify(nextName));
    }
  };

  const validateProductForm = () => {
    const parsed = productInputSchema.safeParse({
      name,
      slug,
      categoryId,
      productTypeId,
      shortDescription,
      fullDescription: fullDescription || null,
      overview: overview || null,
      problemStatement: problemStatement || null,
      solution: solution || null,
      technicalCapabilities: technicalCapabilities || null,
      businessBenefits: businessBenefits || null,
      industrySegments: industrySegments || null,
      technologiesUsed: technologiesUsed || null,
      targetCustomers: targetCustomers || null,
      featured,
      displayOrder,
      publicationStatus,
    });

    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors;
      const errs: Record<string, string> = {};
      for (const [key, msgs] of Object.entries(flat)) {
        if (msgs && msgs[0]) errs[key] = msgs[0];
      }
      setFieldErrors(errs);
      setActiveTab('basic');
      setFeedback({
        type: 'error',
        message: 'Please fix the highlighted validation fields before saving.',
      });
      return null;
    }

    setFieldErrors({});
    return parsed.data;
  };

  const buildPayload = () => {
    const validated = validateProductForm();
    if (!validated) return null;
    return {
      ...validated,
      features,
      useCases,
      externalLinks,
      sections,
      imagesOrder: images.map((img, i) => ({
        id: img.id,
        caption: img.caption ?? null,
        displayOrder: i + 1,
        isPrimary: img.isPrimary,
      })),
      videosOrder: videos.map((vid, i) => ({
        id: vid.id,
        title: vid.title,
        description: vid.description ?? null,
        displayOrder: i + 1,
      })),
    };
  };

  const handleSaveDraft = async () => {
    if (readOnly) return;
    const payload = buildPayload();
    if (!payload) return;

    setSaving(true);
    const res = isNew
      ? await adminApi.createProduct(payload)
      : await adminApi.updateProduct(id!, payload);
    setSaving(false);

    if (!res.ok) {
      setFeedback({
        type: res.awaitingBackend ? 'warning' : 'error',
        message:
          res.error ?? 'Unable to save product.',
      });
      return;
    }

    setFeedback({ type: 'info', message: 'Draft saved to backend database.' });
    if (isNew && res.data?.product?.id) {
      navigate(`/products/${res.data.product.id}/edit`, { replace: true });
    }
  };

  const handlePublishToggle = async () => {
    if (!canPublish || isNew) return;
    setConfirmPublishOpen(false);
    setSaving(true);
    const res =
      publicationStatus === 'published'
        ? await adminApi.unpublishProduct(id!)
        : await adminApi.publishProduct(id!);
    setSaving(false);

    if (!res.ok) {
      setFeedback({
        type: res.awaitingBackend ? 'warning' : 'error',
        message: res.error ?? 'Unable to change publication status.',
      });
      return;
    }
    setPublicationStatus((prev) => (prev === 'published' ? 'draft' : 'published'));
  };

  const handleImageUpload = async (files: FileList | File[]) => {
    if (isNew) {
      setFeedback({
        type: 'warning',
        message: 'Save the draft product first to obtain a product UUID before uploading media to persistent storage.',
      });
      return;
    }
    const formData = new FormData();
    Array.from(files).forEach((f) => formData.append('images', f));
    setUploadProgress(5);
    const res = await adminApi.uploadProductImage(id!, formData, (pct) =>
      setUploadProgress(pct),
    );
    setUploadProgress(null);

    if (!res.ok) {
      setFeedback({
        type: res.awaitingBackend ? 'warning' : 'error',
        message: res.error ?? 'Image upload failed.',
      });
      return;
    }

    if (res.data?.images) {
      setImages((prev) => [...prev, ...res.data!.images]);
      setFeedback({ type: 'info', message: 'Screenshots uploaded to persistent storage.' });
    }
  };

  const handleVideoUpload = async (
    file: File,
    meta: { title: string; description: string; thumbnailFile: File | null },
  ) => {
    if (isNew) {
      setFeedback({
        type: 'warning',
        message: 'Save the draft product first to obtain a product UUID before uploading videos.',
      });
      return;
    }
    const formData = new FormData();
    formData.append('video', file);
    formData.append('title', meta.title);
    formData.append('description', meta.description);
    if (meta.thumbnailFile) {
      formData.append('thumbnail', meta.thumbnailFile);
    }
    setUploadProgress(5);
    const res = await adminApi.uploadProductVideo(id!, formData, (pct) =>
      setUploadProgress(pct),
    );
    setUploadProgress(null);

    if (!res.ok) {
      setFeedback({
        type: res.awaitingBackend ? 'warning' : 'error',
        message: res.error ?? 'Video upload failed.',
      });
      return;
    }

    if (res.data?.video) {
      setVideos((prev) => [...prev, res.data!.video]);
      setFeedback({ type: 'info', message: 'Demonstration video uploaded to persistent storage.' });
    }
  };

  const moveSection = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= sections.length) return;
    const copy = [...sections];
    const [item] = copy.splice(idx, 1);
    if (!item) return;
    copy.splice(target, 0, item);
    setSections(copy.map((s, i) => ({ ...s, displayOrder: i + 1 })));
  };

  return (
    <AdminLayout
      title={isNew ? 'Add New Product' : name || 'Edit Product'}
      subtitle={
        readOnly
          ? 'Read-only product inspection'
          : 'Configure product narrative, media, features, use cases, and publishing'
      }
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/products">
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </Link>
          </Button>
          {!isNew && (
            <Button variant="secondary" size="sm" asChild>
              <Link to={`/products/${id}/preview`}>
                <Eye className="h-3.5 w-3.5" />
                Preview
              </Link>
            </Button>
          )}
          {!readOnly && (
            <Button
              type="button"
              size="sm"
              disabled={saving}
              onClick={() => void handleSaveDraft()}
            >
              <Save className="h-3.5 w-3.5" />
              Save Draft
            </Button>
          )}
          {canPublish && !isNew && (
            <Button
              type="button"
              size="sm"
              variant={publicationStatus === 'published' ? 'outline' : 'default'}
              disabled={saving}
              onClick={() => setConfirmPublishOpen(true)}
            >
              {publicationStatus === 'published' ? (
                <>
                  <Globe className="h-3.5 w-3.5 text-emerald-600" />
                  Unpublish
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Publish
                </>
              )}
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-5">
        <ApiStatusBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

        {/* Section Tabs */}
        <div className="flex flex-wrap gap-1.5 rounded-2xl border border-slate-200 bg-white p-2">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-xl px-3.5 py-2 text-xs font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE]'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-transparent'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Active Tab Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          {activeTab === 'basic' && (
            <div className="space-y-6">
              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-700">
                    Product Name *
                  </label>
                  <Input
                    value={name}
                    disabled={readOnly}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="e.g. Voice Policy Engine"
                  />
                  {fieldErrors.name && (
                    <p className="text-xs text-rose-600">{fieldErrors.name}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-700">
                    URL Slug *
                  </label>
                  <Input
                    value={slug}
                    disabled={readOnly}
                    onChange={(e) => {
                      setSlugEdited(true);
                      setSlug(slugify(e.target.value));
                    }}
                    placeholder="voice-policy-engine"
                  />
                  {fieldErrors.slug && (
                    <p className="text-xs text-rose-600">{fieldErrors.slug}</p>
                  )}
                </div>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-700">
                    Category *
                  </label>
                  <select
                    value={categoryId}
                    disabled={readOnly}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 focus:border-[#2563EB] focus:bg-white focus:outline-none"
                  >
                    <option value="">Select category...</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.categoryId && (
                    <p className="text-xs text-rose-600">{fieldErrors.categoryId}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-700">
                    Product Type *
                  </label>
                  <select
                    value={productTypeId}
                    disabled={readOnly}
                    onChange={(e) => setProductTypeId(e.target.value)}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 focus:border-[#2563EB] focus:bg-white focus:outline-none"
                  >
                    <option value="">Select product type...</option>
                    {productTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.productTypeId && (
                    <p className="text-xs text-rose-600">{fieldErrors.productTypeId}</p>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700">
                  Short Description *
                </label>
                <Textarea
                  value={shortDescription}
                  disabled={readOnly}
                  onChange={(e) => setShortDescription(e.target.value)}
                  placeholder="Concise summary shown on product cards and hero..."
                  className="min-h-[84px]"
                />
                {fieldErrors.shortDescription && (
                  <p className="text-xs text-rose-600">{fieldErrors.shortDescription}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700">
                  Full Description (Optional)
                </label>
                <Textarea
                  value={fullDescription}
                  disabled={readOnly}
                  onChange={(e) => setFullDescription(e.target.value)}
                  placeholder="Detailed narrative for the product detail page..."
                  className="min-h-[120px]"
                />
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                  <label className="text-xs font-medium text-slate-700">
                    Product Thumbnail
                  </label>
                  {thumbnailPreview && (
                    <div className="aspect-video overflow-hidden rounded-lg border border-slate-200 bg-white">
                      <img
                        src={thumbnailPreview}
                        alt="Thumbnail preview"
                        className="h-full w-full object-contain"
                      />
                    </div>
                  )}
                  {!readOnly && (
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        if (isNew) {
                          setFeedback({
                            type: 'warning',
                            message: 'Save the draft product first before uploading a thumbnail.',
                          });
                          return;
                        }
                        const res = await adminApi.uploadProductThumbnail(id!, f);
                        if (res.ok && res.data?.filePath) {
                          setThumbnailPreview(res.data.filePath);
                          setFeedback({ type: 'info', message: 'Thumbnail uploaded.' });
                        } else {
                          setFeedback({
                            type: res.awaitingBackend ? 'warning' : 'error',
                            message: res.error ?? 'Thumbnail upload failed.',
                          });
                        }
                      }}
                      className="block w-full text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-[#EFF6FF] file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-[#1D4ED8]"
                    />
                  )}
                </div>

                <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-slate-700">
                      Optional Product Logo
                    </label>
                    {logoPreview && (
                      <img
                        src={logoPreview}
                        alt="Product logo preview"
                        className="h-12 w-auto rounded border border-slate-200 bg-white p-1"
                      />
                    )}
                    {!readOnly && (
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) setLogoPreview(URL.createObjectURL(f));
                        }}
                        className="block w-full text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-[#EFF6FF] file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-[#1D4ED8]"
                      />
                    )}
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-200 pt-3">
                    <div>
                      <p className="text-xs font-medium text-slate-800">
                        Featured Showcase
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Highlight on the Featured Products page
                      </p>
                    </div>
                    <Switch
                      checked={featured}
                      disabled={readOnly}
                      onCheckedChange={setFeatured}
                    />
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-200 pt-3">
                    <label className="text-xs font-medium text-slate-800">
                      Display Order
                    </label>
                    <Input
                      type="number"
                      min={0}
                      disabled={readOnly}
                      value={displayOrder}
                      onChange={(e) => setDisplayOrder(Number(e.target.value) || 0)}
                      className="h-9 w-24 text-center"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'overview' && (
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-medium text-slate-700">Overview</label>
                <Textarea
                  value={overview}
                  disabled={readOnly}
                  onChange={(e) => setOverview(e.target.value)}
                  placeholder="Executive product overview..."
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700">Problem Statement</label>
                <Textarea
                  value={problemStatement}
                  disabled={readOnly}
                  onChange={(e) => setProblemStatement(e.target.value)}
                  placeholder="Customer or operator challenge..."
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700">Solution</label>
                <Textarea
                  value={solution}
                  disabled={readOnly}
                  onChange={(e) => setSolution(e.target.value)}
                  placeholder="How the Mobileum solution solves it..."
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700">Technical Capabilities</label>
                <Textarea
                  value={technicalCapabilities}
                  disabled={readOnly}
                  onChange={(e) => setTechnicalCapabilities(e.target.value)}
                  placeholder="Architecture, protocols, integrations..."
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700">Business Benefits</label>
                <Textarea
                  value={businessBenefits}
                  disabled={readOnly}
                  onChange={(e) => setBusinessBenefits(e.target.value)}
                  placeholder="Measurable business value..."
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700">Industry Segments</label>
                <Input
                  value={industrySegments}
                  disabled={readOnly}
                  onChange={(e) => setIndustrySegments(e.target.value)}
                  placeholder="e.g. MNOs, Wholesale Carriers"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700">Technologies Used</label>
                <Input
                  value={technologiesUsed}
                  disabled={readOnly}
                  onChange={(e) => setTechnologiesUsed(e.target.value)}
                  placeholder="e.g. Real-Time Analytics, SIP"
                />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-medium text-slate-700">Target Customers / Teams</label>
                <Input
                  value={targetCustomers}
                  disabled={readOnly}
                  onChange={(e) => setTargetCustomers(e.target.value)}
                  placeholder="e.g. Roaming Operations, Security Teams"
                />
              </div>
            </div>
          )}

          {activeTab === 'screenshots' && (
            <ScreenshotsTab
              productId={id ?? ''}
              images={images}
              readOnly={readOnly}
              onImagesChange={setImages}
              onUploadFiles={handleImageUpload}
              uploadProgress={uploadProgress}
              onValidationError={(msg) => setFeedback({ type: 'error', message: msg })}
            />
          )}

          {activeTab === 'videos' && (
            <VideosTab
              videos={videos}
              readOnly={readOnly}
              onVideosChange={setVideos}
              onUploadVideo={handleVideoUpload}
              uploadProgress={uploadProgress}
              onValidationError={(msg) => setFeedback({ type: 'error', message: msg })}
            />
          )}

          {activeTab === 'features' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-600">
                  Add key product features. Empty lists are hidden automatically on the public page.
                </p>
                {!readOnly && (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      setFeatures((prev) => [
                        ...prev,
                        {
                          id: `feat-${Date.now()}`,
                          title: '',
                          description: '',
                          iconName: 'ShieldCheck',
                          displayOrder: prev.length + 1,
                        },
                      ])
                    }
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Feature
                  </Button>
                )}
              </div>

              {features.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500">
                  No features added yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {features.map((feat, idx) => (
                    <div
                      key={feat.id}
                      className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 md:grid-cols-12"
                    >
                      <div className="md:col-span-4">
                        <Input
                          value={feat.title}
                          disabled={readOnly}
                          onChange={(e) =>
                            setFeatures((prev) =>
                              prev.map((item) =>
                                item.id === feat.id
                                  ? { ...item, title: e.target.value }
                                  : item,
                              ),
                            )
                          }
                          placeholder="Feature title"
                        />
                      </div>
                      <div className="md:col-span-5">
                        <Input
                          value={feat.description ?? ''}
                          disabled={readOnly}
                          onChange={(e) =>
                            setFeatures((prev) =>
                              prev.map((item) =>
                                item.id === feat.id
                                  ? { ...item, description: e.target.value }
                                  : item,
                              ),
                            )
                          }
                          placeholder="Feature description"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <Input
                          value={feat.iconName ?? ''}
                          disabled={readOnly}
                          onChange={(e) =>
                            setFeatures((prev) =>
                              prev.map((item) =>
                                item.id === feat.id
                                  ? { ...item, iconName: e.target.value }
                                  : item,
                              ),
                            )
                          }
                          placeholder="Icon (optional)"
                        />
                      </div>
                      <div className="flex items-center justify-end md:col-span-1">
                        {!readOnly && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              setFeatures((prev) =>
                                prev.filter((_, i) => i !== idx),
                              )
                            }
                          >
                            <Trash2 className="h-4 w-4 text-rose-600" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'use_cases' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-600">
                  Configure deployment use cases and industry segments.
                </p>
                {!readOnly && (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      setUseCases((prev) => [
                        ...prev,
                        {
                          id: `uc-${Date.now()}`,
                          title: '',
                          description: '',
                          industrySegment: '',
                          displayOrder: prev.length + 1,
                        },
                      ])
                    }
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Use Case
                  </Button>
                )}
              </div>

              {useCases.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500">
                  No use cases added yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {useCases.map((uc, idx) => (
                    <div
                      key={uc.id}
                      className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 md:grid-cols-12"
                    >
                      <div className="md:col-span-4">
                        <Input
                          value={uc.title}
                          disabled={readOnly}
                          onChange={(e) =>
                            setUseCases((prev) =>
                              prev.map((item) =>
                                item.id === uc.id
                                  ? { ...item, title: e.target.value }
                                  : item,
                              ),
                            )
                          }
                          placeholder="Use case title"
                        />
                      </div>
                      <div className="md:col-span-5">
                        <Input
                          value={uc.description ?? ''}
                          disabled={readOnly}
                          onChange={(e) =>
                            setUseCases((prev) =>
                              prev.map((item) =>
                                item.id === uc.id
                                  ? { ...item, description: e.target.value }
                                  : item,
                              ),
                            )
                          }
                          placeholder="Description"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <Input
                          value={uc.industrySegment ?? ''}
                          disabled={readOnly}
                          onChange={(e) =>
                            setUseCases((prev) =>
                              prev.map((item) =>
                                item.id === uc.id
                                  ? { ...item, industrySegment: e.target.value }
                                  : item,
                              ),
                            )
                          }
                          placeholder="Segment"
                        />
                      </div>
                      <div className="flex items-center justify-end md:col-span-1">
                        {!readOnly && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              setUseCases((prev) =>
                                prev.filter((_, i) => i !== idx),
                              )
                            }
                          >
                            <Trash2 className="h-4 w-4 text-rose-600" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'links' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-600">
                  Optional external URLs such as Live Demo, Documentation, or Website.
                </p>
                {!readOnly && (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      setExternalLinks((prev) => [
                        ...prev,
                        {
                          id: `lnk-${Date.now()}`,
                          linkType: 'live_demo',
                          label: 'Launch Live Demo',
                          url: 'https://',
                          displayOrder: prev.length + 1,
                        },
                      ])
                    }
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Link
                  </Button>
                )}
              </div>

              {externalLinks.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500">
                  No external links configured.
                </p>
              ) : (
                <div className="space-y-3">
                  {externalLinks.map((lnk, idx) => (
                    <div
                      key={lnk.id}
                      className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 md:grid-cols-12"
                    >
                      <div className="md:col-span-3">
                        <select
                          value={lnk.linkType}
                          disabled={readOnly}
                          onChange={(e) =>
                            setExternalLinks((prev) =>
                              prev.map((item) =>
                                item.id === lnk.id
                                  ? { ...item, linkType: e.target.value as ExternalLinkType }
                                  : item,
                              ),
                            )
                          }
                          className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-800"
                        >
                          {EXTERNAL_LINK_TYPES.map((lt) => (
                            <option key={lt} value={lt}>
                              {lt.replace('_', ' ')}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="md:col-span-3">
                        <Input
                          value={lnk.label}
                          disabled={readOnly}
                          onChange={(e) =>
                            setExternalLinks((prev) =>
                              prev.map((item) =>
                                item.id === lnk.id
                                  ? { ...item, label: e.target.value }
                                  : item,
                              ),
                            )
                          }
                          placeholder="Button label"
                        />
                      </div>
                      <div className="md:col-span-5">
                        <Input
                          value={lnk.url}
                          disabled={readOnly}
                          onChange={(e) =>
                            setExternalLinks((prev) =>
                              prev.map((item) =>
                                item.id === lnk.id
                                  ? { ...item, url: e.target.value }
                                  : item,
                              ),
                            )
                          }
                          placeholder="https://..."
                        />
                      </div>
                      <div className="flex items-center justify-end md:col-span-1">
                        {!readOnly && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              setExternalLinks((prev) =>
                                prev.filter((_, i) => i !== idx),
                              )
                            }
                          >
                            <Trash2 className="h-4 w-4 text-rose-600" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'publishing' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-[#F8FBFF] p-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Current Publication Status
                  </p>
                  <p className="text-xs text-slate-600">
                    Only published products appear in the public Sales Demo Portal.
                  </p>
                </div>
                <Badge
                  variant={publicationStatus === 'published' ? 'success' : 'warning'}
                >
                  {publicationStatus === 'published' ? 'Published' : 'Draft'}
                </Badge>
              </div>

              <div>
                <h4 className="mb-3 text-sm font-semibold text-slate-900">
                  Presentation Section Ordering
                </h4>
                <div className="space-y-2">
                  {sections.map((sec, idx) => (
                    <div
                      key={sec.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-semibold text-slate-400">
                          #{idx + 1}
                        </span>
                        <span className="text-sm font-medium text-slate-900">
                          {sec.title}
                        </span>
                        <Badge variant="neutral">{sec.sectionType}</Badge>
                      </div>

                      <div className="flex items-center gap-2">
                        <Switch
                          checked={sec.isVisible}
                          disabled={readOnly}
                          onCheckedChange={(checked) =>
                            setSections((prev) =>
                              prev.map((item) =>
                                item.id === sec.id
                                  ? { ...item, isVisible: checked }
                                  : item,
                              ),
                            )
                          }
                        />
                        {!readOnly && (
                          <>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={idx === 0}
                              onClick={() => moveSection(idx, -1)}
                            >
                              <ArrowUp className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={idx === sections.length - 1}
                              onClick={() => moveSection(idx, 1)}
                            >
                              <ArrowDown className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmPublishOpen}
        onOpenChange={setConfirmPublishOpen}
        title={
          publicationStatus === 'published'
            ? 'Unpublish Product?'
            : 'Publish Product to Sales Demo Portal?'
        }
        description={
          publicationStatus === 'published'
            ? 'This will remove the product from the public showcase while preserving all media and draft content.'
            : 'Once published, this product and its populated sections will appear immediately in the public Sales Demo Portal.'
        }
        confirmLabel={publicationStatus === 'published' ? 'Unpublish' : 'Publish'}
        onConfirm={() => void handlePublishToggle()}
      />
    </AdminLayout>
  );
}
