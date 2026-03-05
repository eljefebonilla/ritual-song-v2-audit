import type { MusicPlan, SongEntry } from "./types";
import dateIndexData from "@/data/date-index.json";
import allOccasionsData from "@/data/all-occasions.json";

// --- Types ---

interface DateIndexEntry {
  date: string;
  occasionId: string;
  season: string;
  name: string;
}

interface AllOccasionEntry {
  id: string;
  season: string;
}

// --- Lazy-built maps ---

let _dateToOccasion: Map<string, DateIndexEntry> | null = null;
let _occasionToSeason: Map<string, string> | null = null;

/**
 * Lazy-built Map<date, { occasionId, season, name }> from date-index.json
 */
export function getDateToOccasionMap(): Map<string, DateIndexEntry> {
  if (!_dateToOccasion) {
    _dateToOccasion = new Map();
    for (const entry of dateIndexData as DateIndexEntry[]) {
      _dateToOccasion.set(entry.date, entry);
    }
  }
  return _dateToOccasion;
}

/**
 * Lazy-built Map<occasionId, season> from all-occasions.json
 */
export function getOccasionSeasonMap(): Map<string, string> {
  if (!_occasionToSeason) {
    _occasionToSeason = new Map();
    for (const entry of allOccasionsData as AllOccasionEntry[]) {
      _occasionToSeason.set(entry.id, entry.season);
    }
  }
  return _occasionToSeason;
}

/**
 * Get the current liturgical season from the date index.
 * Finds today's entry or the nearest future entry.
 */
export function getCurrentLiturgicalSeason(): string {
  const map = getDateToOccasionMap();
  const today = new Date().toISOString().split("T")[0];

  // Exact match
  const exact = map.get(today);
  if (exact) return exact.season;

  // Find nearest future date
  let bestDate = "";
  let bestSeason = "ordinary";
  for (const [date, entry] of map) {
    if (date >= today && (bestDate === "" || date < bestDate)) {
      bestDate = date;
      bestSeason = entry.season;
    }
  }
  return bestSeason;
}

/**
 * Lowercase, strip punctuation, collapse whitespace.
 */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// --- Mass position constants ---

const SINGLE_FIELDS: (keyof MusicPlan)[] = [
  "prelude",
  "gathering",
  "penitentialAct",
  "gloria",
  "gospelAcclamation",
  "offertory",
  "lordsPrayer",
  "fractionRite",
  "sending",
];

/** Sort order for Mass positions. Lower = earlier in the liturgy. */
export const MASS_POSITION_ORDER: Record<string, number> = {
  prelude: 0,
  gathering: 1,
  penitentialAct: 2,
  gloria: 3,
  gospelAcclamation: 4,
  offertory: 5,
  lordsPrayer: 6,
  fractionRite: 7,
  communion: 8,
  sending: 9,
};

/** Human-readable labels for Mass positions. */
export const MASS_POSITION_LABELS: Record<string, string> = {
  prelude: "Prelude",
  gathering: "Gathering",
  penitentialAct: "Penitential Act",
  gloria: "Gloria",
  gospelAcclamation: "Gospel Acclamation",
  offertory: "Offertory",
  lordsPrayer: "Lord's Prayer",
  fractionRite: "Fraction Rite",
  communion: "Communion",
  sending: "Sending",
};

/** Ensemble badge config: letter, background color, text color. */
export const ENSEMBLE_BADGES: Record<string, { letter: string; bg: string; text: string }> = {
  reflections:  { letter: "R", bg: "#f1f4f6", text: "#5a6a78" },
  foundations:  { letter: "F", bg: "#f5e9e5", text: "#8b6b5a" },
  generations:  { letter: "G", bg: "#fff8da", text: "#8a7a3a" },
  heritage:     { letter: "H", bg: "#eef1eb", text: "#5a6b54" },
  elevations:   { letter: "E", bg: "#eeebf6", text: "#6b5a8a" },
};

/**
 * Ensemble-to-psalter source mapping.
 * Lyric Psalter serves Reflections, Foundations, Heritage.
 * Spirit & Psalm serves Generations, Elevations.
 */
export const ENSEMBLE_PSALTER: Record<string, "lyric_psalter" | "spirit_and_psalm"> = {
  reflections: "lyric_psalter",
  foundations: "lyric_psalter",
  heritage: "lyric_psalter",
  generations: "spirit_and_psalm",
  elevations: "spirit_and_psalm",
};

/**
 * Determine the psalter source from a resource label.
 * Returns null if the label doesn't indicate a specific psalter.
 */
export function getPsalterSourceFromLabel(label: string): "lyric_psalter" | "spirit_and_psalm" | null {
  const lower = label.toLowerCase();
  if (lower.includes("lyric psalter")) return "lyric_psalter";
  if (lower.includes("spirit") && lower.includes("psalm")) return "spirit_and_psalm";
  return null;
}

/**
 * Filter psalm resources to show the correct psalter for a given ensemble.
 * When no ensemble is specified, returns all resources.
 */
export function filterPsalmResourcesByEnsemble<T extends { label: string }>(
  resources: T[],
  ensemble?: string
): T[] {
  if (!ensemble) return resources;

  const psalter = ENSEMBLE_PSALTER[ensemble.toLowerCase()];
  if (!psalter) return resources;

  return resources.filter((r) => {
    const source = getPsalterSourceFromLabel(r.label);
    // If resource has no identified psalter source, keep it (generic resource)
    if (!source) return true;
    // Match to ensemble's psalter
    return source === psalter;
  });
}

export interface PositionedSongEntry {
  entry: SongEntry;
  position: string; // field name: "gathering", "communion", etc.
}

/**
 * Pull all SongEntry objects from a music plan (flat list).
 */
export function extractSongEntries(plan: MusicPlan): SongEntry[] {
  return extractSongEntriesWithPosition(plan).map((p) => p.entry);
}

/**
 * Pull all SongEntry objects with their Mass position from a music plan.
 */
export function extractSongEntriesWithPosition(plan: MusicPlan): PositionedSongEntry[] {
  const entries: PositionedSongEntry[] = [];

  for (const field of SINGLE_FIELDS) {
    const val = plan[field];
    if (val && typeof val === "object" && "title" in val) {
      entries.push({ entry: val as SongEntry, position: field });
    }
  }

  if (plan.communionSongs) {
    for (const s of plan.communionSongs) {
      entries.push({ entry: s, position: "communion" });
    }
  }

  return entries;
}
