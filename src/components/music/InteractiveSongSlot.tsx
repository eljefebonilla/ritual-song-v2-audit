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
      {/* Play bullet column */}
      <span className="w-3 shrink-0 flex items-center justify-center pt-0.5">
        {resolved.audioUrl && resolved.audioType && (
          <button
            onClick={handleToggle}
            className="transition-opacity hover:opacity-70 active:scale-90"
            title={isPlaying ? "Stop" : "Play"}
          >
            {isPlaying ? (
              <svg width="9" height="9" viewBox="0 0 24 24" fill="#4CAF50" stroke="none">
                <rect x="4" y="4" width="16" height="16" rx="2" />
              </svg>
            ) : (
              <svg width="9" height="9" viewBox="0 0 24 24" fill="#4CAF50" stroke="none">
                <polygon points="5,2 21,12 5,22" />
              </svg>
            )}
          </button>
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-stone-800 leading-snug">
          {song.title}
        </p>
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
