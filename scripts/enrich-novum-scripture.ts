/**
 * enrich-novum-scripture.ts
 *
 * Merges extracted Novum scripture index data into song-library.json.
 *
 * Usage:
 *   npx tsx scripts/enrich-novum-scripture.ts          # dry-run (report only)
 *   npx tsx scripts/enrich-novum-scripture.ts --write   # write changes
 */

import * as fs from "fs";
import * as path from "path";

interface ScriptureEntry {
  hymnNumber: number;
  title: string;
  citation: string;
}

interface LibrarySong {
  id: string;
  title: string;
  catalogs?: { novum?: number; [k: string]: number | undefined };
  scriptureRefs?: string[];
  [k: string]: unknown;
}

const ROOT = path.resolve(__dirname, "..");
const LIBRARY_PATH = path.join(ROOT, "src/data/song-library.json");
const SCRIPTURE_PATH = path.join(ROOT, "scripts/data/novum-scripture-index.json");

function main() {
  const writeMode = process.argv.includes("--write");

  const songs: LibrarySong[] = JSON.parse(fs.readFileSync(LIBRARY_PATH, "utf-8"));
  const scriptureEntries: ScriptureEntry[] = JSON.parse(fs.readFileSync(SCRIPTURE_PATH, "utf-8"));

  // Build lookup: Novum hymn number → index in songs array
  const novumMap = new Map<number, number>();
  for (let i = 0; i < songs.length; i++) {
    const num = songs[i].catalogs?.novum;
    if (num !== undefined) {
      novumMap.set(num, i);
    }
  }

  const updated: { title: string; newRefs: string[] }[] = [];
  const unmatched: { hymnNumber: number; title: string }[] = [];
  const unmatchedSeen = new Set<number>();

  for (const entry of scriptureEntries) {
    const idx = novumMap.get(entry.hymnNumber);
    if (idx === undefined) {
      if (!unmatchedSeen.has(entry.hymnNumber)) {
        unmatched.push({ hymnNumber: entry.hymnNumber, title: entry.title });
        unmatchedSeen.add(entry.hymnNumber);
      }
      continue;
    }

    const song = songs[idx];
    const existing = new Set(song.scriptureRefs || []);
    if (!existing.has(entry.citation)) {
      if (!song.scriptureRefs) song.scriptureRefs = [];
      song.scriptureRefs.push(entry.citation);
      updated.push({ title: song.title, newRefs: [entry.citation] });
    }
  }

  // Sort scriptureRefs on touched songs
  const touchedTitles = new Set(updated.map((u) => u.title));
  for (const song of songs) {
    if (song.scriptureRefs && touchedTitles.has(song.title)) {
      song.scriptureRefs.sort();
    }
  }

  // Report
  console.log(`\n${"═".repeat(60)}`);
  console.log(`  Novum Scripture Enrichment — ${writeMode ? "WRITE MODE" : "DRY RUN"}`);
  console.log(`${"═".repeat(60)}\n`);

  console.log(`Total Novum songs in library: ${novumMap.size}`);
  console.log(`Scripture index entries:       ${scriptureEntries.length}`);
  console.log(`Songs receiving new refs:      ${new Set(updated.map(u => u.title)).size}`);
  console.log(`Total new citations added:     ${updated.length}`);
  console.log();

  if (updated.length > 0) {
    console.log(`Examples (first 5):`);
    for (const u of updated.slice(0, 5)) {
      console.log(`  "${u.title}" ← ${u.newRefs.join(", ")}`);
    }
    console.log();
  }

  if (unmatched.length > 0) {
    console.log(`── Unmatched Hymn Numbers (${unmatched.length}) ─────────────────────`);
    for (const u of unmatched.sort((a, b) => a.hymnNumber - b.hymnNumber)) {
      console.log(`  #${u.hymnNumber} — ${u.title}`);
    }
    console.log();
  } else {
    console.log(`All hymn numbers matched!\n`);
  }

  if (writeMode) {
    fs.writeFileSync(LIBRARY_PATH, JSON.stringify(songs, null, 2) + "\n", "utf-8");
    console.log(`✓ Wrote updated song-library.json (${songs.length} songs)\n`);
  } else {
    console.log(`Dry run complete. Use --write to save changes.\n`);
  }
}

main();
