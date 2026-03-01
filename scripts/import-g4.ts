import fs from "fs";
import path from "path";
import type { LibrarySong, SongCategory } from "../src/lib/types";

// ───── CONFIGURATION ─────

const G4_TITLE_INDEX_PATH =
  "/Users/jeffreybonilla/St Monica Dropbox/Jeff Bonilla/PROJECTS/Index Folder/g4_title_index.json";
const G4_COMPOSERS_PATH =
  "/Users/jeffreybonilla/St Monica Dropbox/Jeff Bonilla/PROJECTS/Index Folder/g4_composers_authors_sources.json";
const SONG_LIBRARY_PATH = path.join(__dirname, "../src/data/song-library.json");

const DRY_RUN = process.argv.includes("--dry-run");

// ───── SOURCE DATA TYPES ─────

interface G4TitleEntry {
  g4: number;
  title: string;
}

interface G4TitleIndex {
  total_entries: number;
  titles: G4TitleEntry[];
}

interface G4ComposerEntry {
  name: string;
  g4: number[];
}

interface G4ComposersIndex {
  entries: G4ComposerEntry[];
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

// ───── SONG CLASSIFICATION ─────

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

// ───── BUILD G4 → COMPOSER NAMES MAP ─────

/**
 * Invert the composers JSON (name → g4[]) into a map of g4 → names[].
 */
function buildG4ComposerMap(
  composersData: G4ComposersIndex
): Map<number, string[]> {
  const map = new Map<number, string[]>();
  for (const entry of composersData.entries) {
    for (const g4Num of entry.g4) {
      if (!map.has(g4Num)) map.set(g4Num, []);
      map.get(g4Num)!.push(entry.name);
    }
  }
  return map;
}

// ───── MATCHING ─────

interface MatchResult {
  song: LibrarySong;
  confidence: "exact" | "slash-part" | "dash-stripped" | "no-paren";
}

function findMatch(
  g4Title: string,
  titleIndex: Map<string, LibrarySong[]>
): MatchResult | null {
  const normTitle = normalize(g4Title);

  // Tier 1: Full title match (unique)
  const fullMatches = titleIndex.get(normTitle);
  if (fullMatches && fullMatches.length === 1) {
    return { song: fullMatches[0], confidence: "exact" };
  }

  // Tier 2: Slash-separated parts (bilingual titles like "Acuerdate de Jesucristo / Keep in Mind")
  if (g4Title.includes("/")) {
    const parts = g4Title.split("/").map((p) => p.trim());
    for (const part of parts) {
      const normPart = normalize(part);
      if (normPart.length > 3) {
        const partMatches = titleIndex.get(normPart);
        if (partMatches && partMatches.length === 1) {
          return { song: partMatches[0], confidence: "slash-part" };
        }
      }
    }
  }

  // Tier 3: Strip dash suffix ("All the Ends of the Earth - Psalm 98" → "All the Ends of the Earth")
  const dashIdx = g4Title.indexOf(" - ");
  if (dashIdx > 0) {
    const beforeDash = normalize(g4Title.slice(0, dashIdx));
    if (beforeDash.length > 3) {
      const dashMatches = titleIndex.get(beforeDash);
      if (dashMatches && dashMatches.length === 1) {
        return { song: dashMatches[0], confidence: "dash-stripped" };
      }
    }
  }

  // Tier 4: Strip parentheticals
  const noParen = normalize(g4Title.replace(/\(.*?\)/g, "").trim());
  if (noParen !== normTitle && noParen.length > 3) {
    const parenMatches = titleIndex.get(noParen);
    if (parenMatches && parenMatches.length === 1) {
      return { song: parenMatches[0], confidence: "no-paren" };
    }
  }

  return null;
}

// ───── NEW SONG CREATION ─────

function createNewSong(
  title: string,
  g4Num: number,
  composerNames: string[],
  existingIds: Set<string>
): LibrarySong {
  const composerStr =
    composerNames.length > 0 ? composerNames.join(" \u2022 ") : undefined;

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
    composer: composerStr,
    category: classifySong(title),
    catalogs: { gather4: g4Num },
    resources: [],
    usageCount: 0,
    occasions: [],
  };

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

  // Load G4 title index
  console.log("Loading G4 title index...");
  const titleData: G4TitleIndex = JSON.parse(
    fs.readFileSync(G4_TITLE_INDEX_PATH, "utf-8")
  );
  console.log(`G4 title index has ${titleData.titles.length} entries`);

  // Load G4 composers
  console.log("Loading G4 composers/authors/sources...");
  const composersData: G4ComposersIndex = JSON.parse(
    fs.readFileSync(G4_COMPOSERS_PATH, "utf-8")
  );
  console.log(`G4 composers index has ${composersData.entries.length} entries`);

  // Build G4# → composer names map
  const g4ComposerMap = buildG4ComposerMap(composersData);

  // Deduplicate G4 title entries — keep only first occurrence of each G4#
  const seenG4 = new Set<number>();
  const uniqueEntries: G4TitleEntry[] = [];
  let dupeSkipped = 0;
  for (const entry of titleData.titles) {
    if (seenG4.has(entry.g4)) {
      dupeSkipped++;
      continue;
    }
    seenG4.add(entry.g4);
    uniqueEntries.push(entry);
  }
  console.log(
    `Unique G4 numbers: ${uniqueEntries.length} (${dupeSkipped} duplicate entries skipped)`
  );

  // Build title index from library
  const titleIndex = new Map<string, LibrarySong[]>();
  for (const song of library) {
    const normTitle = normalize(song.title);
    if (!titleIndex.has(normTitle)) titleIndex.set(normTitle, []);
    titleIndex.get(normTitle)!.push(song);
  }

  // Track existing IDs for dedup
  const existingIds = new Set(library.map((s) => s.id));

  // Process entries
  let matched = 0;
  let newCount = 0;
  const matchLog: string[] = [];
  const newLog: string[] = [];
  const newSongs: LibrarySong[] = [];

  for (const entry of uniqueEntries) {
    const g4Num = entry.g4;
    const g4Title = entry.title.trim();

    const match = findMatch(g4Title, titleIndex);

    if (match) {
      // Set G4 catalog number — don't overwrite existing credits
      if (!match.song.catalogs) match.song.catalogs = {};
      match.song.catalogs.gather4 = g4Num;
      matched++;
      matchLog.push(
        `  [${match.confidence}] G4#${g4Num} "${g4Title}" \u2192 "${match.song.title}" [${match.song.id}]`
      );
    } else {
      // No match — create new entry
      const composerNames = g4ComposerMap.get(g4Num) || [];
      const song = createNewSong(g4Title, g4Num, composerNames, existingIds);
      existingIds.add(song.id);
      newSongs.push(song);
      newCount++;
      newLog.push(`  NEW G4#${g4Num} "${g4Title}" [${song.id}]`);
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
  console.log(`G4 title entries: ${titleData.titles.length}`);
  console.log(`Unique G4 numbers: ${uniqueEntries.length}`);
  console.log(`Duplicate entries skipped: ${dupeSkipped}`);
  console.log(`Matched to existing: ${matched}`);
  console.log(`New songs created: ${newCount}`);
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
}

main();
