import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ChevronRight, Star } from 'lucide-react';
import type { ProductSummaryDTO } from '@mobileum/shared';
import { catalogueApi } from '@/api/catalogueApi';
import { ProductCard, ProductCardSkeleton } from '@/components/home/ProductCard';
import { Footer } from '@/components/layout/Footer';
import { Navbar } from '@/components/layout/Navbar';
import { Button } from '@/components/ui/button';

export function FeaturedPage() {
  const [products, setProducts] = useState<ProductSummaryDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    window.scrollTo({ top: 0 });
    let active = true;
    const loadFeatured = async () => {
      try {
        setApiError(null);
        const data = await catalogueApi.getFeaturedProducts();
        if (active) setProducts(data);
      } catch (err) {
        if (active) {
          setApiError(err instanceof Error ? err.message : 'Unable to load featured products');
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadFeatured();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-[#F8FAFC] text-slate-900">
      <Navbar />

      <main className="flex-1">
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
                <span className="font-medium text-[#1D4ED8]">
                  Featured Products
                </span>
              </nav>

              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" asChild>
                  <Link to="/">
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Home
                  </Link>
                </Button>
                <Button variant="secondary" size="sm" asChild>
                  <Link to="/products">
                    All Products
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
            </div>

            <div className="mt-6 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#1D4ED8]">
              <Star className="h-3.5 w-3.5 fill-[#1D4ED8]" />
              Featured
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
              Featured Products
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
              Select a highlighted solution to open its full product overview,
              screenshots, use cases, and video demonstrations.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-12 sm:px-8">
          {loading ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <ProductCardSkeleton />
              <ProductCardSkeleton />
              <ProductCardSkeleton />
            </div>
          ) : apiError ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-6 py-12 text-center">
              <h2 className="text-base font-semibold text-amber-900">
                Catalogue service unavailable
              </h2>
              <p className="mt-2 text-sm text-amber-800">{apiError}</p>
            </div>
          ) : products.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
              <h2 className="text-lg font-semibold text-slate-900">
                No featured products configured yet
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                Browse the complete catalogue to explore all published Mobileum
                products.
              </p>
              <Button asChild className="mt-6">
                <Link to="/products">Browse All Products</Link>
              </Button>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {products.map((product, idx) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  index={idx}
                  variant="featured"
                />
              ))}
            </div>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}
