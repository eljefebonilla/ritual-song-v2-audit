import type { Placement, SheetPlan } from "./types";
import { inToPt } from "./units";

/**
 * Practical saddle-stitch creep model.
 * Outer sheets get no creep. Inner sheets shift toward the spine.
 * Only meaningful for formats with a single central fold.
 */
export function computeCreepOffsetPt(params: {
  sheetIndex: number;
  totalSheets: number;
  paperThicknessIn: number;
  multiplier?: number;
}): number {
  const { sheetIndex, totalSheets, paperThicknessIn, multiplier = 1 } = params;
  if (totalSheets <= 1) return 0;

  const tPt = inToPt(paperThicknessIn);
  const offset = (sheetIndex * tPt) / 2;
  return offset * multiplier;
}

function applyCreepToPlacements(params: {
  placements: Placement[];
  sheetWidth: number;
  creepOffsetPt: number;
}): Placement[] {
  const { placements, sheetWidth, creepOffsetPt } = params;
  const spineX = sheetWidth / 2;

  if (creepOffsetPt === 0) return placements;

  return placements.map((p) => {
    const centerX = p.x + p.width / 2;
    const isLeft = centerX < spineX;
    const dx = isLeft ? creepOffsetPt : -creepOffsetPt;
    return { ...p, x: p.x + dx };
  });
}

export function applySaddleStitchCreep(
  plans: SheetPlan[],
  opts: { paperThicknessIn: number; multiplier?: number },
): SheetPlan[] {
  const totalSheets = plans.length;

  return plans.map((sheet) => {
    const creepOffsetPt = computeCreepOffsetPt({
      sheetIndex: sheet.sheetIndex,
      totalSheets,
      paperThicknessIn: opts.paperThicknessIn,
      multiplier: opts.multiplier,
    });

    return {
      ...sheet,
      front: {
        ...sheet.front,
        placements: applyCreepToPlacements({
          placements: sheet.front.placements,
          sheetWidth: sheet.sheetWidth,
          creepOffsetPt,
        }),
      },
      back: {
        ...sheet.back,
        placements: applyCreepToPlacements({
          placements: sheet.back.placements,
          sheetWidth: sheet.sheetWidth,
          creepOffsetPt,
        }),
      },
    };
  });
}
