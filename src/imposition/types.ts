import type { Rect } from "./units";

export type FoldFormat =
  | "HALF_LETTER_SADDLE_STITCH"
  | "LETTER_BIFOLD"
  | "LEGAL_BIFOLD"
  | "TABLOID_TRIFOLD";

export type SheetSide = "front" | "back";

/**
 * Placement coordinates are in PDF points in the imposed sheet coordinate space:
 * - origin is bottom-left (pdf-lib default)
 * - x increases right, y increases up
 */
export interface Placement extends Rect {
  pageNumber: number | null;
  rotation: 0 | 90 | 180 | 270;
  label?: string;
}

export interface SheetSidePlan {
  side: SheetSide;
  placements: Placement[];
  foldX?: number[];
  foldY?: number[];
}

export interface SheetPlan {
  sheetIndex: number;
  sheetWidth: number;
  sheetHeight: number;
  front: SheetSidePlan;
  back: SheetSidePlan;
}

export interface MarksOptions {
  enabled?: boolean;
  bleedIn?: number;
  safeIn?: number;
  strokeWidthPt?: number;
  markLengthIn?: number;
  offsetIn?: number;
  drawFoldMarks?: boolean;
  drawRegistration?: boolean;
  drawPanelCropMarks?: boolean;
  drawSheetCropMarks?: boolean;
}

export interface CreepOptions {
  enabled?: boolean;
  paperThicknessIn?: number;
  multiplier?: number;
}

export interface DuplexOptions {
  rotateBackside180?: boolean;
}

export interface ImpositionOptions {
  marks?: MarksOptions;
  creep?: CreepOptions;
  duplex?: DuplexOptions;
  strictSinglePageInput?: boolean;
}
