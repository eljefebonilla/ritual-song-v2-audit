import fs from "fs";
import path from "path";
import type { LibrarySong, SongCategory } from "../src/lib/types";

// ───── CONFIGURATION ─────

const VOICES_INDEX_PATH =
  "/Users/jeffreybonilla/St Monica Dropbox/Jeff Bonilla/PROJECTS/Index Folder/voices_title_index.json";
const SONG_LIBRARY_PATH = path.join(__dirname, "../src/data/song-library.json");

const DRY_RUN = process.argv.includes("--dry-run");

// ───── SOURCE DATA TYPES ─────

interface VoicesTitleEntry {
  voices: number;
  title: string;
}

interface VoicesTitleIndex {
  total_entries: number;
  titles: VoicesTitleEntry[];
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
  if (/\bkyrie\b/.test(t) || /\bgloria\b/.test(t) || /\bsanctus\b/.test(t) || /\bholy,?\s*holy/.test(t) || /\bmemorial accl/.test(t) || /\bgreat amen\b/.test(t) || /\blamb of god\b/.test(t) || /\bagnus dei\b/.test(t) || /\blord have mercy\b/.test(t) || /\bpenitential\b/.test(t) || /\bfraction rite\b/.test(t) || /\bmass setting\b/.test(t) || /\bmisa\b/.test(t) || /\blord's prayer\b/.test(t)) return "mass_part";
  if (/^ps\.?\s*\d/.test(t) || /^psalm\s*\d/.test(t) || /\bresponsorial\b/.test(t)) return "psalm";
  if (/\balleluia\b/.test(t) || /\bgospel accl/.test(t) || /\bverse before/.test(t) || /\blenten gospel/.test(t)) return "gospel_acclamation";
  return "song";
}

// ───── MATCHING ─────

interface MatchResult {
  song: LibrarySong;
  confidence: "exact" | "slash-part" | "no-paren";
}

function findMatch(
  title: string,
  titleIndex: Map<string, LibrarySong[]>
): MatchResult | null {
  const normTitle = normalize(title);

  // Tier 1: Full title match (unique)
  const fullMatches = titleIndex.get(normTitle);
  if (fullMatches && fullMatches.length === 1) {
    return { song: fullMatches[0], confidence: "exact" };
  }

  // Tier 2: Slash-separated parts
  if (title.includes("/")) {
    const parts = title.split("/").map((p) => p.trim());
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

  // Tier 3: Strip parentheticals and mass setting suffixes
  const noParen = normalize(title.replace(/\(.*?\)/g, "").trim());
  if (noParen !== normTitle && noParen.length > 3) {
    const parenMatches = titleIndex.get(noParen);
    if (parenMatches && parenMatches.length === 1) {
      return { song: parenMatches[0], confidence: "no-paren" };
    }
  }

  return null;
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

  // Load Voices title index
  console.log("Loading Voices title index...");
  const indexData: VoicesTitleIndex = JSON.parse(
    fs.readFileSync(VOICES_INDEX_PATH, "utf-8")
  );
  console.log(`Voices index has ${indexData.titles.length} entries`);

  // Build title index from library
  const titleIndex = new Map<string, LibrarySong[]>();
  for (const song of library) {
    const normTitle = normalize(song.title);
    if (!titleIndex.has(normTitle)) titleIndex.set(normTitle, []);
    titleIndex.get(normTitle)!.push(song);
  }

  // Track existing IDs
  const existingIds = new Set(library.map((s) => s.id));

  // Process entries
  let matched = 0;
  let newCount = 0;
  let skipped = 0;
  const matchLog: string[] = [];
  const newLog: string[] = [];
  const newSongs: LibrarySong[] = [];

  for (const entry of indexData.titles) {
    const num = entry.voices;
    const title = entry.title.trim();

    // Skip entries that are just numbers (like Voices #1 = "146")
    if (/^\d+$/.test(title)) {
      skipped++;
      continue;
    }

    const match = findMatch(title, titleIndex);

    if (match) {
      if (!match.song.catalogs) match.song.catalogs = {};
      match.song.catalogs.voices = num;
      matched++;
      matchLog.push(
        `  [${match.confidence}] V#${num} "${title}" → "${match.song.title}" [${match.song.id}]`
      );
    } else {
      // Create new entry
      let baseSlug = slugify(title);
      let id = baseSlug;
      let counter = 1;
      while (existingIds.has(id)) {
        counter++;
        id = `${baseSlug}-${counter}`;
      }

      const song: LibrarySong = {
        id,
        title,
        category: classifySong(title),
        catalogs: { voices: num },
        resources: [],
        usageCount: 0,
        occasions: [],
      };

      existingIds.add(song.id);
      newSongs.push(song);
      newCount++;
      newLog.push(`  NEW V#${num} "${title}" [${song.id}]`);
    }
  }

  library.push(...newSongs);

  if (!DRY_RUN) {
    fs.writeFileSync(SONG_LIBRARY_PATH, JSON.stringify(library, null, 2));
    console.log(`\nWrote ${library.length} songs to song-library.json`);
  }

  console.log(`\n=== Results ===`);
  console.log(`Voices entries: ${indexData.titles.length}`);
  console.log(`Matched to existing: ${matched}`);
  console.log(`New songs created: ${newCount}`);
  console.log(`Skipped (numeric-only title): ${skipped}`);
  console.log(`Final library size: ${library.length}`);

  if (matchLog.length > 0) {
    console.log(`\n--- Matches (${matchLog.length}) ---`);
    const limit = DRY_RUN ? matchLog.length : 20;
    for (const line of matchLog.slice(0, limit)) console.log(line);
    if (matchLog.length > limit) console.log(`  ... and ${matchLog.length - limit} more`);
  }

  if (newLog.length > 0) {
    console.log(`\n--- New Songs (${newLog.length}) ---`);
    const limit = DRY_RUN ? newLog.length : 20;
    for (const line of newLog.slice(0, limit)) console.log(line);
    if (newLog.length > limit) console.log(`  ... and ${newLog.length - limit} more`);
  }
}

main();
