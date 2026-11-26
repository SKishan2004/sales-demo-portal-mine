import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { MotionConfig } from 'motion/react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { LoginPage } from '@/pages/LoginPage';

const DashboardPage = lazy(() =>
  import('@/pages/DashboardPage').then((m) => ({ default: m.DashboardPage })),
);
const ProductsPage = lazy(() =>
  import('@/pages/ProductsPage').then((m) => ({ default: m.ProductsPage })),
);
const ProductEditorPage = lazy(() =>
  import('@/pages/ProductEditorPage').then((m) => ({ default: m.ProductEditorPage })),
);
const ProductPreviewPage = lazy(() =>
  import('@/pages/ProductPreviewPage').then((m) => ({ default: m.ProductPreviewPage })),
);
const CategoriesPage = lazy(() =>
  import('@/pages/CategoriesPage').then((m) => ({ default: m.CategoriesPage })),
);
const MediaLibraryPage = lazy(() =>
  import('@/pages/MediaLibraryPage').then((m) => ({ default: m.MediaLibraryPage })),
);
const AdministratorsPage = lazy(() =>
  import('@/pages/AdministratorsPage').then((m) => ({ default: m.AdministratorsPage })),
);
const ActivityLogsPage = lazy(() =>
  import('@/pages/ActivityLogsPage').then((m) => ({ default: m.ActivityLogsPage })),
);
const SettingsPage = lazy(() =>
  import('@/pages/SettingsPage').then((m) => ({ default: m.SettingsPage })),
);

function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] text-sm text-slate-500">
      Loading Admin CMS...
    </div>
  );
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { mode } = useAuth();
  if (mode === 'loading') {
    return <RouteFallback />;
  }
  if (mode === 'unauthenticated') {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

function PublicOnlyLogin() {
  const { mode } = useAuth();
  if (mode === 'authenticated' || mode === 'ui_preview') {
    return <Navigate to="/dashboard" replace />;
  }
  return <LoginPage />;
}

export function App() {
  return (
    <MotionConfig reducedMotion="user">
      <AuthProvider>
        <BrowserRouter basename="/sales-demo-admin">
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/login" element={<PublicOnlyLogin />} />
              <Route
                path="/"
                element={
                  <RequireAuth>
                    <Navigate to="/dashboard" replace />
                  </RequireAuth>
                }
              />
              <Route
                path="/dashboard"
                element={
                  <RequireAuth>
                    <DashboardPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/products"
                element={
                  <RequireAuth>
                    <ProductsPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/products/new"
                element={
                  <RequireAuth>
                    <ProductEditorPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/products/:id/edit"
                element={
                  <RequireAuth>
                    <ProductEditorPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/products/:id/preview"
                element={
                  <RequireAuth>
                    <ProductPreviewPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/categories"
                element={
                  <RequireAuth>
                    <CategoriesPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/media"
                element={
                  <RequireAuth>
                    <MediaLibraryPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/users"
                element={
                  <RequireAuth>
                    <AdministratorsPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/activity-logs"
                element={
                  <RequireAuth>
                    <ActivityLogsPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/settings"
                element={
                  <RequireAuth>
                    <SettingsPage />
                  </RequireAuth>
                }
              />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </MotionConfig>
  );
}

export default App;
