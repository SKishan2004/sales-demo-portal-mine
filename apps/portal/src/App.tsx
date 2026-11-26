import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { MotionConfig } from 'motion/react';
import { HomePage } from '@/pages/HomePage';

const FeaturedPage = lazy(() =>
  import('@/pages/FeaturedPage').then((m) => ({
    default: m.FeaturedPage,
  })),
);

const CategoriesPage = lazy(() =>
  import('@/pages/CategoriesPage').then((m) => ({
    default: m.CategoriesPage,
  })),
);

const ProductsPage = lazy(() =>
  import('@/pages/ProductsPage').then((m) => ({
    default: m.ProductsPage,
  })),
);

const ProductDetailPage = lazy(() =>
  import('@/pages/ProductDetailPage').then((m) => ({
    default: m.ProductDetailPage,
  })),
);

const NotFoundPage = lazy(() =>
  import('@/pages/NotFoundPage').then((m) => ({
    default: m.NotFoundPage,
  })),
);

function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] text-sm text-slate-500">
      Loading...
    </div>
  );
}

export function App() {
  return (
    <MotionConfig reducedMotion="user">
      <BrowserRouter basename="/sales-demo">
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/featured" element={<FeaturedPage />} />
            <Route path="/categories" element={<CategoriesPage />} />
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/products/:slug" element={<ProductDetailPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </MotionConfig>
  );
}

export default App;
