/**
 * Smart snap guides for the editor canvas.
 * Snaps elements to page center, margins, and other element edges.
 * Threshold: 2mm.
 */

import type { Geometry } from "@/types/schema";
import { MARGINS } from "@/core/design-system/tokens/spacing";

const SNAP_THRESHOLD_MM = 2;

export interface SnapLine {
  axis: "x" | "y";
  position: number; // mm
  type: "center" | "margin" | "element";
}

export interface SnapResult {
  x: number; // snapped x position (mm)
  y: number; // snapped y position (mm)
  guides: SnapLine[]; // active guide lines to render
}

function snapToNearest(
  value: number,
  targets: { pos: number; line: SnapLine }[],
): { snapped: number; guide: SnapLine | null } {
  let closest: { pos: number; line: SnapLine } | null = null;
  let minDist = SNAP_THRESHOLD_MM + 1;

  for (const t of targets) {
    const dist = Math.abs(value - t.pos);
    if (dist < minDist) {
      minDist = dist;
      closest = t;
    }
  }

  if (closest && minDist <= SNAP_THRESHOLD_MM) {
    return { snapped: closest.pos, guide: closest.line };
  }
  return { snapped: value, guide: null };
}

/**
 * Compute snapped position and active guide lines for an element being dragged.
 */
export function computeSnap(
  draggedGeometry: Geometry,
  pageWidth: number,
  pageHeight: number,
  otherElements: Geometry[],
): SnapResult {
  const guides: SnapLine[] = [];

  // Build snap targets for X axis
  const xTargets: { pos: number; line: SnapLine }[] = [
    // Page center
    { pos: pageWidth / 2 - draggedGeometry.width / 2, line: { axis: "x", position: pageWidth / 2, type: "center" } },
    // Margins
    { pos: MARGINS.inner, line: { axis: "x", position: MARGINS.inner, type: "margin" } },
    { pos: pageWidth - MARGINS.outer - draggedGeometry.width, line: { axis: "x", position: pageWidth - MARGINS.outer, type: "margin" } },
  ];

  // Build snap targets for Y axis
  const yTargets: { pos: number; line: SnapLine }[] = [
    // Page center
    { pos: pageHeight / 2 - draggedGeometry.height / 2, line: { axis: "y", position: pageHeight / 2, type: "center" } },
    // Margins
    { pos: MARGINS.top, line: { axis: "y", position: MARGINS.top, type: "margin" } },
    { pos: pageHeight - MARGINS.bottom - draggedGeometry.height, line: { axis: "y", position: pageHeight - MARGINS.bottom, type: "margin" } },
  ];

  // Other element edges
  for (const other of otherElements) {
    // Left edge alignment
    xTargets.push({ pos: other.x, line: { axis: "x", position: other.x, type: "element" } });
    // Right edge alignment
    xTargets.push({ pos: other.x + other.width - draggedGeometry.width, line: { axis: "x", position: other.x + other.width, type: "element" } });
    // Center alignment
    xTargets.push({ pos: other.x + other.width / 2 - draggedGeometry.width / 2, line: { axis: "x", position: other.x + other.width / 2, type: "element" } });

    // Top edge
    yTargets.push({ pos: other.y, line: { axis: "y", position: other.y, type: "element" } });
    // Bottom edge
    yTargets.push({ pos: other.y + other.height - draggedGeometry.height, line: { axis: "y", position: other.y + other.height, type: "element" } });
    // Center
    yTargets.push({ pos: other.y + other.height / 2 - draggedGeometry.height / 2, line: { axis: "y", position: other.y + other.height / 2, type: "element" } });
  }

  const xSnap = snapToNearest(draggedGeometry.x, xTargets);
  const ySnap = snapToNearest(draggedGeometry.y, yTargets);

  if (xSnap.guide) guides.push(xSnap.guide);
  if (ySnap.guide) guides.push(ySnap.guide);

  return {
    x: xSnap.snapped,
    y: ySnap.snapped,
    guides,
  };
}
