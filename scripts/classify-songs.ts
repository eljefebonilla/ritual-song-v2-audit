/**
 * classify-songs.ts
 *
 * Auto-classifies songs in song-library.json into categories:
 *   song | mass_part | psalm | gospel_acclamation
 *
 * Uses pattern matching on titles. Run with:
 *   npx tsx scripts/classify-songs.ts
 *
 * Pass --dry-run to preview without writing.
 */

import fs from "fs";
import path from "path";
import type { LibrarySong, SongCategory } from "../src/lib/types";

const SONG_LIBRARY_PATH = path.join(__dirname, "../src/data/song-library.json");

function classifySong(title: string): SongCategory {
  const t = title.toLowerCase();

  // Mass parts
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

  // Psalms
  if (
    /^ps\.?\s*\d/.test(t) ||
    /^psalm\s*\d/.test(t) ||
    /\bresponsorial\b/.test(t)
  ) {
    return "psalm";
  }

  // Gospel acclamations
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

// ───── MAIN ─────

const isDryRun = process.argv.includes("--dry-run");

const raw = fs.readFileSync(SONG_LIBRARY_PATH, "utf-8");
const songs: LibrarySong[] = JSON.parse(raw);

const counts: Record<SongCategory, number> = {
  song: 0,
  mass_part: 0,
  psalm: 0,
  gospel_acclamation: 0,
};

for (const song of songs) {
  const category = classifySong(song.title);
  song.category = category;
  counts[category]++;
}

console.log("Classification results:");
console.log(`  Songs:                ${counts.song}`);
console.log(`  Mass Parts:           ${counts.mass_part}`);
console.log(`  Psalms:               ${counts.psalm}`);
console.log(`  Gospel Acclamations:  ${counts.gospel_acclamation}`);
console.log(`  Total:                ${songs.length}`);

if (isDryRun) {
  console.log("\n--dry-run: No changes written.");

  // Show some examples from each category
  for (const cat of ["mass_part", "psalm", "gospel_acclamation"] as SongCategory[]) {
    const examples = songs.filter((s) => s.category === cat).slice(0, 5);
    console.log(`\n${cat} examples:`);
    for (const s of examples) {
      console.log(`  ${s.title}`);
    }
  }
} else {
  fs.writeFileSync(SONG_LIBRARY_PATH, JSON.stringify(songs, null, 2) + "\n");
  console.log(`\nWrote classified songs to ${SONG_LIBRARY_PATH}`);
}
