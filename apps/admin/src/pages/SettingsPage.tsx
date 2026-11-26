import { useEffect, useState } from 'react';
import { Lock, Save, ShieldCheck } from 'lucide-react';
import type { PortalSettingsDTO } from '@mobileum/shared';
import { adminApi } from '@/api/adminApi';
import { ApiStatusBanner, type StatusFeedback } from '@/components/ApiStatusBanner';
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
import { Input } from '@/components/ui/input';
import { useAuth } from '@/context/AuthContext';
import { PREVIEW_SETTINGS } from '@/data/adminPreviewData';

export function SettingsPage() {
  const { mode, user, hasPermission } = useAuth();
  const isSuperAdmin = hasPermission('roles:manage');
  const [settings, setSettings] = useState<PortalSettingsDTO>(PREVIEW_SETTINGS);
  const [feedback, setFeedback] = useState<StatusFeedback | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const res = await adminApi.getSettings();
      if (!active) return;
      if (res.ok && res.data?.settings) {
        setSettings(res.data.settings);
      } else if (mode === 'ui_preview') {
        setSettings(PREVIEW_SETTINGS);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [mode]);

  const handleSaveSettings = async () => {
    if (!isSuperAdmin) return;
    setSaving(true);
    const res = await adminApi.updateSettings(settings);
    setSaving(false);
    if (!res.ok) {
      setFeedback({
        type: res.awaitingBackend ? 'warning' : 'error',
        message: res.error ?? 'Unable to save portal settings.',
      });
      return;
    }
    setFeedback({ type: 'info', message: 'Settings updated.' });
  };

  return (
    <AdminLayout
      title="Settings"
      subtitle="Portal branding, upload rules, session configuration, and profile details"
      actions={
        isSuperAdmin ? (
          <Button
            size="sm"
            disabled={saving}
            onClick={() => void handleSaveSettings()}
          >
            <Save className="h-3.5 w-3.5" />
            Save Settings
          </Button>
        ) : undefined
      }
    >
      <div className="space-y-6">
        <ApiStatusBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

        {/* Admin Profile Card */}
        <Card>
          <CardHeader>
            <CardTitle>Your Administrator Profile</CardTitle>
            <CardDescription>
              Active account details and assigned role permissions
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-slate-500">Name</p>
              <p className="mt-1 text-sm font-medium text-slate-900">{user?.name}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Email / Username</p>
              <p className="mt-1 text-sm font-medium text-slate-900">
                {user?.email} (@{user?.username})
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Role</p>
              <div className="mt-1">
                <Badge variant="default">{user?.roleName}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* System Settings (Restricted to Super Admin) */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Portal & Security Configuration</CardTitle>
              <CardDescription>
                Company-wide upload limits, file rules, and session TTL
              </CardDescription>
            </div>
            {isSuperAdmin ? (
              <Badge variant="default">
                <ShieldCheck className="h-3 w-3" />
                Super Admin Editable
              </Badge>
            ) : (
              <Badge variant="neutral">
                <Lock className="h-3 w-3" />
                Super Admin Only
              </Badge>
            )}
          </CardHeader>
          <CardContent className="grid gap-5 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700">
                Portal Branding Title
              </label>
              <Input
                value={settings.portalTitle}
                disabled={!isSuperAdmin}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, portalTitle: e.target.value }))
                }
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700">
                Default Product Sorting
              </label>
              <select
                value={settings.defaultSort}
                disabled={!isSuperAdmin}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    defaultSort: e.target.value as PortalSettingsDTO['defaultSort'],
                  }))
                }
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 disabled:opacity-60"
              >
                <option value="display_order">Display Order</option>
                <option value="recent">Recently Added</option>
                <option value="alpha">Alphabetical</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700">
                Max Image Upload Size (MB)
              </label>
              <Input
                type="number"
                min={1}
                max={100}
                disabled={!isSuperAdmin}
                value={settings.maxImageSizeMb}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    maxImageSizeMb: Number(e.target.value) || 15,
                  }))
                }
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700">
                Max Video Upload Size (MB)
              </label>
              <Input
                type="number"
                min={10}
                max={2048}
                disabled={!isSuperAdmin}
                value={settings.maxVideoSizeMb}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    maxVideoSizeMb: Number(e.target.value) || 500,
                  }))
                }
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700">
                Allowed Image Types
              </label>
              <Input
                value={settings.allowedImageTypes.join(', ')}
                disabled
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700">
                Session Expiration (Hours)
              </label>
              <Input
                type="number"
                min={1}
                max={168}
                disabled={!isSuperAdmin}
                value={settings.sessionTtlHours}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    sessionTtlHours: Number(e.target.value) || 12,
                  }))
                }
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
