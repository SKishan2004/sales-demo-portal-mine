import { useState } from 'react';
import { motion } from 'motion/react';
import { Clock, Film, Play } from 'lucide-react';
import type { ProductVideoDTO } from '@mobileum/shared';
import { VideoModal } from '@/components/product/VideoModal';

interface VideoDemoSectionProps {
  videos: ProductVideoDTO[];
}

function formatDurationBadge(seconds: number | null): string {
  if (!seconds || seconds <= 0) return 'Demo Video';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function VideoDemoSection({ videos }: VideoDemoSectionProps) {
  const [selectedVideo, setSelectedVideo] = useState<ProductVideoDTO | null>(
    null,
  );
  const orderedVideos = [...videos].sort(
    (a, b) => a.displayOrder - b.displayOrder,
  );

  if (orderedVideos.length === 0) {
    return null;
  }

  return (
    <>
      <div className="grid gap-6 md:grid-cols-2">
        {orderedVideos.map((video, index) => (
          <motion.button
            key={video.id}
            type="button"
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.15 }}
            transition={{ duration: 0.35, delay: index * 0.05 }}
            onClick={() => setSelectedVideo(video)}
            className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-left transition-colors duration-200 hover:border-[#93C5FD] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]"
          >
            {/* Poster Only (True Lazy Video Loading) */}
            <div className="relative aspect-video w-full overflow-hidden border-b border-slate-200 bg-[#F4F8FF]">
              {video.thumbnailPath ? (
                <img
                  src={video.thumbnailPath}
                  alt={video.title}
                  loading="lazy"
                  className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-[1.02]"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Film className="h-10 w-10 text-slate-400" />
                </div>
              )}

              <div className="absolute inset-0 bg-slate-900/10 transition-colors group-hover:bg-slate-900/15" />

              {/* Center Play Button */}
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full border border-white bg-[#1D4ED8] text-white transition-transform duration-200 group-hover:scale-105">
                  <Play className="ml-0.5 h-6 w-6 fill-white" />
                </span>
              </div>

              {/* Duration Badge */}
              <span className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/95 px-3 py-1 text-xs font-medium text-slate-700">
                <Clock className="h-3.5 w-3.5 text-[#1D4ED8]" />
                {formatDurationBadge(video.durationSeconds)}
              </span>
            </div>

            <div className="flex flex-1 flex-col p-5">
              <h3 className="text-base font-semibold text-slate-900 transition-colors group-hover:text-[#1D4ED8]">
                {video.title}
              </h3>
              {video.description && (
                <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-slate-600">
                  {video.description}
                </p>
              )}
              <span className="mt-4 text-xs font-semibold text-[#1D4ED8]">
                Watch demonstration →
              </span>
            </div>
          </motion.button>
        ))}
      </div>

      <VideoModal
        video={selectedVideo}
        onClose={() => setSelectedVideo(null)}
      />
    </>
  );
}
