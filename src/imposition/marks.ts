import { rgb, type PDFPage } from "pdf-lib";
import type { MarksOptions, SheetSidePlan } from "./types";
import { inToPt, clamp, type Rect } from "./units";

const DEFAULTS: Required<MarksOptions> = {
  enabled: true,
  bleedIn: 0.125,
  safeIn: 0.25,
  strokeWidthPt: 0.5,
  markLengthIn: 0.2,
  offsetIn: 0.05,
  drawFoldMarks: true,
  drawRegistration: true,
  drawPanelCropMarks: true,
  drawSheetCropMarks: false,
};

function norm(opts?: MarksOptions): Required<MarksOptions> {
  return { ...DEFAULTS, ...(opts ?? {}) };
}

export function drawCropMarks(page: PDFPage, trimBox: Rect, pageBounds: Rect, options?: MarksOptions): void {
  const o = norm(options);
  if (!o.enabled) return;

  const bleed = inToPt(o.bleedIn);
  const offset = inToPt(o.offsetIn);
  const len = inToPt(o.markLengthIn);
  const color = rgb(0, 0, 0);

  const x0 = trimBox.x - bleed;
  const y0 = trimBox.y - bleed;
  const x1 = trimBox.x + trimBox.width + bleed;
  const y1 = trimBox.y + trimBox.height + bleed;

  const draw = (xS: number, yS: number, xE: number, yE: number) => {
    const bx = pageBounds.x;
    const by = pageBounds.y;
    const bxe = pageBounds.x + pageBounds.width;
    const bye = pageBounds.y + pageBounds.height;
    page.drawLine({
      start: { x: clamp(xS, bx, bxe), y: clamp(yS, by, bye) },
      end: { x: clamp(xE, bx, bxe), y: clamp(yE, by, bye) },
      thickness: o.strokeWidthPt,
      color,
    });
  };

  // Corner marks: horizontal + vertical at each corner
  draw(x0 - offset, y0, x0 - offset - len, y0);
  draw(x0, y0 - offset, x0, y0 - offset - len);
  draw(x1 + offset, y0, x1 + offset + len, y0);
  draw(x1, y0 - offset, x1, y0 - offset - len);
  draw(x0 - offset, y1, x0 - offset - len, y1);
  draw(x0, y1 + offset, x0, y1 + offset + len);
  draw(x1 + offset, y1, x1 + offset + len, y1);
  draw(x1, y1 + offset, x1, y1 + offset + len);
}

export function drawFoldMarks(
  page: PDFPage,
  foldX: number[] | undefined,
  foldY: number[] | undefined,
  pageBounds: Rect,
  options?: MarksOptions,
): void {
  const o = norm(options);
  if (!o.enabled || !o.drawFoldMarks) return;

  const color = rgb(0, 0, 0);
  const len = inToPt(0.15);

  if (foldX) {
    for (const x of foldX) {
      page.drawLine({ start: { x, y: pageBounds.y }, end: { x, y: pageBounds.y + len }, thickness: o.strokeWidthPt, color });
      page.drawLine({ start: { x, y: pageBounds.y + pageBounds.height }, end: { x, y: pageBounds.y + pageBounds.height - len }, thickness: o.strokeWidthPt, color });
    }
  }

  if (foldY) {
    for (const y of foldY) {
      page.drawLine({ start: { x: pageBounds.x, y }, end: { x: pageBounds.x + len, y }, thickness: o.strokeWidthPt, color });
      page.drawLine({ start: { x: pageBounds.x + pageBounds.width, y }, end: { x: pageBounds.x + pageBounds.width - len, y }, thickness: o.strokeWidthPt, color });
    }
  }
}

export function drawRegistrationCrosshair(page: PDFPage, pageBounds: Rect, options?: MarksOptions): void {
  const o = norm(options);
  if (!o.enabled || !o.drawRegistration) return;

  const cx = pageBounds.x + pageBounds.width / 2;
  const cy = pageBounds.y + pageBounds.height / 2;
  const color = rgb(0, 0, 0);
  const len = inToPt(0.25);

  page.drawLine({ start: { x: cx - len, y: cy }, end: { x: cx + len, y: cy }, thickness: o.strokeWidthPt, color });
  page.drawLine({ start: { x: cx, y: cy - len }, end: { x: cx, y: cy + len }, thickness: o.strokeWidthPt, color });
}

export function drawMarksForSheetSide(params: {
  page: PDFPage;
  sheetWidth: number;
  sheetHeight: number;
  sidePlan: SheetSidePlan;
  placements: SheetSidePlan["placements"];
  options?: MarksOptions;
}): void {
  const o = norm(params.options);
  if (!o.enabled) return;

  const bounds: Rect = { x: 0, y: 0, width: params.sheetWidth, height: params.sheetHeight };

  if (o.drawSheetCropMarks) {
    drawCropMarks(params.page, bounds, bounds, o);
  }

  if (o.drawPanelCropMarks) {
    for (const pl of params.placements) {
      drawCropMarks(params.page, pl, bounds, o);
    }
  }

  drawFoldMarks(params.page, params.sidePlan.foldX, params.sidePlan.foldY, bounds, o);
  drawRegistrationCrosshair(params.page, bounds, o);
}
