import { useEffect, useState } from 'react';
import { Activity, Search } from 'lucide-react';
import type { ActivityLogDTO } from '@mobileum/shared';
import { adminApi } from '@/api/adminApi';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/context/AuthContext';
import { PREVIEW_ACTIVITY_LOGS } from '@/data/adminPreviewData';

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ActivityLogsPage() {
  const { mode } = useAuth();
  const [logs, setLogs] = useState<ActivityLogDTO[]>([]);
  const [search, setSearch] = useState('');
  const [entityFilter, setEntityFilter] = useState('all');

  useEffect(() => {
    let active = true;
    const load = async () => {
      const res = await adminApi.getActivityLogs();
      if (!active) return;
      if (res.ok && res.data) {
        setLogs(res.data.items);
      } else if (mode === 'ui_preview') {
        setLogs(PREVIEW_ACTIVITY_LOGS);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [mode]);

  const filtered = logs.filter((log) => {
    if (entityFilter !== 'all' && log.entityType !== entityFilter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      return (
        log.actorName.toLowerCase().includes(q) ||
        log.action.toLowerCase().includes(q) ||
        log.entityName.toLowerCase().includes(q) ||
        log.details.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <AdminLayout
      title="Activity Logs"
      subtitle="Audit trail of product updates, publishing actions, media uploads, and admin changes"
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4">
          <div className="relative min-w-[240px] flex-1 max-w-md">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search administrator, action, or product..."
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#2563EB] focus:bg-white focus:outline-none"
            />
          </div>

          <select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            aria-label="Filter by entity type"
            className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 focus:border-[#2563EB] focus:outline-none"
          >
            <option value="all">All Event Types</option>
            <option value="product">Products</option>
            <option value="category">Categories</option>
            <option value="media">Media</option>
            <option value="admin_user">Administrators</option>
          </select>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-3.5">Administrator</th>
                  <th className="px-4 py-3.5">Action</th>
                  <th className="px-4 py-3.5">Affected Entity</th>
                  <th className="px-4 py-3.5">Details</th>
                  <th className="px-5 py-3.5 text-right">Date & Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-4">
                      <p className="font-medium text-slate-900">{log.actorName}</p>
                      {log.actorRole && (
                        <p className="text-xs text-slate-500">{log.actorRole}</p>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <Badge variant="default">
                        <Activity className="h-3 w-3" />
                        {log.action}
                      </Badge>
                    </td>
                    <td className="px-4 py-4 font-medium text-slate-800">
                      {log.entityName}
                    </td>
                    <td className="px-4 py-4 text-xs text-slate-600">{log.details}</td>
                    <td className="px-5 py-4 text-right text-xs text-slate-500">
                      {formatDateTime(log.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
