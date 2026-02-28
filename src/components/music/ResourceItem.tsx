"use client";

import { useMedia } from "@/lib/media-context";
import type { OccasionResource } from "@/lib/types";

function resourceUrl(filePath: string): string {
  return `/api/music/${encodeURIComponent(filePath)}`;
}

export default function ResourceItem({
  resource,
  seasonColor,
}: {
  resource: OccasionResource;
  seasonColor: string;
}) {
  const { play } = useMedia();
  const url = resourceUrl(resource.filePath);

  if (resource.type === "audio") {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-stone-200 bg-white">
        <button
          onClick={() =>
            play({
              type: "audio",
              url,
              title: resource.label,
              subtitle: resource.category === "gospel_acclamation"
                ? "Gospel Acclamation"
                : "Antiphon",
            })
          }
          className="w-6 h-6 flex items-center justify-center rounded-full shrink-0 transition-all active:scale-95"
          style={{
            background: "linear-gradient(145deg, #4CAF500a, transparent)",
            border: "2px solid #4CAF50",
            boxShadow: "0 1px 4px #4CAF5015",
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4CAF50" strokeWidth="2.5" strokeLinejoin="round">
            <polygon points="6,3 20,12 6,21" />
          </svg>
        </button>
        <p className="text-xs font-medium text-stone-700 truncate">
          {resource.label}
        </p>
      </div>
    );
  }

  // PDF — open in new tab
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 px-3 py-2 rounded-md border border-stone-200 bg-white hover:border-stone-300 transition-colors"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke={seasonColor}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="shrink-0"
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
      <p className="text-xs font-medium text-stone-700 truncate">
        {resource.label}
      </p>
    </a>
  );
}
