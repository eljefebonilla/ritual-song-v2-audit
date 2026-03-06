import dateIndex from "@/data/date-index.json";
import lectionarySynopses from "@/data/lectionary-synopses.json";
import usccbData from "@/data/usccb-2026.json";

/**
 * Parse a scripture citation into book + chapter for matching.
 * e.g., "Mt 4:1-11" → { book: "mt", chapter: 4 }
 * e.g., "Gen 2:7-9; 3:1-7" → { book: "gen", chapter: 2 }
 */
export function parseCitation(citation: string): { book: string; chapter: number } | null {
  const m = citation.match(/^(\d?\s*[A-Za-z]+)\s+(\d+)/);
  if (!m) return null;
  return {
    book: m[1].replace(/\s+/g, "").toLowerCase(),
    chapter: parseInt(m[2], 10),
  };
}

/** Normalize common book abbreviations to a canonical short form. */
function normalizeBook(b: string): string {
  return b
    .replace(/^1/, "1").replace(/^2/, "2").replace(/^3/, "3")
    .replace(/^gen$/, "gn").replace(/^exod$/, "ex").replace(/^deut$/, "dt")
    .replace(/^matt?$/, "mt").replace(/^mark$/, "mk")
    .replace(/^luke$/, "lk").replace(/^john$/, "jn")
    .replace(/^rom$/, "rm").replace(/^phil$/, "ph")
    .replace(/^rev$/, "rv").replace(/^isa?$/, "is");
}

/**
 * Check if a song's scripture reference matches a reading citation.
 * Matches on book + chapter (not verse level).
 */
export function scriptureMatch(songRef: string, readingCitation: string): boolean {
  const songParsed = parseCitation(songRef);
  const readParsed = parseCitation(readingCitation);
  if (!songParsed || !readParsed) return false;

  const normSong = normalizeBook(songParsed.book);
  const normRead = normalizeBook(readParsed.book);

  return normSong === normRead && songParsed.chapter === readParsed.chapter;
}

export type ScriptureSubFilter = "all" | "first" | "second" | "gospel";

export interface DayReadings {
  first?: string;
  second?: string;
  gospel?: string;
  all: string[];
}

/**
 * Parse USCCB slash-delimited citation string into individual citations.
 * Strips trailing lectionary number like "(1) Pss I" or "(175)".
 * Handles "or" alternatives by including both.
 */
export function parseUSCCBCitations(raw: string): string[] {
  // Strip trailing lectionary number + psalter week: "(1) Pss I", "(175)", "(690A)"
  const cleaned = raw.replace(/\s*\(\d+[A-Z]?\)\s*(Pss\s+\w+)?$/, "").trim();
  if (!cleaned) return [];

  // Split on / to get individual readings
  const parts = cleaned.split("/");
  const citations: string[] = [];

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    // Handle "or" alternatives: "Zec 2:14-17 or Rv 11:19a; 12:1-6a, 10ab"
    if (trimmed.includes(" or ")) {
      for (const alt of trimmed.split(" or ")) {
        const a = alt.trim();
        if (a) citations.push(a);
      }
    } else {
      citations.push(trimmed);
    }
  }

  return citations;
}

const synopses = lectionarySynopses as unknown as Record<string, {
  readings: {
    first?: { citation: string | null };
    second?: { citation: string | null };
    gospel?: { citation: string | null };
  };
}>;

const dateEntries = dateIndex as { date: string; occasionId: string }[];
const usccbEntries = usccbData as { date: string; citations: string }[];

/**
 * Get structured readings for a given date string (YYYY-MM-DD).
 * First tries lectionary synopses (via date-index), falls back to USCCB citation parsing.
 */
export function getReadingsForDate(dateStr: string): DayReadings {
  // Try lectionary synopses via date-index
  const dateEntry = dateEntries.find((d) => d.date === dateStr);
  if (dateEntry) {
    const synopsis = synopses[dateEntry.occasionId];
    if (synopsis?.readings) {
      const r = synopsis.readings;
      const all: string[] = [];
      if (r.first?.citation) all.push(r.first.citation);
      if (r.second?.citation) all.push(r.second.citation);
      if (r.gospel?.citation) all.push(r.gospel.citation);

      return {
        first: r.first?.citation ?? undefined,
        second: r.second?.citation ?? undefined,
        gospel: r.gospel?.citation ?? undefined,
        all,
      };
    }
  }

  // Fallback: parse USCCB citations
  const usccbEntry = usccbEntries.find((d) => d.date === dateStr);
  if (usccbEntry?.citations) {
    const all = parseUSCCBCitations(usccbEntry.citations);
    // Heuristic: Sunday/solemnity format is typically first/second/gospel
    // Weekday format is typically first/gospel (2 readings)
    if (all.length >= 3) {
      return { first: all[0], second: all[1], gospel: all[2], all };
    } else if (all.length === 2) {
      return { first: all[0], gospel: all[1], all };
    } else {
      return { all };
    }
  }

  return { all: [] };
}

/**
 * Get citations for a specific sub-filter from day readings.
 */
export function getCitationsForSubFilter(readings: DayReadings, subFilter: ScriptureSubFilter): string[] {
  switch (subFilter) {
    case "all": return readings.all;
    case "first": return readings.first ? [readings.first] : [];
    case "second": return readings.second ? [readings.second] : [];
    case "gospel": return readings.gospel ? [readings.gospel] : [];
  }
}
