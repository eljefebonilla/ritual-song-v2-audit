"use client";

import { useState, useMemo } from "react";
import type { DuplicateGroup, DuplicateConfidence, JunkEntry } from "@/lib/duplicate-detection";
import { COMMUNITY_BADGES } from "@/lib/occasion-helpers";

type TabId = "high" | "medium" | "low" | "junk";

const TAB_CONFIG: { id: TabId; label: string; confidence?: DuplicateConfidence }[] = [
  { id: "high", label: "Likely Duplicates", confidence: "high" },
  { id: "medium", label: "Possible Duplicates", confidence: "medium" },
  { id: "low", label: "Same Title, Different Song", confidence: "low" },
  { id: "junk", label: "Junk Entries" },
];

interface DuplicateReviewShellProps {
  groups: DuplicateGroup[];
  junk: JunkEntry[];
}

export default function DuplicateReviewShell({ groups: initialGroups, junk: initialJunk }: DuplicateReviewShellProps) {
  const [groups, setGroups] = useState(initialGroups);
  const [junk, setJunk] = useState(initialJunk);
  const [activeTab, setActiveTab] = useState<TabId>("high");
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [merging, setMerging] = useState<string | null>(null);
  const [dismissing, setDismissing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const counts = useMemo(() => ({
    high: groups.filter((g) => g.confidence === "high").length,
    medium: groups.filter((g) => g.confidence === "medium").length,
    low: groups.filter((g) => g.confidence === "low").length,
    junk: junk.length,
  }), [groups, junk]);

  const filteredGroups = useMemo(
    () => groups.filter((g) => g.confidence === activeTab),
    [groups, activeTab]
  );

  function toggleSelected(songId: string) {
    setSelectedIds((prev) =>
      prev.includes(songId) ? prev.filter((id) => id !== songId) : [...prev, songId]
    );
  }

  async function handleMerge(group: DuplicateGroup, primaryId: string, secondaryId: string) {
    setMerging(group.normalizedTitle);
    try {
      const res = await fetch("/api/songs/duplicates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ primaryId, secondaryId }),
      });
      if (!res.ok) return;
      setGroups((prev) => prev.filter((g) => g.normalizedTitle !== group.normalizedTitle));
      setExpandedGroup(null);
    } finally {
      setMerging(null);
    }
  }

  async function handleClusterMerge(group: DuplicateGroup, keeperKey: string) {
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
    if (secondarySongIds.length === 0) return;

    setMerging(group.normalizedTitle);
    try {
      let latestMerged: { resources: { id: string }[]; usageCount: number } | null = null;
      for (const secondaryId of secondarySongIds) {
        const res = await fetch("/api/songs/duplicates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ primaryId: keeperId, secondaryId }),
        });
        if (!res.ok) return;
        const data = await res.json();
        latestMerged = data.merged;
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
    } finally {
      setMerging(null);
    }
  }

  async function handleDismiss(group: DuplicateGroup) {
    setDismissing(group.normalizedTitle);
    try {
      const res = await fetch("/api/songs/duplicates", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ songIds: group.songs.map((s) => s.id) }),
      });
      if (res.ok) {
        setGroups((prev) => prev.filter((g) => g.normalizedTitle !== group.normalizedTitle));
        setExpandedGroup(null);
      }
    } finally {
      setDismissing(null);
    }
  }

  async function handleDeleteJunk(entry: JunkEntry) {
    setDeleting(entry.id);
    try {
      const res = await fetch(`/api/songs/${entry.id}`, { method: "DELETE" });
      if (res.ok) {
        setJunk((prev) => prev.filter((j) => j.id !== entry.id));
      }
    } finally {
      setDeleting(null);
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

      {/* Tabs */}
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
                              {Object.keys(song.communityUsage).length > 0 ? (
                                <div className="flex gap-1 flex-wrap">
                                  {Object.entries(song.communityUsage)
                                    .sort(([, a], [, b]) => b - a)
                                    .map(([communityId, count]) => {
                                      const badge = COMMUNITY_BADGES[communityId];
                                      if (!badge) return null;
                                      return (
                                        <span
                                          key={communityId}
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

                    {/* Clear selection link for 3+ groups */}
                    {group.songs.length > 2 && selectedIds.length > 0 && (
                      <div className="mt-2">
                        <button
                          onClick={() => setSelectedIds([])}
                          className="text-xs text-stone-400 hover:text-stone-600"
                        >
                          Clear selection
                        </button>
                      </div>
                    )}

                    <div className="flex justify-end mt-3 pt-3 border-t border-stone-100">
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
