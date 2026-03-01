import fs from "fs";
import path from "path";
import type { LibrarySong, SongCategory } from "../src/lib/types";

// ───── CONFIGURATION ─────

const SS_TITLE_INDEX_PATH =
  "/Users/jeffreybonilla/St Monica Dropbox/Jeff Bonilla/PROJECTS/Index Folder/ss_title_index.json";
const SS_JSON_PATH =
  "/Users/jeffreybonilla/St Monica Dropbox/Jeff Bonilla/PROJECTS/Index Folder/spirit-and-song-data.json";
const SONG_LIBRARY_PATH = path.join(__dirname, "../src/data/song-library.json");

const DRY_RUN = process.argv.includes("--dry-run");

// ───── DATA TYPES ─────

interface SSTitleEntry {
  spiritSong: number;
  title: string;
}

interface SSTitleIndex {
  total_entries: number;
  titles: SSTitleEntry[];
}

interface SSData {
  authorsComposersArrangers: Record<string, number[]>;
  topicalIndex: Record<string, number[] | string>;
  scripturalIndex: Record<string, Record<string, { number: number; title: string }>>;
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
    /\bglory to god\b/.test(t) ||
    /\bgloria\b/.test(t) ||
    /\bsanctus\b/.test(t) ||
    /\bholy,?\s*holy/.test(t) ||
    /\bmemorial accl/.test(t) ||
    /\bmystery of faith\b/.test(t) ||
    /\bwe proclaim your death\b/.test(t) ||
    /\bwhen we eat this bread\b/.test(t) ||
    /\bsave us,?\s*savior\b/.test(t) ||
    /\bgreat amen\b/.test(t) ||
    /^amen\b/.test(t) ||
    /\blamb of god\b/.test(t) ||
    /\bagnus dei\b/.test(t) ||
    /\blord have mercy\b/.test(t) ||
    /\blord,?\s*have mercy\b/.test(t) ||
    /\bpenitential\b/.test(t) ||
    /\bfraction rite\b/.test(t) ||
    /\bmass setting\b/.test(t) ||
    /\bmisa\b/.test(t) ||
    /\blord's prayer\b/.test(t) ||
    /\bi saw water flowing\b/.test(t) ||
    /\bdismissal of the catechumens\b/.test(t) ||
    /\bhear our prayer\b/.test(t) ||
    /\boyenos\b/.test(t)
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

// ───── INVERT METADATA MAPS ─────

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
  confidence: "exact" | "no-paren" | "slash-part";
}

function findMatch(
  ssTitle: string,
  titleIndex: Map<string, LibrarySong[]>
): MatchResult | null {
  const normTitle = normalize(ssTitle);

  // Mass setting titles contain "(Mass of ...)" — these parentheticals are part of
  // the title, not composer attributions. Skip fuzzy matching for these.
  const isMassSetting = /\(Mass of /i.test(ssTitle);

  // Tier 1: Exact normalized title match (unique)
  const titleMatches = titleIndex.get(normTitle);
  if (titleMatches && titleMatches.length === 1) {
    return { song: titleMatches[0], confidence: "exact" };
  }

  // Skip fuzzy tiers for mass setting titles
  if (isMassSetting) return null;

  // Tier 2: Strip parenthetical composer/setting names
  const noParen = normalize(ssTitle.replace(/\(.*?\)/g, "").trim());
  if (noParen !== normTitle && noParen.length > 3) {
    const parenMatches = titleIndex.get(noParen);
    if (parenMatches && parenMatches.length === 1) {
      return { song: parenMatches[0], confidence: "no-paren" };
    }
  }

  // Tier 3: Try part before "/" if title has a slash
  if (ssTitle.includes("/")) {
    const parts = ssTitle.split("/").map((p) => p.trim());
    for (const part of parts) {
      const normPart = normalize(part.replace(/\(.*?\)/g, "").trim());
      if (normPart.length > 3) {
        const partMatches = titleIndex.get(normPart);
        if (partMatches && partMatches.length === 1) {
          return { song: partMatches[0], confidence: "slash-part" };
        }
      }
    }
  }

  return null;
}

// ───── ENRICHMENT ─────

function enrichSong(
  song: LibrarySong,
  ssNum: number,
  ssTopics: Map<number, string[]>,
  ssScriptureRefs: Map<number, string[]>
): void {
  if (!song.catalogs) song.catalogs = {};
  song.catalogs.spiritSong = ssNum;

  const topics = ssTopics.get(ssNum);
  if (topics && topics.length > 0) {
    const existing = new Set(song.topics || []);
    for (const t of topics) existing.add(t);
    song.topics = [...existing];
  }

  const refs = ssScriptureRefs.get(ssNum);
  if (refs && refs.length > 0) {
    const existing = new Set(song.scriptureRefs || []);
    for (const r of refs) existing.add(r);
    song.scriptureRefs = [...existing];
  }
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

  // Load comprehensive S&S title index (visually extracted)
  console.log("Loading S&S title index...");
  const titleData: SSTitleIndex = JSON.parse(
    fs.readFileSync(SS_TITLE_INDEX_PATH, "utf-8")
  );
  console.log(`S&S title index has ${titleData.titles.length} entries`);

  // Load S&S metadata JSON (for composers, topics, scripture refs)
  console.log("Loading S&S metadata JSON...");
  const ssData: SSData = JSON.parse(fs.readFileSync(SS_JSON_PATH, "utf-8"));

  // Build inverted metadata maps
  const ssAuthors = invertAuthors(ssData);
  const ssTopics = invertTopics(ssData);
  const ssScriptureRefs = invertScriptureRefs(ssData);

  // Collect SS numbers already in the library (skip these)
  const existingSS = new Set<number>();
  for (const song of library) {
    if (song.catalogs?.spiritSong) {
      existingSS.add(song.catalogs.spiritSong);
    }
  }
  console.log(`Library already has ${existingSS.size} songs with spiritSong catalog numbers`);

  // Build title index from library
  const libTitleIndex = new Map<string, LibrarySong[]>();
  for (const song of library) {
    const normTitle = normalize(song.title);
    if (!libTitleIndex.has(normTitle)) libTitleIndex.set(normTitle, []);
    libTitleIndex.get(normTitle)!.push(song);
  }

  // Track existing IDs for dedup
  const existingIds = new Set(library.map((s) => s.id));

  // Process title index entries
  let skipped = 0;
  let matched = 0;
  let newCount = 0;
  const matchLog: string[] = [];
  const newLog: string[] = [];
  const newSongs: LibrarySong[] = [];

  for (const entry of titleData.titles) {
    const ssNum = entry.spiritSong;
    const title = entry.title.trim();

    // Skip if already in library
    if (existingSS.has(ssNum)) {
      skipped++;
      continue;
    }

    const match = findMatch(title, libTitleIndex);

    if (match) {
      // Check if matched song already has a different spiritSong number
      if (match.song.catalogs?.spiritSong) {
        // Different SS number maps to same song — create new entry
        const authors = ssAuthors.get(ssNum) || [];
        const composerStr = authors.length > 0 ? authors.join(" \u2022 ") : undefined;

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
          catalogs: { spiritSong: ssNum },
          resources: [],
          usageCount: 0,
          occasions: [],
        };

        const topics = ssTopics.get(ssNum);
        if (topics && topics.length > 0) song.topics = [...new Set(topics)];
        const refs = ssScriptureRefs.get(ssNum);
        if (refs && refs.length > 0) song.scriptureRefs = [...new Set(refs)];

        existingIds.add(song.id);
        newSongs.push(song);
        newCount++;
        newLog.push(`  NEW (dup-match) SS#${ssNum} "${title}" [${song.id}]`);
        continue;
      }

      enrichSong(match.song, ssNum, ssTopics, ssScriptureRefs);
      matched++;
      matchLog.push(
        `  [${match.confidence}] SS#${ssNum} "${title}" → "${match.song.title}" [${match.song.id}]`
      );
    } else {
      // No match — create new entry
      const authors = ssAuthors.get(ssNum) || [];
      const composerStr = authors.length > 0 ? authors.join(" \u2022 ") : undefined;

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
        catalogs: { spiritSong: ssNum },
        resources: [],
        usageCount: 0,
        occasions: [],
      };

      const topics = ssTopics.get(ssNum);
      if (topics && topics.length > 0) song.topics = [...new Set(topics)];
      const refs = ssScriptureRefs.get(ssNum);
      if (refs && refs.length > 0) song.scriptureRefs = [...new Set(refs)];

      existingIds.add(song.id);
      newSongs.push(song);
      newCount++;
      newLog.push(`  NEW SS#${ssNum} "${title}" [${song.id}]`);
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
  console.log(`S&S title index entries: ${titleData.titles.length}`);
  console.log(`Already in library (skipped): ${skipped}`);
  console.log(`Matched to existing library songs: ${matched}`);
  console.log(`New songs created: ${newCount}`);
  console.log(`Final library size: ${library.length}`);

  // Matches
  if (matchLog.length > 0) {
    console.log(`\n--- Matches (${matchLog.length}) ---`);
    const limit = DRY_RUN ? matchLog.length : 20;
    for (const line of matchLog.slice(0, limit)) console.log(line);
    if (matchLog.length > limit) console.log(`  ... and ${matchLog.length - limit} more`);
  }

  // New songs
  if (newLog.length > 0) {
    console.log(`\n--- New Songs (${newLog.length}) ---`);
    const limit = DRY_RUN ? newLog.length : 20;
    for (const line of newLog.slice(0, limit)) console.log(line);
    if (newLog.length > limit) console.log(`  ... and ${newLog.length - limit} more`);
  }
}

main();
