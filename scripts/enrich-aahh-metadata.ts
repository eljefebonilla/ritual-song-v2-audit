/**
 * enrich-aahh-metadata.ts
 *
 * Merges extracted AAHH scripture and topical index data into song-library.json.
 *
 * Usage:
 *   npx tsx scripts/enrich-aahh-metadata.ts          # dry-run (report only)
 *   npx tsx scripts/enrich-aahh-metadata.ts --write   # write changes to song-library.json
 */

import * as fs from "fs";
import * as path from "path";

// ── Types ────────────────────────────────────────────────────────────────────

interface ScriptureEntry {
  hymnNumber: number;
  title: string;
  citation: string;
}

interface TopicalEntry {
  hymnNumber: number;
  title: string;
  topics: string[];
}

interface LibrarySong {
  id: string;
  title: string;
  catalogs?: { aahh?: number; [k: string]: number | undefined };
  scriptureRefs?: string[];
  topics?: string[];
  [k: string]: unknown;
}

// ── Paths ────────────────────────────────────────────────────────────────────

const ROOT = path.resolve(__dirname, "..");
const LIBRARY_PATH = path.join(ROOT, "src/data/song-library.json");
const SCRIPTURE_PATH = path.join(ROOT, "scripts/data/aahh-scripture-index.json");
const TOPICAL_PATH = path.join(ROOT, "scripts/data/aahh-topical-index.json");

// ── Main ─────────────────────────────────────────────────────────────────────

function main() {
  const writeMode = process.argv.includes("--write");

  // Load data
  const songs: LibrarySong[] = JSON.parse(fs.readFileSync(LIBRARY_PATH, "utf-8"));
  const scriptureEntries: ScriptureEntry[] = JSON.parse(fs.readFileSync(SCRIPTURE_PATH, "utf-8"));
  const topicalEntries: TopicalEntry[] = JSON.parse(fs.readFileSync(TOPICAL_PATH, "utf-8"));

  // Build lookup: AAHH hymn number → index in songs array
  const aahhMap = new Map<number, number>();
  for (let i = 0; i < songs.length; i++) {
    const aahhNum = songs[i].catalogs?.aahh;
    if (aahhNum !== undefined) {
      aahhMap.set(aahhNum, i);
    }
  }

  // Collect existing topics across the entire library for "new vocabulary" report
  const existingTopics = new Set<string>();
  for (const song of songs) {
    if (song.topics) {
      for (const t of song.topics) existingTopics.add(t);
    }
  }

  // ── Scripture merge ──────────────────────────────────────────────────────

  const scriptureUpdated: { title: string; newRefs: string[] }[] = [];
  const scriptureUnmatched: { hymnNumber: number; title: string }[] = [];

  for (const entry of scriptureEntries) {
    const idx = aahhMap.get(entry.hymnNumber);
    if (idx === undefined) {
      scriptureUnmatched.push({ hymnNumber: entry.hymnNumber, title: entry.title });
      continue;
    }

    const song = songs[idx];
    const existing = new Set(song.scriptureRefs || []);
    if (!existing.has(entry.citation)) {
      if (!song.scriptureRefs) song.scriptureRefs = [];
      song.scriptureRefs.push(entry.citation);
      scriptureUpdated.push({ title: song.title, newRefs: [entry.citation] });
    }
  }

  // Sort scriptureRefs on all touched songs
  const songsTouchedByScripture = new Set(scriptureUpdated.map((u) => u.title));
  for (const song of songs) {
    if (song.scriptureRefs && songsTouchedByScripture.has(song.title)) {
      song.scriptureRefs.sort();
    }
  }

  // ── Topical merge ────────────────────────────────────────────────────────

  const topicsUpdated: { title: string; newTopics: string[] }[] = [];
  const topicsUnmatched: { hymnNumber: number; title: string }[] = [];

  for (const entry of topicalEntries) {
    const idx = aahhMap.get(entry.hymnNumber);
    if (idx === undefined) {
      topicsUnmatched.push({ hymnNumber: entry.hymnNumber, title: entry.title });
      continue;
    }

    const song = songs[idx];
    const existing = new Set(song.topics || []);
    const added: string[] = [];

    for (const topic of entry.topics) {
      if (!existing.has(topic)) {
        if (!song.topics) song.topics = [];
        song.topics.push(topic);
        existing.add(topic);
        added.push(topic);
      }
    }

    if (added.length > 0) {
      topicsUpdated.push({ title: song.title, newTopics: added });
    }
  }

  // Sort topics on all touched songs
  const songsTouchedByTopics = new Set(topicsUpdated.map((u) => u.title));
  for (const song of songs) {
    if (song.topics && songsTouchedByTopics.has(song.title)) {
      song.topics.sort();
    }
  }

  // ── New topic vocabulary ─────────────────────────────────────────────────

  const allNewTopics = new Set<string>();
  for (const entry of topicalEntries) {
    for (const t of entry.topics) {
      if (!existingTopics.has(t)) allNewTopics.add(t);
    }
  }

  // ── Dedup unmatched lists ────────────────────────────────────────────────

  const scriptureUnmatchedDeduped = dedup(scriptureUnmatched);
  const topicsUnmatchedDeduped = dedup(topicsUnmatched);
  // Combine all unmatched into one list
  const allUnmatchedMap = new Map<number, string>();
  for (const u of [...scriptureUnmatchedDeduped, ...topicsUnmatchedDeduped]) {
    allUnmatchedMap.set(u.hymnNumber, u.title);
  }
  const allUnmatched = [...allUnmatchedMap.entries()]
    .map(([hymnNumber, title]) => ({ hymnNumber, title }))
    .sort((a, b) => a.hymnNumber - b.hymnNumber);

  // ── Report ───────────────────────────────────────────────────────────────

  console.log(`\n${"═".repeat(60)}`);
  console.log(`  AAHH Metadata Enrichment — ${writeMode ? "WRITE MODE" : "DRY RUN"}`);
  console.log(`${"═".repeat(60)}\n`);

  console.log(`Total AAHH songs in library: ${aahhMap.size}`);
  console.log(`Scripture index entries:      ${scriptureEntries.length}`);
  console.log(`Topical index entries:        ${topicalEntries.length}`);
  console.log();

  // Scripture report
  console.log(`── Scripture Refs ──────────────────────────────────────────`);
  console.log(`Songs receiving new scriptureRefs: ${scriptureUpdated.length}`);
  if (scriptureUpdated.length > 0) {
    console.log(`\nExamples (first 5):`);
    for (const u of scriptureUpdated.slice(0, 5)) {
      console.log(`  "${u.title}" ← ${u.newRefs.join(", ")}`);
    }
  }
  console.log();

  // Topics report
  console.log(`── Topics ─────────────────────────────────────────────────`);
  console.log(`Songs receiving new topics: ${topicsUpdated.length}`);
  if (topicsUpdated.length > 0) {
    console.log(`\nExamples (first 5):`);
    for (const u of topicsUpdated.slice(0, 5)) {
      console.log(`  "${u.title}" ← ${u.newTopics.join(", ")}`);
    }
  }
  console.log();

  // New topic vocabulary
  if (allNewTopics.size > 0) {
    const sorted = [...allNewTopics].sort();
    console.log(`── New Topic Vocabulary (${sorted.length} topics not in library) ──`);
    for (const t of sorted) {
      console.log(`  • ${t}`);
    }
    console.log();
  }

  // Unmatched
  if (allUnmatched.length > 0) {
    console.log(`── Unmatched Hymn Numbers (${allUnmatched.length}) ─────────────────────`);
    for (const u of allUnmatched) {
      console.log(`  #${u.hymnNumber} — ${u.title}`);
    }
    console.log();
  } else {
    console.log(`── All hymn numbers matched! ───────────────────────────────\n`);
  }

  // ── Write ────────────────────────────────────────────────────────────────

  if (writeMode) {
    fs.writeFileSync(LIBRARY_PATH, JSON.stringify(songs, null, 2) + "\n", "utf-8");
    console.log(`✓ Wrote updated song-library.json (${songs.length} songs)\n`);
  } else {
    console.log(`Dry run complete. Use --write to save changes.\n`);
  }
}

function dedup(arr: { hymnNumber: number; title: string }[]) {
  const seen = new Set<number>();
  return arr.filter((x) => {
    if (seen.has(x.hymnNumber)) return false;
    seen.add(x.hymnNumber);
    return true;
  });
}

main();
