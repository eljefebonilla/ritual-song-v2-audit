"use client";

import type { LibrarySong } from "@/lib/types";

interface SongCardProps {
  song: LibrarySong;
  isSelected: boolean;
  onClick: () => void;
}

export default function SongCard({ song, isSelected, onClick }: SongCardProps) {
  const hasResources = song.resources.length > 0;

  // Count resources by source
  const localCount = song.resources.filter((r) => r.source === "local").length;
  const ocpCount = song.resources.filter(
    (r) => r.source === "ocp_bb" || r.source === "ocp_ss"
  ).length;
  const ytCount = song.resources.filter((r) => r.source === "youtube").length;
  const hasAIM = song.resources.some((r) => r.isHighlighted);

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
        {hasAIM && (
          <span className="px-1 py-0.5 text-[9px] font-bold bg-amber-200 text-amber-800 rounded shrink-0">
            AIM
          </span>
        )}
      </div>

      <div className="flex items-center justify-between mt-2">
        <span className="text-[10px] text-stone-400">
          Used {song.usageCount}x
        </span>
        {hasResources ? (
          <div className="flex gap-1">
            {localCount > 0 && (
              <span
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-medium bg-emerald-100 text-emerald-700 rounded"
                title={`${localCount} local files`}
              >
                <svg
                  className="w-2.5 h-2.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
                {localCount}
              </span>
            )}
            {ocpCount > 0 && (
              <span
                className="inline-flex items-center px-1.5 py-0.5 text-[9px] font-medium bg-blue-100 text-blue-700 rounded"
                title="OCP link"
              >
                OCP
              </span>
            )}
            {ytCount > 0 && (
              <span
                className="inline-flex items-center px-1.5 py-0.5 text-[9px] font-medium bg-red-100 text-red-700 rounded"
                title="YouTube link"
              >
                YT
              </span>
            )}
          </div>
        ) : (
          <span className="text-[10px] text-stone-300">No resources</span>
        )}
      </div>
    </button>
  );
}
