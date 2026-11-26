import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  BarChart3,
  BellRing,
  CheckCircle2,
  CheckSquare,
  ChevronRight,
  Columns3,
  Cpu,
  ExternalLink,
  FileText,
  GitCompare,
  History,
  Layers,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Star,
  Target,
} from 'lucide-react';
import type {
  ProductContentSectionDTO,
  ProductDetailDTO,
  ProductSummaryDTO,
} from '@mobileum/shared';
import { catalogueApi } from '@/api/catalogueApi';
import { ProductCard } from '@/components/home/ProductCard';
import { Footer } from '@/components/layout/Footer';
import { Navbar } from '@/components/layout/Navbar';
import { ScreenshotGallery } from '@/components/product/ScreenshotGallery';
import { VideoDemoSection } from '@/components/product/VideoDemoSection';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const FEATURE_ICONS: Record<string, typeof ShieldCheck> = {
  ShieldCheck,
  BadgeCheck,
  BellRing,
  SlidersHorizontal,
  GitCompare,
  CheckSquare,
  History,
  BarChart3,
  Target,
  Columns3,
  FileText,
  Sparkles,
  Cpu,
};

export function ProductDetailPage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState<ProductDetailDTO | null>(null);
  const [previous, setPrevious] = useState<ProductSummaryDTO | null>(null);
  const [next, setNext] = useState<ProductSummaryDTO | null>(null);
  const [related, setRelated] = useState<ProductSummaryDTO[]>([]);
  const [allProducts, setAllProducts] = useState<ProductSummaryDTO[]>([]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    let active = true;
    const loadProduct = async () => {
      setLoading(true);
      try {
        const [result, listResult] = await Promise.all([
          catalogueApi.getProductBySlug(slug),
          catalogueApi.getProducts({ page: 1, pageSize: 100 }),
        ]);
        if (!active) return;
        setProduct(result.product);
        setPrevious(result.previous);
        setNext(result.next);
        setRelated(result.related);
        setAllProducts(listResult.items);
      } catch {
        if (active) setProduct(null);
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadProduct();
    return () => {
      active = false;
    };
  }, [slug]);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col bg-[#F8FAFC] text-slate-900">
        <Navbar />
        <main className="mx-auto w-full max-w-6xl flex-1 space-y-8 px-5 py-14 sm:px-8">
          <div className="h-5 w-48 animate-pulse rounded bg-slate-200" />
          <div className="h-12 w-2/3 animate-pulse rounded-xl bg-slate-200" />
          <div className="aspect-video w-full animate-pulse rounded-2xl bg-slate-200" />
        </main>
        <Footer />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex min-h-screen flex-col bg-[#F8FAFC] text-slate-900">
        <Navbar />
        <main className="mx-auto flex max-w-xl flex-1 flex-col items-center justify-center px-6 py-24 text-center">
          <h1 className="text-3xl font-semibold text-slate-900">
            Product Showcase Not Found
          </h1>
          <p className="mt-3 text-sm text-slate-600">
            The requested product is unavailable or has not been published.
          </p>
          <Button asChild className="mt-7">
            <Link to="/products">
              <ArrowLeft className="h-4 w-4" />
              Back to Products
            </Link>
          </Button>
        </main>
        <Footer />
      </div>
    );
  }

  const orderedSections = [...product.sections]
    .filter((sec) => sec.isVisible)
    .sort((a, b) => a.displayOrder - b.displayOrder);

  const primaryImage =
    product.images.find((img) => img.isPrimary) ?? product.images[0] ?? null;

  const liveDemoLink = product.externalLinks.find(
    (link) => link.linkType === 'live_demo',
  );
  const otherLinks = product.externalLinks.filter(
    (link) => link.linkType !== 'live_demo',
  );

  const renderSection = (section: ProductContentSectionDTO): ReactNode => {
    switch (section.sectionType) {
      case 'overview': {
        const hasOverviewText = Boolean(
          product.overview || product.fullDescription,
        );
        const hasMeta = Boolean(
          product.industrySegments ||
            product.technologiesUsed ||
            product.targetCustomers,
        );
        if (!hasOverviewText && !hasMeta) return null;

        return (
          <SectionContainer key={section.id} title={section.title}>
            <div className="grid gap-6 lg:grid-cols-12">
              <div className="space-y-4 lg:col-span-8">
                {product.overview && (
                  <p className="text-base leading-relaxed text-slate-700">
                    {product.overview}
                  </p>
                )}
                {product.fullDescription && (
                  <p className="text-sm leading-relaxed text-slate-600">
                    {product.fullDescription}
                  </p>
                )}
              </div>

              {hasMeta && (
                <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-4">
                  {product.industrySegments && (
                    <MetaBlock
                      label="Industry Segments"
                      value={product.industrySegments}
                    />
                  )}
                  {product.technologiesUsed && (
                    <MetaBlock
                      label="Capabilities & Stack"
                      value={product.technologiesUsed}
                    />
                  )}
                  {product.targetCustomers && (
                    <MetaBlock
                      label="Target Teams"
                      value={product.targetCustomers}
                    />
                  )}
                </div>
              )}
            </div>
          </SectionContainer>
        );
      }

      case 'screenshots': {
        if (product.images.length === 0) return null;
        return (
          <SectionContainer key={section.id} title={section.title}>
            <ScreenshotGallery
              images={product.images}
              productName={product.name}
            />
          </SectionContainer>
        );
      }

      case 'problem_statement':
      case 'solution':
      case 'technical_capabilities':
      case 'business_benefits': {
        const hasChallengeSolution = Boolean(
          product.problemStatement || product.solution,
        );
        const hasTechBenefits = Boolean(
          product.technicalCapabilities || product.businessBenefits,
        );
        if (!hasChallengeSolution && !hasTechBenefits) return null;

        return (
          <SectionContainer key={section.id} title={section.title}>
            <div className="grid gap-5 md:grid-cols-2">
              {product.problemStatement && (
                <div className="rounded-2xl border border-slate-200 bg-white p-6">
                  <span className="text-xs font-semibold uppercase tracking-wider text-amber-700">
                    Problem Statement
                  </span>
                  <p className="mt-3 text-sm leading-relaxed text-slate-700">
                    {product.problemStatement}
                  </p>
                </div>
              )}
              {product.solution && (
                <div className="rounded-2xl border border-[#BFDBFE] bg-[#EFF6FF] p-6">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#1D4ED8]">
                    Mobileum Solution
                  </span>
                  <p className="mt-3 text-sm leading-relaxed text-slate-800">
                    {product.solution}
                  </p>
                </div>
              )}
              {product.technicalCapabilities && (
                <div className="rounded-2xl border border-slate-200 bg-white p-6">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Technical Capabilities
                  </span>
                  <p className="mt-3 text-sm leading-relaxed text-slate-700">
                    {product.technicalCapabilities}
                  </p>
                </div>
              )}
              {product.businessBenefits && (
                <div className="rounded-2xl border border-slate-200 bg-white p-6">
                  <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                    Business Benefits
                  </span>
                  <p className="mt-3 text-sm leading-relaxed text-slate-700">
                    {product.businessBenefits}
                  </p>
                </div>
              )}
            </div>
          </SectionContainer>
        );
      }

      case 'features': {
        if (product.features.length === 0) return null;
        return (
          <SectionContainer key={section.id} title={section.title}>
            <div className="grid gap-5 sm:grid-cols-2">
              {[...product.features]
                .sort((a, b) => a.displayOrder - b.displayOrder)
                .map((feature, idx) => {
                  const Icon =
                    (feature.iconName && FEATURE_ICONS[feature.iconName]) ||
                    CheckCircle2;
                  return (
                    <motion.div
                      key={feature.id}
                      initial={{ opacity: 0, y: 12 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, amount: 0.2 }}
                      transition={{ duration: 0.3, delay: idx * 0.04 }}
                      className="rounded-2xl border border-slate-200 bg-white p-6"
                    >
                      <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] text-[#1D4ED8]">
                        <Icon className="h-5 w-5" />
                      </div>
                      <h3 className="mt-4 text-base font-semibold text-slate-900">
                        {feature.title}
                      </h3>
                      {feature.description && (
                        <p className="mt-2 text-sm leading-relaxed text-slate-600">
                          {feature.description}
                        </p>
                      )}
                    </motion.div>
                  );
                })}
            </div>
          </SectionContainer>
        );
      }

      case 'videos': {
        if (product.videos.length === 0) return null;
        return (
          <SectionContainer key={section.id} title={section.title}>
            <VideoDemoSection videos={product.videos} />
          </SectionContainer>
        );
      }

      case 'use_cases': {
        if (product.useCases.length === 0) return null;
        return (
          <SectionContainer key={section.id} title={section.title}>
            <div className="grid gap-5 md:grid-cols-2">
              {[...product.useCases]
                .sort((a, b) => a.displayOrder - b.displayOrder)
                .map((uc) => (
                  <div
                    key={uc.id}
                    className="rounded-2xl border border-slate-200 bg-white p-6"
                  >
                    {uc.industrySegment && (
                      <Badge variant="neutral" className="mb-3">
                        {uc.industrySegment}
                      </Badge>
                    )}
                    <h3 className="text-base font-semibold text-slate-900">
                      {uc.title}
                    </h3>
                    {uc.description && (
                      <p className="mt-2 text-sm leading-relaxed text-slate-600">
                        {uc.description}
                      </p>
                    )}
                  </div>
                ))}
            </div>
          </SectionContainer>
        );
      }

      default:
        return null;
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#F8FAFC] text-slate-900">
      <Navbar />

      <main className="flex-1">
        {/* Product Hero */}
        <section className="border-b border-slate-200 bg-gradient-to-b from-[#EFF6FF] to-[#F8FAFC]">
          <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-12">
            {/* Breadcrumb, Quick Switcher & Back Links */}
            <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
              <nav
                aria-label="Breadcrumb"
                className="flex flex-wrap items-center gap-2 text-xs text-slate-500"
              >
                <Link to="/" className="hover:text-slate-900">
                  Home
                </Link>
                <ChevronRight className="h-3.5 w-3.5" />
                <Link to="/products" className="hover:text-slate-900">
                  Products
                </Link>
                <ChevronRight className="h-3.5 w-3.5" />
                <Link
                  to={`/products?category=${encodeURIComponent(product.categorySlug)}`}
                  className="hover:text-slate-900"
                >
                  {product.categoryName}
                </Link>
                <ChevronRight className="h-3.5 w-3.5" />
                <span className="font-medium text-[#1D4ED8]">{product.name}</span>
              </nav>

              <div className="flex flex-wrap items-center gap-2.5">
                {allProducts.length > 1 && (
                  <select
                    value={product.slug}
                    onChange={(e) => navigate(`/products/${e.target.value}`)}
                    aria-label="Switch product"
                    className="h-8 max-w-[230px] rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 focus:border-[#2563EB] focus:outline-none"
                  >
                    {allProducts.map((item) => (
                      <option key={item.id} value={item.slug}>
                        Switch: {item.name}
                      </option>
                    ))}
                  </select>
                )}

                <Button variant="outline" size="sm" asChild>
                  <Link to="/products">
                    <ArrowLeft className="h-3.5 w-3.5" />
                    All Products
                  </Link>
                </Button>
              </div>
            </div>

            <div className="grid items-center gap-10 lg:grid-cols-12">
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="space-y-5 lg:col-span-6"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    to={`/products?category=${encodeURIComponent(product.categorySlug)}`}
                  >
                    <Badge variant="default" className="hover:bg-[#DBEAFE]">
                      <Layers className="h-3.5 w-3.5" />
                      {product.categoryName}
                    </Badge>
                  </Link>
                  <Badge variant="neutral">{product.productTypeName}</Badge>
                  {product.featured && (
                    <Badge variant="success">
                      <Star className="h-3 w-3 fill-emerald-600" />
                      Featured
                    </Badge>
                  )}
                </div>

                <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl lg:text-5xl lg:leading-[1.12]">
                  {product.name}
                </h1>

                <p className="text-base leading-relaxed text-slate-600 sm:text-lg">
                  {product.shortDescription}
                </p>

                {product.features.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {product.features.slice(0, 3).map((f) => (
                      <span
                        key={f.id}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
                      >
                        {f.title}
                      </span>
                    ))}
                  </div>
                )}

                {(liveDemoLink || otherLinks.length > 0) && (
                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    {liveDemoLink && (
                      <Button asChild size="lg">
                        <a
                          href={liveDemoLink.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {liveDemoLink.label}
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                    {otherLinks.map((lnk) => (
                      <Button key={lnk.id} variant="outline" asChild>
                        <a
                          href={lnk.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {lnk.label}
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    ))}
                  </div>
                )}
              </motion.div>

              {primaryImage && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.06 }}
                  className="lg:col-span-6"
                >
                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-2">
                    <div className="aspect-video overflow-hidden rounded-xl bg-[#F4F8FF]">
                      <img
                        src={primaryImage.filePath}
                        alt={primaryImage.caption ?? product.name}
                        className="h-full w-full object-contain"
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        </section>

        {/* Dynamic Ordered Content Sections */}
        <div className="mx-auto max-w-7xl divide-y divide-slate-200 px-5 sm:px-8">
          {orderedSections.map(renderSection)}
        </div>

        {/* Previous / Next Product Navigation */}
        <section className="border-t border-slate-200 bg-white py-10">
          <div className="mx-auto grid max-w-7xl gap-4 px-5 sm:grid-cols-2 sm:px-8">
            {previous ? (
              <Link
                to={`/products/${previous.slug}`}
                className="group flex items-center justify-between rounded-2xl border border-slate-200 bg-[#F8FAFC] p-5 transition-colors hover:border-[#93C5FD] hover:bg-[#EFF6FF]"
              >
                <div className="min-w-0">
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
                    <ArrowLeft className="h-3.5 w-3.5 text-[#1D4ED8]" />
                    Previous Product
                  </span>
                  <p className="mt-1 truncate text-base font-semibold text-slate-900 group-hover:text-[#1D4ED8]">
                    {previous.name}
                  </p>
                </div>
              </Link>
            ) : (
              <div />
            )}

            {next ? (
              <Link
                to={`/products/${next.slug}`}
                className="group flex items-center justify-between rounded-2xl border border-slate-200 bg-[#F8FAFC] p-5 text-right transition-colors hover:border-[#93C5FD] hover:bg-[#EFF6FF] sm:justify-end"
              >
                <div className="min-w-0">
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
                    Next Product
                    <ArrowRight className="h-3.5 w-3.5 text-[#1D4ED8]" />
                  </span>
                  <p className="mt-1 truncate text-base font-semibold text-slate-900 group-hover:text-[#1D4ED8]">
                    {next.name}
                  </p>
                </div>
              </Link>
            ) : null}
          </div>
        </section>

        {/* Related Products */}
        {related.length > 0 && (
          <section className="border-t border-slate-200 py-14">
            <div className="mx-auto max-w-7xl px-5 sm:px-8">
              <div className="mb-8 flex items-end justify-between gap-4">
                <h2 className="text-2xl font-semibold text-slate-900">
                  Related Products
                </h2>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/products">View All Products</Link>
                </Button>
              </div>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {related.map((item, idx) => (
                  <ProductCard key={item.id} product={item} index={idx} />
                ))}
              </div>
            </div>
          </section>
        )}
      </main>

      <Footer />
    </div>
  );
}

function SectionContainer({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.12 }}
      transition={{ duration: 0.35 }}
      className="py-12 sm:py-14"
    >
      <h2 className="mb-6 text-2xl font-semibold tracking-tight text-slate-900">
        {title}
      </h2>
      {children}
    </motion.section>
  );
}

function MetaBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wider text-[#1D4ED8]">
        {label}
      </dt>
      <dd className="mt-1 text-sm leading-relaxed text-slate-700">{value}</dd>
    </div>
  );
}
