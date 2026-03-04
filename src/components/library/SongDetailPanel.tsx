"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import type {
  LibrarySong,
  SongResource,
} from "@/lib/types";
import { useUser } from "@/lib/user-context";
import { extractChartKeys } from "@/lib/key-utils";
import { filterPsalmResourcesByEnsemble } from "@/lib/occasion-helpers";
import {
  getResourceGroup,
  RESOURCE_GROUP_LABELS,
  RESOURCE_GROUP_ORDER,
  type ResourceDisplayGroup,
} from "@/lib/resource-tags";
import LyricsEditor from "./LyricsEditor";
import ResourceLink from "./ResourceLink";
import ResourceUploadForm from "./ResourceUploadForm";
import Link from "next/link";

interface SongDetailPanelProps {
  song: LibrarySong;
  onClose: () => void;
  onAudioUploaded?: (songId: string, url: string) => void;
  ensembleId?: string;
  psalmSuggestions?: LibrarySong[];
  onSelectSuggestion?: (songId: string) => void;
  occasionId?: string;
  slotRole?: string;
  onSlotReplace?: (songId: string, title: string, composer: string) => void;
}

/* SOURCE_LABELS removed — resources now grouped by tag category */

/* ResourceLink and TypeIcon extracted to ./ResourceLink.tsx */
/* ResourceUploadForm extracted to ./ResourceUploadForm.tsx */

function getLastName(composer: string | undefined): string {
  if (!composer) return "";
  const first = composer.split(/[\/&,]/).map((s) => s.trim())[0];
  const parts = first.split(/\s+/);
  return parts[parts.length - 1];
}

// === Slot Recommendations ===

const SLOT_TO_REC_POSITION: Record<string, string> = {
  prelude: "prelude",
  gathering: "gathering",
  offertory: "offertory",
  communion_0: "communion1",
  communion_1: "communion1",
  communion_2: "communion1",
  sending: "sending",
  responsorial_psalm: "psalm",
  gospel_acclamation: "gospelAcclamation",
};

const REC_POSITION_LABELS: Record<string, string> = {
  prelude: "Prelude",
  gathering: "Gathering",
  offertory: "Offertory",
  communion1: "Communion",
  sending: "Sending",
  psalm: "Psalm",
  gospelAcclamation: "Gospel Accl.",
};

interface SlimRec {
  id: string;
  title: string;
  composer?: string;
  score: number;
  reasons: string[];
}

function getDismissedRecs(): string[] {
  try {
    const raw = localStorage.getItem("rs_dismissed_recs");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function addDismissedRec(songId: string) {
  const current = getDismissedRecs();
  if (!current.includes(songId)) {
    current.push(songId);
    localStorage.setItem("rs_dismissed_recs", JSON.stringify(current));
  }
}

function SlotRecommendations({
  occasionId,
  slotRole,
  currentSongId,
  onReplace,
}: {
  occasionId: string;
  slotRole: string;
  currentSongId: string;
  onReplace?: (songId: string, title: string, composer: string) => void;
}) {
  const recPosition = SLOT_TO_REC_POSITION[slotRole];
  const [recs, setRecs] = useState<SlimRec[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set(getDismissedRecs()));

  useEffect(() => {
    if (!recPosition) {
      setLoading(false);
      return;
    }
    const excludeIds = [currentSongId, ...dismissed].filter(Boolean).join(",");
    fetch(`/api/recommendations/${occasionId}?limit=8&exclude=${excludeIds}`)
      .then((res) => res.json())
      .then((data) => {
        const posRecs: SlimRec[] = data[recPosition] || [];
        setRecs(posRecs.filter((r) => r.id !== currentSongId && !dismissed.has(r.id)));
      })
      .catch(() => setRecs([]))
      .finally(() => setLoading(false));
  }, [occasionId, recPosition, currentSongId, dismissed]);

  if (!recPosition) return null;
  if (loading) {
    return (
      <div className="mt-4 pt-4 border-t border-stone-100">
        <h3 className="text-[10px] uppercase tracking-widest font-bold text-stone-400 mb-2">
          Alternatives for {REC_POSITION_LABELS[recPosition] || recPosition}
        </h3>
        <p className="text-xs text-stone-300 animate-pulse">Loading...</p>
      </div>
    );
  }
  if (recs.length === 0) return null;

  const handleDismiss = (songId: string) => {
    addDismissedRec(songId);
    setDismissed((prev) => new Set(prev).add(songId));
    setRecs((prev) => prev.filter((r) => r.id !== songId));
  };

  return (
    <div className="mt-4 pt-4 border-t border-stone-100">
      <h3 className="text-[10px] uppercase tracking-widest font-bold text-stone-400 mb-2">
        Alternatives for {REC_POSITION_LABELS[recPosition] || recPosition}
      </h3>
      <div className="space-y-1">
        {recs.map((rec) => (
          <div
            key={rec.id}
            className="flex items-start gap-2 px-2 py-1.5 rounded hover:bg-stone-50 transition-colors cursor-pointer"
            onDoubleClick={() => onReplace?.(rec.id, rec.title, rec.composer || "")}
            title="Double-click to use this song"
          >
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-stone-700 truncate">
                {rec.title}
              </p>
              {rec.composer && (
                <p className="text-[10px] text-stone-400 truncate">{rec.composer}</p>
              )}
              {rec.reasons.length > 0 && (
                <div className="flex flex-wrap gap-0.5 mt-0.5">
                  {rec.reasons.slice(0, 3).map((reason, j) => (
                    <span
                      key={j}
                      className="inline-block px-1 py-0 text-[7px] font-medium rounded bg-amber-50 text-amber-600"
                    >
                      {reason}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDismiss(rec.id);
              }}
              className="shrink-0 p-0.5 text-stone-200 hover:text-red-400 transition-colors mt-0.5"
              title="Don't recommend this"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" />
              </svg>
            </button>
          </div>
        ))}
      </div>
      <p className="text-[9px] text-stone-300 mt-1.5 px-2">
        Double-click to replace current song
      </p>
    </div>
  );
}

// === Song Metadata Section ===
function SongMetadataSection({ song }: { song: LibrarySong }) {
  const hasCatalogs = song.catalogs && Object.values(song.catalogs).some(Boolean);
  const hasTopics = song.topics && song.topics.length > 0;
  const hasScriptureRefs = song.scriptureRefs && song.scriptureRefs.length > 0;
  const hasLiturgicalUse = song.liturgicalUse && song.liturgicalUse.length > 0;
  const hasCredits = song.credits && (song.credits.textAuthors?.length || song.credits.composers?.length || song.credits.arrangers?.length);
  const hasTuneMeter = song.tuneMeter && (song.tuneMeter.tuneName || song.tuneMeter.meter);
  const hasFunctions = song.functions && song.functions.length > 0;
  const hasAnyMetadata = hasCatalogs || hasTopics || hasScriptureRefs || hasLiturgicalUse || hasCredits || hasTuneMeter || hasFunctions || song.firstLine || song.refrainFirstLine || song.psalmNumber || song.languages?.length;

  if (!hasAnyMetadata) return null;

  const catalogLabels: Record<string, string> = {
    bb2026: "BB",
    gather4: "G4",
    spiritSong: "SS",
    voices: "V",
    novum: "N",
    aahh: "AAHH",
  };

  return (
    <div className="mt-4 pt-4 border-t border-stone-100">
      <h3 className="text-[10px] uppercase tracking-widest font-bold text-stone-400 mb-2">
        Metadata
      </h3>
      <div className="space-y-2">
        {/* Category badge */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-medium text-stone-400 w-16 shrink-0">Category</span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 bg-stone-100 text-stone-600 rounded">
            {song.category || "song"}
          </span>
        </div>

        {/* Psalm Number */}
        {song.psalmNumber && (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-medium text-stone-400 w-16 shrink-0">Psalm</span>
            <span className="text-sm font-bold text-stone-700">Psalm {song.psalmNumber}</span>
          </div>
        )}

        {/* Catalogs */}
        {hasCatalogs && (
          <div className="flex items-start gap-1.5">
            <span className="text-[10px] font-medium text-stone-400 w-16 shrink-0 mt-0.5">Catalogs</span>
            <div className="flex flex-wrap gap-1">
              {Object.entries(song.catalogs!).map(([key, num]) => {
                if (!num) return null;
                return (
                  <span key={key} className="text-[10px] font-bold px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded">
                    {catalogLabels[key] || key}#{num}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Topics */}
        {hasTopics && (
          <div className="flex items-start gap-1.5">
            <span className="text-[10px] font-medium text-stone-400 w-16 shrink-0 mt-0.5">Topics</span>
            <div className="flex flex-wrap gap-1">
              {song.topics!.slice(0, 12).map((t) => (
                <span key={t} className="text-[10px] px-1.5 py-0.5 bg-stone-100 text-stone-600 rounded">
                  {t}
                </span>
              ))}
              {song.topics!.length > 12 && (
                <span className="text-[10px] text-stone-400">+{song.topics!.length - 12}</span>
              )}
            </div>
          </div>
        )}

        {/* Scripture Refs */}
        {hasScriptureRefs && (
          <div className="flex items-start gap-1.5">
            <span className="text-[10px] font-medium text-stone-400 w-16 shrink-0 mt-0.5">Scripture</span>
            <div className="flex flex-wrap gap-1">
              {song.scriptureRefs!.slice(0, 8).map((ref) => (
                <span key={ref} className="text-[10px] px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded">
                  {ref}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Liturgical Use */}
        {hasLiturgicalUse && (
          <div className="flex items-start gap-1.5">
            <span className="text-[10px] font-medium text-stone-400 w-16 shrink-0 mt-0.5">Liturgical</span>
            <div className="flex flex-wrap gap-1">
              {song.liturgicalUse!.map((u) => (
                <span key={u} className="text-[10px] px-1.5 py-0.5 bg-violet-50 text-violet-700 rounded">
                  {u}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Functions */}
        {hasFunctions && (
          <div className="flex items-start gap-1.5">
            <span className="text-[10px] font-medium text-stone-400 w-16 shrink-0 mt-0.5">Functions</span>
            <div className="flex flex-wrap gap-1">
              {song.functions!.map((f) => (
                <span key={f} className="text-[10px] px-1.5 py-0.5 bg-green-50 text-green-700 rounded">
                  {f}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* First Line / Refrain First Line */}
        {song.firstLine && (
          <div className="flex items-start gap-1.5">
            <span className="text-[10px] font-medium text-stone-400 w-16 shrink-0">First Line</span>
            <span className="text-[10px] text-stone-600 italic">{song.firstLine}</span>
          </div>
        )}
        {song.refrainFirstLine && (
          <div className="flex items-start gap-1.5">
            <span className="text-[10px] font-medium text-stone-400 w-16 shrink-0">Refrain</span>
            <span className="text-[10px] text-stone-600 italic">{song.refrainFirstLine}</span>
          </div>
        )}

        {/* Credits */}
        {hasCredits && (
          <div className="flex items-start gap-1.5">
            <span className="text-[10px] font-medium text-stone-400 w-16 shrink-0 mt-0.5">Credits</span>
            <div className="text-[10px] text-stone-600 space-y-0.5">
              {song.credits!.textAuthors?.map((a) => (
                <div key={a.name}>Text: {a.name}{a.dates ? ` (${a.dates})` : ""}</div>
              ))}
              {song.credits!.composers?.map((c) => (
                <div key={c.name}>Music: {c.name}{c.dates ? ` (${c.dates})` : ""}</div>
              ))}
              {song.credits!.arrangers?.map((a) => (
                <div key={a.name}>Arr: {a.name}{a.dates ? ` (${a.dates})` : ""}</div>
              ))}
            </div>
          </div>
        )}

        {/* Tune / Meter */}
        {hasTuneMeter && (
          <div className="flex items-start gap-1.5">
            <span className="text-[10px] font-medium text-stone-400 w-16 shrink-0">Tune</span>
            <span className="text-[10px] text-stone-600">
              {song.tuneMeter!.tuneName && <span className="font-medium">{song.tuneMeter!.tuneName}</span>}
              {song.tuneMeter!.meter && <span className="ml-1 text-stone-400">{song.tuneMeter!.meter}</span>}
            </span>
          </div>
        )}

        {/* Languages */}
        {song.languages && song.languages.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-medium text-stone-400 w-16 shrink-0">Languages</span>
            <span className="text-[10px] text-stone-600">{song.languages.join(", ")}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// === Star Rating Component ===
function StarRating({ songId }: { songId: string }) {
  const [userRating, setUserRating] = useState<number>(0);
  const [avgRating, setAvgRating] = useState<number>(0);
  const [ratingCount, setRatingCount] = useState<number>(0);
  const [hoveredStar, setHoveredStar] = useState<number>(0);
  const [saving, setSaving] = useState(false);

  // Fetch ratings on mount
  useEffect(() => {
    fetch(`/api/songs/${songId}/rankings`)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data) {
          setAvgRating(data.average || 0);
          setRatingCount(data.count || 0);
          // Find current user's rating (first one for now)
          if (data.rankings?.length > 0) {
            setUserRating(data.rankings[0].ranking);
          }
        }
      })
      .catch(() => {});
  }, [songId]);

  const handleRate = async (rating: number) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/songs/${songId}/ranking`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ranking: rating }),
      });
      if (res.ok) {
        setUserRating(rating);
        // Re-fetch to update average
        const rankRes = await fetch(`/api/songs/${songId}/rankings`);
        if (rankRes.ok) {
          const data = await rankRes.json();
          setAvgRating(data.average || 0);
          setRatingCount(data.count || 0);
        }
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-4 pt-4 border-t border-stone-100">
      <h3 className="text-[10px] uppercase tracking-widest font-bold text-stone-400 mb-2">
        Rating
      </h3>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-0.5" onMouseLeave={() => setHoveredStar(0)}>
          {[1, 2, 3, 4, 5].map((star) => {
            const filled = star <= (hoveredStar || userRating);
            return (
              <button
                key={star}
                disabled={saving}
                onClick={() => handleRate(star)}
                onMouseEnter={() => setHoveredStar(star)}
                className={`w-5 h-5 transition-colors ${filled ? "text-amber-400" : "text-stone-200"} hover:text-amber-300`}
              >
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              </button>
            );
          })}
        </div>
        {ratingCount > 0 && (
          <span className="text-[10px] text-stone-400">
            {avgRating.toFixed(1)} avg ({ratingCount})
          </span>
        )}
      </div>
    </div>
  );
}

// === Visibility Toggle ===
function VisibilityToggle({ songId }: { songId: string }) {
  const [isHidden, setIsHidden] = useState(false);
  const [saving, setSaving] = useState(false);

  const toggle = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/songs/${songId}/visibility`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isHidden: !isHidden }),
      });
      if (res.ok) {
        setIsHidden(!isHidden);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <button
      onClick={toggle}
      disabled={saving}
      className={`p-1 transition-colors ${isHidden ? "text-red-400 hover:text-red-600" : "text-stone-300 hover:text-stone-500"}`}
      title={isHidden ? "Song is hidden — click to show" : "Click to hide this song"}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {isHidden ? (
          <>
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
            <line x1="1" y1="1" x2="23" y2="23" />
          </>
        ) : (
          <>
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </>
        )}
      </svg>
    </button>
  );
}

export default function SongDetailPanel({
  song,
  onClose,
  onAudioUploaded,
  ensembleId,
  psalmSuggestions,
  onSelectSuggestion,
  occasionId,
  slotRole,
  onSlotReplace,
}: SongDetailPanelProps) {
  const router = useRouter();
  const { role } = useUser();
  const isAdmin = role === "admin";
  // Add resource state
  const [addingResource, setAddingResource] = useState(false);
  const [localResources, setLocalResources] = useState<SongResource[]>([]);

  // Edit song state
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(song.title);
  const [editComposer, setEditComposer] = useState(song.composer || "");
  const [editSaving, setEditSaving] = useState(false);

  // Delete song state
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Supabase resources state
  const [supabaseResources, setSupabaseResources] = useState<SongResource[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/songs/${song.id}/resources/supabase`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.resources) {
          setSupabaseResources(data.resources);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [song.id]);

  // Delete resource state
  const [deletingResourceId, setDeletingResourceId] = useState<string | null>(null);
  const [removedResourceIds, setRemovedResourceIds] = useState<Set<string>>(new Set());

  // Combine static JSON + Supabase + locally-added, dedup by ID, minus removed
  const allResources = (() => {
    const seen = new Set<string>();
    const result: SongResource[] = [];
    for (const r of [...song.resources, ...supabaseResources, ...localResources]) {
      if (!seen.has(r.id) && !removedResourceIds.has(r.id)) {
        seen.add(r.id);
        result.push(r);
      }
    }
    return result;
  })();

  // Filter psalm resources by ensemble psalter when viewing from an occasion
  let filteredResources = allResources;
  if (ensembleId && song.category === "psalm") {
    filteredResources = filterPsalmResourcesByEnsemble(allResources, ensembleId);
  }

  // Filter admin-only resources for non-admin users
  const visibleResources = isAdmin
    ? filteredResources
    : filteredResources.filter((r) => r.visibility !== "admin");

  // Group resources by display group (tag-based)
  const resourcesByGroup = visibleResources.reduce<
    Record<ResourceDisplayGroup, SongResource[]>
  >((acc, r) => {
    const group = getResourceGroup(r.tags, r.type);
    (acc[group] = acc[group] || []).push(r);
    return acc;
  }, { score_parts: [], choral: [], audio: [], other: [] });

  // Sort: highlighted (AIM) first within each group
  for (const resources of Object.values(resourcesByGroup)) {
    resources.sort((a, b) => {
      if (a.isHighlighted && !b.isHighlighted) return -1;
      if (!a.isHighlighted && b.isHighlighted) return 1;
      return 0;
    });
  }

  // Compute chart keys from sheet music file paths for media player
  const chartKeys = extractChartKeys(
    allResources
      .filter((r) => r.type === "sheet_music" && r.filePath)
      .map((r) => r.filePath!)
  );

  // --- Handlers ---

  const handleSaveEdit = async () => {
    setEditSaving(true);
    try {
      const res = await fetch(`/api/songs/${song.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle.trim(),
          composer: editComposer.trim() || undefined,
        }),
      });
      if (res.ok) {
        setEditing(false);
        router.refresh();
      }
    } finally {
      setEditSaving(false);
    }
  };

  const handleDeleteSong = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/songs/${song.id}`, { method: "DELETE" });
      if (res.ok) {
        onClose();
        router.refresh();
      }
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteResource = async (resourceId: string) => {
    try {
      const res = await fetch(
        `/api/songs/${song.id}/resources/${resourceId}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        setRemovedResourceIds((prev) => new Set(prev).add(resourceId));
        setDeletingResourceId(null);
      }
    } catch {
      setDeletingResourceId(null);
    }
  };

  const handleResourceAdded = (resource: SongResource) => {
    setLocalResources((prev) => {
      if (prev.some((r) => r.id === resource.id)) return prev;
      return [...prev, resource];
    });
    setAddingResource(false);
  };

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
              {editing ? (
                <div className="space-y-1.5">
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full text-sm font-bold text-stone-900 border border-stone-300 rounded px-1.5 py-0.5"
                    autoFocus
                  />
                  <input
                    type="text"
                    value={editComposer}
                    onChange={(e) => setEditComposer(e.target.value)}
                    placeholder="Composer"
                    className="w-full text-xs text-stone-500 border border-stone-300 rounded px-1.5 py-0.5"
                  />
                  <div className="flex gap-1.5">
                    <button
                      disabled={editSaving || !editTitle.trim()}
                      onClick={handleSaveEdit}
                      className="px-2 py-0.5 text-[10px] font-medium bg-stone-900 text-white rounded hover:bg-stone-800 disabled:opacity-50"
                    >
                      {editSaving ? "Saving..." : "Save"}
                    </button>
                    <button
                      onClick={() => {
                        setEditing(false);
                        setEditTitle(song.title);
                        setEditComposer(song.composer || "");
                      }}
                      className="px-2 py-0.5 text-[10px] font-medium text-stone-500 rounded hover:bg-stone-100"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <h2 className="text-sm font-bold text-stone-900 leading-tight">
                    {song.title}
                  </h2>
                  {song.composer && (
                    <p className="text-xs text-stone-500 mt-0.5">{song.composer}</p>
                  )}
                </>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {isAdmin && !editing && !ensembleId && (
                <button
                  onClick={() => setEditing(true)}
                  className="p-1 text-stone-300 hover:text-stone-600 transition-colors"
                  title="Edit title/composer"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
              )}
              {!ensembleId && <VisibilityToggle songId={song.id} />}
              {isAdmin && !editing && !ensembleId && (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="p-1 text-stone-300 hover:text-red-500 transition-colors"
                  title="Delete song from library"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              )}
              <button
                onClick={onClose}
                className="p-1 text-stone-400 hover:text-stone-600 transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>

          {/* Delete confirmation */}
          {confirmDelete && (
            <div className="mt-3 p-2.5 bg-red-50 border border-red-200 rounded-md">
              <p className="text-xs text-red-800 font-medium">
                Delete &ldquo;{song.title}&rdquo;? This cannot be undone.
              </p>
              <div className="flex gap-2 mt-2">
                <button
                  disabled={deleting}
                  onClick={handleDeleteSong}
                  className="px-2.5 py-1 text-[10px] font-medium bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                >
                  {deleting ? "Deleting..." : "Delete"}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="px-2.5 py-1 text-[10px] font-medium text-stone-500 rounded hover:bg-stone-100"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

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
          {visibleResources.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-sm text-stone-400">No resources linked yet.</p>
              {isAdmin && (
                <p className="text-xs text-stone-300 mt-1">
                  Click below to add audio, sheet music, or other resources.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {RESOURCE_GROUP_ORDER.map((group) => {
                const resources = resourcesByGroup[group];
                if (!resources || resources.length === 0) return null;
                return (
                  <div key={group}>
                    <h3 className="text-[10px] uppercase tracking-widest font-bold text-stone-400 mb-1.5">
                      {RESOURCE_GROUP_LABELS[group]}
                    </h3>
                    <div className="space-y-1.5">
                      {resources.map((r) => (
                        <div key={r.id} className="relative">
                          {/* Resource delete confirmation overlay */}
                          {deletingResourceId === r.id && (
                            <div className="absolute inset-0 z-10 bg-white/95 border border-red-200 rounded-md flex items-center justify-center gap-2 px-2">
                              <p className="text-[10px] text-red-700 font-medium">Delete?</p>
                              <button
                                onClick={() => handleDeleteResource(r.id)}
                                className="px-1.5 py-0.5 text-[10px] font-medium bg-red-600 text-white rounded hover:bg-red-700"
                              >
                                Yes
                              </button>
                              <button
                                onClick={() => setDeletingResourceId(null)}
                                className="px-1.5 py-0.5 text-[10px] font-medium text-stone-500 rounded hover:bg-stone-100"
                              >
                                No
                              </button>
                            </div>
                          )}
                          <ResourceLink
                            resource={r}
                            songTitle={song.title}
                            isAdmin={isAdmin}
                            onDelete={() => setDeletingResourceId(r.id)}
                            songId={song.id}
                            recordedKey={song.recordedKey}
                            chartKeys={chartKeys}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Add resource form (admin only) */}
          {isAdmin && (
            <div className="mt-4 pt-4 border-t border-stone-100">
              {addingResource ? (
                <ResourceUploadForm
                  songId={song.id}
                  songTitle={song.title}
                  songComposer={song.composer}
                  onResourceAdded={handleResourceAdded}
                  onAudioUploaded={onAudioUploaded}
                  onCancel={() => setAddingResource(false)}
                />
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

          {/* Slot Recommendations */}
          {occasionId && slotRole && (
            <SlotRecommendations
              occasionId={occasionId}
              slotRole={slotRole}
              currentSongId={song.id}
              onReplace={onSlotReplace}
            />
          )}

          {/* Lyrics & Metadata (admin only) */}
          {isAdmin && (
            <LyricsEditor songId={song.id} songTitle={song.title} />
          )}

          {/* Enrichment Metadata */}
          <SongMetadataSection song={song} />

          {/* Star Rating */}
          <StarRating songId={song.id} />
        </div>

        {/* Psalm Suggestions */}
        {psalmSuggestions && psalmSuggestions.length > 0 && onSelectSuggestion && (
          <div className="border-t border-stone-200 p-4">
            <h3 className="text-[10px] uppercase tracking-widest font-bold text-stone-400 mb-2">
              Other Settings ({psalmSuggestions.length})
            </h3>
            <div className="space-y-1">
              {psalmSuggestions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => onSelectSuggestion(s.id)}
                  className="w-full text-left px-2 py-1.5 rounded hover:bg-stone-50 transition-colors group"
                >
                  <p className="text-xs font-medium text-stone-600 group-hover:text-stone-900 truncate">
                    {s.title}
                  </p>
                  {s.composer && (
                    <p className="text-[10px] text-stone-400">{s.composer}</p>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

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
