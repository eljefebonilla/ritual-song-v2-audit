// Music theory utilities for key transposition

const SHARP_KEYS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLAT_KEYS  = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

// The 12 key names shown in the admin picker (prefer flats for common keys)
export const CHROMATIC_KEYS = [
  "C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B",
];

interface ParsedKey {
  semitone: number; // 0–11
  minor: boolean;
}

const KEY_MAP: Record<string, number> = {
  C: 0, "B#": 0,
  "C#": 1, Db: 1,
  D: 2,
  "D#": 3, Eb: 3,
  E: 4, Fb: 4,
  F: 5, "E#": 5,
  "F#": 6, Gb: 6,
  G: 7,
  "G#": 8, Ab: 8,
  A: 9,
  "A#": 10, Bb: 10,
  B: 11, Cb: 11,
};

/** Parse a key string like "C", "Db", "F#m", "Ebm" into semitone + minor flag */
export function parseKey(key: string): ParsedKey | null {
  const match = key.trim().match(/^([A-G][b#]?)(m)?$/);
  if (!match) return null;
  const root = match[1];
  const minor = match[2] === "m";
  const semitone = KEY_MAP[root];
  if (semitone === undefined) return null;
  return { semitone, minor };
}

/** Shortest-path semitone offset from one key to another (-6 to +5) */
export function semitoneOffset(fromKey: string, toKey: string): number | null {
  const from = parseKey(fromKey);
  const to = parseKey(toKey);
  if (!from || !to) return null;
  let diff = (to.semitone - from.semitone) % 12;
  if (diff < 0) diff += 12;
  // Shortest path: if diff > 6, go the other way
  if (diff > 6) diff -= 12;
  return diff;
}

/** Given a recorded key and a pitch offset, return the display name of the resulting key */
export function transposedKeyName(recordedKey: string, offset: number): string | null {
  const parsed = parseKey(recordedKey);
  if (!parsed) return null;
  let idx = ((parsed.semitone + offset) % 12 + 12) % 12;
  // Decide sharps vs flats based on the original key
  const useSharps = recordedKey.includes("#");
  const table = useSharps ? SHARP_KEYS : FLAT_KEYS;
  return table[idx] + (parsed.minor ? "m" : "");
}

/**
 * Extract deduplicated chart keys from sheet music file paths.
 * Matches patterns like (D), (Eb), (F#m), (Gb) in filenames.
 * Excludes vocal range patterns like (D-F#).
 */
export function extractChartKeys(filePaths: string[]): string[] {
  const keys = new Set<string>();
  // Match (Key) but not (Key-Key) vocal ranges
  const re = /\(([A-G][b#]?m?)\)(?!.*-[A-G])/;
  for (const fp of filePaths) {
    const filename = fp.split("/").pop() || fp;
    const match = filename.match(re);
    if (match) {
      const key = match[1];
      if (parseKey(key)) {
        keys.add(key);
      }
    }
  }
  // Sort by semitone value for consistent display
  return [...keys].sort((a, b) => {
    const pa = parseKey(a)!;
    const pb = parseKey(b)!;
    return pa.semitone - pb.semitone;
  });
}
