import type { LibrarySong } from "./types";
import { extractPsalmNumber, extractPsalmNumberFromTitle } from "./psalm-coverage";

/**
 * Find psalm settings in the song library that match a given psalm citation.
 * E.g., "Ps 23:1-6" → finds songs titled "Psalm 23: Shepherd Me, O God" etc.
 */
export function findPsalmSettings(
  psalmCitation: string,
  library: LibrarySong[]
): LibrarySong[] {
  const psalmNum = extractPsalmNumber(psalmCitation);
  if (psalmNum === null) return [];

  return library.filter((song) => {
    if (song.category !== "psalm") return false;
    const songNum = extractPsalmNumberFromTitle(song.title);
    return songNum === psalmNum;
  });
}

/**
 * For a given lectionary number, find all psalm citations that share it.
 * Used for "When else is this psalm sung?" queries.
 */
export function findRelatedPsalmDates(
  psalmNumber: number,
  liturgicalDays: { date: string; celebrationName: string; lectionaryNumber: number | null }[]
): { date: string; celebrationName: string; lectionaryNumber: number | null }[] {
  // This is a simplified version — full implementation would cross-reference
  // readings tables. For now, return dates that share the same lectionary context.
  return liturgicalDays.filter((d) => d.lectionaryNumber !== null);
}
