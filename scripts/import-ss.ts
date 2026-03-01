import fs from "fs";
import path from "path";
import type { LibrarySong, SongCategory } from "../src/lib/types";

// ───── CONFIGURATION ─────

const SS_JSON_PATH =
  "/Users/jeffreybonilla/St Monica Dropbox/Jeff Bonilla/PROJECTS/Index Folder/spirit-and-song-data.json";
const SONG_LIBRARY_PATH = path.join(__dirname, "../src/data/song-library.json");

const DRY_RUN = process.argv.includes("--dry-run");

// ───── SPIRIT & SONG DATA TYPES ─────

interface SSPsalmSetting {
  number: number;
  title: string;
}

interface SSPsalmEntry {
  psalm: number;
  season: string;
  settings: SSPsalmSetting[];
}

interface SSScripturalEntry {
  number: number;
  title: string;
}

interface SSData {
  hymnal: string;
  publisher: string;
  songCount: number;
  indexOfTextMusicHymnSources: Record<string, Record<string, number[]> | string>;
  indexOfCommonPsalms: SSPsalmEntry[];
  scripturalIndex: Record<string, Record<string, SSScripturalEntry>>;
  authorsComposersArrangers: Record<string, number[]>;
  topicalIndex: Record<string, number[] | string>;
  liturgicalIndex: Record<string, unknown>;
  massSettings: string;
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

// ───── EXTRACT TITLED SONGS ─────

interface SSTitledSong {
  number: number;
  title: string;
  source: "psalm" | "scriptural";
}

/**
 * Extract all songs with titles from indexOfCommonPsalms and scripturalIndex.
 * Deduplicates by SS number (keeps first title encountered).
 */
function extractTitledSongs(data: SSData): Map<number, SSTitledSong> {
  const titled = new Map<number, SSTitledSong>();

  // From indexOfCommonPsalms
  for (const entry of data.indexOfCommonPsalms) {
    for (const setting of entry.settings) {
      if (!titled.has(setting.number)) {
        titled.set(setting.number, {
          number: setting.number,
          title: setting.title,
          source: "psalm",
        });
      }
    }
  }

  // From scripturalIndex
  for (const book of Object.values(data.scripturalIndex)) {
    if (typeof book === "string") continue;
    for (const entry of Object.values(book)) {
      if (entry && typeof entry === "object" && "number" in entry && "title" in entry) {
        if (!titled.has(entry.number)) {
          titled.set(entry.number, {
            number: entry.number,
            title: entry.title,
            source: "scriptural",
          });
        }
      }
    }
  }

  return titled;
}

// ───── COLLECT ALL SS NUMBERS ─────

/**
 * Walk every section of the S&S JSON and collect every unique SS number.
 */
function collectAllSSNumbers(data: SSData): Set<number> {
  const all = new Set<number>();

  // indexOfTextMusicHymnSources
  for (const letterGroup of Object.values(data.indexOfTextMusicHymnSources)) {
    if (typeof letterGroup === "string") continue;
    for (const nums of Object.values(letterGroup)) {
      for (const n of nums) all.add(n);
    }
  }

  // indexOfCommonPsalms
  for (const entry of data.indexOfCommonPsalms) {
    for (const setting of entry.settings) {
      all.add(setting.number);
    }
  }

  // scripturalIndex
  for (const book of Object.values(data.scripturalIndex)) {
    if (typeof book === "string") continue;
    for (const entry of Object.values(book)) {
      if (entry && typeof entry === "object" && "number" in entry) {
        all.add(entry.number);
      }
    }
  }

  // authorsComposersArrangers
  for (const nums of Object.values(data.authorsComposersArrangers)) {
    for (const n of nums) all.add(n);
  }

  // topicalIndex
  for (const value of Object.values(data.topicalIndex)) {
    if (Array.isArray(value)) {
      for (const n of value) all.add(n);
    }
  }

  // liturgicalIndex — recursive walk
  function walkLiturgical(obj: unknown): void {
    if (Array.isArray(obj)) {
      for (const n of obj) {
        if (typeof n === "number") all.add(n);
      }
    } else if (obj && typeof obj === "object") {
      for (const value of Object.values(obj as Record<string, unknown>)) {
        if (typeof value === "string") continue;
        walkLiturgical(value);
      }
    }
  }
  walkLiturgical(data.liturgicalIndex);

  return all;
}

// ───── INVERT AUTHORS/COMPOSERS ─────

function invertAuthors(data: SSData): Map<number, string[]> {
  const map = new Map<number, string[]>();
  for (const [name, nums] of Object.entries(data.authorsComposersArrangers)) {
    for (const n of nums) {
      if (!map.has(n)) map.set(n, []);
      map.get(n)!.push(name);
    }
  }
  return map;
}

// ───── INVERT TOPICS ─────

function invertTopics(data: SSData): Map<number, string[]> {
  const map = new Map<number, string[]>();
  for (const [topic, value] of Object.entries(data.topicalIndex)) {
    if (!Array.isArray(value)) continue;
    for (const n of value) {
      if (!map.has(n)) map.set(n, []);
      map.get(n)!.push(topic);
    }
  }
  return map;
}

// ───── INVERT SCRIPTURE REFS ─────

function invertScriptureRefs(data: SSData): Map<number, string[]> {
  const map = new Map<number, string[]>();
  for (const [book, entries] of Object.entries(data.scripturalIndex)) {
    if (typeof entries === "string") continue;
    for (const [verse, entry] of Object.entries(entries)) {
      if (entry && typeof entry === "object" && "number" in entry) {
        const n = entry.number;
        const ref = `${book} ${verse}`;
        if (!map.has(n)) map.set(n, []);
        map.get(n)!.push(ref);
      }
    }
  }
  return map;
}

// ───── MATCHING ─────

interface MatchResult {
  song: LibrarySong;
  confidence: "exact" | "title";
}

function findMatch(
  ssTitle: string,
  titleIndex: Map<string, LibrarySong[]>
): MatchResult | null {
  const normTitle = normalize(ssTitle);

  // Tier 1: Exact normalized title match (unique)
  const titleMatches = titleIndex.get(normTitle);
  if (titleMatches && titleMatches.length === 1) {
    return { song: titleMatches[0], confidence: "exact" };
  }

  // Tier 2: Strip parenthetical composer disambiguation and subtitles
  // e.g. "To You, O Lord (TR Smith)" → "To You, O Lord"
  // e.g. "Be Merciful, O Lord/Create a Clean Heart (Consiglio)" → "Be Merciful, O Lord/Create a Clean Heart"
  const cleanTitle = normalize(
    ssTitle
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

  // Tier 3: Try the part before "/" if title has a slash
  // e.g. "My Soul Is Thirsting/As Morning Breaks (Angrisano)" → "My Soul Is Thirsting"
  if (ssTitle.includes("/")) {
    const beforeSlash = normalize(
      ssTitle.split("/")[0].replace(/\(.*?\)/g, "").trim()
    );
    if (beforeSlash.length > 3) {
      const slashMatches = titleIndex.get(beforeSlash);
      if (slashMatches && slashMatches.length === 1) {
        return { song: slashMatches[0], confidence: "title" };
      }
    }
  }

  return null;
}

// ───── ENRICHMENT ─────

function enrichSong(
  song: LibrarySong,
  ssNum: number,
  ssAuthors: Map<number, string[]>,
  ssTopics: Map<number, string[]>,
  ssScriptureRefs: Map<number, string[]>
): void {
  // Catalog number
  if (!song.catalogs) song.catalogs = {};
  song.catalogs.spiritSong = ssNum;

  // Topics (merge, don't overwrite)
  const topics = ssTopics.get(ssNum);
  if (topics && topics.length > 0) {
    const existing = new Set(song.topics || []);
    for (const t of topics) existing.add(t);
    song.topics = [...existing];
  }

  // Scripture refs (merge, don't overwrite)
  const refs = ssScriptureRefs.get(ssNum);
  if (refs && refs.length > 0) {
    const existing = new Set(song.scriptureRefs || []);
    for (const r of refs) existing.add(r);
    song.scriptureRefs = [...existing];
  }
}

// ───── NEW SONG CREATION ─────

function createNewSong(
  title: string,
  ssNum: number,
  ssAuthors: Map<number, string[]>,
  ssTopics: Map<number, string[]>,
  ssScriptureRefs: Map<number, string[]>,
  existingIds: Set<string>
): LibrarySong {
  // Build composer string from authors
  const authors = ssAuthors.get(ssNum) || [];
  const composerStr = authors.join(" \u2022 ");

  // Build unique ID
  let baseSlug = slugify(title);
  if (composerStr) baseSlug += `--${slugify(composerStr)}`;
  let id = baseSlug;
  let counter = 1;
  while (existingIds.has(id)) {
    counter++;
    id = `${baseSlug}-${counter}`;
  }

  const song: LibrarySong = {
    id,
    title,
    composer: composerStr || undefined,
    category: classifySong(title),
    catalogs: { spiritSong: ssNum },
    resources: [],
    usageCount: 0,
    occasions: [],
  };

  // Topics
  const topics = ssTopics.get(ssNum);
  if (topics && topics.length > 0) {
    song.topics = [...new Set(topics)];
  }

  // Scripture refs
  const refs = ssScriptureRefs.get(ssNum);
  if (refs && refs.length > 0) {
    song.scriptureRefs = [...new Set(refs)];
  }

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

  // Load Spirit & Song data
  console.log("Loading Spirit & Song JSON...");
  const ssData: SSData = JSON.parse(fs.readFileSync(SS_JSON_PATH, "utf-8"));
  console.log(`Spirit & Song catalog: ${ssData.songCount} songs declared`);

  // Step 1: Extract titled songs
  const titledSongs = extractTitledSongs(ssData);
  console.log(`Titled songs extracted: ${titledSongs.size}`);

  // Step 2: Collect all SS numbers from every section
  const allSSNumbers = collectAllSSNumbers(ssData);
  console.log(`Unique SS numbers found across all indexes: ${allSSNumbers.size}`);

  // Step 3: Invert lookup maps
  const ssAuthors = invertAuthors(ssData);
  const ssTopics = invertTopics(ssData);
  const ssScriptureRefs = invertScriptureRefs(ssData);

  // Step 4: Build title index from library
  const titleIndex = new Map<string, LibrarySong[]>();
  for (const song of library) {
    const normTitle = normalize(song.title);
    if (!titleIndex.has(normTitle)) titleIndex.set(normTitle, []);
    titleIndex.get(normTitle)!.push(song);
  }

  // Track existing IDs for dedup
  const existingIds = new Set(library.map((s) => s.id));

  // Step 5: Process titled songs
  let matched = 0;
  let newCount = 0;
  const matchLog: string[] = [];
  const newLog: string[] = [];
  const newSongs: LibrarySong[] = [];
  const matchedSSNumbers = new Set<number>();

  for (const [ssNum, titled] of titledSongs) {
    const match = findMatch(titled.title, titleIndex);

    if (match) {
      // Check if already has a spiritSong catalog number (duplicate title, different setting)
      if (match.song.catalogs?.spiritSong) {
        // Create a new entry for the duplicate
        const song = createNewSong(
          titled.title,
          ssNum,
          ssAuthors,
          ssTopics,
          ssScriptureRefs,
          existingIds
        );
        existingIds.add(song.id);
        newSongs.push(song);
        newCount++;
        matchedSSNumbers.add(ssNum);
        newLog.push(
          `  NEW (dup) SS#${ssNum} "${titled.title}" [${song.id}]`
        );
        continue;
      }

      enrichSong(match.song, ssNum, ssAuthors, ssTopics, ssScriptureRefs);
      matched++;
      matchedSSNumbers.add(ssNum);
      matchLog.push(
        `  [${match.confidence}] SS#${ssNum} "${titled.title}" → "${match.song.title}" [${match.song.id}]`
      );
    } else {
      // No match — create new entry
      const song = createNewSong(
        titled.title,
        ssNum,
        ssAuthors,
        ssTopics,
        ssScriptureRefs,
        existingIds
      );
      existingIds.add(song.id);
      newSongs.push(song);
      newCount++;
      matchedSSNumbers.add(ssNum);
      newLog.push(`  NEW SS#${ssNum} "${titled.title}" [${song.id}]`);
    }
  }

  // Step 6: Count unresolvable numbers (appear in indexes but have no title)
  const unresolvableNumbers: number[] = [];
  for (const n of allSSNumbers) {
    if (!matchedSSNumbers.has(n)) {
      unresolvableNumbers.push(n);
    }
  }
  unresolvableNumbers.sort((a, b) => a - b);

  // Append new songs to library
  library.push(...newSongs);

  // Write
  if (!DRY_RUN) {
    fs.writeFileSync(SONG_LIBRARY_PATH, JSON.stringify(library, null, 2));
    console.log(`\nWrote ${library.length} songs to song-library.json`);
  }

  // Summary
  console.log(`\n=== Results ===`);
  console.log(`Titled SS songs found: ${titledSongs.size}`);
  console.log(`Matched to existing library songs: ${matched}`);
  console.log(`New songs created: ${newCount}`);
  console.log(`Total unique SS numbers across all indexes: ${allSSNumbers.size}`);
  console.log(`SS numbers with titles (resolved): ${matchedSSNumbers.size}`);
  console.log(`SS numbers without titles (unresolvable): ${unresolvableNumbers.length}`);
  console.log(`Final library size: ${library.length}`);

  // Matches
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

  // Unresolvable numbers (always show summary, full list on dry run)
  if (unresolvableNumbers.length > 0) {
    console.log(`\n--- Unresolvable SS Numbers (${unresolvableNumbers.length}) ---`);
    console.log(`  These numbers appear in topical/liturgical/author indexes but have no title.`);
    console.log(`  They will need the full Spirit & Song PDF extraction to resolve.`);
    if (DRY_RUN) {
      // Group into ranges for readability
      const ranges: string[] = [];
      let start = unresolvableNumbers[0];
      let prev = start;
      for (let i = 1; i <= unresolvableNumbers.length; i++) {
        const curr = unresolvableNumbers[i];
        if (curr === prev + 1) {
          prev = curr;
        } else {
          ranges.push(start === prev ? `${start}` : `${start}-${prev}`);
          start = curr;
          prev = curr;
        }
      }
      console.log(`  Numbers: ${ranges.join(", ")}`);
    } else {
      console.log(`  Run with --dry-run to see the full list.`);
    }
  }
}

main();
