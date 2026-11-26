import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Pause,
  Play,
  X,
} from 'lucide-react';
import type { ProductImageDTO } from '@mobileum/shared';

interface ScreenshotGalleryProps {
  images: ProductImageDTO[];
  productName: string;
}

export function ScreenshotGallery({
  images,
  productName,
}: ScreenshotGalleryProps) {
  const orderedImages = [...images].sort(
    (a, b) => a.displayOrder - b.displayOrder,
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(orderedImages.length > 1);
  const [isHovered, setIsHovered] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const count = orderedImages.length;
  const activeImage = orderedImages[activeIndex] ?? null;

  const goNext = useCallback(() => {
    if (count <= 1) return;
    setActiveIndex((prev) => (prev + 1) % count);
  }, [count]);

  const goPrev = useCallback(() => {
    if (count <= 1) return;
    setActiveIndex((prev) => (prev - 1 + count) % count);
  }, [count]);

  useEffect(() => {
    setActiveIndex(0);
    setIsAutoPlaying(orderedImages.length > 1);
  }, [orderedImages.length]);

  useEffect(() => {
    if (!isAutoPlaying || isHovered || lightboxOpen || count <= 1) return;
    const id = window.setInterval(goNext, 5000);
    return () => window.clearInterval(id);
  }, [isAutoPlaying, isHovered, lightboxOpen, count, goNext]);

  useEffect(() => {
    if (!lightboxOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxOpen(false);
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goPrev();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [lightboxOpen, goNext, goPrev]);

  if (!activeImage) {
    return null;
  }

  return (
    <div
      className="space-y-4"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Primary Gallery Frame */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="relative aspect-video w-full bg-[#F4F8FF]">
          <AnimatePresence mode="wait">
            <motion.button
              key={activeImage.id}
              type="button"
              onClick={() => setLightboxOpen(true)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              aria-label={`Enlarge ${activeImage.caption ?? productName}`}
              className="group relative flex h-full w-full cursor-zoom-in items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]"
            >
              <img
                src={activeImage.filePath}
                alt={activeImage.caption ?? `${productName} screenshot`}
                className="h-full w-full object-contain"
              />
              <span className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/95 px-3 py-1.5 text-xs font-medium text-slate-700 opacity-0 transition-opacity group-hover:opacity-100">
                <Maximize2 className="h-3.5 w-3.5 text-[#1D4ED8]" />
                Full Screen
              </span>
            </motion.button>
          </AnimatePresence>

          {count > 1 && (
            <>
              <button
                type="button"
                onClick={goPrev}
                aria-label="Previous screenshot"
                className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full border border-slate-200 bg-white/95 p-2.5 text-slate-700 transition-colors hover:border-[#93C5FD] hover:text-[#1D4ED8] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>

              <button
                type="button"
                onClick={goNext}
                aria-label="Next screenshot"
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-slate-200 bg-white/95 p-2.5 text-slate-700 transition-colors hover:border-[#93C5FD] hover:text-[#1D4ED8] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          )}
        </div>

        {/* Caption & Slideshow Bar */}
        <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-700">
            {activeImage.caption ?? `${productName} — Screen ${activeIndex + 1}`}
          </p>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span>
              {activeIndex + 1} / {count}
            </span>
            {count > 1 && (
              <button
                type="button"
                onClick={() => setIsAutoPlaying((prev) => !prev)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-slate-700 transition-colors hover:bg-slate-100"
              >
                {isAutoPlaying ? (
                  <>
                    <Pause className="h-3 w-3 text-[#1D4ED8]" />
                    Pause Slideshow
                  </>
                ) : (
                  <>
                    <Play className="h-3 w-3 text-[#1D4ED8]" />
                    Auto Slideshow
                  </>
                )}
              </button>
            )}
            <button
              type="button"
              onClick={() => setLightboxOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-slate-700 transition-colors hover:bg-slate-100"
            >
              <Maximize2 className="h-3 w-3 text-[#1D4ED8]" />
              Expand
            </button>
          </div>
        </div>
      </div>

      {/* Thumbnail Navigation */}
      {count > 1 && (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
          {orderedImages.map((img, idx) => {
            const active = idx === activeIndex;
            return (
              <button
                key={img.id}
                type="button"
                onClick={() => setActiveIndex(idx)}
                aria-label={`Select screenshot ${idx + 1}`}
                className={`relative aspect-video overflow-hidden rounded-xl border bg-[#F4F8FF] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] ${
                  active
                    ? 'border-[#1D4ED8] ring-2 ring-[#BFDBFE]'
                    : 'border-slate-200 opacity-75 hover:border-slate-300 hover:opacity-100'
                }`}
              >
                <img
                  src={img.filePath}
                  alt={img.caption ?? `Thumbnail ${idx + 1}`}
                  loading="lazy"
                  className="h-full w-full object-contain"
                />
              </button>
            );
          })}
        </div>
      )}

      {/* Full-Screen Lightbox Viewer */}
      <AnimatePresence>
        {lightboxOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            role="dialog"
            aria-modal="true"
            aria-label={`${productName} full-screen screenshot viewer`}
            className="fixed inset-0 z-50 flex flex-col bg-slate-900/90 p-4 backdrop-blur-sm sm:p-6"
          >
            <div className="flex items-center justify-between gap-4 pb-3 text-white">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {activeImage.caption ?? productName}
                </p>
                <p className="text-xs text-slate-300">
                  Screenshot {activeIndex + 1} of {count} • Press Esc to close
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLightboxOpen(false)}
                aria-label="Close full-screen viewer"
                className="rounded-xl border border-white/20 bg-white/10 p-2 text-white transition-colors hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="relative flex flex-1 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-[#F8FAFC]">
              <img
                src={activeImage.filePath}
                alt={activeImage.caption ?? productName}
                className="max-h-full max-w-full object-contain"
              />

              {count > 1 && (
                <>
                  <button
                    type="button"
                    onClick={goPrev}
                    aria-label="Previous screenshot"
                    className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full border border-slate-200 bg-white/95 p-3 text-slate-800 hover:border-[#93C5FD]"
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </button>
                  <button
                    type="button"
                    onClick={goNext}
                    aria-label="Next screenshot"
                    className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full border border-slate-200 bg-white/95 p-3 text-slate-800 hover:border-[#93C5FD]"
                  >
                    <ChevronRight className="h-6 w-6" />
                  </button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
