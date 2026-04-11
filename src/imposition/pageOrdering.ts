import type { FoldFormat, SheetPlan } from "./types";
import { inToPt } from "./units";

function padToMultiple(totalPages: number, multiple: number): number {
  if (totalPages <= 0) return 0;
  const rem = totalPages % multiple;
  return rem === 0 ? totalPages : totalPages + (multiple - rem);
}

function pageOrBlank(pageNumber: number, totalOriginalPages: number): number | null {
  return pageNumber >= 1 && pageNumber <= totalOriginalPages ? pageNumber : null;
}

/**
 * HALF-LETTER SADDLE-STITCH BOOKLET IMPOSITION
 * Finished page: 5.5" x 8.5", printed 2-up on letter landscape (11" x 8.5").
 *
 * For N padded to a multiple of 4, sheets = N/4.
 * Sheet s (0-based, outer to inner):
 *   front: left = N - 2s, right = 1 + 2s
 *   back:  left = 2 + 2s, right = N - 1 - 2s
 */
export function planHalfLetterSaddleStitch(totalOriginalPages: number): SheetPlan[] {
  const sheetW = inToPt(11);
  const sheetH = inToPt(8.5);
  const panelW = inToPt(5.5);
  const panelH = inToPt(8.5);
  const foldX = [panelW];

  const padded = padToMultiple(totalOriginalPages, 4);
  const sheets = padded / 4;

  const plans: SheetPlan[] = [];
  for (let s = 0; s < sheets; s++) {
    const frontLeft = pageOrBlank(padded - 2 * s, totalOriginalPages);
    const frontRight = pageOrBlank(1 + 2 * s, totalOriginalPages);
    const backLeft = pageOrBlank(2 + 2 * s, totalOriginalPages);
    const backRight = pageOrBlank(padded - 1 - 2 * s, totalOriginalPages);

    plans.push({
      sheetIndex: s,
      sheetWidth: sheetW,
      sheetHeight: sheetH,
      front: {
        side: "front",
        placements: [
          { pageNumber: frontLeft, x: 0, y: 0, width: panelW, height: panelH, rotation: 0, label: `S${s}-F-L` },
          { pageNumber: frontRight, x: panelW, y: 0, width: panelW, height: panelH, rotation: 0, label: `S${s}-F-R` },
        ],
        foldX,
      },
      back: {
        side: "back",
        placements: [
          { pageNumber: backLeft, x: 0, y: 0, width: panelW, height: panelH, rotation: 0, label: `S${s}-B-L` },
          { pageNumber: backRight, x: panelW, y: 0, width: panelW, height: panelH, rotation: 0, label: `S${s}-B-R` },
        ],
        foldX,
      },
    });
  }

  return plans;
}

/**
 * BI-FOLD (LETTER): 8.5" x 11" folded to 5.5" x 8.5".
 * 4 panels per sheet. Outside: [page4, page1], Inside: [page2, page3].
 */
export function planLetterBifold(totalOriginalPages: number): SheetPlan[] {
  const sheetW = inToPt(11);
  const sheetH = inToPt(8.5);
  const panelW = inToPt(5.5);
  const panelH = inToPt(8.5);
  const foldX = [panelW];

  const padded = padToMultiple(totalOriginalPages, 4);
  const sheets = padded / 4;

  const plans: SheetPlan[] = [];
  for (let s = 0; s < sheets; s++) {
    const base = s * 4;
    plans.push({
      sheetIndex: s,
      sheetWidth: sheetW,
      sheetHeight: sheetH,
      front: {
        side: "front",
        placements: [
          { pageNumber: pageOrBlank(base + 4, totalOriginalPages), x: 0, y: 0, width: panelW, height: panelH, rotation: 0 },
          { pageNumber: pageOrBlank(base + 1, totalOriginalPages), x: panelW, y: 0, width: panelW, height: panelH, rotation: 0 },
        ],
        foldX,
      },
      back: {
        side: "back",
        placements: [
          { pageNumber: pageOrBlank(base + 2, totalOriginalPages), x: 0, y: 0, width: panelW, height: panelH, rotation: 0 },
          { pageNumber: pageOrBlank(base + 3, totalOriginalPages), x: panelW, y: 0, width: panelW, height: panelH, rotation: 0 },
        ],
        foldX,
      },
    });
  }

  return plans;
}

/**
 * BI-FOLD (LEGAL): 8.5" x 14" folded to 7" x 8.5".
 */
export function planLegalBifold(totalOriginalPages: number): SheetPlan[] {
  const sheetW = inToPt(14);
  const sheetH = inToPt(8.5);
  const panelW = inToPt(7);
  const panelH = inToPt(8.5);
  const foldX = [panelW];

  const padded = padToMultiple(totalOriginalPages, 4);
  const sheets = padded / 4;

  const plans: SheetPlan[] = [];
  for (let s = 0; s < sheets; s++) {
    const base = s * 4;
    plans.push({
      sheetIndex: s,
      sheetWidth: sheetW,
      sheetHeight: sheetH,
      front: {
        side: "front",
        placements: [
          { pageNumber: pageOrBlank(base + 4, totalOriginalPages), x: 0, y: 0, width: panelW, height: panelH, rotation: 0 },
          { pageNumber: pageOrBlank(base + 1, totalOriginalPages), x: panelW, y: 0, width: panelW, height: panelH, rotation: 0 },
        ],
        foldX,
      },
      back: {
        side: "back",
        placements: [
          { pageNumber: pageOrBlank(base + 2, totalOriginalPages), x: 0, y: 0, width: panelW, height: panelH, rotation: 0 },
          { pageNumber: pageOrBlank(base + 3, totalOriginalPages), x: panelW, y: 0, width: panelW, height: panelH, rotation: 0 },
        ],
        foldX,
      },
    });
  }

  return plans;
}

/**
 * TABLOID TRI-FOLD: 11" x 17" sheet, 6 panels.
 * Right flap folds in, inside flap 1/16" narrower.
 * Outside: [6, 1, 2(flap)], Inside: [3(flap-back), 4, 5].
 */
export function planTabloidTrifold(totalOriginalPages: number, insideFlapNarrowIn = 0.0625): SheetPlan[] {
  const sheetW = inToPt(17);
  const sheetH = inToPt(11);

  const insideFlapW = inToPt(17) / 3 - inToPt(insideFlapNarrowIn);
  const otherW = (inToPt(17) - insideFlapW) / 2;
  const panelH = sheetH;

  const foldXOutside = [otherW, otherW + otherW];
  const foldXInside = [insideFlapW, insideFlapW + otherW];

  const padded = padToMultiple(totalOriginalPages, 6);
  const sheets = padded / 6;

  const plans: SheetPlan[] = [];
  for (let s = 0; s < sheets; s++) {
    const base = s * 6;

    const p1 = pageOrBlank(base + 1, totalOriginalPages);
    const p2 = pageOrBlank(base + 2, totalOriginalPages);
    const p3 = pageOrBlank(base + 3, totalOriginalPages);
    const p4 = pageOrBlank(base + 4, totalOriginalPages);
    const p5 = pageOrBlank(base + 5, totalOriginalPages);
    const p6 = pageOrBlank(base + 6, totalOriginalPages);

    plans.push({
      sheetIndex: s,
      sheetWidth: sheetW,
      sheetHeight: sheetH,
      front: {
        side: "front",
        placements: [
          { pageNumber: p6, x: 0, y: 0, width: otherW, height: panelH, rotation: 0 },
          { pageNumber: p1, x: otherW, y: 0, width: otherW, height: panelH, rotation: 0 },
          { pageNumber: p2, x: otherW + otherW, y: 0, width: insideFlapW, height: panelH, rotation: 0 },
        ],
        foldX: foldXOutside,
      },
      back: {
        side: "back",
        placements: [
          { pageNumber: p3, x: 0, y: 0, width: insideFlapW, height: panelH, rotation: 0 },
          { pageNumber: p4, x: insideFlapW, y: 0, width: otherW, height: panelH, rotation: 0 },
          { pageNumber: p5, x: insideFlapW + otherW, y: 0, width: otherW, height: panelH, rotation: 0 },
        ],
        foldX: foldXInside,
      },
    });
  }

  return plans;
}

export function buildSheetPlans(format: FoldFormat, totalOriginalPages: number): SheetPlan[] {
  switch (format) {
    case "HALF_LETTER_SADDLE_STITCH":
      return planHalfLetterSaddleStitch(totalOriginalPages);
    case "LETTER_BIFOLD":
      return planLetterBifold(totalOriginalPages);
    case "LEGAL_BIFOLD":
      return planLegalBifold(totalOriginalPages);
    case "TABLOID_TRIFOLD":
      return planTabloidTrifold(totalOriginalPages);
    default: {
      const _exhaustive: never = format;
      throw new Error(`Unsupported format: ${_exhaustive}`);
    }
  }
}
