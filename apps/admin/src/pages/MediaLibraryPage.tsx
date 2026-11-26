import { useEffect, useState } from 'react';
import {
  Eye,
  Film,
  Grid,
  Image as ImageIcon,
  List,
  Search,
  Trash2,
} from 'lucide-react';
import type { MediaLibraryItemDTO } from '@mobileum/shared';
import { adminApi } from '@/api/adminApi';
import { ApiStatusBanner, type StatusFeedback } from '@/components/ApiStatusBanner';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/context/AuthContext';
import { derivePreviewMedia } from '@/data/adminPreviewData';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function MediaLibraryPage() {
  const { mode, hasPermission } = useAuth();
  const canDelete = hasPermission('media:delete');

  const [items, setItems] = useState<MediaLibraryItemDTO[]>([]);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'image' | 'thumbnail' | 'video'>('all');
  const [feedback, setFeedback] = useState<StatusFeedback | null>(null);
  const [previewItem, setPreviewItem] = useState<MediaLibraryItemDTO | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MediaLibraryItemDTO | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const res = await adminApi.getMediaLibrary();
      if (!active) return;
      if (res.ok && res.data) {
        setItems(res.data.items);
      } else if (mode === 'ui_preview') {
        setItems(derivePreviewMedia());
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [mode]);

  const filtered = items.filter((item) => {
    if (typeFilter !== 'all' && item.mediaKind !== typeFilter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      return (
        item.originalFilename.toLowerCase().includes(q) ||
        item.productName.toLowerCase().includes(q) ||
        (item.captionOrTitle ?? '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleRequestDelete = (item: MediaLibraryItemDTO) => {
    if (item.productStatus === 'published') {
      setFeedback({
        type: 'error',
        message: `Cannot delete "${item.originalFilename}" because it is currently used by published product "${item.productName}". Unpublish the product or remove the media inside its editor first.`,
      });
      return;
    }
    setDeleteTarget(item);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const res = await adminApi.deleteMedia(deleteTarget.id);
    setDeleteTarget(null);
    if (!res.ok) {
      setFeedback({
        type: res.awaitingBackend ? 'warning' : 'error',
        message: res.error ?? 'Unable to delete media file.',
      });
      return;
    }
    setItems((prev) => prev.filter((m) => m.id !== deleteTarget.id));
  };

  return (
    <AdminLayout
      title="Media Library"
      subtitle="Centralized registry of uploaded product images, thumbnails, and MP4 demo videos"
    >
      <div className="space-y-5">
        <ApiStatusBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex flex-1 flex-wrap items-center gap-3">
            <div className="relative min-w-[240px] flex-1 max-w-md">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by file name or product..."
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#2563EB] focus:bg-white focus:outline-none"
              />
            </div>

            <select
              value={typeFilter}
              onChange={(e) =>
                setTypeFilter(e.target.value as 'all' | 'image' | 'thumbnail' | 'video')
              }
              aria-label="Filter by media type"
              className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 focus:border-[#2563EB] focus:outline-none"
            >
              <option value="all">All File Types</option>
              <option value="thumbnail">Primary Thumbnails</option>
              <option value="image">Screenshots</option>
              <option value="video">Demo Videos (MP4)</option>
            </select>
          </div>

          <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
            <Button
              type="button"
              variant={view === 'grid' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setView('grid')}
              aria-label="Grid view"
            >
              <Grid className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant={view === 'list' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setView('list')}
              aria-label="List view"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {view === 'grid' ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((item) => (
              <div
                key={item.id}
                className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white"
              >
                <div className="relative aspect-video bg-[#F4F8FF]">
                  {item.mediaKind === 'video' ? (
                    item.thumbnailPath ? (
                      <img
                        src={item.thumbnailPath}
                        alt={item.originalFilename}
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-slate-400">
                        <Film className="h-8 w-8" />
                      </div>
                    )
                  ) : (
                    <img
                      src={item.filePath}
                      alt={item.originalFilename}
                      className="h-full w-full object-contain"
                    />
                  )}
                  <Badge variant="default" className="absolute left-3 top-3 bg-white">
                    {item.mediaKind === 'video' ? 'MP4 Video' : item.mediaKind === 'thumbnail' ? 'Thumbnail' : 'Screenshot'}
                  </Badge>
                </div>

                <div className="flex flex-1 flex-col justify-between p-4">
                  <div>
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {item.originalFilename}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-slate-600">
                      {item.productName}
                    </p>
                    <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                      <span>{formatBytes(item.fileSize)}</span>
                      <span>{formatDate(item.createdAt)}</span>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                    <Badge variant={item.productStatus === 'published' ? 'success' : 'warning'}>
                      {item.productStatus}
                    </Badge>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setPreviewItem(item)}
                        title="Preview media"
                      >
                        <Eye className="h-4 w-4 text-[#1D4ED8]" />
                      </Button>
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRequestDelete(item)}
                          title="Delete media"
                        >
                          <Trash2 className="h-4 w-4 text-rose-600" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-5 py-3.5">File</th>
                    <th className="px-4 py-3.5">Type</th>
                    <th className="px-4 py-3.5">Associated Product</th>
                    <th className="px-4 py-3.5">Size</th>
                    <th className="px-4 py-3.5">Uploaded</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/70">
                      <td className="px-5 py-3.5 font-medium text-slate-900">
                        <div className="flex items-center gap-2.5">
                          {item.mediaKind === 'video' ? (
                            <Film className="h-4 w-4 text-[#1D4ED8]" />
                          ) : (
                            <ImageIcon className="h-4 w-4 text-[#1D4ED8]" />
                          )}
                          <span>{item.originalFilename}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-600">{item.mimeType}</td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-800">{item.productName}</span>
                          <Badge variant={item.productStatus === 'published' ? 'success' : 'warning'}>
                            {item.productStatus}
                          </Badge>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-600">
                        {formatBytes(item.fileSize)}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-500">
                        {formatDate(item.createdAt)}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="inline-flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setPreviewItem(item)}
                          >
                            <Eye className="h-4 w-4 text-[#1D4ED8]" />
                          </Button>
                          {canDelete && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRequestDelete(item)}
                            >
                              <Trash2 className="h-4 w-4 text-rose-600" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Media Preview Modal */}
      <Dialog open={Boolean(previewItem)} onOpenChange={(o) => !o && setPreviewItem(null)}>
        <DialogContent className="max-w-3xl">
          <DialogTitle>{previewItem?.originalFilename}</DialogTitle>
          <DialogDescription>
            {previewItem?.productName} • {previewItem ? formatBytes(previewItem.fileSize) : ''}
          </DialogDescription>
          {previewItem && (
            <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-[#F4F8FF]">
              {previewItem.mediaKind === 'video' ? (
                <video
                  src={previewItem.filePath}
                  poster={previewItem.thumbnailPath ?? undefined}
                  controls
                  className="aspect-video w-full bg-black"
                />
              ) : (
                <img
                  src={previewItem.filePath}
                  alt={previewItem.originalFilename}
                  className="aspect-video w-full object-contain"
                />
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Delete Media File?"
        description={`Delete "${deleteTarget?.originalFilename}" from persistent storage?`}
        confirmLabel="Delete File"
        destructive
        onConfirm={() => void handleConfirmDelete()}
      />
    </AdminLayout>
  );
}
