/**
 * Unit conversion + geometry helpers for PDF imposition.
 * pdf-lib uses points: 72 points per inch.
 */
export const PT_PER_IN = 72;

export function inToPt(inches: number): number {
  return inches * PT_PER_IN;
}

export function ptToIn(points: number): number {
  return points / PT_PER_IN;
}

export type Rect = { x: number; y: number; width: number; height: number };

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
