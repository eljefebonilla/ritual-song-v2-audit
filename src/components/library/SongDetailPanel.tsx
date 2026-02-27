"use client";

import { useState } from "react";
import type {
  LibrarySong,
  SongResource,
  SongResourceType,
  SongResourceSource,
} from "@/lib/types";
import { useUser } from "@/lib/user-context";
import { useMedia } from "@/lib/media-context";
import Link from "next/link";

interface SongDetailPanelProps {
  song: LibrarySong;
  onClose: () => void;
}

const RESOURCE_TYPE_LABELS: Record<SongResourceType, string> = {
  audio: "Audio",
  sheet_music: "Sheet Music",
  practice_track: "Practice Track",
  hymnal_ref: "Hymnal Reference",
  notation: "Notation",
  lyrics: "Lyrics",
  ocp_link: "OCP",
  youtube: "YouTube",
  other: "Other",
};

const SOURCE_LABELS: Record<SongResourceSource, string> = {
  local: "Local Files",
  ocp_bb: "Breaking Bread (OCP)",
  ocp_ss: "Spirit & Song (OCP)",
  youtube: "YouTube",
  manual: "Manual Links",
};

function resourceUrl(resource: SongResource): string | null {
  if (resource.url) return resource.url;
  if (resource.filePath) {
    return `/api/music/${encodeURIComponent(resource.filePath)}`;
  }
  return null;
}

function ResourceLink({ resource, songTitle }: { resource: SongResource; songTitle?: string }) {
  const { play } = useMedia();
  const url = resourceUrl(resource);
  const isAudio = resource.type === "audio";
  const isLocalAudio = isAudio && resource.filePath;
  const isYouTube = resource.type === "youtube" && resource.url;

  // Open in media player panel (audio or YouTube)
  const openInPlayer = (type: "audio" | "youtube", mediaUrl: string) => {
    play({
      type,
      url: mediaUrl,
      title: songTitle || resource.label,
      subtitle: resource.label,
    });
  };

  // Inline audio player for local audio files
  if (isLocalAudio && url) {
    return (
      <div
        className={`flex items-center gap-2 px-3 py-2 rounded-md border transition-colors ${
          resource.isHighlighted
            ? "border-amber-300 bg-amber-50"
            : "border-stone-200 bg-white"
        }`}
      >
        <button
          onClick={() => openInPlayer("audio", url)}
          className="w-6 h-6 flex items-center justify-center rounded-full bg-stone-800 text-white hover:bg-stone-700 shrink-0"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5,3 19,12 5,21" />
          </svg>
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-stone-700 truncate">
            {resource.label}
            {resource.isHighlighted && (
              <span className="ml-1 px-1 py-0.5 text-[9px] font-bold bg-amber-200 text-amber-800 rounded">
                AIM
              </span>
            )}
          </p>
        </div>
      </div>
    );
  }

  // YouTube links open in player instead of navigating away
  if (isYouTube && resource.url) {
    return (
      <button
        type="button"
        onClick={() => openInPlayer("youtube", resource.url!)}
        className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded-md border hover:border-stone-300 transition-colors group ${
          resource.isHighlighted
            ? "border-amber-300 bg-amber-50 hover:bg-amber-100"
            : "border-stone-200 bg-white hover:bg-stone-50"
        }`}
      >
        <TypeIcon type={resource.type} />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-stone-700 truncate">
            {resource.label}
            {resource.isHighlighted && (
              <span className="ml-1 px-1 py-0.5 text-[9px] font-bold bg-amber-200 text-amber-800 rounded">
                AIM
              </span>
            )}
          </p>
          <p className="text-[10px] text-stone-400 truncate">
            Open in player
          </p>
        </div>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-stone-300 group-hover:text-stone-500 shrink-0">
          <polygon points="5,3 19,12 5,21" />
        </svg>
      </button>
    );
  }

  if (url) {
    const isExternal = resource.url?.startsWith("http");
    return (
      <a
        href={url}
        target={isExternal ? "_blank" : "_self"}
        rel={isExternal ? "noopener noreferrer" : undefined}
        className={`flex items-center gap-2 px-3 py-2 rounded-md border hover:border-stone-300 transition-colors group ${
          resource.isHighlighted
            ? "border-amber-300 bg-amber-50 hover:bg-amber-100"
            : "border-stone-200 bg-white hover:bg-stone-50"
        }`}
      >
        <TypeIcon type={resource.type} />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-stone-700 truncate">
            {resource.label}
            {resource.isHighlighted && (
              <span className="ml-1 px-1 py-0.5 text-[9px] font-bold bg-amber-200 text-amber-800 rounded">
                AIM
              </span>
            )}
          </p>
          {resource.url && (
            <p className="text-[10px] text-stone-400 truncate">
              {resource.url}
            </p>
          )}
        </div>
        <svg
          className="w-3 h-3 text-stone-300 group-hover:text-stone-500 shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {isExternal ? (
            <>
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </>
          ) : (
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
          )}
        </svg>
      </a>
    );
  }

  // Non-URL, non-file resource (e.g., hymnal number)
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-stone-200 bg-white">
      <TypeIcon type={resource.type} />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-stone-700">{resource.label}</p>
        {resource.value && (
          <p className="text-[10px] text-stone-500">{resource.value}</p>
        )}
      </div>
    </div>
  );
}

function TypeIcon({ type }: { type: SongResourceType }) {
  const cls = "w-4 h-4 text-stone-400 shrink-0";
  switch (type) {
    case "audio":
    case "practice_track":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 18V5l12-2v13" />
          <circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
        </svg>
      );
    case "sheet_music":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      );
    case "notation":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M8 13h2M8 17h6" />
        </svg>
      );
    case "ocp_link":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M8 12h8M12 8v8" />
        </svg>
      );
    case "youtube":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19.13C5.12 19.56 12 19.56 12 19.56s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.43z" />
          <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" />
        </svg>
      );
    default:
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
      );
  }
}

export default function SongDetailPanel({
  song,
  onClose,
}: SongDetailPanelProps) {
  const { role } = useUser();
  const [addingResource, setAddingResource] = useState(false);
  const [newType, setNewType] = useState<SongResourceType>("youtube");
  const [newLabel, setNewLabel] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [localResources, setLocalResources] = useState<SongResource[]>([]);

  // Combine server resources with locally-added ones
  const allResources = [...song.resources, ...localResources];

  // Group resources by source
  const resourcesBySource = allResources.reduce<
    Record<string, SongResource[]>
  >((acc, r) => {
    const source = r.source || "manual";
    (acc[source] = acc[source] || []).push(r);
    return acc;
  }, {});

  // Sort: highlighted (AIM) first within each group
  for (const resources of Object.values(resourcesBySource)) {
    resources.sort((a, b) => {
      if (a.isHighlighted && !b.isHighlighted) return -1;
      if (!a.isHighlighted && b.isHighlighted) return 1;
      return 0;
    });
  }

  // Source display order
  const sourceOrder: SongResourceSource[] = [
    "local",
    "ocp_bb",
    "ocp_ss",
    "youtube",
    "manual",
  ];

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 md:hidden"
        onClick={onClose}
      />

      <div className="
        fixed inset-0 z-50 bg-white flex flex-col
        md:relative md:inset-auto md:z-auto md:w-80 md:border-l md:border-stone-200 md:shrink-0
      ">
        {/* Header */}
        <div className="p-4 border-b border-stone-200">
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-bold text-stone-900 leading-tight">
                {song.title}
              </h2>
              {song.composer && (
                <p className="text-xs text-stone-500 mt-0.5">{song.composer}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-1 text-stone-400 hover:text-stone-600 transition-colors shrink-0"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        <div className="flex items-center gap-2 mt-2">
          <p className="text-[10px] text-stone-400">
            Used {song.usageCount}x
          </p>
          {allResources.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded font-medium">
              {allResources.length} resource
              {allResources.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {/* Resources */}
      <div className="flex-1 overflow-y-auto p-4">
        {allResources.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-sm text-stone-400">No resources linked yet.</p>
            {role === "admin" && (
              <p className="text-xs text-stone-300 mt-1">
                Click below to add audio, sheet music, or other resources.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {sourceOrder.map((source) => {
              const resources = resourcesBySource[source];
              if (!resources || resources.length === 0) return null;
              return (
                <div key={source}>
                  <h3 className="text-[10px] uppercase tracking-widest font-bold text-stone-400 mb-1.5">
                    {SOURCE_LABELS[source] || source}
                  </h3>
                  <div className="space-y-1.5">
                    {resources.map((r) => (
                      <ResourceLink key={r.id} resource={r} songTitle={song.title} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Add resource form (admin only) */}
        {role === "admin" && (
          <div className="mt-4 pt-4 border-t border-stone-100">
            {addingResource ? (
              <div className="space-y-2">
                <select
                  value={newType}
                  onChange={(e) =>
                    setNewType(e.target.value as SongResourceType)
                  }
                  className="w-full text-xs border border-stone-200 rounded-md px-2 py-1.5"
                >
                  {Object.entries(RESOURCE_TYPE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="Label (e.g., YouTube Recording)"
                  className="w-full text-xs border border-stone-200 rounded-md px-2 py-1.5"
                />
                <input
                  type="text"
                  value={newUrl}
                  onChange={(e) => {
                    const url = e.target.value;
                    setNewUrl(url);
                    // Auto-detect YouTube and set type/label
                    if (
                      (url.includes("youtube.com") ||
                        url.includes("youtu.be")) &&
                      newType !== "youtube"
                    ) {
                      setNewType("youtube");
                      if (!newLabel) setNewLabel("YouTube");
                    }
                  }}
                  placeholder="URL (YouTube, Dropbox, etc.)"
                  className="w-full text-xs border border-stone-200 rounded-md px-2 py-1.5"
                />
                <div className="flex gap-2">
                  <button
                    disabled={saving || !newLabel.trim()}
                    onClick={async () => {
                      setSaving(true);
                      try {
                        const res = await fetch(
                          `/api/songs/${song.id}/resources`,
                          {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              type: newType,
                              label: newLabel.trim(),
                              url: newUrl.trim() || undefined,
                            }),
                          }
                        );
                        if (res.ok) {
                          const data = await res.json();
                          setLocalResources((prev) => [
                            ...prev,
                            data.resource,
                          ]);
                          setAddingResource(false);
                          setNewLabel("");
                          setNewUrl("");
                        }
                      } finally {
                        setSaving(false);
                      }
                    }}
                    className="flex-1 px-3 py-1.5 text-xs font-medium bg-stone-900 text-white rounded-md hover:bg-stone-800 transition-colors disabled:opacity-50"
                  >
                    {saving ? "Saving..." : "Add Resource"}
                  </button>
                  <button
                    onClick={() => setAddingResource(false)}
                    className="px-3 py-1.5 text-xs font-medium text-stone-500 rounded-md hover:bg-stone-100 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setAddingResource(true)}
                className="w-full px-3 py-2 text-xs font-medium text-stone-500 border border-dashed border-stone-300 rounded-md hover:border-stone-400 hover:text-stone-700 transition-colors"
              >
                + Add Resource
              </button>
            )}
          </div>
        )}
      </div>

      {/* Occasions list */}
      {song.occasions.length > 0 && (
        <div className="border-t border-stone-200 p-4">
          <h3 className="text-[10px] uppercase tracking-widest font-bold text-stone-400 mb-2">
            Used In
          </h3>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {song.occasions.slice(0, 10).map((occId) => (
              <Link
                key={occId}
                href={`/occasion/${occId}`}
                className="block text-xs text-stone-500 hover:text-stone-800 truncate transition-colors"
              >
                {occId
                  .replace(/-/g, " ")
                  .replace(/\b\w/g, (c) => c.toUpperCase())}
              </Link>
            ))}
            {song.occasions.length > 10 && (
              <p className="text-[10px] text-stone-300">
                + {song.occasions.length - 10} more
              </p>
            )}
          </div>
        </div>
      )}
    </div>
    </>
  );
}
