"use client";

import type { GridColumn } from "@/lib/grid-types";
import {
  GRID_SECTIONS,
  GRID_ROW_LABELS,
  type GridRowKey,
} from "@/lib/grid-types";
import { extractCellData } from "@/lib/grid-data";
import GridColumnHeader from "./GridColumnHeader";
import GridCell from "./GridCell";

interface PlannerGridProps {
  columns: GridColumn[];
}

export default function PlannerGrid({ columns }: PlannerGridProps) {
  if (columns.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-stone-400 text-sm">
        No occasions match your filters. Try adjusting year cycle or season.
      </div>
    );
  }

  const rows: { type: "header" | "row"; label: string; key?: GridRowKey }[] = [];
  for (const section of GRID_SECTIONS) {
    rows.push({ type: "header", label: section.label });
    for (const rowKey of section.rows) {
      rows.push({ type: "row", label: GRID_ROW_LABELS[rowKey], key: rowKey });
    }
  }

  const COL_WIDTH = 140;
  const LABEL_WIDTH = 130;
  const HEADER_HEIGHT = 72;

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
                {columns.map((col, ci) => (
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
                className="shrink-0 sticky left-0 z-10 bg-white border-b border-r border-stone-200 flex items-center px-3"
                style={{ width: LABEL_WIDTH, height: 44 }}
              >
                <span className="text-[11px] font-medium text-stone-500 uppercase tracking-wide">
                  {row.label}
                </span>
              </div>
              {columns.map((col, ci) => (
                <div
                  key={`${col.occasion.id}-${rowKey}`}
                  className="shrink-0"
                  style={{ width: COL_WIDTH, height: 44 }}
                >
                  <GridCell
                    data={extractCellData(col.plan, rowKey)}
                    isEven={ci % 2 === 0}
                  />
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
