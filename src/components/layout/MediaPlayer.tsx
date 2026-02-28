"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { useMedia } from "@/lib/media-context";

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const match = url.match(p);
    if (match) return match[1];
  }
  return null;
}

function formatTime(s: number): string {
  if (!isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export default function MediaPlayer() {
  const { current, isOpen, close } = useMedia();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (current?.type === "audio" && audioRef.current) {
      audioRef.current.src = current.url;
      audioRef.current.play().catch(() => {});
    }
  }, [current]);

  const handleTimeUpdate = useCallback(() => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  }, []);

  const handleScrub = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audioRef.current.currentTime = pct * duration;
  }, [duration]);

  const togglePlay = useCallback(() => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
  }, [playing]);

  if (!isOpen || !current) return null;

  const isYouTube = current.type === "youtube";
  const youtubeId = isYouTube ? extractYouTubeId(current.url) : null;
  const progress = duration > 0 ? currentTime / duration : 0;
  const accentColor = "#4CAF50";

  const audioControls = !isYouTube && (
    <div className="w-full space-y-2">
      {/* Scrub bar */}
      <div
        className="w-full h-2 bg-stone-200 rounded-full cursor-pointer group"
        onClick={handleScrub}
      >
        <div
          className="h-full rounded-full relative transition-[width] duration-100"
          style={{ width: `${progress * 100}%`, backgroundColor: accentColor }}
        >
          <div
            className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ backgroundColor: accentColor }}
          />
        </div>
      </div>
      {/* Time */}
      <div className="flex justify-between text-[10px] text-stone-400 tabular-nums">
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>
    </div>
  );

  const playPauseBtn = (
    <button
      onClick={togglePlay}
      className="w-10 h-10 flex items-center justify-center rounded-full shrink-0 transition-all active:scale-95"
      style={{
        background: playing
          ? `linear-gradient(145deg, ${accentColor}20, ${accentColor}10)`
          : `linear-gradient(145deg, ${accentColor}0a, transparent)`,
        border: `2px solid ${accentColor}`,
        boxShadow: playing
          ? `0 0 8px ${accentColor}30, 0 1px 4px ${accentColor}20`
          : `0 1px 4px ${accentColor}15`,
      }}
    >
      {playing ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth="2.5">
          <rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth="2.5" strokeLinejoin="round">
          <polygon points="6,3 20,12 6,21" />
        </svg>
      )}
    </button>
  );

  return (
    <>
      {/* Shared audio element */}
      <audio
        ref={audioRef}
        onEnded={() => setPlaying(false)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        className="hidden"
      />

      {/* Desktop: side panel */}
      <div className="hidden md:flex fixed inset-y-0 right-0 w-[400px] bg-white border-l border-stone-200 shadow-xl z-30 flex-col">
        <div className="px-4 py-3 border-b border-stone-200 flex items-center justify-between shrink-0">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-stone-900 truncate">{current.title}</p>
            {current.subtitle && (
              <p className="text-xs text-stone-400 truncate">{current.subtitle}</p>
            )}
          </div>
          <button
            onClick={close}
            className="p-1 text-stone-400 hover:text-stone-600 shrink-0 ml-2"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="flex-1 flex items-center justify-center p-6">
          {isYouTube && youtubeId ? (
            <iframe
              src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1`}
              className="w-full aspect-video rounded-lg"
              allow="autoplay; encrypted-media"
              allowFullScreen
            />
          ) : (
            <div className="w-full flex flex-col items-center gap-6">
              <div className="w-24 h-24 rounded-full bg-stone-100 flex items-center justify-center">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-stone-400">
                  <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
                </svg>
              </div>
              {playPauseBtn}
              {audioControls}
            </div>
          )}
        </div>
      </div>

      {/* Mobile: bottom sheet */}
      <div className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-stone-200 shadow-xl z-30">
        {isYouTube && youtubeId ? (
          <>
            <div className="px-4 py-2 flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-stone-900 truncate">{current.title}</p>
              </div>
              <button onClick={close} className="p-1 text-stone-400 hover:text-stone-600 ml-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="px-4 pb-4">
              <iframe
                src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1`}
                className="w-full aspect-video rounded-lg"
                allow="autoplay; encrypted-media"
                allowFullScreen
              />
            </div>
          </>
        ) : (
          <div className="px-4 py-3 space-y-2">
            <div className="flex items-center gap-3">
              {playPauseBtn}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-stone-900 truncate">{current.title}</p>
                {current.subtitle && (
                  <p className="text-[10px] text-stone-400 truncate">{current.subtitle}</p>
                )}
              </div>
              <button onClick={close} className="p-1 text-stone-400 hover:text-stone-600 shrink-0">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            {audioControls}
          </div>
        )}
      </div>
    </>
  );
}
