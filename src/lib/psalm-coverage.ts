import type { LibrarySong } from "./types";

export interface PsalmCoverageEntry {
  psalmNumber: number;
  /** How many occasion files reference this psalm */
  occasionCount: number;
  /** Occasion IDs that use this psalm */
  occasionIds: string[];
  /** Song library settings available for this psalm */
  settings: { id: string; title: string; composer: string }[];
  /** Whether this psalm has at least one setting */
  covered: boolean;
}

/**
 * Extract psalm number from a citation string.
 * Handles: "Ps 23:1-6", "Psalm 23", "Ps. 103", "Ps 118/119"
 */
export function extractPsalmNumber(citation: string): number | null {
  const match = citation.match(/Ps(?:alm)?\.?\s*(\d+)/i);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Extract psalm number from a song title.
 * Handles: "Psalm 23: Shepherd Me", "Ps 103 The Lord is kind", "Ps. 34"
 */
export function extractPsalmNumberFromTitle(title: string): number | null {
  const match = title.match(/Ps(?:alm)?\.?\s*(\d+)/i);
  return match ? parseInt(match[1], 10) : null;
}

interface OccasionReading {
  type: string;
  citation: string;
}

interface OccasionData {
  id: string;
  readings?: OccasionReading[];
}

/**
 * Analyze psalm coverage across occasions and the song library.
 */
export function analyzePsalmCoverage(
  occasions: OccasionData[],
  librarySongs: LibrarySong[]
): PsalmCoverageEntry[] {
  // 1. Extract all psalm citations from occasions
  const psalmOccurrences = new Map<number, Set<string>>();

  for (const occ of occasions) {
    if (!occ.readings) continue;
    for (const reading of occ.readings) {
      if (reading.type !== "psalm") continue;
      const num = extractPsalmNumber(reading.citation);
      if (num === null) continue;
      if (!psalmOccurrences.has(num)) {
        psalmOccurrences.set(num, new Set());
      }
      psalmOccurrences.get(num)!.add(occ.id);
    }
  }

  // 2. Index psalm settings from the library
  const psalmSettings = new Map<
    number,
    { id: string; title: string; composer: string }[]
  >();

  for (const song of librarySongs) {
    if (song.category !== "psalm") continue;
    const num = extractPsalmNumberFromTitle(song.title);
    if (num === null) continue;
    if (!psalmSettings.has(num)) {
      psalmSettings.set(num, []);
    }
    psalmSettings.get(num)!.push({
      id: song.id,
      title: song.title,
      composer: song.composer || "",
    });
  }

  // 3. Merge into coverage entries
  const allPsalms = new Set([
    ...psalmOccurrences.keys(),
    ...psalmSettings.keys(),
  ]);

  const entries: PsalmCoverageEntry[] = [];

  for (const num of allPsalms) {
    const occasionIds = psalmOccurrences.get(num);
    const settings = psalmSettings.get(num) || [];

    entries.push({
      psalmNumber: num,
      occasionCount: occasionIds?.size || 0,
      occasionIds: occasionIds ? Array.from(occasionIds) : [],
      settings,
      covered: settings.length > 0,
    });
  }

  // Sort by psalm number
  entries.sort((a, b) => a.psalmNumber - b.psalmNumber);

  return entries;
}

/**
 * Summary stats from a coverage analysis.
 */
export function coverageSummary(entries: PsalmCoverageEntry[]) {
  const total = entries.length;
  const covered = entries.filter((e) => e.covered).length;
  const gaps = entries.filter((e) => !e.covered && e.occasionCount > 0);
  const unused = entries.filter((e) => e.covered && e.occasionCount === 0);

  return { total, covered, gapCount: gaps.length, unusedCount: unused.length, gaps, unused };
}
