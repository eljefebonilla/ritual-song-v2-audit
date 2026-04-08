"use client";

import React, { useState, useCallback, useMemo, useEffect } from "react";
import Link from "next/link";
import type { GridColumn, SongDragPayload } from "@/lib/grid-types";
import type { LibrarySong } from "@/lib/types";
import {
  GRID_SECTIONS,
  GRID_ROW_LABELS,
  READING_ROWS,
  MASS_PART_ROWS,
  MASS_SETTING_SUB_ROWS,
  SONG_DRAG_ROWS,
  SONG_COPY_MIME,
  type GridRowKey,
} from "@/lib/grid-types";
import { extractCellData, getOccasionDisplayDate } from "@/lib/grid-data";
import { SEASON_COLORS } from "@/lib/liturgical-colors";
import { normalizeTitle } from "@/lib/occasion-helpers";
import { getAllSynopses } from "@/lib/data";
import { getTitleIndex, pickBestMatch, resourceUrl } from "@/lib/song-library";
import { useUser } from "@/lib/user-context";
import { useMedia } from "@/lib/media-context";
import GridColumnHeader from "./GridColumnHeader";
import GridCell from "./GridCell";
import CellEditor from "./CellEditor";
import RecommendationChips from "./RecommendationChips";
import type { PlannerViewMode } from "./PlannerShell";

const MASS_SETTING_SUB_SET = new Set<GridRowKey>(MASS_SETTING_SUB_ROWS);

interface PlannerGridProps {
  columns: GridColumn[];
  viewMode: PlannerViewMode;
  hideMassParts?: boolean;
  hideReadings?: boolean;
  hideSynopses?: boolean;
  ensembleId?: string;
  onPlanChange?: () => void;
  onHideOccasion?: (id: string) => void;
}

interface EditingCell {
  occasionId: string;
  rowKey: GridRowKey;
  columnIndex: number;
  anchorRect: DOMRect;
}

function OccasionCard({ column, hideMassParts = false, hideReadings = false, hideSynopses = true }: { column: GridColumn; hideMassParts?: boolean; hideReadings?: boolean; hideSynopses?: boolean }) {
  const { occasion, plan } = column;
  const colors = SEASON_COLORS[occasion.season] || SEASON_COLORS.ordinary;
  const displayDate = getOccasionDisplayDate(occasion);
  const synopses = getAllSynopses();
  const synopsis = synopses[occasion.id];

  const shortName = occasion.name
    .replace(/\[([ABC])\]/, "")
    .replace(/^(ORDINARY TIME|ORD\. TIME)\s*/, "OT ")
    .trim();

  return (
    <div className="border border-stone-200 rounded-lg bg-white overflow-hidden">
      {/* Card header */}
      <div className="px-4 py-3 border-b border-stone-100" style={{ borderTopWidth: 3, borderTopColor: colors.primary }}>
        <div className="flex items-center justify-between">
          <Link
            href={`/occasion/${occasion.id}`}
            className="text-sm font-bold text-stone-900 hover:text-stone-700 transition-colors"
          >
            {shortName}
          </Link>
          <div className="flex items-center gap-2">
            {occasion.year !== "ABC" && (
              <span className="text-[10px] font-bold text-stone-400">
                {occasion.year}
              </span>
            )}
            {displayDate && (
              <span className="text-xs text-stone-400">{displayDate}</span>
            )}
          </div>
        </div>
        {/* Season + reading tags */}
        <div className="flex flex-wrap items-center gap-1 mt-1.5">
          <span
            className="inline-block px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-sm text-white"
            style={{ backgroundColor: colors.primary }}
          >
            {occasion.seasonLabel}
          </span>
          {occasion.lectionary?.thematicTag && (
            <span className="inline-block px-1.5 py-0.5 text-[9px] font-medium rounded-sm bg-stone-100 text-stone-600">
              {occasion.lectionary.thematicTag}
            </span>
          )}
          {(() => {
            const gospel = occasion.readings?.find((r) => r.type === "gospel");
            if (!gospel) return null;
            const m = gospel.citation.match(/^(\d?\s*[A-Za-z]+)\s+(\d+)/);
            const label = m ? `${m[1]} ${m[2]}` : gospel.citation.slice(0, 12);
            return (
              <span className="inline-block px-1.5 py-0.5 text-[9px] font-medium rounded-sm bg-amber-50 text-amber-700">
                {label}
              </span>
            );
          })()}
        </div>
      </div>

      {/* Synopsis (when visible) */}
      {!hideSynopses && synopsis && (
        <div className="px-4 py-2 border-b border-stone-100">
          <p className="text-xs font-medium text-stone-600">{synopsis.logline}</p>
          <p className="text-xs text-stone-400 italic mt-1 border-l-2 pl-2" style={{ borderColor: colors.primary }}>
            {synopsis.invitesUsTo.length > 200 ? synopsis.invitesUsTo.slice(0, 200) + "…" : synopsis.invitesUsTo}
          </p>
        </div>
      )}

      {/* Card body — music plan rows + readings */}
      <div className="divide-y divide-stone-50">
        {GRID_SECTIONS.map((section) => {
          const sectionRows = section.rows
            .filter((rowKey) => !(hideMassParts && MASS_PART_ROWS.has(rowKey)))
            .filter((rowKey) => !(hideReadings && READING_ROWS.has(rowKey)))
            .map((rowKey) => {
              const data = extractCellData(plan, rowKey, occasion);
              return { rowKey, data };
            })
            .filter((r) => !r.data.isEmpty);

          if (sectionRows.length === 0) return null;

          return (
            <div key={section.label} className="px-4 py-2">
              <p className="text-[9px] font-bold text-stone-400 uppercase tracking-wider mb-1">
                {section.label}
              </p>
              {sectionRows.map(({ rowKey, data }) => (
                <div key={rowKey} className={`flex items-baseline gap-2 py-0.5 ${data.isReading ? "opacity-70" : ""}`}>
                  <span className="text-[10px] text-stone-400 shrink-0 w-20">
                    {GRID_ROW_LABELS[rowKey]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <span className={`text-xs ${data.isReading ? "italic text-stone-500" : "font-medium text-stone-800"}`}>
                      {data.title}
                    </span>
                    {data.composer && (
                      <span className="text-[10px] text-stone-400 ml-1">
                        {data.composer}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* Recommendation suggestions for key empty slots */}
      {(() => {
        const keyPositions = ["gathering", "offertory", "communion1", "sending"] as const;
        const emptyPositions = keyPositions.filter((pos) => {
          const data = extractCellData(plan, pos as GridRowKey, occasion);
          return data.isEmpty;
        });
        if (emptyPositions.length === 0) return null;
        return (
          <div className="px-4 py-2 border-t border-stone-100 bg-stone-50/50">
            <p className="text-[9px] font-bold text-stone-400 uppercase tracking-wider mb-1">
              Suggestions
            </p>
            {emptyPositions.map((pos) => (
              <div key={pos} className="mb-1.5">
                <span className="text-[9px] font-medium text-stone-500">
                  {GRID_ROW_LABELS[pos as GridRowKey]}:
                </span>
                <RecommendationChips
                  occasionId={occasion.id}
                  position={pos}
                />
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );
}

/** Find the best playable audio/youtube resource for a song */
function findPlayable(song: LibrarySong): { url: string; type: "audio" | "youtube"; label?: string } | null {
  for (const r of song.resources) {
    if (r.type === "audio" && (r.url || r.storagePath)) {
      const url = resourceUrl(r);
      if (url) return { url, type: "audio", label: r.label };
    }
  }
  for (const r of song.resources) {
    if (r.type === "audio" && r.filePath && !r.url && !r.storagePath) {
      const url = resourceUrl(r);
      if (url) return { url, type: "audio", label: r.label };
    }
  }
  for (const r of song.resources) {
    if (r.type === "youtube" && r.url) {
      return { url: r.url, type: "youtube", label: r.label };
    }
  }
  if (song.youtubeUrl) {
    return { url: song.youtubeUrl, type: "youtube" };
  }
  return null;
}

export default function PlannerGrid({ columns, viewMode, hideMassParts = false, hideReadings = false, hideSynopses = true, ensembleId, onPlanChange, onHideOccasion }: PlannerGridProps) {
  const { isAdmin } = useUser();
  const { play } = useMedia();
  const [massSettingExpanded, setMassSettingExpanded] = useState(false);
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [dragOverCell, setDragOverCell] = useState<{ occasionId: string; rowKey: GridRowKey } | null>(null);

  // Song lookup for play buttons
  const songIndex = useMemo(() => getTitleIndex(), [columns]); // eslint-disable-line react-hooks/exhaustive-deps
  const lookupSong = useCallback((title: string, composer?: string): LibrarySong | null => {
    const key = normalizeTitle(title);
    const candidates = songIndex.get(key);
    if (!candidates) return null;
    return pickBestMatch(candidates, composer);
  }, [songIndex]);

  // Batch-fetch audio URLs for all songs in visible columns
  const [audioOverrides, setAudioOverrides] = useState<Record<string, string>>({});
  const [youtubeOverrides, setYoutubeOverrides] = useState<Record<string, string>>({});

  const allSongIds = useMemo(() => {
    const ids = new Set<string>();
    for (const col of columns) {
      if (!col.plan) continue;
      const fields = ["prelude", "gathering", "penitentialAct", "gloria", "offertory", "lordsPrayer", "fractionRite", "sending", "responsorialPsalm", "gospelAcclamation"] as const;
      for (const f of fields) {
        const val = col.plan[f as keyof typeof col.plan];
        if (val && typeof val === "object" && "title" in val) {
          const song = lookupSong((val as { title: string }).title, (val as { composer?: string }).composer);
          if (song) ids.add(song.id);
        }
      }
      if (col.plan.communionSongs) {
        for (const s of col.plan.communionSongs) {
          const song = lookupSong(s.title, s.composer);
          if (song) ids.add(song.id);
        }
      }
    }
    return [...ids];
  }, [columns, lookupSong]);

  useEffect(() => {
    if (allSongIds.length === 0) return;
    let cancelled = false;
    fetch(`/api/songs/batch-audio?ids=${allSongIds.join(",")}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled) {
          if (data?.audioUrls) setAudioOverrides(data.audioUrls);
          if (data?.youtubeUrls) setYoutubeOverrides(data.youtubeUrls);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [allSongIds]);

  // Map rowKey to the MusicPlan field name for the API
  const rowKeyToField = useCallback((key: GridRowKey): string => {
    switch (key) {
      case "prelude": return "prelude";
      case "gathering": return "gathering";
      case "penitentialAct": return "penitentialAct";
      case "gloria": return "gloria";
      case "psalm": return "responsorialPsalm";
      case "gospelAcclamation": return "gospelAcclamation";
      case "offertory": return "offertory";
      case "massSetting": return "eucharisticAcclamations";
      case "lordsPrayer": return "lordsPrayer";
      case "fractionRite": return "fractionRite";
      case "communion1": return "communionSongs";
      case "communion2": return "communionSongs";
      case "communion3": return "communionSongs";
      case "sending": return "sending";
      default: return key;
    }
  }, []);

  // Helper: get communion index from rowKey (0, 1, 2)
  const communionIndex = (rk: GridRowKey): number | null => {
    if (rk === "communion1") return 0;
    if (rk === "communion2") return 1;
    if (rk === "communion3") return 2;
    return null;
  };

  // Helper: build the communion array value for a save at a specific index
  const buildCommunionValue = (plan: import("@/lib/types").MusicPlan | null, idx: number, entry: { title: string; composer?: string } | null) => {
    const current = plan?.communionSongs ? [...plan.communionSongs] : [];
    // Extend array if needed
    while (current.length <= idx) current.push({ title: "" });
    if (entry) {
      current[idx] = entry;
    } else {
      current.splice(idx, 1);
    }
    // Trim trailing empty entries
    while (current.length > 0 && !current[current.length - 1].title) current.pop();
    return current.length > 0 ? current : null;
  };

  const handleCellSave = useCallback(async (rk: GridRowKey, title: string, composer: string, description?: string) => {
    if (!editingCell || !ensembleId) return;
    const field = rowKeyToField(rk);
    let value: unknown;

    const cIdx = communionIndex(rk);
    if (cIdx !== null) {
      const plan = columns[editingCell.columnIndex]?.plan ?? null;
      value = buildCommunionValue(plan, cIdx, { title, composer: composer || undefined, description: description || undefined });
    } else if (rk === "psalm") {
      value = { psalm: title, setting: composer || undefined, description: description || undefined };
    } else if (rk === "massSetting") {
      value = { massSettingName: title, composer: composer || undefined, description: description || undefined };
    } else {
      value = { title, composer: composer || undefined, description: description || undefined };
    }

    try {
      await fetch(`/api/occasions/${editingCell.occasionId}/music-plan`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ensembleId, field, value }),
      });
      onPlanChange?.();
    } catch {
      // Silently fail for now — future: toast notification
    }
  }, [editingCell, ensembleId, rowKeyToField, columns, onPlanChange]);

  const handleCellClear = useCallback(async (rk: GridRowKey) => {
    if (!editingCell || !ensembleId) return;
    const field = rowKeyToField(rk);

    const cIdx = communionIndex(rk);
    let value: unknown = null;
    if (cIdx !== null) {
      const plan = columns[editingCell.columnIndex]?.plan ?? null;
      value = buildCommunionValue(plan, cIdx, null);
    }

    try {
      await fetch(`/api/occasions/${editingCell.occasionId}/music-plan`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ensembleId, field, value }),
      });
      onPlanChange?.();
    } catch {
      // Silent
    }
  }, [editingCell, ensembleId, rowKeyToField, columns, onPlanChange]);

  // --- Drag-and-copy handlers ---
  const handleDragStart = useCallback((e: React.DragEvent, occasionId: string, rowKey: GridRowKey, cellData: { title: string; composer?: string }) => {
    const payload: SongDragPayload = {
      title: cellData.title,
      composer: cellData.composer,
      sourceOccasionId: occasionId,
      sourceRowKey: rowKey,
    };
    e.dataTransfer.setData(SONG_COPY_MIME, JSON.stringify(payload));
    e.dataTransfer.effectAllowed = "copy";
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, occasionId: string, rowKey: GridRowKey) => {
    // Only accept our custom MIME type (reject OS file drops etc.)
    if (!e.dataTransfer.types.includes(SONG_COPY_MIME)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setDragOverCell({ occasionId, rowKey });
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverCell(null);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent, targetOccasionId: string, targetRowKey: GridRowKey, targetColumnIndex: number) => {
    e.preventDefault();
    setDragOverCell(null);

    const raw = e.dataTransfer.getData(SONG_COPY_MIME);
    if (!raw || !ensembleId) return;

    let payload: SongDragPayload;
    try {
      payload = JSON.parse(raw);
    } catch {
      return;
    }

    const field = rowKeyToField(targetRowKey);
    const entry = { title: payload.title, composer: payload.composer };

    const cIdx = communionIndex(targetRowKey);
    let value: unknown;
    if (cIdx !== null) {
      const plan = columns[targetColumnIndex]?.plan ?? null;
      value = buildCommunionValue(plan, cIdx, entry);
    } else {
      value = entry;
    }

    try {
      await fetch(`/api/occasions/${targetOccasionId}/music-plan`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ensembleId, field, value }),
      });
      onPlanChange?.();
    } catch {
      // Silent
    }
  }, [ensembleId, rowKeyToField, columns, onPlanChange]);

  if (columns.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-stone-400 text-sm">
        No occasions match your filters. Try adjusting year cycle or season.
      </div>
    );
  }

  // Detect where Holy Week divider should be inserted.
  // Insert before the first Easter column that follows a Lent column.
  const holyWeekDividerIndex = (() => {
    for (let i = 1; i < columns.length; i++) {
      const prev = columns[i - 1].occasion.season;
      const curr = columns[i].occasion.season;
      if ((prev === "lent" || prev === "holyweek") && curr === "easter") {
        return i;
      }
    }
    return -1;
  })();
  const DIVIDER_WIDTH = 48;
  const HOLY_WEEK_COLOR = "#7F1D1D";

  // Card view (mobile)
  if (viewMode === "cards") {
    return (
      <div className="h-full overflow-y-auto p-4 pb-24 space-y-3">
        {columns.map((col, ci) => (
          <React.Fragment key={col.occasion.id}>
            {ci === holyWeekDividerIndex && (
              <div className="flex items-center gap-3 py-2">
                <div className="flex-1 h-px" style={{ backgroundColor: HOLY_WEEK_COLOR }} />
                <span className="text-xs font-bold uppercase tracking-wider" style={{ color: HOLY_WEEK_COLOR }}>
                  Holy Week
                </span>
                <div className="flex-1 h-px" style={{ backgroundColor: HOLY_WEEK_COLOR }} />
              </div>
            )}
            <OccasionCard column={col} hideMassParts={hideMassParts} hideReadings={hideReadings} hideSynopses={hideSynopses} />
          </React.Fragment>
        ))}
      </div>
    );
  }

  // Grid view (desktop)
  const rows: { type: "header" | "row"; label: string; key?: GridRowKey; isReading?: boolean; isExpandable?: boolean; isSubRow?: boolean }[] = [];
  for (const section of GRID_SECTIONS) {
    // Check if any rows in this section are visible
    const visibleRows = section.rows.filter((rowKey) => {
      if (hideMassParts && MASS_PART_ROWS.has(rowKey)) return false;
      if (hideReadings && READING_ROWS.has(rowKey)) return false;
      // Hide mass setting sub-rows when collapsed
      if (MASS_SETTING_SUB_SET.has(rowKey) && !massSettingExpanded) return false;
      return true;
    });
    if (visibleRows.length === 0) continue;

    rows.push({ type: "header", label: section.label });
    for (const rowKey of visibleRows) {
      rows.push({
        type: "row",
        label: GRID_ROW_LABELS[rowKey],
        key: rowKey,
        isReading: READING_ROWS.has(rowKey),
        isExpandable: rowKey === "massSetting",
        isSubRow: MASS_SETTING_SUB_SET.has(rowKey),
      });
    }
  }

  const COL_WIDTH = 300;
  const LABEL_WIDTH = 160;
  const HEADER_HEIGHT = 110;
  const ROW_HEIGHT = 36;
  const totalWidth = LABEL_WIDTH + columns.length * COL_WIDTH + (holyWeekDividerIndex >= 0 ? DIVIDER_WIDTH : 0);

  return (
    <div className="h-full overflow-auto planner-scroll">
      <div
        className="relative"
        style={{
          width: totalWidth,
          minHeight: "100%",
          paddingBottom: 96,
        }}
      >
        {/* Column headers */}
        <div
          className="sticky top-0 z-20 flex bg-white border-b border-stone-200"
          style={{ height: HEADER_HEIGHT }}
        >
          <div
            className="shrink-0 sticky left-0 z-30 bg-white border-r border-stone-200"
            style={{ width: LABEL_WIDTH }}
          />
          {columns.map((col, ci) => (
            <React.Fragment key={col.occasion.id}>
              {ci === holyWeekDividerIndex && (
                <div
                  className="shrink-0 flex flex-col items-center justify-center border-r border-stone-100"
                  style={{ width: DIVIDER_WIDTH, backgroundColor: HOLY_WEEK_COLOR }}
                >
                  <span className="text-[9px] font-bold text-white uppercase tracking-widest [writing-mode:vertical-lr] rotate-180">
                    Holy Week
                  </span>
                </div>
              )}
              <div
                className={`shrink-0 border-r border-stone-100 ${
                  ci % 2 === 0 ? "bg-stone-50/50" : "bg-white"
                }`}
                style={{ width: COL_WIDTH }}
              >
                <GridColumnHeader occasion={col.occasion} onHide={onHideOccasion ? () => onHideOccasion(col.occasion.id) : undefined} />
              </div>
            </React.Fragment>
          ))}
        </div>

        {/* Synopsis logline row */}
        {!hideSynopses && (() => {
          const synopses = getAllSynopses();
          return (
            <div className="flex">
              <div
                className="shrink-0 sticky left-0 z-10 bg-stone-50 border-b border-r border-stone-200 flex items-center px-3"
                style={{ width: LABEL_WIDTH, minHeight: ROW_HEIGHT }}
              >
                <span className="text-[11px] font-medium text-stone-400 italic uppercase tracking-wide">
                  Synopsis
                </span>
              </div>
              {columns.map((col, ci) => {
                const syn = synopses[col.occasion.id];
                return (
                  <React.Fragment key={`${col.occasion.id}-synopsis`}>
                    {ci === holyWeekDividerIndex && (
                      <div className="shrink-0 border-b border-r border-stone-100" style={{ width: DIVIDER_WIDTH, minHeight: ROW_HEIGHT, backgroundColor: HOLY_WEEK_COLOR }} />
                    )}
                    <div
                      className={`shrink-0 border-b border-r border-stone-100 px-2 py-1.5 flex items-center ${
                        ci % 2 === 0 ? "bg-stone-50/50" : "bg-white"
                      }`}
                      style={{ width: COL_WIDTH, minHeight: ROW_HEIGHT }}
                    >
                      {syn ? (
                        <p className="text-xs italic text-stone-500 line-clamp-2">
                          {syn.logline}
                        </p>
                      ) : null}
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          );
        })()}

        {/* Grid body */}
        {rows.map((row, ri) => {
          if (row.type === "header") {
            return (
              <div key={`section-${ri}`} className="flex bg-stone-100 border-b border-stone-200" style={{ height: 28 }}>
                <div
                  className="shrink-0 sticky left-0 z-10 bg-stone-100 flex items-center px-3"
                  style={{ width: LABEL_WIDTH }}
                >
                  <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider whitespace-nowrap">
                    {row.label}
                  </span>
                </div>
                {columns.map((col, ci) => (
                  <React.Fragment key={`${col.occasion.id}-hdr-${ri}`}>
                    {ci === holyWeekDividerIndex && (
                      <div className="shrink-0" style={{ width: DIVIDER_WIDTH }} />
                    )}
                    <div className="shrink-0" style={{ width: COL_WIDTH }} />
                  </React.Fragment>
                ))}
              </div>
            );
          }

          const rowKey = row.key!;
          return (
            <div key={`row-${rowKey}`} className="flex">
              <div
                className={`shrink-0 sticky left-0 z-10 border-b border-r border-stone-200 flex items-center justify-end px-3 text-right ${
                  row.isReading ? "bg-stone-50" : row.isSubRow ? "bg-stone-50/70" : "bg-white"
                }`}
                style={{ width: LABEL_WIDTH, minHeight: ROW_HEIGHT }}
              >
                {row.isExpandable ? (
                  <button
                    onClick={() => setMassSettingExpanded(!massSettingExpanded)}
                    className="flex items-center gap-1 text-[11px] font-medium text-stone-500 uppercase tracking-wide hover:text-stone-700"
                  >
                    <svg
                      width="10" height="10"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={`transition-transform ${massSettingExpanded ? "rotate-90" : ""}`}
                    >
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                    {row.label}
                  </button>
                ) : (
                  <span className={`text-[11px] font-medium uppercase tracking-wide ${
                    row.isReading ? "text-stone-400 italic" : row.isSubRow ? "text-stone-400 pl-3" : "text-stone-500"
                  }`}>
                    {row.label}
                  </span>
                )}
              </div>
              {columns.map((col, ci) => {
                const cellData = extractCellData(col.plan, rowKey, col.occasion);
                const isDraggable = isAdmin && SONG_DRAG_ROWS.has(rowKey);
                const isOver = dragOverCell?.occasionId === col.occasion.id && dragOverCell?.rowKey === rowKey;

                // Lookup song for play button
                let matchedSong: LibrarySong | null = null;
                let playable: ReturnType<typeof findPlayable> = null;
                if (!row.isReading && !cellData.isEmpty && cellData.title) {
                  matchedSong = lookupSong(cellData.title, cellData.composer);
                  if (matchedSong) {
                    // Check batch-audio overrides first
                    const overrideUrl = audioOverrides[matchedSong.id];
                    const ytOverrideUrl = youtubeOverrides[matchedSong.id];
                    if (overrideUrl) {
                      playable = { url: overrideUrl, type: "audio" };
                    } else {
                      playable = findPlayable(matchedSong);
                      if (!playable && ytOverrideUrl) {
                        playable = { url: ytOverrideUrl, type: "youtube" };
                      }
                    }
                  }
                }

                return (
                  <React.Fragment key={`${col.occasion.id}-${rowKey}`}>
                    {ci === holyWeekDividerIndex && (
                      <div className="shrink-0 border-b border-r border-stone-100" style={{ width: DIVIDER_WIDTH, minHeight: ROW_HEIGHT, backgroundColor: HOLY_WEEK_COLOR, opacity: 0.15 }} />
                    )}
                    <div
                      className="shrink-0"
                      style={{ width: COL_WIDTH, minHeight: ROW_HEIGHT }}
                    >
                      <GridCell
                        data={cellData}
                        isEven={ci % 2 === 0}
                        hasAudio={!!playable}
                        audioType={playable?.type}
                        onPlay={playable && matchedSong ? () => {
                          play({
                            type: playable!.type,
                            url: playable!.url,
                            title: matchedSong!.title,
                            subtitle: playable!.label,
                            songId: matchedSong!.id,
                          });
                        } : undefined}
                        onEdit={isAdmin ? (rect) => setEditingCell({
                          occasionId: col.occasion.id,
                          rowKey,
                          columnIndex: ci,
                          anchorRect: rect,
                        }) : undefined}
                        draggable={isDraggable && !cellData.isEmpty ? true : undefined}
                        onDragStart={isDraggable && !cellData.isEmpty ? (e) => handleDragStart(e, col.occasion.id, rowKey, cellData) : undefined}
                        isDragOver={isDraggable ? isOver : undefined}
                        onDragOver={isDraggable ? (e) => handleDragOver(e, col.occasion.id, rowKey) : undefined}
                        onDragLeave={isDraggable ? handleDragLeave : undefined}
                        onDrop={isDraggable ? (e) => handleDrop(e, col.occasion.id, rowKey, ci) : undefined}
                      />
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Cell Editor Popover */}
      {editingCell && ensembleId && (
        <CellEditor
          occasionId={editingCell.occasionId}
          ensembleId={ensembleId}
          rowKey={editingCell.rowKey}
          currentData={extractCellData(
            columns[editingCell.columnIndex]?.plan ?? null,
            editingCell.rowKey,
            columns[editingCell.columnIndex]?.occasion
          )}
          anchorRect={editingCell.anchorRect}
          onSave={handleCellSave}
          onClear={handleCellClear}
          onClose={() => setEditingCell(null)}
          onBulkApply={async (rowKey, title, composer, scope) => {
            try {
              await fetch("/api/occasions/bulk-apply", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  occasionId: editingCell.occasionId,
                  position: rowKey,
                  title,
                  composer,
                  scope,
                  ensembleId,
                }),
              });
              // Also save to current cell
              handleCellSave(rowKey, title, composer);
            } catch (err) {
              console.error("Bulk apply failed:", err);
            }
          }}
        />
      )}
    </div>
  );
}
