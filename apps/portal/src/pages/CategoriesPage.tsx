import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  FolderKanban,
  Grid2X2,
} from 'lucide-react';
import type { CategoryDTO } from '@mobileum/shared';
import { catalogueApi } from '@/api/catalogueApi';
import { Footer } from '@/components/layout/Footer';
import { Navbar } from '@/components/layout/Navbar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export function CategoriesPage() {
  const [categories, setCategories] = useState<CategoryDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    window.scrollTo({ top: 0 });
    let active = true;
    const loadData = async () => {
      try {
        setApiError(null);
        const cats = await catalogueApi.getCategories();
        if (!active) return;
        setCategories(cats);
      } catch (err) {
        if (active) {
          setApiError(err instanceof Error ? err.message : 'Unable to load categories');
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadData();
    return () => {
      active = false;
    };
  }, []);

  const countForCategory = (cat: CategoryDTO) => cat.productCount ?? 0;

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
                <span className="font-medium text-[#1D4ED8]">Categories</span>
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
              <Grid2X2 className="h-3.5 w-3.5" />
              Categories
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
              Solution Categories
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
              Choose a category to filter and explore Mobileum products within
              that solution area.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-12 sm:px-8">
          {loading ? (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, idx) => (
                <div
                  key={idx}
                  className="h-48 animate-pulse rounded-2xl border border-slate-200 bg-white"
                />
              ))}
            </div>
          ) : apiError ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-6 py-12 text-center">
              <h2 className="text-base font-semibold text-amber-900">
                Categories unavailable
              </h2>
              <p className="mt-2 text-sm text-amber-800">{apiError}</p>
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {categories.map((category, idx) => {
                const count = countForCategory(category);
                return (
                  <motion.div
                    key={category.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: idx * 0.04 }}
                  >
                    <Link
                      to={`/products?category=${encodeURIComponent(category.slug)}`}
                      className="group flex h-full flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 transition-colors duration-200 hover:border-[#93C5FD] hover:bg-[#F8FBFF] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-3">
                          <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] text-[#1D4ED8]">
                            <FolderKanban className="h-5 w-5" />
                          </div>
                          <Badge variant="neutral">
                            {count} {count === 1 ? 'Product' : 'Products'}
                          </Badge>
                        </div>

                        <h2 className="mt-4 text-lg font-semibold text-slate-900 transition-colors group-hover:text-[#1D4ED8]">
                          {category.name}
                        </h2>
                        {category.description && (
                          <p className="mt-2 text-sm leading-relaxed text-slate-600">
                            {category.description}
                          </p>
                        )}
                      </div>

                      <div className="mt-6 inline-flex items-center gap-1.5 border-t border-slate-100 pt-4 text-xs font-semibold text-[#1D4ED8]">
                        <span>View Category Products</span>
                        <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}
