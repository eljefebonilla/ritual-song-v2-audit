/**
 * enrich-novum-topics.ts
 *
 * Merges Novum hymnal topical index data into song-library.json.
 * Each Novum entry has a topic + hymn number. We aggregate all topics per hymn,
 * then merge into the song's existing topics array (additive, deduped, sorted).
 *
 * Usage:
 *   npx tsx scripts/enrich-novum-topics.ts          # dry-run (report only)
 *   npx tsx scripts/enrich-novum-topics.ts --write   # write changes to song-library.json
 */

import * as fs from "fs";
import * as path from "path";

// ── Types ────────────────────────────────────────────────────────────────────

interface NovumEntry {
  topic: string;
  number: number;
  title: string;
  catalog: string;
}

interface LibrarySong {
  id: string;
  title: string;
  catalogs?: { novum?: number; [k: string]: number | undefined };
  topics?: string[];
  [k: string]: unknown;
}

// ── Paths ────────────────────────────────────────────────────────────────────

const ROOT = path.resolve(__dirname, "..");
const LIBRARY_PATH = path.join(ROOT, "src/data/song-library.json");
const NOVUM_TOPICAL_PATH = path.join(ROOT, "scripts/novum-topical-index.json");

// ── Topic normalization ──────────────────────────────────────────────────────

// The novum topical index already uses the same Title Case vocabulary as the
// library (e.g., "Love for God", "Kingdom / Reign of God"). We just trim
// whitespace. If a topic somehow arrives in a different case, we leave it as-is
// since the source data is authoritative.
function normalizeTopic(s: string): string {
  return s.trim();
}

// ── Main ─────────────────────────────────────────────────────────────────────

function main() {
  const writeMode = process.argv.includes("--write");

  // Load data
  const songs: LibrarySong[] = JSON.parse(
    fs.readFileSync(LIBRARY_PATH, "utf-8")
  );
  const novumEntries: NovumEntry[] = JSON.parse(
    fs.readFileSync(NOVUM_TOPICAL_PATH, "utf-8")
  );

  // Build lookup: Novum hymn number → index in songs array
  const novumMap = new Map<number, number>();
  for (let i = 0; i < songs.length; i++) {
    const novumNum = songs[i].catalogs?.novum;
    if (novumNum !== undefined) {
      novumMap.set(novumNum, i);
    }
  }

  // Collect existing topics across the entire library for "new vocabulary" report
  const existingTopics = new Set<string>();
  for (const song of songs) {
    if (song.topics) {
      for (const t of song.topics) existingTopics.add(t);
    }
  }

  // Aggregate topics by hymn number
  const topicsByHymn = new Map<number, { title: string; topics: Set<string> }>();
  for (const entry of novumEntries) {
    const normalized = normalizeTopic(entry.topic);
    if (!topicsByHymn.has(entry.number)) {
      topicsByHymn.set(entry.number, { title: entry.title, topics: new Set() });
    }
    topicsByHymn.get(entry.number)!.topics.add(normalized);
  }

  // ── Topical merge ──────────────────────────────────────────────────────────

  const topicsUpdated: { title: string; novumNum: number; newTopics: string[] }[] = [];
  const unmatched: { hymnNumber: number; title: string }[] = [];
  let totalNewTopicAssignments = 0;

  for (const [hymnNum, data] of topicsByHymn) {
    const idx = novumMap.get(hymnNum);
    if (idx === undefined) {
      unmatched.push({ hymnNumber: hymnNum, title: data.title });
      continue;
    }

    const song = songs[idx];
    const existing = new Set(song.topics || []);
    const added: string[] = [];

    for (const topic of data.topics) {
      if (!existing.has(topic)) {
        if (!song.topics) song.topics = [];
        song.topics.push(topic);
        existing.add(topic);
        added.push(topic);
      }
    }

    if (added.length > 0) {
      topicsUpdated.push({
        title: song.title,
        novumNum: hymnNum,
        newTopics: added.sort(),
      });
      totalNewTopicAssignments += added.length;
    }
  }

  // Sort topics on all touched songs
  const songsTouched = new Set(topicsUpdated.map((u) => u.title));
  for (const song of songs) {
    if (song.topics && songsTouched.has(song.title)) {
      song.topics.sort();
    }
  }

  // ── New topic vocabulary ───────────────────────────────────────────────────

  const allNewTopics = new Set<string>();
  for (const [, data] of topicsByHymn) {
    for (const t of data.topics) {
      if (!existingTopics.has(t)) allNewTopics.add(t);
    }
  }

  // Sort unmatched
  unmatched.sort((a, b) => a.hymnNumber - b.hymnNumber);

  // ── Report ─────────────────────────────────────────────────────────────────

  console.log(`\n${"═".repeat(60)}`);
  console.log(
    `  Novum Topical Index Enrichment — ${writeMode ? "WRITE MODE" : "DRY RUN"}`
  );
  console.log(`${"═".repeat(60)}\n`);

  console.log(`Novum songs in library:       ${novumMap.size}`);
  console.log(`Novum topical index entries:   ${novumEntries.length}`);
  console.log(`Unique hymn numbers in index:  ${topicsByHymn.size}`);
  console.log();

  // Matched / updated
  const matched = topicsByHymn.size - unmatched.length;
  console.log(`── Topics ─────────────────────────────────────────────────`);
  console.log(`Hymn numbers matched:          ${matched}`);
  console.log(`Songs receiving new topics:     ${topicsUpdated.length}`);
  console.log(`Total new topic assignments:    ${totalNewTopicAssignments}`);

  if (topicsUpdated.length > 0) {
    console.log(`\nExamples (first 10):`);
    for (const u of topicsUpdated.slice(0, 10)) {
      console.log(`  #${u.novumNum} "${u.title}" ← ${u.newTopics.join(", ")}`);
    }
    if (topicsUpdated.length > 10) {
      console.log(`  ... and ${topicsUpdated.length - 10} more`);
    }
  }
  console.log();

  // New topic vocabulary
  if (allNewTopics.size > 0) {
    const sorted = [...allNewTopics].sort();
    console.log(
      `── New Topic Vocabulary (${sorted.length} topics not previously in library) ──`
    );
    for (const t of sorted) {
      console.log(`  • ${t}`);
    }
    console.log();
  } else {
    console.log(`── No new topic vocabulary introduced ─────────────────────\n`);
  }

  // Unmatched
  if (unmatched.length > 0) {
    console.log(
      `── Unmatched Hymn Numbers (${unmatched.length}) ─────────────────────`
    );
    for (const u of unmatched) {
      console.log(`  #${u.hymnNumber} — ${u.title}`);
    }
    console.log();
  } else {
    console.log(
      `── All hymn numbers matched! ───────────────────────────────\n`
    );
  }

  // ── Write ──────────────────────────────────────────────────────────────────

  if (writeMode) {
    fs.writeFileSync(
      LIBRARY_PATH,
      JSON.stringify(songs, null, 2) + "\n",
      "utf-8"
    );
    console.log(`✓ Wrote updated song-library.json (${songs.length} songs)\n`);
  } else {
    console.log(`Dry run complete. Use --write to save changes.\n`);
  }
}

main();
