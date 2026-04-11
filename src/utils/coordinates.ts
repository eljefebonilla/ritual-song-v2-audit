/**
 * Coordinate conversion between mm (data model) and px (screen).
 * CSS standard: 96 DPI. 1 inch = 25.4 mm.
 */

const MM_PER_INCH = 25.4;
const CSS_DPI = 96;
const PX_PER_MM = CSS_DPI / MM_PER_INCH; // ~3.7795

export function mmToPx(mm: number, zoom: number = 1): number {
  return mm * PX_PER_MM * zoom;
}

export function pxToMm(px: number, zoom: number = 1): number {
  return px / (PX_PER_MM * zoom);
}

// For pdf-lib (72 points per inch)
const PT_PER_INCH = 72;
const PT_PER_MM = PT_PER_INCH / MM_PER_INCH;

export function mmToPt(mm: number): number {
  return mm * PT_PER_MM;
}

export function ptToMm(pt: number): number {
  return pt / PT_PER_MM;
}

export function inToPt(inches: number): number {
  return inches * PT_PER_INCH;
}

export function inToMm(inches: number): number {
  return inches * MM_PER_INCH;
}
