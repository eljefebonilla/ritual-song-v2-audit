"use client";

import type { LibrarySong, ResourceDisplayCategory } from "@/lib/types";
import { RESOURCE_DISPLAY_LABELS } from "@/lib/types";
import { getSongDisplayCategories } from "@/lib/song-library";

interface SongCardProps {
  song: LibrarySong;
  isSelected: boolean;
  onClick: () => void;
}

const BADGE_STYLES: Record<ResourceDisplayCategory, string> = {
  aim: "bg-amber-200 text-amber-800",
  lead_sheet: "bg-emerald-100 text-emerald-700",
  choral: "bg-violet-100 text-violet-700",
  color: "bg-sky-100 text-sky-700",
  audio: "bg-red-100 text-red-700",
};

export default function SongCard({ song, isSelected, onClick }: SongCardProps) {
  const categories = getSongDisplayCategories(song);

  return (
    <button
      onClick={onClick}
      className={`text-left w-full p-3 rounded-lg border transition-all ${
        isSelected
          ? "border-stone-400 bg-stone-50 shadow-sm"
          : "border-stone-200 bg-white hover:border-stone-300 hover:shadow-sm"
      }`}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-stone-800 leading-tight truncate">
            {song.title}
          </p>
          {song.composer && (
            <p className="text-xs text-stone-500 mt-0.5 truncate">
              {song.composer}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between mt-2">
        <span className="text-[10px] text-stone-400">
          Used {song.usageCount}x
        </span>
        {categories.size > 0 ? (
          <div className="flex gap-1 flex-wrap justify-end">
            {(["aim", "lead_sheet", "choral", "color", "audio"] as ResourceDisplayCategory[]).map(
              (cat) =>
                categories.has(cat) && (
                  <span
                    key={cat}
                    className={`inline-flex items-center px-1.5 py-0.5 text-[9px] font-medium rounded ${BADGE_STYLES[cat]}`}
                  >
                    {RESOURCE_DISPLAY_LABELS[cat]}
                  </span>
                )
            )}
          </div>
        ) : (
          <span className="text-[10px] text-stone-300">No resources</span>
        )}
      </div>
    </button>
  );
}
