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
          className="w-6 h-6 flex items-center justify-center rounded-full shrink-0 hover:opacity-80 transition-opacity"
          style={{ backgroundColor: "#22c55e" }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="white">
            <polygon points="5,3 19,12 5,21" />
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
