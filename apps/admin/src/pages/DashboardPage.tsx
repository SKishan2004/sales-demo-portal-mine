import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  FileEdit,
  FolderKanban,
  Images,
  Package,
  Plus,
  Users,
  Video,
} from 'lucide-react';
import type { DashboardSummaryDTO } from '@mobileum/shared';
import { adminApi } from '@/api/adminApi';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useAuth } from '@/context/AuthContext';
import { derivePreviewDashboard } from '@/data/adminPreviewData';

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function DashboardPage() {
  const { mode, hasPermission } = useAuth();
  const [summary, setSummary] = useState<DashboardSummaryDTO | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const loadDashboard = async () => {
      setLoading(true);
      const res = await adminApi.getDashboard();
      if (!active) return;
      if (res.ok && res.data) {
        setSummary(res.data);
      } else if (mode === 'ui_preview') {
        setSummary(derivePreviewDashboard());
      }
      setLoading(false);
    };
    void loadDashboard();
    return () => {
      active = false;
    };
  }, [mode]);

  const metrics = summary?.metrics;

  const statCards = [
    { label: 'Total Products', value: metrics?.totalProducts ?? 0, icon: Package, tone: 'blue' },
    { label: 'Published Products', value: metrics?.publishedProducts ?? 0, icon: CheckCircle2, tone: 'emerald' },
    { label: 'Draft Products', value: metrics?.draftProducts ?? 0, icon: FileEdit, tone: 'amber' },
    { label: 'Total Categories', value: metrics?.totalCategories ?? 0, icon: FolderKanban, tone: 'blue' },
    { label: 'Total Videos', value: metrics?.totalVideos ?? 0, icon: Video, tone: 'blue' },
    { label: 'Total Screenshots', value: metrics?.totalScreenshots ?? 0, icon: Images, tone: 'blue' },
    { label: 'Total Administrators', value: metrics?.totalAdministrators ?? 0, icon: Users, tone: 'slate' },
  ];

  const publishedPct =
    metrics && metrics.totalProducts > 0
      ? Math.round((metrics.publishedProducts / metrics.totalProducts) * 100)
      : 0;
  const maxCategoryCount = Math.max(
    1,
    ...(summary?.categoryBreakdown.map((c) => c.productCount) ?? [1]),
  );

  return (
    <AdminLayout
      title="Dashboard"
      subtitle="Portfolio metrics, publishing status, and recent administrative activity"
      actions={
        hasPermission('products:create') ? (
          <Button asChild size="sm">
            <Link to="/products/new">
              <Plus className="h-4 w-4" />
              Add Product
            </Link>
          </Button>
        ) : undefined
      }
    >
      <div className="space-y-6">
        {/* Summary Metric Cards */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {statCards.map((stat, idx) => {
            const Icon = stat.icon;
            return (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: idx * 0.03 }}
                className="rounded-2xl border border-slate-200 bg-white p-4"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500">
                    {stat.label}
                  </span>
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] text-[#1D4ED8]">
                    <Icon className="h-4 w-4" />
                  </span>
                </div>
                <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
                  {loading ? '—' : stat.value}
                </p>
              </motion.div>
            );
          })}
        </section>

        {/* Charts & Quick Actions Row */}
        <section className="grid gap-6 lg:grid-cols-12">
          {/* Product Publication Overview */}
          <Card className="lg:col-span-4">
            <CardHeader>
              <CardTitle>Product Publication Overview</CardTitle>
              <CardDescription>
                Live distribution of published vs. draft catalogue entries
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center gap-6">
                <div className="relative flex h-28 w-28 shrink-0 items-center justify-center">
                  <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      fill="none"
                      stroke="#E2E8F0"
                      strokeWidth="12"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      fill="none"
                      stroke="#1D4ED8"
                      strokeWidth="12"
                      strokeDasharray={`${2 * Math.PI * 40}`}
                      strokeDashoffset={`${2 * Math.PI * 40 * (1 - publishedPct / 100)}`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="absolute text-lg font-semibold text-slate-900">
                    {publishedPct}%
                  </span>
                </div>

                <div className="space-y-2.5 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#1D4ED8]" />
                    <span className="text-slate-600">Published:</span>
                    <span className="font-semibold text-slate-900">
                      {metrics?.publishedProducts ?? 0}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                    <span className="text-slate-600">Drafts:</span>
                    <span className="font-semibold text-slate-900">
                      {metrics?.draftProducts ?? 0}
                    </span>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Quick Actions
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {hasPermission('products:create') && (
                    <Button asChild size="sm">
                      <Link to="/products/new">New Product</Link>
                    </Button>
                  )}
                  <Button asChild size="sm" variant="secondary">
                    <Link to="/products">All Products</Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link to="/categories">Categories</Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link to="/media">Media Library</Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Products by Category Bar Chart */}
          <Card className="lg:col-span-8">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Products by Category</CardTitle>
                <CardDescription>
                  Catalogue coverage across configured Mobileum solution areas
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/categories">
                  Manage
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-3.5">
              {(summary?.categoryBreakdown ?? []).map((item) => {
                const widthPct = Math.round((item.productCount / maxCategoryCount) * 100);
                return (
                  <div key={item.categoryId} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700">
                        {item.categoryName}
                      </span>
                      <span className="font-semibold text-slate-900">
                        {item.productCount}
                      </span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-[#1D4ED8] transition-all duration-300"
                        style={{ width: `${Math.max(widthPct, item.productCount > 0 ? 8 : 0)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </section>

        {/* Recently Updated, Recently Added, Recent Activity */}
        <section className="grid gap-6 lg:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Recently Updated Products</CardTitle>
                <CardDescription>Latest edits across drafts & published items</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/products">All</Link>
              </Button>
            </CardHeader>
            <CardContent className="divide-y divide-slate-100">
              {(summary?.recentlyUpdatedProducts ?? []).map((p) => (
                <Link
                  key={p.id}
                  to={`/products/${p.id}/edit`}
                  className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0 hover:text-[#1D4ED8]"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {p.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      Updated {formatDate(p.updatedAt)}
                    </p>
                  </div>
                  <Badge variant={p.publicationStatus === 'published' ? 'success' : 'warning'}>
                    {p.publicationStatus}
                  </Badge>
                </Link>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recently Added Products</CardTitle>
              <CardDescription>Newest entries in the catalogue</CardDescription>
            </CardHeader>
            <CardContent className="divide-y divide-slate-100">
              {(summary?.recentlyAddedProducts ?? []).map((p) => (
                <Link
                  key={p.id}
                  to={`/products/${p.id}/edit`}
                  className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0 hover:text-[#1D4ED8]"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {p.name}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {p.categoryName}
                    </p>
                  </div>
                  <Badge variant="neutral">{p.productTypeName}</Badge>
                </Link>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Latest audit events</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/activity-logs">Logs</Link>
              </Button>
            </CardHeader>
            <CardContent className="divide-y divide-slate-100">
              {(summary?.recentActivity ?? []).map((log) => (
                <div key={log.id} className="flex items-start gap-2.5 py-3 first:pt-0 last:pb-0">
                  <Activity className="mt-0.5 h-4 w-4 shrink-0 text-[#1D4ED8]" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-900">
                      {log.actorName} • <span className="text-[#1D4ED8]">{log.action}</span>
                    </p>
                    <p className="truncate text-xs text-slate-600">
                      {log.entityName}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {formatDate(log.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      </div>
    </AdminLayout>
  );
}
