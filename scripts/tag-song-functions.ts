/**
 * tag-song-functions.ts
 *
 * Scans all occasion JSON files and derives liturgical function tags
 * (gathering, offertory, communion, sending, etc.) for each song in
 * song-library.json based on which MusicPlan field the song appears in.
 *
 * Run with:
 *   npx tsx scripts/tag-song-functions.ts
 *
 * Pass --dry-run to preview without writing.
 */

import fs from "fs";
import path from "path";
import type { LibrarySong, MusicPlan } from "../src/lib/types";

const SONG_LIBRARY_PATH = path.join(__dirname, "../src/data/song-library.json");
const OCCASIONS_DIR = path.join(__dirname, "../src/data/occasions");

// MusicPlan field → liturgical function label
const FIELD_TO_FUNCTION: Record<string, string> = {
  gathering: "gathering",
  offertory: "offertory",
  sending: "sending",
  prelude: "prelude",
  penitentialAct: "penitential_act",
  gloria: "gloria",
  gospelAcclamation: "gospel_acclamation",
  lordsPrayer: "lords_prayer",
  fractionRite: "fraction_rite",
  communionSongs: "communion",
  responsorialPsalm: "psalm",
};

function normalize(title: string): string {
  return title
    .toLowerCase()
    .replace(/['']/g, "'")
    .replace(/[""]/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

// ───── MAIN ─────

const isDryRun = process.argv.includes("--dry-run");

// Load song library and build a title → song index
const raw = fs.readFileSync(SONG_LIBRARY_PATH, "utf-8");
const songs: LibrarySong[] = JSON.parse(raw);

const titleIndex = new Map<string, LibrarySong[]>();
for (const song of songs) {
  const key = normalize(song.title);
  const existing = titleIndex.get(key) || [];
  existing.push(song);
  titleIndex.set(key, existing);
}

// Track functions per song id
const songFunctions = new Map<string, Set<string>>();

// Scan all occasion files
const occasionFiles = fs.readdirSync(OCCASIONS_DIR).filter((f) => f.endsWith(".json"));
let plansScanned = 0;
let matchesFound = 0;

for (const file of occasionFiles) {
  const filePath = path.join(OCCASIONS_DIR, file);
  const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  const musicPlans: MusicPlan[] = data.musicPlans || [];

  for (const plan of musicPlans) {
    plansScanned++;

    for (const [field, functionLabel] of Object.entries(FIELD_TO_FUNCTION)) {
      const value = (plan as Record<string, unknown>)[field];
      if (!value) continue;

      // Collect titles from this field
      const titles: string[] = [];

      if (field === "communionSongs" && Array.isArray(value)) {
        for (const entry of value) {
          if (entry && typeof entry === "object" && "title" in entry) {
            titles.push((entry as { title: string }).title);
          }
        }
      } else if (field === "responsorialPsalm") {
        // responsorialPsalm has { psalm, setting } — use setting as the "title"
        const rp = value as { psalm?: string; setting?: string };
        if (rp.setting) titles.push(rp.setting);
      } else if (typeof value === "object" && value !== null && "title" in value) {
        titles.push((value as { title: string }).title);
      }

      // Match titles to songs
      for (const title of titles) {
        const key = normalize(title);
        const matched = titleIndex.get(key);
        if (matched) {
          for (const song of matched) {
            if (!songFunctions.has(song.id)) {
              songFunctions.set(song.id, new Set());
            }
            songFunctions.get(song.id)!.add(functionLabel);
            matchesFound++;
          }
        }
      }
    }
  }
}

// Apply functions to songs
let songsTagged = 0;
for (const song of songs) {
  const fns = songFunctions.get(song.id);
  if (fns && fns.size > 0) {
    song.functions = [...fns].sort();
    songsTagged++;
  }
}

// Report
console.log(`Scanned ${occasionFiles.length} occasion files, ${plansScanned} music plans`);
console.log(`Found ${matchesFound} function matches across ${songsTagged} songs`);

// Count by function
const fnCounts: Record<string, number> = {};
for (const fns of songFunctions.values()) {
  for (const fn of fns) {
    fnCounts[fn] = (fnCounts[fn] || 0) + 1;
  }
}
console.log("\nSongs per function:");
for (const [fn, count] of Object.entries(fnCounts).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${fn}: ${count}`);
}

if (isDryRun) {
  console.log("\n--dry-run: No changes written.");

  // Show examples
  const tagged = songs.filter((s) => s.functions && s.functions.length > 0);
  console.log(`\nExample tagged songs (first 10):`);
  for (const s of tagged.slice(0, 10)) {
    console.log(`  ${s.title} → [${s.functions!.join(", ")}]`);
  }
} else {
  fs.writeFileSync(SONG_LIBRARY_PATH, JSON.stringify(songs, null, 2) + "\n");
  console.log(`\nWrote updated song library to ${SONG_LIBRARY_PATH}`);
}
