import { useState, type ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FolderKanban,
  Images,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Settings,
  ShieldAlert,
  Users,
  X,
} from 'lucide-react';
import type { PermissionKey, RoleSlug } from '@mobileum/shared';
import { MobileumBrand } from '@/components/MobileumBrand';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';

interface NavItem {
  label: string;
  to: string;
  icon: typeof LayoutDashboard;
  requiredPermission?: PermissionKey;
}

const SIDEBAR_ITEMS: NavItem[] = [
  { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
  { label: 'Products', to: '/products', icon: Package, requiredPermission: 'products:read' },
  { label: 'Categories', to: '/categories', icon: FolderKanban, requiredPermission: 'categories:read' },
  { label: 'Media Library', to: '/media', icon: Images, requiredPermission: 'products:read' },
  { label: 'Administrators', to: '/users', icon: Users, requiredPermission: 'users:read' },
  { label: 'Activity Logs', to: '/activity-logs', icon: Activity, requiredPermission: 'logs:read' },
  { label: 'Settings', to: '/settings', icon: Settings },
];

export function AdminLayout({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const {
    mode,
    user,
    previewRole,
    editorCanPublish,
    hasPermission,
    setPreviewRole,
    setEditorCanPublish,
    logout,
  } = useAuth();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const visibleItems = SIDEBAR_ITEMS.filter(
    (item) => !item.requiredPermission || hasPermission(item.requiredPermission),
  );

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const renderNavLinks = (isCollapsed: boolean) => (
    <nav aria-label="Admin sidebar navigation" className="flex-1 space-y-1 px-3 py-4">
      {visibleItems.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'border border-[#BFDBFE] bg-[#EFF6FF] text-[#1D4ED8]'
                  : 'border border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`
            }
          >
            <Icon className="h-4 w-4 shrink-0" />
            {!isCollapsed && <span className="truncate">{item.label}</span>}
          </NavLink>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-screen bg-[#F8FAFC] text-slate-900">
      {/* Desktop Collapsible Sidebar */}
      <aside
        className={`hidden shrink-0 flex-col border-r border-slate-200 bg-white transition-all duration-200 lg:flex ${
          collapsed ? 'w-[76px]' : 'w-64'
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-slate-200 px-4">
          {!collapsed ? (
            <MobileumBrand size="sm" />
          ) : (
            <img
              src={`${import.meta.env.BASE_URL}assets/mobileum-logo.png`}
              alt="Mobileum"
              className="mx-auto h-8 w-8 object-contain"
            />
          )}
          <button
            type="button"
            onClick={() => setCollapsed((prev) => !prev)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        </div>

        {renderNavLinks(collapsed)}

        <div className="border-t border-slate-200 p-3">
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-rose-50 hover:text-rose-700"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative z-10 flex w-64 flex-col bg-white shadow-xl">
            <div className="flex h-16 items-center justify-between border-b border-slate-200 px-4">
              <MobileumBrand size="sm" />
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {renderNavLinks(false)}
            <div className="border-t border-slate-200 p-3">
              <button
                type="button"
                onClick={() => void handleLogout()}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-rose-50 hover:text-rose-700"
              >
                <LogOut className="h-4 w-4 shrink-0" />
                <span>Logout</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Shell */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Phase 3 Honest Backend Status Bar when in UI Preview Mode */}
        {mode === 'ui_preview' && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-5 py-2.5 text-xs text-amber-900 sm:px-8">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 shrink-0 text-amber-600" />
              <span>
                <strong>Phase 3 UI Inspection Mode:</strong> Displaying sample CMS
                views without an active PostgreSQL session. Mutations call real{' '}
                <code className="font-mono">/api/admin/*</code> endpoints and report
                backend status until Phase 4/5 integration.
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <label className="text-[11px] font-medium text-amber-800">
                Inspect Role UI:
              </label>
              <select
                value={previewRole}
                onChange={(e) => setPreviewRole(e.target.value as RoleSlug)}
                aria-label="Inspect role UI state"
                className="h-7 rounded-lg border border-amber-300 bg-white px-2 text-xs font-medium text-slate-800 focus:outline-none"
              >
                <option value="super_admin">Super Admin</option>
                <option value="admin">Admin</option>
                <option value="content_manager">Editor (Content Manager)</option>
                <option value="viewer">Viewer (Read-Only)</option>
              </select>

              {previewRole === 'content_manager' && (
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-2 py-1 text-[11px] font-medium text-slate-800">
                  <input
                    type="checkbox"
                    checked={editorCanPublish}
                    onChange={(e) => setEditorCanPublish(e.target.checked)}
                    className="rounded border-slate-300 text-[#1D4ED8]"
                  />
                  Editor Can Publish
                </label>
              )}
            </div>
          </div>
        )}

        {/* Top Header */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white/95 px-5 backdrop-blur-md sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
              className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold text-slate-900">
                {title}
              </h1>
              {subtitle && (
                <p className="hidden truncate text-xs text-slate-500 sm:block">
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {actions}
            <Button variant="outline" size="sm" asChild className="hidden sm:inline-flex">
              <a href="/sales-demo/" target="_blank" rel="noopener noreferrer">
                View Public Portal
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>
            {user && (
              <div className="hidden items-center gap-2 rounded-full border border-slate-200 bg-slate-50 py-1 pl-3 pr-2 md:flex">
                <span className="max-w-[140px] truncate text-xs font-medium text-slate-700">
                  {user.name}
                </span>
                <Badge variant="default" className="text-[10px]">
                  {user.roleName}
                </Badge>
              </div>
            )}
          </div>
        </header>

        {/* Page Body */}
        <main className="flex-1 p-5 sm:p-8">{children}</main>
      </div>
    </div>
  );
}
