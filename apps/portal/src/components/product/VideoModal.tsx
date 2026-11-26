import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import type { ProductVideoDTO } from '@mobileum/shared';

interface VideoModalProps {
  video: ProductVideoDTO | null;
  onClose: () => void;
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function VideoModal({ video, onClose }: VideoModalProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0.85);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);

  const releaseMediaAndClose = () => {
    const el = videoRef.current;
    if (el) {
      el.pause();
      el.removeAttribute('src');
      el.load();
    }
    setIsPlaying(false);
    setCurrentTime(0);
    setPlaybackError(null);
    onClose();
  };

  useEffect(() => {
    if (!video) return;
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(video.durationSeconds ?? 0);
    setPlaybackError(null);
  }, [video]);

  const togglePlay = async () => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) {
      try {
        await el.play();
        setIsPlaying(true);
      } catch {
        setPlaybackError('Unable to start video playback in this browser session.');
      }
    } else {
      el.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = () => {
    const el = videoRef.current;
    if (!el) return;
    const nextMuted = !isMuted;
    el.muted = nextMuted;
    setIsMuted(nextMuted);
  };

  const handleVolumeChange = (nextVol: number) => {
    const el = videoRef.current;
    setVolume(nextVol);
    if (el) {
      el.volume = nextVol;
      el.muted = nextVol === 0;
    }
    setIsMuted(nextVol === 0);
  };

  const handleSeek = (nextTime: number) => {
    const el = videoRef.current;
    if (!el) return;
    el.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const toggleFullscreen = async () => {
    const node = containerRef.current;
    if (!node) return;
    if (!document.fullscreenElement) {
      await node.requestFullscreen().catch(() => {});
    } else {
      await document.exitFullscreen().catch(() => {});
    }
  };

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  useEffect(() => {
    if (!video) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        releaseMediaAndClose();
      } else if (e.key === ' ' || e.key.toLowerCase() === 'k') {
        e.preventDefault();
        void togglePlay();
      } else if (e.key.toLowerCase() === 'm') {
        e.preventDefault();
        toggleMute();
      } else if (e.key.toLowerCase() === 'f') {
        e.preventDefault();
        void toggleFullscreen();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video, isMuted]);

  const effectiveDuration = duration || video?.durationSeconds || 0;

  return (
    <AnimatePresence>
      {video && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          role="dialog"
          aria-modal="true"
          aria-label={video.title}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/75 p-4 backdrop-blur-sm sm:p-8"
          onClick={(e) => {
            if (e.target === e.currentTarget) releaseMediaAndClose();
          }}
        >
          <motion.div
            ref={containerRef}
            initial={{ opacity: 0, scale: 0.97, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 10 }}
            transition={{ duration: 0.24, ease: 'easeOut' }}
            className="flex w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
              <div className="min-w-0">
                <h3 className="truncate text-lg font-semibold text-slate-900">
                  {video.title}
                </h3>
                {video.description && (
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-600">
                    {video.description}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={releaseMediaAndClose}
                aria-label="Close video player"
                className="shrink-0 rounded-lg border border-slate-200 bg-slate-50 p-2 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Video Stage */}
            <div className="relative aspect-video w-full bg-slate-950">
              <video
                ref={videoRef}
                src={video.filePath}
                poster={video.thumbnailPath ?? undefined}
                preload="metadata"
                playsInline
                onClick={() => void togglePlay()}
                onLoadedMetadata={(e) => {
                  const vid = e.currentTarget;
                  if (Number.isFinite(vid.duration) && vid.duration > 0) {
                    setDuration(vid.duration);
                  }
                  vid.volume = volume;
                }}
                onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                onEnded={() => setIsPlaying(false)}
                onError={() =>
                  setPlaybackError(
                    'This sample MP4 stream could not be decoded by your browser. Uploaded H.264 MP4 files stream via HTTP 206 once connected.',
                  )
                }
                className="h-full w-full cursor-pointer object-contain"
              />

              {!isPlaying && !playbackError && (
                <button
                  type="button"
                  onClick={() => void togglePlay()}
                  aria-label="Play video"
                  className="absolute inset-0 m-auto flex h-16 w-16 items-center justify-center rounded-full border border-white bg-[#1D4ED8] text-white transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-[#93C5FD]"
                >
                  <Play className="ml-0.5 h-7 w-7 fill-white" />
                </button>
              )}

              {playbackError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 px-6 text-center">
                  <p className="max-w-md text-sm text-slate-100">
                    {playbackError}
                  </p>
                </div>
              )}
            </div>

            {/* Custom Controls */}
            <div className="space-y-3 border-t border-slate-200 bg-slate-50 px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="w-11 text-right font-mono text-xs text-slate-700">
                  {formatTime(currentTime)}
                </span>
                <input
                  type="range"
                  min={0}
                  max={effectiveDuration || 1}
                  step={0.1}
                  value={Math.min(currentTime, effectiveDuration || 1)}
                  onChange={(e) => handleSeek(Number(e.target.value))}
                  aria-label="Seek video timeline"
                  className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-slate-200 accent-[#1D4ED8]"
                />
                <span className="w-11 font-mono text-xs text-slate-500">
                  {formatTime(effectiveDuration)}
                </span>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => void togglePlay()}
                    aria-label={isPlaying ? 'Pause' : 'Play'}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 transition-colors hover:bg-slate-100"
                  >
                    {isPlaying ? (
                      <>
                        <Pause className="h-4 w-4 text-[#1D4ED8]" />
                        Pause
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4 text-[#1D4ED8]" />
                        Play
                      </>
                    )}
                  </button>

                  <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5">
                    <button
                      type="button"
                      onClick={toggleMute}
                      aria-label={isMuted ? 'Unmute' : 'Mute'}
                      className="text-slate-600 hover:text-slate-900"
                    >
                      {isMuted || volume === 0 ? (
                        <VolumeX className="h-4 w-4 text-slate-400" />
                      ) : (
                        <Volume2 className="h-4 w-4 text-[#1D4ED8]" />
                      )}
                    </button>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={isMuted ? 0 : volume}
                      onChange={(e) => handleVolumeChange(Number(e.target.value))}
                      aria-label="Volume"
                      className="w-20 cursor-pointer accent-[#1D4ED8]"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span className="hidden sm:inline">
                    Space: Play/Pause • M: Mute • F: Full Screen • Esc: Close
                  </span>
                  <button
                    type="button"
                    onClick={() => void toggleFullscreen()}
                    aria-label="Toggle full screen"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 transition-colors hover:bg-slate-100"
                  >
                    {isFullscreen ? (
                      <>
                        <Minimize2 className="h-4 w-4 text-[#1D4ED8]" />
                        Exit Full Screen
                      </>
                    ) : (
                      <>
                        <Maximize2 className="h-4 w-4 text-[#1D4ED8]" />
                        Full Screen
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
