import type { SetlistSongRow } from "../booking-types";

/**
 * Required positions for a setlist to be considered "complete" for generation.
 * A position is filled if it has at least one song OR a display_value (like "chanted").
 */
const REQUIRED_POSITIONS = [
  "gathering",
  "psalm",
  "offertory",
  "communion_1",
  "sending",
];

/**
 * Check if a setlist has all required positions filled.
 * Returns true if the setlist is ready for auto-generation.
 */
export function isSetlistComplete(songs: SetlistSongRow[]): boolean {
  for (const position of REQUIRED_POSITIONS) {
    const row = songs.find((r) => r.position === position);
    if (!row) return false;

    const hasSongs = row.songs.length > 0 && row.songs.some((s) => s.title.trim() !== "");
    const hasDisplayValue = !!row.display_value?.trim();

    if (!hasSongs && !hasDisplayValue) return false;
  }
  return true;
}

/**
 * Compute a simple content hash for change detection.
 * Used to determine if the setlist has changed since last generation.
 */
export function computeSetlistHash(songs: SetlistSongRow[]): string {
  const content = songs
    .map((r) => `${r.position}:${r.songs.map((s) => s.title).join(",")}:${r.display_value || ""}`)
    .join("|");

  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    hash = ((hash << 5) - hash + content.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Get the list of missing required positions for UI display.
 */
export function getMissingPositions(songs: SetlistSongRow[]): string[] {
  const missing: string[] = [];
  for (const position of REQUIRED_POSITIONS) {
    const row = songs.find((r) => r.position === position);
    if (!row) {
      missing.push(position);
      continue;
    }
    const hasSongs = row.songs.length > 0 && row.songs.some((s) => s.title.trim() !== "");
    const hasDisplayValue = !!row.display_value?.trim();
    if (!hasSongs && !hasDisplayValue) {
      missing.push(position);
    }
  }
  return missing;
}
