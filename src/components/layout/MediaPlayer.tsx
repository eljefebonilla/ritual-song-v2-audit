"use client";

import { useRef, useEffect, useState } from "react";
import { useMedia } from "@/lib/media-context";

/**
 * Extracts a YouTube video ID from various URL formats.
 */
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

export default function MediaPlayer() {
  const { current, isOpen, close } = useMedia();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);

  // Auto-play audio when current changes
  useEffect(() => {
    if (current?.type === "audio" && audioRef.current) {
      audioRef.current.src = current.url;
      audioRef.current.play().catch(() => {});
    }
  }, [current]);

  if (!isOpen || !current) return null;

  const isYouTube = current.type === "youtube";
  const youtubeId = isYouTube ? extractYouTubeId(current.url) : null;

  return (
    <>
      {/* Desktop: side panel */}
      <div className="hidden md:flex fixed inset-y-0 right-0 w-[400px] bg-white border-l border-stone-200 shadow-xl z-30 flex-col">
        {/* Header */}
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

        {/* Content */}
        <div className="flex-1 flex items-center justify-center p-4">
          {isYouTube && youtubeId ? (
            <iframe
              src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1`}
              className="w-full aspect-video rounded-lg"
              allow="autoplay; encrypted-media"
              allowFullScreen
            />
          ) : (
            <div className="w-full flex flex-col items-center gap-4">
              <div className="w-24 h-24 rounded-full bg-stone-100 flex items-center justify-center">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-stone-400">
                  <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
                </svg>
              </div>
              <audio
                ref={audioRef}
                controls
                className="w-full"
                onEnded={() => setPlaying(false)}
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
              />
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
          <div className="px-4 py-3 flex items-center gap-3">
            <button
              onClick={() => {
                if (!audioRef.current) return;
                if (playing) {
                  audioRef.current.pause();
                } else {
                  audioRef.current.play();
                }
              }}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-stone-900 text-white shrink-0"
            >
              {playing ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" />
                </svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5,3 19,12 5,21" />
                </svg>
              )}
            </button>
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
            <audio
              ref={audioRef}
              onEnded={() => setPlaying(false)}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
            />
          </div>
        )}
      </div>
    </>
  );
}
