import fs from "fs";
import path from "path";
import Papa from "papaparse";
import type {
  LibrarySong,
  SongCategory,
  CreditPerson,
  SongCredits,
  TuneMeter,
} from "../src/lib/types";

// ───── CONFIGURATION ─────

const AAHH_CSV_PATH =
  "/Users/jeffreybonilla/St Monica Dropbox/Jeff Bonilla/PROJECTS/Index Folder/African American Heritage.csv";
const SONG_LIBRARY_PATH = path.join(__dirname, "../src/data/song-library.json");

const DRY_RUN = process.argv.includes("--dry-run");

// ───── CSV ROW TYPE ─────

interface AAHHRow {
  displayTitle: string;
  firstLine: string;
  textAuthNumber: string;
  hymnalTitle: string;
  hymnalID: string;
  number: string;
  textTitle: string;
  refrainFirstLine: string;
  authors: string;
  composers: string;
  meter: string;
  tuneTitle: string;
  tuneAuthNumber: string;
  incipit: string;
  languages: string;
  textSources: string;
  tuneSources: string;
}

// ───── NORMALIZATION ─────

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/['']/g, "'")
    .replace(/[""]/g, '"')
    .replace(/[^a-z0-9' ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ───── CREDIT PARSING ─────

/**
 * Parse a semicolon-separated credit string into CreditPerson[].
 * "Charles Wesley, 1707-1788; Frederick H. Hedge, 1805-1890"
 * → [{ name: "Charles Wesley", dates: "1707-1788" }, { name: "Frederick H. Hedge", dates: "1805-1890" }]
 */
function parseCredits(raw: string): CreditPerson[] {
  if (!raw.trim()) return [];

  return raw
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => {
      // Match trailing date patterns: "1707-1788", "b. 1950", "c.760-821", "fl.1859", "d. 1999"
      const dateMatch = part.match(
        /,?\s*((?:(?:b|c|d|fl)\.?\s*)?\d{3,4}(?:\s*-\s*\d{3,4})?)\s*$/
      );
      if (dateMatch) {
        const name = part.slice(0, dateMatch.index).replace(/,\s*$/, "").trim();
        return { name, dates: dateMatch[1].trim() };
      }
      return { name: part };
    });
}

/**
 * Strip HTML tags (e.g. <cite>...</cite>) from a string.
 */
function stripHtml(raw: string): string {
  return raw.replace(/<[^>]+>/g, "").trim();
}

/**
 * Parse textSources or tuneSources — semicolon-separated, strip HTML.
 */
function parseSources(raw: string): string[] {
  if (!raw.trim()) return [];
  return raw
    .split(";")
    .map((s) => stripHtml(s).trim())
    .filter((s) => s.length > 0);
}

// ───── TUNE/METER ─────

/**
 * Clean tune title. Skip bracket-wrapped values like "[A charge to keep I have]"
 * (first-line-as-tune convention, not a real tune name).
 */
function cleanTuneTitle(raw: string): string | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) return undefined;
  return trimmed;
}

// ───── LANGUAGE PARSING ─────

/**
 * Deduplicate languages from a string like "English; Xhosa, English" → ["English", "Xhosa"]
 * Also fixes typos like "Engilsh".
 */
function parseLanguages(raw: string): string[] {
  if (!raw.trim()) return [];
  const langs = raw
    .split(/[;,]/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((l) => {
      // Fix known typos
      if (l.toLowerCase() === "engilsh") return "English";
      return l;
    });
  return [...new Set(langs)];
}

// ───── SONG CLASSIFICATION (mirrors song-library.ts) ─────

function classifySong(title: string): SongCategory {
  const t = title.toLowerCase();

  if (
    /\bkyrie\b/.test(t) ||
    /\bgloria\b/.test(t) ||
    /\bsanctus\b/.test(t) ||
    /\bholy,?\s*holy/.test(t) ||
    /\bmemorial accl/.test(t) ||
    /\bgreat amen\b/.test(t) ||
    /\blamb of god\b/.test(t) ||
    /\bagnus dei\b/.test(t) ||
    /\blord have mercy\b/.test(t) ||
    /\bpenitential\b/.test(t) ||
    /\bfraction rite\b/.test(t) ||
    /\bmass setting\b/.test(t) ||
    /\bmisa\b/.test(t) ||
    /\blord's prayer\b/.test(t)
  ) {
    return "mass_part";
  }

  if (
    /^ps\.?\s*\d/.test(t) ||
    /^psalm\s*\d/.test(t) ||
    /\bresponsorial\b/.test(t)
  ) {
    return "psalm";
  }

  if (
    /\balleluia\b/.test(t) ||
    /\bgospel accl/.test(t) ||
    /\bverse before/.test(t) ||
    /\blenten gospel/.test(t)
  ) {
    return "gospel_acclamation";
  }

  return "song";
}

// ───── COMPOSER STRING BUILDER ─────

/**
 * Build a legacy composer string from credits for new songs.
 * Uses • separator to match existing convention.
 */
function buildComposerString(credits: SongCredits): string {
  const names: string[] = [];
  if (credits.textAuthors) {
    for (const c of credits.textAuthors) names.push(c.name);
  }
  if (credits.composers) {
    for (const c of credits.composers) {
      if (!names.includes(c.name)) names.push(c.name);
    }
  }
  if (credits.arrangers) {
    for (const c of credits.arrangers) {
      if (!names.includes(c.name)) names.push(`arr. ${c.name}`);
    }
  }
  return names.join(" • ");
}

// ───── MATCHING ─────

interface MatchResult {
  song: LibrarySong;
  confidence: "exact" | "title" | "first-line";
}

function findMatch(
  aahhTitle: string,
  aahhFirstLine: string,
  titleIndex: Map<string, LibrarySong[]>,
  firstLineIndex: Map<string, LibrarySong[]>
): MatchResult | null {
  const normTitle = normalize(aahhTitle);

  // Tier 1: Exact title match (unique)
  const titleMatches = titleIndex.get(normTitle);
  if (titleMatches && titleMatches.length === 1) {
    return { song: titleMatches[0], confidence: "exact" };
  }

  // Tier 2: Cleaned title (strip parentheticals, subtitles)
  const cleanTitle = normalize(
    aahhTitle
      .replace(/\(.*?\)/g, "")
      .replace(/:\s.*$/, "")
      .trim()
  );
  if (cleanTitle !== normTitle && cleanTitle.length > 3) {
    const cleanMatches = titleIndex.get(cleanTitle);
    if (cleanMatches && cleanMatches.length === 1) {
      return { song: cleanMatches[0], confidence: "title" };
    }
  }

  // Tier 3: First line of AAHH → library title
  if (aahhFirstLine) {
    const normFirst = normalize(aahhFirstLine);
    const flMatches = titleIndex.get(normFirst);
    if (flMatches && flMatches.length === 1) {
      return { song: flMatches[0], confidence: "first-line" };
    }

    // Also check library firstLine → AAHH title
    const reverseMatches = firstLineIndex.get(normTitle);
    if (reverseMatches && reverseMatches.length === 1) {
      return { song: reverseMatches[0], confidence: "first-line" };
    }
  }

  return null;
}

// ───── ENRICHMENT ─────

function buildCredits(row: AAHHRow): SongCredits {
  const credits: SongCredits = {};

  const textAuthors = parseCredits(row.authors);
  if (textAuthors.length > 0) credits.textAuthors = textAuthors;

  const composers = parseCredits(row.composers);
  if (composers.length > 0) credits.composers = composers;

  const textSrc = parseSources(row.textSources);
  if (textSrc.length > 0) credits.textSources = textSrc;

  const tuneSrc = parseSources(row.tuneSources);
  if (tuneSrc.length > 0) credits.tuneSources = tuneSrc;

  return Object.keys(credits).length > 0 ? credits : {};
}

function buildTuneMeter(row: AAHHRow): TuneMeter | undefined {
  const tuneName = cleanTuneTitle(row.tuneTitle);
  const meter = row.meter?.trim() || undefined;
  const incipit = row.incipit?.trim() || undefined;

  if (!tuneName && !meter && !incipit) return undefined;

  const tm: TuneMeter = {};
  if (tuneName) tm.tuneName = tuneName;
  if (meter) tm.meter = meter;
  if (incipit) tm.incipit = incipit;
  return tm;
}

function enrichSong(song: LibrarySong, row: AAHHRow, aahhNum: number): void {
  // Catalog number
  if (!song.catalogs) song.catalogs = {};
  song.catalogs.aahh = aahhNum;

  // Credits (only if not already populated)
  const credits = buildCredits(row);
  if (Object.keys(credits).length > 0 && !song.credits) {
    song.credits = credits;
  }

  // Tune/meter
  const tuneMeter = buildTuneMeter(row);
  if (tuneMeter && !song.tuneMeter) {
    song.tuneMeter = tuneMeter;
  }

  // First line
  if (row.firstLine && !song.firstLine) {
    song.firstLine = row.firstLine.trim();
  }

  // Refrain first line
  if (row.refrainFirstLine && !song.refrainFirstLine) {
    song.refrainFirstLine = row.refrainFirstLine.trim();
  }

  // Languages
  const langs = parseLanguages(row.languages);
  if (langs.length > 0 && !song.languages) {
    song.languages = langs;
  }
}

function createNewSong(row: AAHHRow, aahhNum: number, existingIds: Set<string>): LibrarySong {
  const credits = buildCredits(row);
  const composerStr = buildComposerString(credits);
  const title = row.displayTitle.trim();

  // Build unique ID
  let baseSlug = slugify(title);
  if (composerStr) baseSlug += `--${slugify(composerStr)}`;
  let id = baseSlug;
  let counter = 1;
  while (existingIds.has(id)) {
    counter++;
    id = `${baseSlug}-${counter}`;
  }

  const tuneMeter = buildTuneMeter(row);
  const langs = parseLanguages(row.languages);

  const song: LibrarySong = {
    id,
    title,
    composer: composerStr || undefined,
    category: classifySong(title),
    catalogs: { aahh: aahhNum },
    resources: [],
    usageCount: 0,
    occasions: [],
  };

  if (Object.keys(credits).length > 0) song.credits = credits;
  if (tuneMeter) song.tuneMeter = tuneMeter;
  if (row.firstLine) song.firstLine = row.firstLine.trim();
  if (row.refrainFirstLine) song.refrainFirstLine = row.refrainFirstLine.trim();
  if (langs.length > 0) song.languages = langs;

  return song;
}

// ───── MAIN ─────

function main() {
  console.log(DRY_RUN ? "=== DRY RUN ===" : "=== LIVE RUN ===");

  // Load library
  console.log("Loading song library...");
  const library: LibrarySong[] = JSON.parse(
    fs.readFileSync(SONG_LIBRARY_PATH, "utf-8")
  );
  console.log(`Library has ${library.length} songs`);

  // Parse CSV
  console.log("Parsing AAHH CSV...");
  const csvText = fs.readFileSync(AAHH_CSV_PATH, "utf-8");
  const parsed = Papa.parse<AAHHRow>(csvText, {
    header: true,
    skipEmptyLines: true,
  });
  const rows = parsed.data;
  console.log(`AAHH CSV has ${rows.length} rows`);

  // Build title index from library
  const titleIndex = new Map<string, LibrarySong[]>();
  const firstLineIndex = new Map<string, LibrarySong[]>();
  for (const song of library) {
    const normTitle = normalize(song.title);
    if (!titleIndex.has(normTitle)) titleIndex.set(normTitle, []);
    titleIndex.get(normTitle)!.push(song);

    // Also index by firstLine if present (for future imports that already enriched)
    if (song.firstLine) {
      const normFL = normalize(song.firstLine);
      if (!firstLineIndex.has(normFL)) firstLineIndex.set(normFL, []);
      firstLineIndex.get(normFL)!.push(song);
    }
  }

  // Track existing IDs for dedup
  const existingIds = new Set(library.map((s) => s.id));

  // Process rows
  let matched = 0;
  let newCount = 0;
  let skipped = 0;
  const matchLog: string[] = [];
  const newLog: string[] = [];
  const newSongs: LibrarySong[] = [];

  for (const row of rows) {
    const aahhNum = parseInt(row.number, 10);
    if (isNaN(aahhNum)) {
      skipped++;
      continue;
    }

    const match = findMatch(
      row.displayTitle,
      row.firstLine,
      titleIndex,
      firstLineIndex
    );

    if (match) {
      // Check if this song already has an AAHH catalog number (duplicate title, different tune)
      if (match.song.catalogs?.aahh) {
        // This is a second AAHH entry for the same library song — create a new entry
        const song = createNewSong(row, aahhNum, existingIds);
        // Differentiate by tune name if available
        const tuneName = cleanTuneTitle(row.tuneTitle);
        if (tuneName) {
          song.title = `${row.displayTitle.trim()} (${tuneName})`;
          song.id = slugify(song.title);
          if (song.composer) song.id += `--${slugify(song.composer)}`;
          let counter = 1;
          while (existingIds.has(song.id)) {
            counter++;
            song.id = `${slugify(song.title)}--${slugify(song.composer || "")}-${counter}`;
          }
        }
        existingIds.add(song.id);
        newSongs.push(song);
        newCount++;
        newLog.push(
          `  NEW (dup tune) AAHH#${aahhNum} "${row.displayTitle}" → "${song.title}" [${song.id}]`
        );
        continue;
      }

      enrichSong(match.song, row, aahhNum);
      matched++;
      matchLog.push(
        `  [${match.confidence}] AAHH#${aahhNum} "${row.displayTitle}" → "${match.song.title}" [${match.song.id}]`
      );
    } else {
      // No match — create new entry
      const song = createNewSong(row, aahhNum, existingIds);
      existingIds.add(song.id);
      newSongs.push(song);
      newCount++;
      newLog.push(
        `  NEW AAHH#${aahhNum} "${row.displayTitle}" [${song.id}]`
      );
    }
  }

  // Append new songs to library
  library.push(...newSongs);

  // Write
  if (!DRY_RUN) {
    fs.writeFileSync(SONG_LIBRARY_PATH, JSON.stringify(library, null, 2));
    console.log(`\nWrote ${library.length} songs to song-library.json`);
  }

  // Summary
  console.log(`\n=== Results ===`);
  console.log(`AAHH rows: ${rows.length}`);
  console.log(`Matched to existing: ${matched}`);
  console.log(`New songs created: ${newCount}`);
  console.log(`Skipped (no number): ${skipped}`);
  console.log(`Final library size: ${library.length}`);

  // Sample matches
  if (matchLog.length > 0) {
    console.log(`\n--- Matches (${matchLog.length}) ---`);
    const limit = DRY_RUN ? matchLog.length : 20;
    for (const line of matchLog.slice(0, limit)) {
      console.log(line);
    }
    if (matchLog.length > limit) {
      console.log(`  ... and ${matchLog.length - limit} more`);
    }
  }

  // New songs
  if (newLog.length > 0) {
    console.log(`\n--- New Songs (${newLog.length}) ---`);
    const limit = DRY_RUN ? newLog.length : 20;
    for (const line of newLog.slice(0, limit)) {
      console.log(line);
    }
    if (newLog.length > limit) {
      console.log(`  ... and ${newLog.length - limit} more`);
    }
  }
}

main();
