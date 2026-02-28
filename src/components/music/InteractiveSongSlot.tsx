"use client";

import Link from "next/link";
import type { SongEntry, ResolvedSong } from "@/lib/types";
import { useMedia } from "@/lib/media-context";

interface InteractiveSongSlotProps {
  label: string;
  song: SongEntry;
  resolved: ResolvedSong;
}

export default function InteractiveSongSlot({
  label,
  song,
  resolved,
}: InteractiveSongSlotProps) {
  const { play } = useMedia();

  const handlePlay = () => {
    if (!resolved.audioUrl || !resolved.audioType) return;
    play({
      type: resolved.audioType,
      url: resolved.audioUrl,
      title: resolved.title,
      subtitle: label,
    });
  };

  return (
    <div className="flex items-start gap-3 py-2 px-3 group">
      <span className="text-[10px] uppercase tracking-wider font-semibold text-stone-400 w-28 shrink-0 pt-0.5">
        {label}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-medium text-stone-800 leading-snug">
            {song.title}
          </p>
          <span className="flex items-center gap-1 shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
            {resolved.audioUrl && resolved.audioType && (
              <button
                onClick={handlePlay}
                className="w-5 h-5 flex items-center justify-center rounded-full bg-stone-800 text-white hover:bg-stone-700 transition-colors"
                title="Play"
              >
                <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5,3 19,12 5,21" />
                </svg>
              </button>
            )}
            <Link
              href={`/library?song=${resolved.id}`}
              className="w-5 h-5 flex items-center justify-center rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
              title="View in library"
            >
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </Link>
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
