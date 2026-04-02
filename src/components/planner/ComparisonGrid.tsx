"use client";

import React, { useState, useCallback, useMemo } from "react";
import type { LiturgicalOccasion, MusicPlan, LibrarySong } from "@/lib/types";
import type { GridColumn, SongDragPayload, EnsembleId } from "@/lib/grid-types";
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
import { extractCellData } from "@/lib/grid-data";
import { ENSEMBLE_BADGES, normalizeTitle } from "@/lib/occasion-helpers";
import { useUser } from "@/lib/user-context";
import { useMedia } from "@/lib/media-context";
import { getTitleIndex, pickBestMatch, resourceUrl } from "@/lib/song-library";
import GridCell from "./GridCell";
import CellEditor from "./CellEditor";

const MASS_SETTING_SUB_SET = new Set<GridRowKey>(MASS_SETTING_SUB_ROWS);

interface CompareColumn {
  column: GridColumn;
  ensembleId: EnsembleId;
}

interface ComparisonGridProps {
  occasion: LiturgicalOccasion;
  columns: CompareColumn[];
  hideMassParts?: boolean;
  hideReadings?: boolean;
  onPlanChange?: () => void;
  songs: LibrarySong[];
  onSelectSong?: (song: LibrarySong) => void;
}

interface EditingCell {
  columnIndex: number;
  rowKey: GridRowKey;
  anchorRect: DOMRect;
}

/** Find the best playable audio/youtube resource for a song */
function findPlayable(song: LibrarySong): { url: string; type: "audio" | "youtube"; label?: string } | null {
  // Supabase-hosted audio first
  for (const r of song.resources) {
    if (r.type === "audio" && (r.url || r.storagePath)) {
      const url = resourceUrl(r);
      if (url) return { url, type: "audio", label: r.label };
    }
  }
  // Local audio
  for (const r of song.resources) {
    if (r.type === "audio" && r.filePath && !r.url && !r.storagePath) {
      const url = resourceUrl(r);
      if (url) return { url, type: "audio", label: r.label };
    }
  }
  // YouTube
  for (const r of song.resources) {
    if (r.type === "youtube" && r.url) {
      return { url: r.url, type: "youtube", label: r.label };
    }
  }
  return null;
}

export default function ComparisonGrid({
  occasion,
  columns,
  hideMassParts = false,
  hideReadings = false,
  onPlanChange,
  songs,
  onSelectSong,
}: ComparisonGridProps) {
  const { isAdmin } = useUser();
  const { play } = useMedia();
  const [massSettingExpanded, setMassSettingExpanded] = useState(false);
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [dragOverCell, setDragOverCell] = useState<{
    columnIndex: number;
    rowKey: GridRowKey;
  } | null>(null);

  // Build a normalized title → LibrarySong index
  const songIndex = useMemo(() => {
    const titleIdx = getTitleIndex();
    return titleIdx;
  }, [songs]); // eslint-disable-line react-hooks/exhaustive-deps

  const lookupSong = useCallback(
    (title: string, composer?: string): LibrarySong | null => {
      const key = normalizeTitle(title);
      const candidates = songIndex.get(key);
      if (!candidates) return null;
      return pickBestMatch(candidates, composer);
    },
    [songIndex]
  );

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

  const communionIndex = (rk: GridRowKey): number | null => {
    if (rk === "communion1") return 0;
    if (rk === "communion2") return 1;
    if (rk === "communion3") return 2;
    return null;
  };

  const buildCommunionValue = (
    plan: MusicPlan | null,
    idx: number,
    entry: { title: string; composer?: string } | null
  ) => {
    const current = plan?.communionSongs ? [...plan.communionSongs] : [];
    while (current.length <= idx) current.push({ title: "" });
    if (entry) {
      current[idx] = entry;
    } else {
      current.splice(idx, 1);
    }
    while (current.length > 0 && !current[current.length - 1].title) current.pop();
    return current.length > 0 ? current : null;
  };

  const handleCellSave = useCallback(
    async (rk: GridRowKey, title: string, composer: string) => {
      if (!editingCell) return;
      const { columnIndex } = editingCell;
      const ensembleId = columns[columnIndex].ensembleId;
      const plan = columns[columnIndex].column.plan;
      const field = rowKeyToField(rk);
      let value: unknown;

      const cIdx = communionIndex(rk);
      if (cIdx !== null) {
        value = buildCommunionValue(plan, cIdx, { title, composer: composer || undefined });
      } else if (rk === "psalm") {
        value = { psalm: title, setting: composer || undefined };
      } else if (rk === "massSetting") {
        value = { massSettingName: title, composer: composer || undefined };
      } else {
        value = { title, composer: composer || undefined };
      }

      try {
        await fetch(`/api/occasions/${occasion.id}/music-plan`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ensembleId, field, value }),
        });
        onPlanChange?.();
      } catch {
        // Silent
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editingCell, columns, occasion.id, onPlanChange, rowKeyToField]
  );

  const handleCellClear = useCallback(
    async (rk: GridRowKey) => {
      if (!editingCell) return;
      const { columnIndex } = editingCell;
      const ensembleId = columns[columnIndex].ensembleId;
      const plan = columns[columnIndex].column.plan;
      const field = rowKeyToField(rk);

      const cIdx = communionIndex(rk);
      let value: unknown = null;
      if (cIdx !== null) {
        value = buildCommunionValue(plan, cIdx, null);
      }

      try {
        await fetch(`/api/occasions/${occasion.id}/music-plan`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ensembleId, field, value }),
        });
        onPlanChange?.();
      } catch {
        // Silent
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editingCell, columns, occasion.id, onPlanChange, rowKeyToField]
  );

  // --- Drag-and-drop between columns ---
  const handleDragStart = useCallback(
    (e: React.DragEvent, colIdx: number, rowKey: GridRowKey, cellData: { title: string; composer?: string }) => {
      const payload: SongDragPayload = {
        title: cellData.title,
        composer: cellData.composer,
        sourceOccasionId: occasion.id,
        sourceRowKey: rowKey,
        sourceEnsembleId: columns[colIdx].ensembleId,
      };
      e.dataTransfer.setData(SONG_COPY_MIME, JSON.stringify(payload));
      e.dataTransfer.effectAllowed = "copy";
    },
    [occasion.id, columns]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent, colIdx: number, rowKey: GridRowKey) => {
      if (!e.dataTransfer.types.includes(SONG_COPY_MIME)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      setDragOverCell({ columnIndex: colIdx, rowKey });
    },
    []
  );

  const handleDragLeave = useCallback(() => {
    setDragOverCell(null);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent, targetColIdx: number, targetRowKey: GridRowKey) => {
      e.preventDefault();
      setDragOverCell(null);

      const raw = e.dataTransfer.getData(SONG_COPY_MIME);
      if (!raw) return;

      let payload: SongDragPayload;
      try {
        payload = JSON.parse(raw);
      } catch {
        return;
      }

      const targetEnsembleId = columns[targetColIdx].ensembleId;

      // Skip no-op: same ensemble, same row, same occasion
      if (
        payload.sourceEnsembleId === targetEnsembleId &&
        payload.sourceRowKey === targetRowKey &&
        payload.sourceOccasionId === occasion.id
      ) {
        return;
      }

      const field = rowKeyToField(targetRowKey);
      const entry = { title: payload.title, composer: payload.composer };

      const cIdx = communionIndex(targetRowKey);
      let value: unknown;
      if (cIdx !== null) {
        const plan = columns[targetColIdx].column.plan;
        value = buildCommunionValue(plan, cIdx, entry);
      } else {
        value = entry;
      }

      try {
        await fetch(`/api/occasions/${occasion.id}/music-plan`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ensembleId: targetEnsembleId, field, value }),
        });
        onPlanChange?.();
      } catch {
        // Silent
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [occasion.id, columns, onPlanChange, rowKeyToField]
  );

  // Build visible rows
  const rows: {
    type: "header" | "row";
    label: string;
    key?: GridRowKey;
    isReading?: boolean;
    isExpandable?: boolean;
    isSubRow?: boolean;
  }[] = [];

  for (const section of GRID_SECTIONS) {
    const visibleRows = section.rows.filter((rowKey) => {
      if (hideMassParts && MASS_PART_ROWS.has(rowKey)) return false;
      if (hideReadings && READING_ROWS.has(rowKey)) return false;
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

  const LABEL_WIDTH = 160;
  const COL_WIDTH = 300;
  const colCount = columns.length;
  const gridCols = `${LABEL_WIDTH}px ${`${COL_WIDTH}px `.repeat(colCount).trim()}`;

  const editingEnsembleId = editingCell
    ? columns[editingCell.columnIndex].ensembleId
    : "";
  const editingPlan = editingCell
    ? columns[editingCell.columnIndex].column.plan
    : null;

  return (
    <div className="h-full overflow-auto">
      <div className="min-w-[500px]">
        {/* Column headers */}
        <div
          className="sticky top-0 z-20 grid bg-white border-b border-stone-200"
          style={{ gridTemplateColumns: gridCols }}
        >
          <div className="border-r border-stone-200" />
          {columns.map((cc, ci) => {
            const badge = ENSEMBLE_BADGES[cc.ensembleId];
            return (
              <div
                key={ci}
                className={`px-4 py-3 text-center ${ci < colCount - 1 ? "border-r border-stone-100" : ""}`}
                style={{ backgroundColor: badge?.bg }}
              >
                <span
                  className="text-sm font-bold uppercase tracking-wide"
                  style={{ color: badge?.text }}
                >
                  {cc.ensembleId}
                </span>
              </div>
            );
          })}
        </div>

        {/* Grid body */}
        {rows.map((row, ri) => {
          if (row.type === "header") {
            return (
              <div
                key={`section-${ri}`}
                className="grid border-b border-stone-200"
                style={{ gridTemplateColumns: gridCols }}
              >
                <div
                  className="bg-stone-100 flex items-center px-3 h-7"
                  style={{ gridColumn: `1 / -1` }}
                >
                  <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider whitespace-nowrap">
                    {row.label}
                  </span>
                </div>
              </div>
            );
          }

          const rowKey = row.key!;
          const isPsalmText = rowKey === "psalmText";
          const cellDataArr = columns.map((cc) =>
            extractCellData(cc.column.plan, rowKey, occasion)
          );

          // Diff highlight: check if any non-empty cells differ from each other
          const nonEmptyTitles = cellDataArr
            .filter((d) => !d.isEmpty)
            .map((d) => d.title);
          const hasDiff =
            !row.isReading &&
            nonEmptyTitles.length >= 2 &&
            new Set(nonEmptyTitles).size > 1;
          const hasMismatch =
            !row.isReading &&
            cellDataArr.some((d) => d.isEmpty) &&
            cellDataArr.some((d) => !d.isEmpty);

          const isDraggable = isAdmin && SONG_DRAG_ROWS.has(rowKey);

          return (
            <div
              key={`row-${rowKey}`}
              className="grid"
              style={{ gridTemplateColumns: gridCols }}
            >
              {/* Row label */}
              <div
                className={`border-b border-r border-stone-200 flex items-center justify-end px-3 text-right ${
                  row.isReading ? "h-auto min-h-9" : "h-9"
                } ${
                  row.isReading ? "bg-stone-50" : row.isSubRow ? "bg-stone-50/70" : "bg-white"
                }`}
              >
                {row.isExpandable ? (
                  <button
                    onClick={() => setMassSettingExpanded(!massSettingExpanded)}
                    className="flex items-center gap-1 text-[11px] font-medium text-stone-500 uppercase tracking-wide hover:text-stone-700"
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
                      className={`transition-transform ${massSettingExpanded ? "rotate-90" : ""}`}
                    >
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                    {row.label}
                  </button>
                ) : (
                  <span
                    className={`text-[11px] font-medium uppercase tracking-wide ${
                      row.isReading
                        ? "text-stone-400 italic"
                        : row.isSubRow
                        ? "text-stone-400 pl-3"
                        : "text-stone-500"
                    }`}
                  >
                    {row.label}
                  </span>
                )}
              </div>

              {/* Cells for each ensemble */}
              {columns.map((cc, ci) => {
                const cellData = cellDataArr[ci];
                const isOver =
                  dragOverCell?.columnIndex === ci && dragOverCell?.rowKey === rowKey;
                const cellIsEmpty = cellData.isEmpty;

                // Per-cell diff highlight
                let diffClass = "";
                if (hasDiff) {
                  diffClass = "bg-amber-50/40";
                } else if (hasMismatch && cellIsEmpty) {
                  diffClass = "bg-red-50/30";
                }

                // Lookup song for music rows
                let matchedSong: LibrarySong | null = null;
                let playable: ReturnType<typeof findPlayable> = null;
                if (!row.isReading && !cellIsEmpty && cellData.title) {
                  matchedSong = lookupSong(cellData.title, cellData.composer);
                  if (matchedSong) {
                    playable = findPlayable(matchedSong);
                  }
                }

                return (
                  <div
                    key={ci}
                    className={`border-b border-stone-100 ${
                      row.isReading ? "h-auto min-h-9" : "h-9"
                    } ${ci < colCount - 1 ? "border-r" : ""} ${diffClass}`}
                  >
                    <GridCell
                      data={cellData}
                      isEven={ci % 2 === 0}
                      onEdit={
                        isAdmin
                          ? (rect) =>
                              setEditingCell({ columnIndex: ci, rowKey, anchorRect: rect })
                          : undefined
                      }
                      draggable={isDraggable && !cellIsEmpty ? true : undefined}
                      onDragStart={
                        isDraggable && !cellIsEmpty
                          ? (e) => handleDragStart(e, ci, rowKey, cellData)
                          : undefined
                      }
                      isDragOver={isDraggable ? isOver : undefined}
                      onDragOver={
                        isDraggable ? (e) => handleDragOver(e, ci, rowKey) : undefined
                      }
                      onDragLeave={isDraggable ? handleDragLeave : undefined}
                      onDrop={
                        isDraggable ? (e) => handleDrop(e, ci, rowKey) : undefined
                      }
                      hasAudio={!!playable}
                      onPlay={
                        playable && matchedSong
                          ? () => {
                              play({
                                type: playable!.type,
                                url: playable!.url,
                                title: matchedSong!.title,
                                subtitle: playable!.label,
                                songId: matchedSong!.id,
                              });
                            }
                          : undefined
                      }
                      onDetail={
                        matchedSong && onSelectSong
                          ? () => onSelectSong(matchedSong!)
                          : undefined
                      }
                    />
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Cell Editor Popover */}
      {editingCell && editingEnsembleId && (
        <CellEditor
          occasionId={occasion.id}
          ensembleId={editingEnsembleId}
          rowKey={editingCell.rowKey}
          currentData={extractCellData(editingPlan ?? null, editingCell.rowKey, occasion)}
          anchorRect={editingCell.anchorRect}
          onSave={handleCellSave}
          onClear={handleCellClear}
          onClose={() => setEditingCell(null)}
        />
      )}
    </div>
  );
}
