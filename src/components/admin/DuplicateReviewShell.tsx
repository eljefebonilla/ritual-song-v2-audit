"use client";

import { useState, useMemo } from "react";
import type { DuplicateGroup, DuplicateConfidence, JunkEntry } from "@/lib/duplicate-detection";
import { ENSEMBLE_BADGES } from "@/lib/occasion-helpers";

type TabId = "high" | "medium" | "low" | "junk";
type CategoryFilter = "all" | "songs" | "service_music" | "psalms" | "gospel_acclamations" | "antiphons";

const TAB_CONFIG: { id: TabId; label: string; confidence?: DuplicateConfidence }[] = [
  { id: "high", label: "Likely Duplicates", confidence: "high" },
  { id: "medium", label: "Possible Duplicates", confidence: "medium" },
  { id: "low", label: "Same Title, Different Song", confidence: "low" },
  { id: "junk", label: "Junk Entries" },
];

const CATEGORY_TABS: { id: CategoryFilter; label: string; categories: string[] }[] = [
  { id: "all", label: "All", categories: [] },
  { id: "songs", label: "Songs", categories: ["song"] },
  { id: "service_music", label: "Service Music", categories: ["mass_part", "kyrie", "gloria", "sprinkling_rite", "holy_holy", "memorial_acclamation", "great_amen", "lamb_of_god", "lords_prayer", "sequence"] },
  { id: "psalms", label: "Psalms", categories: ["psalm"] },
  { id: "gospel_acclamations", label: "Gospel Accl.", categories: ["gospel_acclamation", "gospel_acclamation_refrain", "gospel_acclamation_verse"] },
  { id: "antiphons", label: "Antiphons", categories: ["antiphon"] },
];

interface UndoAction {
  label: string;
  type: "merge" | "delete" | "dismiss";
  previousGroups: DuplicateGroup[];
  previousJunk: JunkEntry[];
  payload: {
    preMergePrimary?: unknown;
    removedSongs?: unknown[];
    dismissedPairs?: { songIdA: string; songIdB: string }[];
  };
}

interface DuplicateReviewShellProps {
  groups: DuplicateGroup[];
  junk: JunkEntry[];
}

export default function DuplicateReviewShell({ groups: initialGroups, junk: initialJunk }: DuplicateReviewShellProps) {
  const [groups, setGroups] = useState(initialGroups);
  const [junk, setJunk] = useState(initialJunk);
  const [activeTab, setActiveTab] = useState<TabId>("high");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [merging, setMerging] = useState<string | null>(null);
  const [dismissing, setDismissing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [undoAction, setUndoAction] = useState<UndoAction | null>(null);
  const [undoing, setUndoing] = useState(false);

  // Filter groups by category
  const categoryGroups = useMemo(() => {
    if (categoryFilter === "all") return groups;
    const cats = CATEGORY_TABS.find((t) => t.id === categoryFilter)?.categories ?? [];
    return groups.filter((g) => g.songs.some((s) => cats.includes(s.category)));
  }, [groups, categoryFilter]);

  const categoryCounts = useMemo(() => {
    const result: Record<CategoryFilter, number> = { all: 0, songs: 0, service_music: 0, psalms: 0, gospel_acclamations: 0, antiphons: 0 };
    for (const g of groups) {
      result.all++;
      for (const tab of CATEGORY_TABS) {
        if (tab.id === "all") continue;
        if (g.songs.some((s) => tab.categories.includes(s.category))) {
          result[tab.id]++;
        }
      }
    }
    return result;
  }, [groups]);

  const counts = useMemo(() => ({
    high: categoryGroups.filter((g) => g.confidence === "high").length,
    medium: categoryGroups.filter((g) => g.confidence === "medium").length,
    low: categoryGroups.filter((g) => g.confidence === "low").length,
    junk: junk.length,
  }), [categoryGroups, junk]);

  const filteredGroups = useMemo(
    () => categoryGroups.filter((g) => g.confidence === activeTab),
    [categoryGroups, activeTab]
  );

  function toggleSelected(songId: string) {
    setSelectedIds((prev) =>
      prev.includes(songId) ? prev.filter((id) => id !== songId) : [...prev, songId]
    );
  }

  async function handleMerge(group: DuplicateGroup, primaryId: string, secondaryId: string) {
    const prevGroups = groups;
    const prevJunk = junk;
    setMerging(group.normalizedTitle);
    try {
      const res = await fetch("/api/songs/duplicates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ primaryId, secondaryId }),
      });
      if (!res.ok) return;
      const data = await res.json();
      setGroups((prev) => prev.filter((g) => g.normalizedTitle !== group.normalizedTitle));
      setExpandedGroup(null);
      setUndoAction({
        label: `Merged "${group.displayTitle}"`,
        type: "merge",
        previousGroups: prevGroups,
        previousJunk: prevJunk,
        payload: {
          preMergePrimary: data.preMergePrimary,
          removedSongs: [data.removedSong],
        },
      });
    } finally {
      setMerging(null);
    }
  }

  async function handleClusterMerge(group: DuplicateGroup, keeperKey: string) {
    const prevGroups = groups;
    const prevJunk = junk;
    const keeper = group.songs.find((s) => s._key === keeperKey)!;
    const keeperId = keeper.id;
    // Resolve selected _keys to unique song IDs, excluding the keeper
    const secondarySongIds = [
      ...new Set(
        selectedIds
          .filter((key) => key !== keeperKey)
          .map((key) => group.songs.find((s) => s._key === key)!.id)
          .filter((id) => id !== keeperId)
      ),
    ];
    // All selected entries share the keeper's song ID (ensemble-split copies) —
    // nothing to merge on disk, but collapse them in the UI and keep unselected entries
    if (secondarySongIds.length === 0) {
      const selectedKeySet = new Set(selectedIds);
      const remaining = group.songs.filter((s) => !selectedKeySet.has(s._key) || s._key === keeperKey);
      if (remaining.length <= 1) {
        setGroups((prev) => prev.filter((g) => g.normalizedTitle !== group.normalizedTitle));
        setExpandedGroup(null);
      } else {
        setGroups((prev) =>
          prev.map((g) => {
            if (g.normalizedTitle !== group.normalizedTitle) return g;
            return { ...g, songs: remaining };
          })
        );
      }
      setSelectedIds([]);
      return;
    }

    setMerging(group.normalizedTitle);
    try {
      let latestMerged: { resources: { id: string }[]; usageCount: number } | null = null;
      let preMergePrimary: unknown = null;
      const removedSongs: unknown[] = [];

      for (let i = 0; i < secondarySongIds.length; i++) {
        const secondaryId = secondarySongIds[i];
        const res = await fetch("/api/songs/duplicates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ primaryId: keeperId, secondaryId }),
        });
        if (!res.ok) return;
        const data = await res.json();
        latestMerged = data.merged;
        // Only the first call's preMergePrimary represents the true original state
        if (i === 0) preMergePrimary = data.preMergePrimary;
        removedSongs.push(data.removedSong);
      }

      // Remove all entries whose song ID was merged (including split siblings)
      const mergedIdSet = new Set(secondarySongIds);
      const remaining = group.songs.filter((s) => !mergedIdSet.has(s.id));

      if (remaining.length <= 1) {
        setGroups((prev) => prev.filter((g) => g.normalizedTitle !== group.normalizedTitle));
        setExpandedGroup(null);
      } else {
        setGroups((prev) =>
          prev.map((g) => {
            if (g.normalizedTitle !== group.normalizedTitle) return g;
            return {
              ...g,
              songs: remaining.map((s) =>
                s.id === keeperId && latestMerged
                  ? { ...s, resourceCount: latestMerged.resources.length, usageCount: latestMerged.usageCount }
                  : s
              ),
            };
          })
        );
      }
      setSelectedIds([]);
      setUndoAction({
        label: `Merged "${group.displayTitle}"`,
        type: "merge",
        previousGroups: prevGroups,
        previousJunk: prevJunk,
        payload: { preMergePrimary, removedSongs },
      });
    } finally {
      setMerging(null);
    }
  }

  async function handleDismiss(group: DuplicateGroup) {
    const prevGroups = groups;
    const prevJunk = junk;
    setDismissing(group.normalizedTitle);
    try {
      const songIds = group.songs.map((s) => s.id);
      const res = await fetch("/api/songs/duplicates", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ songIds }),
      });
      if (res.ok) {
        setGroups((prev) => prev.filter((g) => g.normalizedTitle !== group.normalizedTitle));
        setExpandedGroup(null);
        // Build pairs matching the insert pattern used by the dismiss API
        const dismissedPairs: { songIdA: string; songIdB: string }[] = [];
        for (let i = 0; i < songIds.length; i++) {
          for (let j = i + 1; j < songIds.length; j++) {
            dismissedPairs.push({ songIdA: songIds[i], songIdB: songIds[j] });
          }
        }
        setUndoAction({
          label: `Dismissed "${group.displayTitle}"`,
          type: "dismiss",
          previousGroups: prevGroups,
          previousJunk: prevJunk,
          payload: { dismissedPairs },
        });
      }
    } finally {
      setDismissing(null);
    }
  }

  async function handleDeleteGroup(group: DuplicateGroup) {
    const prevGroups = groups;
    const prevJunk = junk;
    const uniqueIds = [...new Set(group.songs.map((s) => s.id))];
    setDeleting(group.normalizedTitle);
    try {
      const removedSongs: unknown[] = [];
      for (const id of uniqueIds) {
        const res = await fetch(`/api/songs/${id}`, { method: "DELETE" });
        if (!res.ok) return;
        const data = await res.json();
        if (data.deletedSong) removedSongs.push(data.deletedSong);
      }
      setGroups((prev) => prev.filter((g) => g.normalizedTitle !== group.normalizedTitle));
      setExpandedGroup(null);
      setSelectedIds([]);
      setUndoAction({
        label: `Deleted "${group.displayTitle}"`,
        type: "delete",
        previousGroups: prevGroups,
        previousJunk: prevJunk,
        payload: { removedSongs },
      });
    } finally {
      setDeleting(null);
    }
  }

  async function handleDeleteJunk(entry: JunkEntry) {
    const prevJunk = junk;
    const prevGroups = groups;
    setDeleting(entry.id);
    try {
      const res = await fetch(`/api/songs/${entry.id}`, { method: "DELETE" });
      if (!res.ok) return;
      const data = await res.json();
      setJunk((prev) => prev.filter((j) => j.id !== entry.id));
      if (data.deletedSong) {
        setUndoAction({
          label: `Deleted "${entry.title}"`,
          type: "delete",
          previousGroups: prevGroups,
          previousJunk: prevJunk,
          payload: { removedSongs: [data.deletedSong] },
        });
      }
    } finally {
      setDeleting(null);
    }
  }

  async function handleUndo() {
    if (!undoAction) return;
    setUndoing(true);
    try {
      const res = await fetch("/api/songs/duplicates/undo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: undoAction.type, ...undoAction.payload }),
      });
      if (res.ok) {
        setGroups(undoAction.previousGroups);
        setJunk(undoAction.previousJunk);
        setUndoAction(null);
      }
    } finally {
      setUndoing(false);
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-lg font-bold text-stone-900">Duplicate Review</h1>
        <p className="text-xs text-stone-400 mt-0.5">
          {groups.length} duplicate groups, {junk.length} junk entries
        </p>
      </div>

      {/* Category tabs */}
      <div className="flex gap-1 mb-3 border-b border-stone-200 overflow-x-auto">
        {CATEGORY_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setCategoryFilter(tab.id)}
            className={`px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
              categoryFilter === tab.id
                ? "border-stone-800 text-stone-900"
                : "border-transparent text-stone-400 hover:text-stone-600"
            }`}
          >
            {tab.label} ({categoryCounts[tab.id]})
          </button>
        ))}
      </div>

      {/* Confidence tabs */}
      <div className="flex gap-1 mb-4 bg-stone-100 rounded-lg p-0.5 overflow-x-auto">
        {TAB_CONFIG.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? "bg-white text-stone-900 shadow-sm"
                : "text-stone-500 hover:text-stone-700"
            }`}
          >
            {tab.label} ({counts[tab.id]})
          </button>
        ))}
      </div>

      {/* Duplicate groups */}
      {activeTab !== "junk" && (
        <div className="space-y-2">
          {filteredGroups.length === 0 && (
            <p className="text-sm text-stone-400 py-8 text-center">No items in this category.</p>
          )}
          {filteredGroups.map((group) => {
            const isExpanded = expandedGroup === group.normalizedTitle;
            const isMerging = merging === group.normalizedTitle;
            const isDismissing = dismissing === group.normalizedTitle;
            const isDeleting = deleting === group.normalizedTitle;

            return (
              <div
                key={group.normalizedTitle}
                className="border border-stone-200 rounded-lg bg-white overflow-hidden"
              >
                {/* Group header */}
                <button
                  onClick={() => {
                    setExpandedGroup(isExpanded ? null : group.normalizedTitle);
                    setSelectedIds([]);
                  }}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-stone-50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <ConfidenceBadge confidence={group.confidence} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-stone-900 truncate">
                        {group.displayTitle}
                      </p>
                      <p className="text-xs text-stone-400">
                        {group.songs.length} entries
                        {" \u00b7 "}
                        {group.songs.map((s) => s.composer || "Unknown").join(" vs ")}
                      </p>
                    </div>
                  </div>
                  <svg
                    className={`w-4 h-4 text-stone-400 shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                    viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-stone-100 px-4 py-3">
                    {/* Instruction for 3+ groups */}
                    {group.songs.length > 2 && (
                      <p className="text-xs text-stone-400 mb-2">
                        {selectedIds.length < 2
                          ? "Check the entries that are the same arrangement, then pick which to keep."
                          : `${selectedIds.length} selected \u2014 now click "Keep This One" on the entry you want to keep.`}
                      </p>
                    )}

                    <div className="grid gap-2 sm:grid-cols-2">
                      {group.songs.map((song) => {
                        const isSelected = selectedIds.includes(song._key);

                        return (
                          <div
                            key={song._key}
                            className={`border rounded-md p-3 ${
                              isSelected
                                ? "border-blue-400 bg-blue-50"
                                : "border-stone-200 bg-stone-50"
                            }`}
                          >
                            <p className="text-sm font-medium text-stone-900">{song.title}</p>
                            <p className="text-xs text-stone-500 mt-0.5">
                              {song.composer || "No composer"}
                            </p>
                            <div className="flex items-center gap-3 mt-2 text-xs text-stone-400">
                              <span>{song.resourceCount} resources</span>
                              {Object.keys(song.ensembleUsage).length > 0 ? (
                                <div className="flex gap-1 flex-wrap">
                                  {Object.entries(song.ensembleUsage)
                                    .sort(([, a], [, b]) => b - a)
                                    .map(([ensembleId, count]) => {
                                      const badge = ENSEMBLE_BADGES[ensembleId];
                                      if (!badge) return null;
                                      return (
                                        <span
                                          key={ensembleId}
                                          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold"
                                          style={{ backgroundColor: badge.bg, color: badge.text }}
                                        >
                                          {badge.letter} {count}x
                                        </span>
                                      );
                                    })}
                                </div>
                              ) : (
                                <span>Used {song.usageCount}x</span>
                              )}
                            </div>

                            {/* 2-entry groups: direct merge */}
                            {group.songs.length === 2 && (
                              <button
                                disabled={isMerging}
                                onClick={() => {
                                  const other = group.songs.find((s) => s._key !== song._key)!;
                                  handleMerge(group, song.id, other.id);
                                }}
                                className="mt-2 px-3 py-1 text-xs font-medium text-white bg-stone-900 rounded hover:bg-stone-800 disabled:opacity-50"
                              >
                                {isMerging ? "Merging..." : "Keep This One"}
                              </button>
                            )}

                            {/* 3+ entry groups: checkbox + conditional Keep button */}
                            {group.songs.length > 2 && (
                              <div className="flex items-center gap-2 mt-2">
                                <label className="flex items-center gap-1.5 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => toggleSelected(song._key)}
                                    className="rounded border-stone-300 text-blue-600 focus:ring-blue-500"
                                  />
                                  <span className="text-xs text-stone-500">Same arrangement</span>
                                </label>
                                {isSelected && selectedIds.length >= 2 && (
                                  <button
                                    disabled={isMerging}
                                    onClick={() => handleClusterMerge(group, song._key)}
                                    className="ml-auto px-3 py-1 text-xs font-medium text-white bg-stone-900 rounded hover:bg-stone-800 disabled:opacity-50"
                                  >
                                    {isMerging ? "Merging..." : "Keep This One"}
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Select all / Clear selection for 3+ groups */}
                    {group.songs.length > 2 && (
                      <div className="mt-2 flex gap-3">
                        {selectedIds.length < group.songs.length && (
                          <button
                            onClick={() => setSelectedIds(group.songs.map((s) => s._key))}
                            className="text-xs text-blue-500 hover:text-blue-700"
                          >
                            Select all
                          </button>
                        )}
                        {selectedIds.length > 0 && (
                          <button
                            onClick={() => setSelectedIds([])}
                            className="text-xs text-stone-400 hover:text-stone-600"
                          >
                            Clear selection
                          </button>
                        )}
                      </div>
                    )}

                    <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-stone-100">
                      <button
                        disabled={isDeleting}
                        onClick={() => handleDeleteGroup(group)}
                        className="px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded hover:bg-red-50 disabled:opacity-50"
                      >
                        {isDeleting ? "Deleting..." : "Delete All"}
                      </button>
                      <button
                        disabled={isDismissing}
                        onClick={() => handleDismiss(group)}
                        className="px-3 py-1.5 text-xs font-medium text-stone-500 border border-stone-200 rounded hover:bg-stone-50 disabled:opacity-50"
                      >
                        {isDismissing ? "Dismissing..." : "Not Duplicates"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Junk entries */}
      {activeTab === "junk" && (
        <div className="space-y-2">
          {junk.length === 0 && (
            <p className="text-sm text-stone-400 py-8 text-center">No junk entries found.</p>
          )}
          {junk.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center justify-between border border-stone-200 rounded-lg bg-white px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-stone-900 truncate">{entry.title}</p>
                <p className="text-xs text-red-500 mt-0.5 truncate">
                  Composer: &quot;{entry.composer}&quot;
                </p>
                <p className="text-[10px] text-stone-400 mt-0.5">{entry.reason}</p>
              </div>
              <button
                disabled={deleting === entry.id}
                onClick={() => handleDeleteJunk(entry)}
                className="ml-3 shrink-0 px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded hover:bg-red-50 disabled:opacity-50"
              >
                {deleting === entry.id ? "Deleting..." : "Delete"}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Undo toast bar */}
      {undoAction && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-stone-900 text-white px-4 py-2.5 rounded-lg shadow-lg max-w-md">
          <span className="text-xs truncate">{undoAction.label}</span>
          <button
            disabled={undoing}
            onClick={handleUndo}
            className="shrink-0 px-2.5 py-1 text-xs font-medium bg-white text-stone-900 rounded hover:bg-stone-100 disabled:opacity-50"
          >
            {undoing ? "Undoing..." : "Undo"}
          </button>
          <button
            onClick={() => setUndoAction(null)}
            className="shrink-0 text-stone-400 hover:text-white"
            aria-label="Dismiss"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

function ConfidenceBadge({ confidence }: { confidence: DuplicateConfidence }) {
  const styles: Record<DuplicateConfidence, { bg: string; text: string; label: string }> = {
    high: { bg: "bg-red-100", text: "text-red-700", label: "High" },
    medium: { bg: "bg-amber-100", text: "text-amber-700", label: "Medium" },
    low: { bg: "bg-stone-100", text: "text-stone-500", label: "Low" },
  };
  const s = styles[confidence];
  return (
    <span className={`${s.bg} ${s.text} text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded shrink-0`}>
      {s.label}
    </span>
  );
}
