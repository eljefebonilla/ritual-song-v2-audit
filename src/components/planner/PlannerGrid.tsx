"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import type { GridColumn } from "@/lib/grid-types";
import {
  GRID_SECTIONS,
  GRID_ROW_LABELS,
  READING_ROWS,
  MASS_PART_ROWS,
  MASS_SETTING_SUB_ROWS,
  type GridRowKey,
} from "@/lib/grid-types";
import { extractCellData, getOccasionDisplayDate } from "@/lib/grid-data";
import { SEASON_COLORS } from "@/lib/liturgical-colors";
import { getAllSynopses } from "@/lib/data";
import { useUser } from "@/lib/user-context";
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
  communityId?: string;
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

export default function PlannerGrid({ columns, viewMode, hideMassParts = false, hideReadings = false, hideSynopses = true, communityId }: PlannerGridProps) {
  const { isAdmin } = useUser();
  const [massSettingExpanded, setMassSettingExpanded] = useState(false);
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);

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

  const handleCellSave = useCallback(async (rk: GridRowKey, title: string, composer: string) => {
    if (!editingCell || !communityId) return;
    const field = rowKeyToField(rk);
    let value: unknown;

    if (rk === "psalm") {
      value = { psalm: title, setting: composer || undefined };
    } else if (rk === "massSetting") {
      value = { massSettingName: title, composer: composer || undefined };
    } else if (rk === "gospelAcclamation") {
      value = { title, composer: composer || undefined };
    } else {
      value = { title, composer: composer || undefined };
    }

    try {
      await fetch(`/api/occasions/${editingCell.occasionId}/music-plan`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ communityId, field, value }),
      });
    } catch {
      // Silently fail for now — future: toast notification
    }
  }, [editingCell, communityId, rowKeyToField]);

  const handleCellClear = useCallback(async (rk: GridRowKey) => {
    if (!editingCell || !communityId) return;
    const field = rowKeyToField(rk);
    try {
      await fetch(`/api/occasions/${editingCell.occasionId}/music-plan`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ communityId, field, value: null }),
      });
    } catch {
      // Silent
    }
  }, [editingCell, communityId, rowKeyToField]);

  if (columns.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-stone-400 text-sm">
        No occasions match your filters. Try adjusting year cycle or season.
      </div>
    );
  }

  // Card view (mobile)
  if (viewMode === "cards") {
    return (
      <div className="h-full overflow-y-auto p-4 space-y-3">
        {columns.map((col) => (
          <OccasionCard key={col.occasion.id} column={col} hideMassParts={hideMassParts} hideReadings={hideReadings} hideSynopses={hideSynopses} />
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

  const COL_WIDTH = 280;
  const LABEL_WIDTH = 130;
  const HEADER_HEIGHT = 110;

  return (
    <div className="h-full overflow-auto planner-scroll">
      <div
        className="relative"
        style={{
          width: LABEL_WIDTH + columns.length * COL_WIDTH,
          minHeight: "100%",
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
            <div
              key={col.occasion.id}
              className={`shrink-0 border-r border-stone-100 ${
                ci % 2 === 0 ? "bg-stone-50/50" : "bg-white"
              }`}
              style={{ width: COL_WIDTH }}
            >
              <GridColumnHeader occasion={col.occasion} />
            </div>
          ))}
        </div>

        {/* Synopsis logline row */}
        {!hideSynopses && (() => {
          const synopses = getAllSynopses();
          return (
            <div className="flex">
              <div
                className="shrink-0 sticky left-0 z-10 bg-stone-50 border-b border-r border-stone-200 flex items-center px-3"
                style={{ width: LABEL_WIDTH, minHeight: 44 }}
              >
                <span className="text-[11px] font-medium text-stone-400 italic uppercase tracking-wide">
                  Synopsis
                </span>
              </div>
              {columns.map((col, ci) => {
                const syn = synopses[col.occasion.id];
                return (
                  <div
                    key={`${col.occasion.id}-synopsis`}
                    className={`shrink-0 border-b border-r border-stone-100 px-2 py-1.5 flex items-center ${
                      ci % 2 === 0 ? "bg-stone-50/50" : "bg-white"
                    }`}
                    style={{ width: COL_WIDTH, minHeight: 44 }}
                  >
                    {syn ? (
                      <p className="text-xs italic text-stone-500 line-clamp-2">
                        {syn.logline}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          );
        })()}

        {/* Grid body */}
        {rows.map((row, ri) => {
          if (row.type === "header") {
            return (
              <div key={`section-${ri}`} className="flex sticky left-0 z-10">
                <div
                  className="shrink-0 sticky left-0 z-10 bg-stone-100 border-b border-r border-stone-200 flex items-center px-3"
                  style={{ width: LABEL_WIDTH, height: 28 }}
                >
                  <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">
                    {row.label}
                  </span>
                </div>
                {columns.map((col) => (
                  <div
                    key={`${col.occasion.id}-section-${ri}`}
                    className="shrink-0 bg-stone-100 border-b border-r border-stone-100"
                    style={{ width: COL_WIDTH, height: 28 }}
                  />
                ))}
              </div>
            );
          }

          const rowKey = row.key!;
          return (
            <div key={`row-${rowKey}`} className="flex">
              <div
                className={`shrink-0 sticky left-0 z-10 border-b border-r border-stone-200 flex items-center px-3 ${
                  row.isReading ? "bg-stone-50" : row.isSubRow ? "bg-stone-50/70" : "bg-white"
                }`}
                style={{ width: LABEL_WIDTH, height: 44 }}
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
              {columns.map((col, ci) => (
                <div
                  key={`${col.occasion.id}-${rowKey}`}
                  className="shrink-0"
                  style={{ width: COL_WIDTH, height: 44 }}
                >
                  <GridCell
                    data={extractCellData(col.plan, rowKey, col.occasion)}
                    isEven={ci % 2 === 0}
                    onEdit={isAdmin ? (rect) => setEditingCell({
                      occasionId: col.occasion.id,
                      rowKey,
                      columnIndex: ci,
                      anchorRect: rect,
                    }) : undefined}
                  />
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* Cell Editor Popover */}
      {editingCell && communityId && (
        <CellEditor
          occasionId={editingCell.occasionId}
          communityId={communityId}
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
        />
      )}
    </div>
  );
}
