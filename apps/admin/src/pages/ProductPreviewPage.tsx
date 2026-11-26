import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Layers,
  Play,
  ShieldCheck,
  Star,
} from 'lucide-react';
import type { ProductDetailDTO } from '@mobileum/shared';
import { adminApi } from '@/api/adminApi';
import { ApiStatusBanner, type StatusFeedback } from '@/components/ApiStatusBanner';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/context/AuthContext';
import { PREVIEW_PRODUCTS } from '@/data/adminPreviewData';

export function ProductPreviewPage() {
  const { id = '' } = useParams<{ id: string }>();
  const { mode, hasPermission } = useAuth();
  const [product, setProduct] = useState<ProductDetailDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<StatusFeedback | null>(null);
  const [slideIndex, setSlideIndex] = useState(0);
  const [activeVideoUrl, setActiveVideoUrl] = useState<{
    title: string;
    url: string;
    poster?: string;
  } | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);

  const canPublish = hasPermission('products:publish');

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      await adminApi.authorizePreview(id);
      const res = await adminApi.getProduct(id);
      if (!active) return;
      if (res.ok && res.data?.product) {
        setProduct(res.data.product);
      } else if (mode === 'ui_preview') {
        setProduct(PREVIEW_PRODUCTS.find((p) => p.id === id) ?? null);
      }
      setLoading(false);
    };
    void load();
    return () => {
      active = false;
    };
  }, [id, mode]);

  const handlePublish = async () => {
    if (!product) return;
    setPublishOpen(false);
    const res = await adminApi.publishProduct(product.id);
    if (!res.ok) {
      setFeedback({
        type: res.awaitingBackend ? 'warning' : 'error',
        message: res.error ?? 'Unable to publish product.',
      });
      return;
    }
    setProduct({ ...product, publicationStatus: 'published' });
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] text-sm text-slate-500">
        Preparing secure preview...
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#F8FAFC] px-6 text-center">
        <h1 className="text-2xl font-semibold text-slate-900">
          Preview Unavailable
        </h1>
        <Button asChild className="mt-5">
          <Link to="/products">Back to Products</Link>
        </Button>
      </div>
    );
  }

  const orderedSections = [...product.sections]
    .filter((s) => s.isVisible)
    .sort((a, b) => a.displayOrder - b.displayOrder);
  const images = [...product.images].sort((a, b) => a.displayOrder - b.displayOrder);
  const currentImg = images[slideIndex] ?? null;

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
      {/* Top Preview Control Bar (not part of public page) */}
      <div className="sticky top-0 z-40 border-b border-amber-200 bg-amber-50/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-3 sm:px-8">
          <div className="flex items-center gap-3 text-xs text-amber-900">
            <Badge variant="warning">
              Admin Preview ({product.publicationStatus})
            </Badge>
            <span>
              Draft previews require authenticated admin authorization and are
              hidden from the public portal.
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to={`/products/${product.id}/edit`}>
                <ArrowLeft className="h-3.5 w-3.5" />
                Return to Editor
              </Link>
            </Button>
            {canPublish && product.publicationStatus !== 'published' && (
              <Button size="sm" onClick={() => setPublishOpen(true)}>
                <CheckCircle2 className="h-3.5 w-3.5" />
                Publish Now
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-5 pt-4 sm:px-8">
        <ApiStatusBanner feedback={feedback} onDismiss={() => setFeedback(null)} />
      </div>

      {/* Exact Light-Themed Public Presentation Layout */}
      <section className="border-b border-slate-200 bg-gradient-to-b from-[#EFF6FF] to-[#F8FAFC]">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-5 py-12 sm:px-8 lg:grid-cols-12">
          <div className="space-y-5 lg:col-span-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="default">
                <Layers className="h-3.5 w-3.5" />
                {product.categoryName}
              </Badge>
              <Badge variant="neutral">{product.productTypeName}</Badge>
              {product.featured && (
                <Badge variant="success">
                  <Star className="h-3 w-3 fill-emerald-600" />
                  Featured
                </Badge>
              )}
            </div>

            <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
              {product.name}
            </h1>
            <p className="text-base leading-relaxed text-slate-600">
              {product.shortDescription}
            </p>

            {product.externalLinks.length > 0 && (
              <div className="flex flex-wrap gap-3 pt-1">
                {product.externalLinks.map((lnk) => (
                  <Button key={lnk.id} variant="outline" asChild>
                    <a href={lnk.url} target="_blank" rel="noopener noreferrer">
                      {lnk.label}
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                ))}
              </div>
            )}
          </div>

          {currentImg && (
            <div className="lg:col-span-6">
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-2">
                <div className="aspect-video overflow-hidden rounded-xl bg-[#F4F8FF]">
                  <img
                    src={currentImg.filePath}
                    alt={currentImg.caption ?? product.name}
                    className="h-full w-full object-contain"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      <div className="mx-auto max-w-7xl divide-y divide-slate-200 px-5 sm:px-8">
        {orderedSections.map((sec) => {
          if (sec.sectionType === 'overview' && (product.overview || product.fullDescription)) {
            return (
              <section key={sec.id} className="py-12">
                <h2 className="mb-4 text-2xl font-semibold text-slate-900">{sec.title}</h2>
                <p className="max-w-4xl text-base leading-relaxed text-slate-700">
                  {product.overview ?? product.fullDescription}
                </p>
              </section>
            );
          }
          if (sec.sectionType === 'screenshots' && images.length > 0) {
            return (
              <section key={sec.id} className="py-12">
                <h2 className="mb-6 text-2xl font-semibold text-slate-900">{sec.title}</h2>
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  <div className="relative aspect-video bg-[#F4F8FF]">
                    <img
                      src={currentImg?.filePath}
                      alt={currentImg?.caption ?? product.name}
                      className="h-full w-full object-contain"
                    />
                    {images.length > 1 && (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            setSlideIndex((p) => (p - 1 + images.length) % images.length)
                          }
                          className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full border border-slate-200 bg-white p-2"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setSlideIndex((p) => (p + 1) % images.length)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-slate-200 bg-white p-2"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </section>
            );
          }
          if (sec.sectionType === 'problem_statement' && (product.problemStatement || product.solution)) {
            return (
              <section key={sec.id} className="py-12">
                <h2 className="mb-6 text-2xl font-semibold text-slate-900">{sec.title}</h2>
                <div className="grid gap-5 md:grid-cols-2">
                  {product.problemStatement && (
                    <div className="rounded-2xl border border-slate-200 bg-white p-6">
                      <span className="text-xs font-semibold uppercase text-amber-700">Problem Statement</span>
                      <p className="mt-2 text-sm text-slate-700">{product.problemStatement}</p>
                    </div>
                  )}
                  {product.solution && (
                    <div className="rounded-2xl border border-[#BFDBFE] bg-[#EFF6FF] p-6">
                      <span className="text-xs font-semibold uppercase text-[#1D4ED8]">Mobileum Solution</span>
                      <p className="mt-2 text-sm text-slate-800">{product.solution}</p>
                    </div>
                  )}
                </div>
              </section>
            );
          }
          if (sec.sectionType === 'features' && product.features.length > 0) {
            return (
              <section key={sec.id} className="py-12">
                <h2 className="mb-6 text-2xl font-semibold text-slate-900">{sec.title}</h2>
                <div className="grid gap-5 sm:grid-cols-2">
                  {product.features.map((f) => (
                    <div key={f.id} className="rounded-2xl border border-slate-200 bg-white p-6">
                      <ShieldCheck className="h-5 w-5 text-[#1D4ED8]" />
                      <h3 className="mt-3 text-base font-semibold text-slate-900">{f.title}</h3>
                      {f.description && <p className="mt-1.5 text-sm text-slate-600">{f.description}</p>}
                    </div>
                  ))}
                </div>
              </section>
            );
          }
          if (sec.sectionType === 'videos' && product.videos.length > 0) {
            return (
              <section key={sec.id} className="py-12">
                <h2 className="mb-6 text-2xl font-semibold text-slate-900">{sec.title}</h2>
                <div className="grid gap-5 md:grid-cols-2">
                  {product.videos.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() =>
                        setActiveVideoUrl({
                          title: v.title,
                          url: v.filePath,
                          poster: v.thumbnailPath ?? undefined,
                        })
                      }
                      className="overflow-hidden rounded-2xl border border-slate-200 bg-white text-left hover:border-[#93C5FD]"
                    >
                      <div className="relative aspect-video bg-[#F4F8FF]">
                        {v.thumbnailPath && (
                          <img src={v.thumbnailPath} alt={v.title} className="h-full w-full object-contain" />
                        )}
                        <span className="absolute inset-0 m-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#1D4ED8] text-white">
                          <Play className="ml-0.5 h-5 w-5 fill-white" />
                        </span>
                      </div>
                      <div className="p-4">
                        <p className="font-semibold text-slate-900">{v.title}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            );
          }
          if (sec.sectionType === 'use_cases' && product.useCases.length > 0) {
            return (
              <section key={sec.id} className="py-12">
                <h2 className="mb-6 text-2xl font-semibold text-slate-900">{sec.title}</h2>
                <div className="grid gap-5 md:grid-cols-2">
                  {product.useCases.map((uc) => (
                    <div key={uc.id} className="rounded-2xl border border-slate-200 bg-white p-6">
                      {uc.industrySegment && <Badge variant="neutral" className="mb-2">{uc.industrySegment}</Badge>}
                      <h3 className="text-base font-semibold text-slate-900">{uc.title}</h3>
                      {uc.description && <p className="mt-1.5 text-sm text-slate-600">{uc.description}</p>}
                    </div>
                  ))}
                </div>
              </section>
            );
          }
          return null;
        })}
      </div>

      <Dialog open={Boolean(activeVideoUrl)} onOpenChange={(o) => !o && setActiveVideoUrl(null)}>
        <DialogContent className="max-w-3xl">
          <DialogTitle>{activeVideoUrl?.title}</DialogTitle>
          <DialogDescription>Preview demonstration video playback</DialogDescription>
          {activeVideoUrl && (
            <video
              src={activeVideoUrl.url}
              poster={activeVideoUrl.poster}
              controls
              className="mt-4 aspect-video w-full rounded-xl bg-black"
            />
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={publishOpen}
        onOpenChange={setPublishOpen}
        title="Publish Product?"
        description={`Publish "${product.name}" to make it visible on the public Sales Demo Portal?`}
        confirmLabel="Publish Now"
        onConfirm={() => void handlePublish()}
      />
    </div>
  );
}
