import { useRef, useState, type DragEvent } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Film,
  ImagePlus,
  Play,
  Star,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  ALLOWED_IMAGE_MIME_TYPES,
  ALLOWED_VIDEO_MIME_TYPES,
  type ProductImageDTO,
  type ProductVideoDTO,
} from '@mobileum/shared';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface ScreenshotsTabProps {
  productId: string;
  images: ProductImageDTO[];
  readOnly: boolean;
  onImagesChange: (next: ProductImageDTO[]) => void;
  onUploadFiles: (files: FileList | File[]) => Promise<void>;
  uploadProgress: number | null;
  onValidationError: (msg: string) => void;
}

export function ScreenshotsTab({
  images,
  readOnly,
  onImagesChange,
  onUploadFiles,
  uploadProgress,
  onValidationError,
}: ScreenshotsTabProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const validateAndDispatch = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0 || readOnly) return;
    const valid: File[] = [];
    for (const file of Array.from(fileList)) {
      if (!ALLOWED_IMAGE_MIME_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_MIME_TYPES)[number])) {
        onValidationError(`Unsupported image type for "${file.name}". Allowed: PNG, JPG, JPEG, WebP.`);
        continue;
      }
      if (file.size > 15 * 1024 * 1024) {
        onValidationError(`"${file.name}" exceeds the 15 MB image limit.`);
        continue;
      }
      valid.push(file);
    }
    if (valid.length > 0) {
      void onUploadFiles(valid);
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    validateAndDispatch(e.dataTransfer.files);
  };

  const moveImage = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= images.length) return;
    const copy = [...images];
    const [item] = copy.splice(index, 1);
    if (!item) return;
    copy.splice(targetIndex, 0, item);
    onImagesChange(copy.map((img, i) => ({ ...img, displayOrder: i + 1 })));
  };

  const setPrimary = (id: string) => {
    onImagesChange(images.map((img) => ({ ...img, isPrimary: img.id === id })));
  };

  const updateCaption = (id: string, caption: string) => {
    onImagesChange(images.map((img) => (img.id === id ? { ...img, caption } : img)));
  };

  return (
    <div className="space-y-6">
      {!readOnly && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
            dragActive
              ? 'border-[#1D4ED8] bg-[#EFF6FF]'
              : 'border-slate-300 bg-slate-50/70 hover:border-[#93C5FD]'
          }`}
        >
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[#BFDBFE] bg-white text-[#1D4ED8]">
            <ImagePlus className="h-5 w-5" />
          </div>
          <p className="mt-3 text-sm font-medium text-slate-900">
            Drag and drop product screenshots here
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Supports PNG, JPG, JPEG, WebP up to 15 MB each. Stored under{' '}
            <code className="font-mono">storage/products/{'{product-uuid}'}/images/</code>.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => validateAndDispatch(e.target.files)}
            className="hidden"
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="mt-4"
          >
            <Upload className="h-3.5 w-3.5" />
            Select Images
          </Button>

          {uploadProgress !== null && (
            <div className="mt-4 w-full max-w-xs space-y-1">
              <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full bg-[#1D4ED8] transition-all"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-600">Uploading {uploadProgress}%</p>
            </div>
          )}
        </div>
      )}

      {images.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
          No screenshots attached to this product yet.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {images.map((img, idx) => (
            <div
              key={img.id}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
            >
              <div className="relative aspect-video bg-[#F4F8FF]">
                <img
                  src={img.filePath}
                  alt={img.caption ?? img.originalFilename}
                  className="h-full w-full object-contain"
                />
                {img.isPrimary && (
                  <Badge variant="default" className="absolute left-3 top-3 bg-white">
                    <Star className="h-3 w-3 fill-[#1D4ED8]" />
                    Primary
                  </Badge>
                )}
              </div>
              <div className="space-y-3 p-4">
                <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                  <span className="truncate font-medium text-slate-700">
                    {img.originalFilename}
                  </span>
                  <span>#{idx + 1}</span>
                </div>

                <Input
                  value={img.caption ?? ''}
                  disabled={readOnly}
                  onChange={(e) => updateCaption(img.id, e.target.value)}
                  placeholder="Optional screenshot caption..."
                />

                {!readOnly && (
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={idx === 0}
                        onClick={() => moveImage(idx, -1)}
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={idx === images.length - 1}
                        onClick={() => moveImage(idx, 1)}
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </Button>
                      {!img.isPrimary && (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => setPrimary(img.id)}
                        >
                          Set Primary
                        </Button>
                      )}
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteId(img.id)}
                      className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remove
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteId)}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Remove Screenshot?"
        description="This removes the screenshot from the product gallery."
        confirmLabel="Remove"
        destructive
        onConfirm={() => {
          if (deleteId) {
            onImagesChange(images.filter((img) => img.id !== deleteId));
            setDeleteId(null);
          }
        }}
      />
    </div>
  );
}

interface VideosTabProps {
  videos: ProductVideoDTO[];
  readOnly: boolean;
  onVideosChange: (next: ProductVideoDTO[]) => void;
  onUploadVideo: (file: File, meta: { title: string; description: string; thumbnailFile: File | null }) => Promise<void>;
  uploadProgress: number | null;
  onValidationError: (msg: string) => void;
}

export function VideosTab({
  videos,
  readOnly,
  onVideosChange,
  onUploadVideo,
  uploadProgress,
  onValidationError,
}: VideosTabProps) {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbFile, setThumbFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [previewVideo, setPreviewVideo] = useState<ProductVideoDTO | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleVideoPick = (file: File | null) => {
    if (!file) return;
    if (!ALLOWED_VIDEO_MIME_TYPES.includes(file.type as (typeof ALLOWED_VIDEO_MIME_TYPES)[number])) {
      onValidationError(`Unsupported video format "${file.type}". Please upload an MP4 video.`);
      return;
    }
    if (file.size > 500 * 1024 * 1024) {
      onValidationError('Video exceeds the 500 MB upload limit.');
      return;
    }
    setVideoFile(file);
    if (!title.trim()) {
      setTitle(file.name.replace(/\.[^.]+$/, ''));
    }
  };

  const handleUploadSubmit = async () => {
    if (!videoFile) {
      onValidationError('Please select an MP4 video file first.');
      return;
    }
    if (!title.trim()) {
      onValidationError('Please enter a video title.');
      return;
    }
    await onUploadVideo(videoFile, {
      title: title.trim(),
      description: description.trim(),
      thumbnailFile: thumbFile,
    });
    setVideoFile(null);
    setThumbFile(null);
    setTitle('');
    setDescription('');
  };

  const moveVideo = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= videos.length) return;
    const copy = [...videos];
    const [item] = copy.splice(index, 1);
    if (!item) return;
    copy.splice(target, 0, item);
    onVideosChange(copy.map((v, i) => ({ ...v, displayOrder: i + 1 })));
  };

  return (
    <div className="space-y-6">
      {!readOnly && (
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
          <h4 className="text-sm font-semibold text-slate-900">
            Upload Demonstration Video (MP4)
          </h4>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700">
                Video Title
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Platform Walkthrough (3 min)"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700">
                MP4 Video File (Max 500 MB)
              </label>
              <input
                type="file"
                accept="video/mp4"
                onChange={(e) => handleVideoPick(e.target.files?.[0] ?? null)}
                className="block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-[#EFF6FF] file:px-3 file:py-1 file:text-xs file:font-medium file:text-[#1D4ED8]"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700">
                Description
              </label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Summarize what this walkthrough demonstrates..."
                className="min-h-[76px]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700">
                Optional Poster Thumbnail (PNG/JPG/WebP)
              </label>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => setThumbFile(e.target.files?.[0] ?? null)}
                className="block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-[#EFF6FF] file:px-3 file:py-1 file:text-xs file:font-medium file:text-[#1D4ED8]"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-4">
            {uploadProgress !== null ? (
              <div className="flex-1 space-y-1">
                <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full bg-[#1D4ED8] transition-all"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="text-xs text-slate-600">Uploading {uploadProgress}%</p>
              </div>
            ) : (
              <span className="text-xs text-slate-500">
                Stored under <code className="font-mono">storage/products/{'{product-uuid}'}/videos/</code>
              </span>
            )}

            <Button type="button" size="sm" onClick={() => void handleUploadSubmit()}>
              <Upload className="h-3.5 w-3.5" />
              Upload Video
            </Button>
          </div>
        </div>
      )}

      {videos.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
          No demonstration videos uploaded for this product yet.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {videos.map((vid, idx) => (
            <div
              key={vid.id}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
            >
              <div className="relative aspect-video bg-[#F4F8FF]">
                {vid.thumbnailPath ? (
                  <img
                    src={vid.thumbnailPath}
                    alt={vid.title}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-slate-400">
                    <Film className="h-8 w-8" />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setPreviewVideo(vid)}
                  aria-label={`Preview ${vid.title}`}
                  className="absolute inset-0 m-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#1D4ED8] text-white hover:bg-[#1E40AF]"
                >
                  <Play className="ml-0.5 h-5 w-5 fill-white" />
                </button>
              </div>

              <div className="space-y-2 p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {vid.title}
                  </p>
                  <span className="text-xs text-slate-500">#{idx + 1}</span>
                </div>
                {vid.description && (
                  <p className="line-clamp-2 text-xs text-slate-600">
                    {vid.description}
                  </p>
                )}

                {!readOnly && (
                  <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={idx === 0}
                        onClick={() => moveVideo(idx, -1)}
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={idx === videos.length - 1}
                        onClick={() => moveVideo(idx, 1)}
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteId(vid.id)}
                      className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remove
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quick Video Preview Dialog */}
      <Dialog open={Boolean(previewVideo)} onOpenChange={(o) => !o && setPreviewVideo(null)}>
        <DialogContent className="max-w-3xl">
          <DialogTitle>{previewVideo?.title}</DialogTitle>
          <DialogDescription>{previewVideo?.description ?? ''}</DialogDescription>
          {previewVideo && (
            <div className="mt-4 overflow-hidden rounded-xl bg-black">
              <video
                src={previewVideo.filePath}
                poster={previewVideo.thumbnailPath ?? undefined}
                controls
                className="aspect-video w-full"
              />
            </div>
          )}
          <div className="mt-4 flex justify-end">
            <Button variant="outline" onClick={() => setPreviewVideo(null)}>
              <X className="h-4 w-4" />
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteId)}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Remove Demonstration Video?"
        description="This removes the video from the product."
        confirmLabel="Remove"
        destructive
        onConfirm={() => {
          if (deleteId) {
            onVideosChange(videos.filter((v) => v.id !== deleteId));
            setDeleteId(null);
          }
        }}
      />
    </div>
  );
}
