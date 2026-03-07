import dateIndex from "@/data/date-index.json";
import lectionarySynopses from "@/data/lectionary-synopses.json";
import usccbData from "@/data/usccb-2026.json";

/**
 * Canonical book name map.
 * Maps every known variant (full name, abbreviation, USCCB short form)
 * to a single canonical lowercase key.
 */
const BOOK_CANON: Record<string, string> = {
  // Old Testament
  genesis: "gen", gn: "gen", gen: "gen",
  exodus: "exod", ex: "exod", exod: "exod",
  leviticus: "lev", lv: "lev", lev: "lev",
  numbers: "num", nm: "num", num: "num",
  deuteronomy: "deut", dt: "deut", deut: "deut",
  joshua: "josh", jos: "josh", josh: "josh",
  judges: "judg", jgs: "judg", judg: "judg",
  ruth: "ruth", ru: "ruth",
  "1samuel": "1sam", "1sm": "1sam", "1sam": "1sam",
  "2samuel": "2sam", "2sm": "2sam", "2sam": "2sam",
  "1kings": "1kgs", "1kgs": "1kgs",
  "2kings": "2kgs", "2kgs": "2kgs",
  "1chronicles": "1chr", "1chr": "1chr",
  "2chronicles": "2chr", "2chr": "2chr",
  ezra: "ezra", ezr: "ezra",
  nehemiah: "neh", neh: "neh",
  tobit: "tob", tb: "tob", tob: "tob",
  judith: "jdt", jdt: "jdt",
  esther: "esth", est: "esth", esth: "esth",
  "1maccabees": "1mc", "1mc": "1mc",
  "2maccabees": "2mc", "2mc": "2mc",
  job: "job", jb: "job",
  psalms: "ps", psalm: "ps", ps: "ps", pss: "ps",
  proverbs: "prov", prv: "prov", prov: "prov",
  ecclesiastes: "eccl", eccl: "eccl",
  songofsongs: "song", sg: "song", song: "song", canticles: "song",
  wisdom: "wis", wis: "wis",
  sirach: "sir", sir: "sir", ecclesiasticus: "sir",
  isaiah: "isa", is: "isa", isa: "isa",
  jeremiah: "jer", jer: "jer",
  lamentations: "lam", lam: "lam",
  baruch: "bar", bar: "bar",
  ezekiel: "ezek", ez: "ezek", ezek: "ezek",
  daniel: "dan", dn: "dan", dan: "dan",
  hosea: "hos", hos: "hos",
  joel: "joel", jl: "joel",
  amos: "amos", am: "amos",
  obadiah: "obad", ob: "obad", obad: "obad",
  jonah: "jon", jon: "jon",
  micah: "mic", mi: "mic", mic: "mic",
  nahum: "nah", na: "nah", nah: "nah",
  habakkuk: "hab", hb: "hab", hab: "hab",
  zephaniah: "zeph", zep: "zeph", zeph: "zeph",
  haggai: "hag", hg: "hag", hag: "hag",
  zechariah: "zech", zec: "zech", zech: "zech",
  malachi: "mal", mal: "mal",

  // New Testament
  matthew: "matt", mt: "matt", matt: "matt", mat: "matt",
  mark: "mark", mk: "mark",
  luke: "luke", lk: "luke",
  john: "john", jn: "john",
  acts: "acts",
  romans: "rom", rm: "rom", rom: "rom",
  "1corinthians": "1cor", "1cor": "1cor",
  "2corinthians": "2cor", "2cor": "2cor",
  galatians: "gal", gal: "gal",
  ephesians: "eph", eph: "eph",
  philippians: "phil", ph: "phil", phil: "phil",
  colossians: "col", col: "col",
  "1thessalonians": "1thes", "1thes": "1thes", "1thess": "1thes",
  "2thessalonians": "2thes", "2thes": "2thes", "2thess": "2thes",
  "1timothy": "1tim", "1tm": "1tim", "1tim": "1tim",
  "2timothy": "2tim", "2tm": "2tim", "2tim": "2tim",
  titus: "titus", ti: "titus",
  philemon: "phlm", phlm: "phlm",
  hebrews: "heb", heb: "heb",
  james: "jas", jas: "jas",
  "1peter": "1pet", "1pt": "1pet", "1pet": "1pet",
  "2peter": "2pet", "2pt": "2pet", "2pet": "2pet",
  "1john": "1jn", "1jn": "1jn",
  "2john": "2jn", "2jn": "2jn",
  "3john": "3jn", "3jn": "3jn",
  jude: "jude",
  revelation: "rev", rv: "rev", rev: "rev",
};

/**
 * Parse a scripture citation into book + chapter for matching.
 * e.g., "Mt 4:1-11" -> { book: "matt", chapter: 4 }
 * e.g., "Isaiah 43:2-3" -> { book: "isa", chapter: 43 }
 * e.g., "1 Cor 1:3-9" -> { book: "1cor", chapter: 1 }
 * e.g., "Song of Songs 2:8-14" -> { book: "song", chapter: 2 }
 */
export function parseCitation(citation: string): { book: string; chapter: number } | null {
  // Match optional number prefix + book name (allowing multi-word like "Song of Songs")
  // then chapter number
  const m = citation.match(/^(\d?\s*[A-Za-z]+(?:\s+of\s+[A-Za-z]+)?)\s+(\d+)/);
  if (!m) return null;

  const rawBook = m[1].replace(/\s+/g, "").toLowerCase();
  const chapter = parseInt(m[2], 10);
  const canonical = BOOK_CANON[rawBook];

  return {
    book: canonical || rawBook,
    chapter,
  };
}

/**
 * Check if a song's scripture reference matches a reading citation.
 * Matches on book + chapter (not verse level).
 */
export function scriptureMatch(songRef: string, readingCitation: string): boolean {
  const songParsed = parseCitation(songRef);
  const readParsed = parseCitation(readingCitation);
  if (!songParsed || !readParsed) return false;

  return songParsed.book === readParsed.book && songParsed.chapter === readParsed.chapter;
}

export type ScriptureSubFilter = "all" | "first" | "second" | "gospel" | "psalm";

export interface DayReadings {
  first?: string;
  second?: string;
  gospel?: string;
  psalm?: string;
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

  // Strip "(second choice)" or similar parentheticals within parts
  const withoutParens = cleaned.replace(/\s*\([^)]*\)/g, "");

  // Split on / to get individual readings
  const parts = withoutParens.split("/");
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
    case "psalm": return readings.psalm ? [readings.psalm] : [];
  }
}
