import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  ArrowDownUp,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Filter,
  LayoutGrid,
  RotateCcw,
  Search,
  Star,
} from 'lucide-react';
import type {
  CategoryDTO,
  ProductSummaryDTO,
  ProductTypeDTO,
} from '@mobileum/shared';
import {
  catalogueApi,
  type ProductSortOption,
} from '@/api/catalogueApi';
import { ProductCard, ProductCardSkeleton } from '@/components/home/ProductCard';
import { Footer } from '@/components/layout/Footer';
import { Navbar } from '@/components/layout/Navbar';
import { Button } from '@/components/ui/button';

export function ProductsPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const search = searchParams.get('search') ?? '';
  const selectedCategory = searchParams.get('category') ?? 'all';
  const selectedType = searchParams.get('type') ?? 'all';
  const featuredOnly = searchParams.get('featured') === 'true';
  const sort = (searchParams.get('sort') as ProductSortOption) || 'display_order';
  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);

  const [categories, setCategories] = useState<CategoryDTO[]>([]);
  const [productTypes, setProductTypes] = useState<ProductTypeDTO[]>([]);
  const [products, setProducts] = useState<ProductSummaryDTO[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [page]);

  useEffect(() => {
    let active = true;
    const loadRef = async () => {
      try {
        const [cats, types] = await Promise.all([
          catalogueApi.getCategories(),
          catalogueApi.getProductTypes(),
        ]);
        if (!active) return;
        setCategories(cats);
        setProductTypes(types);
      } catch {
        // Handled by product fetch error banner
      }
    };
    void loadRef();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const loadProducts = async () => {
      setLoading(true);
      setApiError(null);
      try {
        const result = await catalogueApi.getProducts({
          search,
          categorySlug: selectedCategory,
          productTypeSlug: selectedType,
          featuredOnly,
          sort,
          page,
          pageSize: 6,
        });
        if (!active) return;
        setProducts(result.items);
        setTotal(result.total);
        setTotalPages(result.totalPages);
      } catch (err) {
        if (active) {
          setApiError(err instanceof Error ? err.message : 'Unable to load products');
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadProducts();
    return () => {
      active = false;
    };
  }, [search, selectedCategory, selectedType, featuredOnly, sort, page]);

  const updateParams = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams);
    for (const [k, v] of Object.entries(updates)) {
      if (!v || v === 'all' || v === 'false') {
        next.delete(k);
      } else {
        next.set(k, v);
      }
    }
    setSearchParams(next, { replace: true });
  };

  const resetFilters = () => {
    setSearchParams({}, { replace: true });
  };

  const hasActiveFilters =
    Boolean(search.trim()) ||
    selectedCategory !== 'all' ||
    selectedType !== 'all' ||
    featuredOnly;

  const activeCategoryName =
    selectedCategory === 'all'
      ? null
      : categories.find((c) => c.slug === selectedCategory)?.name ?? null;

  return (
    <div className="flex min-h-screen flex-col bg-[#F8FAFC] text-slate-900">
      <Navbar />

      <main className="flex-1">
        {/* Page Header */}
        <section className="border-b border-slate-200 bg-gradient-to-b from-[#EFF6FF] to-[#F8FAFC]">
          <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-12">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <nav
                aria-label="Breadcrumb"
                className="flex items-center gap-2 text-xs text-slate-500"
              >
                <Link to="/" className="hover:text-slate-900">
                  Home
                </Link>
                <ChevronRight className="h-3.5 w-3.5" />
                <Link to="/products" className="hover:text-slate-900">
                  Products
                </Link>
                {activeCategoryName && (
                  <>
                    <ChevronRight className="h-3.5 w-3.5" />
                    <span className="font-medium text-[#1D4ED8]">
                      {activeCategoryName}
                    </span>
                  </>
                )}
              </nav>

              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" asChild>
                  <Link to="/">
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Home
                  </Link>
                </Button>
                <Button variant="secondary" size="sm" asChild>
                  <Link to="/categories">Categories</Link>
                </Button>
              </div>
            </div>

            <div className="mt-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#1D4ED8]">
                  <LayoutGrid className="h-3.5 w-3.5" />
                  Product Catalogue
                </div>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
                  {activeCategoryName ?? 'All Products'}
                </h1>
              </div>

              <p className="text-sm text-slate-600">
                Showing <span className="font-semibold text-slate-900">{total}</span>{' '}
                {total === 1 ? 'product' : 'products'}
              </p>
            </div>
          </div>
        </section>

        {/* Filters & Grid */}
        <section className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
          {/* Category Filter Pills */}
          <div
            role="tablist"
            aria-label="Filter products by category"
            className="flex flex-wrap gap-2"
          >
            <CategoryPill
              label="All Categories"
              active={selectedCategory === 'all'}
              onClick={() => updateParams({ category: null, page: null })}
            />
            {categories.map((category) => (
              <CategoryPill
                key={category.id}
                label={category.name}
                active={selectedCategory === category.slug}
                onClick={() =>
                  updateParams({ category: category.slug, page: null })
                }
              />
            ))}
          </div>

          {/* Search, Type, Featured & Sort Toolbar */}
          <div className="mt-6 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 lg:grid-cols-12">
            <div className="relative lg:col-span-5">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(e) =>
                  updateParams({ search: e.target.value, page: null })
                }
                placeholder="Search by product name, description, or category..."
                aria-label="Search products"
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#2563EB] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
              />
            </div>

            <div className="relative lg:col-span-3">
              <Filter className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <select
                value={selectedType}
                onChange={(e) =>
                  updateParams({ type: e.target.value, page: null })
                }
                aria-label="Filter by product type"
                className="h-10 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-8 text-sm text-slate-900 focus:border-[#2563EB] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
              >
                <option value="all">All Product Types</option>
                {productTypes.map((type) => (
                  <option key={type.id} value={type.slug}>
                    {type.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative lg:col-span-2">
              <ArrowDownUp className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <select
                value={sort}
                onChange={(e) =>
                  updateParams({
                    sort:
                      e.target.value === 'display_order'
                        ? null
                        : e.target.value,
                    page: null,
                  })
                }
                aria-label="Sort products"
                className="h-10 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-6 text-sm text-slate-900 focus:border-[#2563EB] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
              >
                <option value="display_order">Default Order</option>
                <option value="recent">Recently Added</option>
                <option value="alpha">Alphabetical (A–Z)</option>
              </select>
            </div>

            <div className="flex items-center gap-2 lg:col-span-2">
              <button
                type="button"
                onClick={() =>
                  updateParams({
                    featured: featuredOnly ? null : 'true',
                    page: null,
                  })
                }
                aria-pressed={featuredOnly}
                className={`inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 text-xs font-medium transition-colors ${
                  featuredOnly
                    ? 'border-[#93C5FD] bg-[#EFF6FF] text-[#1D4ED8]'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Star
                  className={`h-3.5 w-3.5 ${featuredOnly ? 'fill-[#1D4ED8]' : ''}`}
                />
                Featured
              </button>

              {hasActiveFilters && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={resetFilters}
                  title="Reset filters"
                  aria-label="Reset all filters"
                  className="h-10 w-10 shrink-0 rounded-xl"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Grid */}
          <div className="mt-8">
            {loading ? (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <ProductCardSkeleton key={i} />
                ))}
              </div>
            ) : apiError ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-6 py-12 text-center">
                <h2 className="text-base font-semibold text-amber-900">
                  Product catalogue unavailable
                </h2>
                <p className="mt-2 text-sm text-amber-800">{apiError}</p>
              </div>
            ) : products.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
                <Search className="h-8 w-8 text-slate-400" />
                <h2 className="mt-4 text-lg font-semibold text-slate-900">
                  No matching products found
                </h2>
                <p className="mt-2 max-w-md text-sm text-slate-600">
                  Try adjusting your search keywords, category, or product type
                  filters.
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={resetFilters}
                  className="mt-6"
                >
                  <RotateCcw className="h-4 w-4" />
                  Clear Filters
                </Button>
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {products.map((product, index) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    index={index}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <nav
              aria-label="Catalogue pagination"
              className="mt-10 flex items-center justify-center gap-2"
            >
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() =>
                  updateParams({
                    page: page - 1 <= 1 ? null : String(page - 1),
                  })
                }
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>

              {Array.from({ length: totalPages }).map((_, idx) => {
                const pageNumber = idx + 1;
                return (
                  <Button
                    key={pageNumber}
                    type="button"
                    size="sm"
                    variant={pageNumber === page ? 'default' : 'outline'}
                    onClick={() =>
                      updateParams({
                        page: pageNumber === 1 ? null : String(pageNumber),
                      })
                    }
                    className="min-w-9"
                  >
                    {pageNumber}
                  </Button>
                );
              })}

              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => updateParams({ page: String(page + 1) })}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </nav>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}

function CategoryPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`relative rounded-full px-4 py-2 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] ${
        active ? 'text-[#1D4ED8]' : 'text-slate-600 hover:text-slate-900'
      }`}
    >
      {active && (
        <motion.span
          layoutId="products-category-pill"
          transition={{ type: 'spring', stiffness: 400, damping: 32 }}
          className="absolute inset-0 rounded-full border border-[#93C5FD] bg-[#EFF6FF]"
        />
      )}
      {!active && (
        <span className="absolute inset-0 rounded-full border border-slate-200 bg-white" />
      )}
      <span className="relative z-10">{label}</span>
    </button>
  );
}
