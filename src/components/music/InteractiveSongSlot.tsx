"use client";

import type { SongEntry, ResolvedSong } from "@/lib/types";
import { useMedia } from "@/lib/media-context";

interface InteractiveSongSlotProps {
  label: string;
  song: SongEntry;
  resolved: ResolvedSong;
  isSelected?: boolean;
  onSelect?: () => void;
}

export default function InteractiveSongSlot({
  label,
  song,
  resolved,
  isSelected,
  onSelect,
}: InteractiveSongSlotProps) {
  const { play, stop, current } = useMedia();

  const isPlaying = current?.url === resolved.audioUrl;

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!resolved.audioUrl || !resolved.audioType) return;
    if (isPlaying) {
      stop();
    } else {
      play({
        type: resolved.audioType,
        url: resolved.audioUrl,
        title: resolved.title,
        subtitle: label,
      });
    }
  };

  return (
    <div
      className={`flex items-start gap-3 py-2 px-3 transition-colors ${
        onSelect ? "cursor-pointer hover:bg-stone-50" : ""
      } ${isSelected ? "bg-stone-100 border-l-2 border-l-stone-800" : ""}`}
      onClick={onSelect}
    >
      <span className="text-[10px] uppercase tracking-wider font-semibold text-stone-400 w-28 shrink-0 pt-0.5">
        {label}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-medium text-stone-800 leading-snug">
            {song.title}
          </p>
          <span className="flex items-center gap-1 shrink-0">
            {resolved.audioUrl && resolved.audioType && (
              <button
                onClick={handleToggle}
                className="w-6 h-6 flex items-center justify-center rounded-full transition-all active:scale-95"
                title={isPlaying ? "Stop" : "Play"}
                style={isPlaying ? {
                  background: "linear-gradient(145deg, #4CAF5020, #4CAF5010)",
                  border: "2px solid #4CAF50",
                  boxShadow: "0 0 8px #4CAF5030, 0 1px 4px #4CAF5020",
                } : {
                  background: "linear-gradient(145deg, #4CAF500a, transparent)",
                  border: "2px solid #4CAF50",
                  boxShadow: "0 1px 4px #4CAF5015",
                }}
              >
                {isPlaying ? (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#4CAF50" strokeWidth="3">
                    <rect x="4" y="4" width="16" height="16" rx="2" />
                  </svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4CAF50" strokeWidth="2.5" strokeLinejoin="round">
                    <polygon points="6,3 20,12 6,21" />
                  </svg>
                )}
              </button>
            )}
          </span>
        </div>
        {song.composer && (
          <p className="text-xs text-stone-500">{song.composer}</p>
        )}
        {song.description && song.description !== "Description" && (
          <p className="text-xs text-stone-400 italic">{song.description}</p>
        )}
      </div>
    </div>
  );
}
