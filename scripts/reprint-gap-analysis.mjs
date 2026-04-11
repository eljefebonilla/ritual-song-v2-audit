#!/usr/bin/env node
/**
 * Reprint Gap Analysis
 * Checks which songs used in music plans have CONG resources in song_resources_v2,
 * and which don't. Outputs a gap list for backfill prioritization.
 *
 * Usage: node scripts/reprint-gap-analysis.mjs
 * Requires: .env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 */

import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

config({ path: join(root, ".env.local") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ── Load song library ──────────────────────────────────────────────────────────

const library = JSON.parse(readFileSync(join(root, "src/data/song-library.json"), "utf-8"));
const libByNorm = new Map();
for (const s of library) {
  const norm = s.title.toLowerCase().replace(/[^a-z0-9]/g, "");
  const existing = libByNorm.get(norm) ?? [];
  existing.push(s);
  libByNorm.set(norm, existing);
}

// ── Collect unique song titles from all music plans ────────────────────────────

import { readdirSync } from "fs";
const occasionDir = join(root, "src/data/occasions");
const occasionFiles = readdirSync(occasionDir)
  .filter(f => f.endsWith(".json"))
  .map(f => join(occasionDir, f));

const titleSet = new Set();
for (const f of occasionFiles) {
  const d = JSON.parse(readFileSync(f, "utf-8"));
  for (const plan of d.musicPlans ?? []) {
    for (const field of ["gathering", "gloria", "offertory", "sending", "gospelAcclamation"]) {
      const song = plan[field];
      if (song?.title) titleSet.add(song.title);
    }
    for (const s of plan.communionSongs ?? []) {
      if (s?.title) titleSet.add(s.title);
    }
  }
}

console.log(`Found ${titleSet.size} unique song titles across ${occasionFiles.length} occasions\n`);

// ── Match titles to library, then check DB ─────────────────────────────────────

// Fetch all songs from DB with their legacy_ids (paginated)
const songsByLegacy = new Map();
let offset = 0;
while (true) {
  const { data } = await supabase.from("songs").select("id, legacy_id").range(offset, offset + 999);
  if (!data || data.length === 0) break;
  for (const s of data) songsByLegacy.set(s.legacy_id, s.id);
  offset += 1000;
  if (data.length < 1000) break;
}
console.log(`Loaded ${songsByLegacy.size} songs from DB\n`);

// Fetch all CONG resource song_ids
const congSongIds = new Set();
let congOffset = 0;
while (true) {
  const { data } = await supabase
    .from("song_resources_v2")
    .select("song_id")
    .contains("tags", ["CONG"])
    .range(congOffset, congOffset + 999);
  if (!data || data.length === 0) break;
  for (const r of data) congSongIds.add(r.song_id);
  congOffset += 1000;
  if (data.length < 1000) break;
}
console.log(`Found ${congSongIds.size} songs with CONG resources\n`);

// Also fetch songs with ANY resources
const anySongIds = new Set();
let anyOffset = 0;
while (true) {
  const { data } = await supabase
    .from("song_resources_v2")
    .select("song_id")
    .range(anyOffset, anyOffset + 999);
  if (!data || data.length === 0) break;
  for (const r of data) anySongIds.add(r.song_id);
  anyOffset += 1000;
  if (data.length < 1000) break;
}

// ── Classify each title ────────────────────────────────────────────────────────

const results = {
  hasCong: [],       // title matched, has CONG reprint
  hasOther: [],      // title matched, has resources but no CONG
  noResources: [],   // title matched, in DB but zero resources
  notInLibrary: [],  // title not in song library (psalms, tune names, etc.)
};

// Count how many occasions use each title (for prioritization)
const titleOccurrences = new Map();
for (const f of occasionFiles) {
  const d = JSON.parse(readFileSync(f, "utf-8"));
  for (const plan of d.musicPlans ?? []) {
    for (const field of ["gathering", "gloria", "offertory", "sending", "gospelAcclamation"]) {
      const song = plan[field];
      if (song?.title) titleOccurrences.set(song.title, (titleOccurrences.get(song.title) ?? 0) + 1);
    }
    for (const s of plan.communionSongs ?? []) {
      if (s?.title) titleOccurrences.set(s.title, (titleOccurrences.get(s.title) ?? 0) + 1);
    }
  }
}

for (const title of titleSet) {
  const norm = title.toLowerCase().replace(/[^a-z0-9]/g, "");
  const libMatches = libByNorm.get(norm);

  if (!libMatches) {
    results.notInLibrary.push({ title, occurrences: titleOccurrences.get(title) ?? 0 });
    continue;
  }

  // Check all variants
  let foundCong = false;
  let foundAny = false;
  let bestLegacyId = libMatches[0].id;

  for (const match of libMatches) {
    const uuid = songsByLegacy.get(match.id);
    if (!uuid) continue;
    if (congSongIds.has(uuid)) { foundCong = true; bestLegacyId = match.id; break; }
    if (anySongIds.has(uuid)) { foundAny = true; bestLegacyId = match.id; }
  }

  const entry = {
    title,
    legacyId: bestLegacyId,
    variants: libMatches.length,
    occurrences: titleOccurrences.get(title) ?? 0,
  };

  if (foundCong) results.hasCong.push(entry);
  else if (foundAny) results.hasOther.push(entry);
  else results.noResources.push(entry);
}

// Sort each bucket by occurrence count (most used first)
for (const bucket of Object.values(results)) {
  bucket.sort((a, b) => b.occurrences - a.occurrences);
}

// ── Print report ───────────────────────────────────────────────────────────────

console.log("═══════════════════════════════════════════════════════════");
console.log("  REPRINT GAP ANALYSIS");
console.log("═══════════════════════════════════════════════════════════\n");

console.log(`Songs with CONG reprints (ready):     ${results.hasCong.length}`);
console.log(`Songs with other resources (no CONG):  ${results.hasOther.length}`);
console.log(`Songs with NO resources (gap):         ${results.noResources.length}`);
console.log(`Titles not in song library:            ${results.notInLibrary.length}`);
console.log(`Total:                                 ${titleSet.size}\n`);

const matchable = results.hasCong.length + results.hasOther.length + results.noResources.length;
console.log(`Coverage of matchable songs: ${Math.round(100 * results.hasCong.length / matchable)}% have CONG reprints\n`);

console.log("───────────────────────────────────────────────────────────");
console.log("  TOP 30 SONGS NEEDING CONG RESOURCES (by usage count)");
console.log("───────────────────────────────────────────────────────────\n");

for (const entry of results.noResources.slice(0, 30)) {
  console.log(`  [${String(entry.occurrences).padStart(3)}x] ${entry.title}`);
  console.log(`        legacy_id: ${entry.legacyId}${entry.variants > 1 ? ` (+${entry.variants - 1} variants)` : ""}`);
}

if (results.hasOther.length > 0) {
  console.log("\n───────────────────────────────────────────────────────────");
  console.log("  SONGS WITH RESOURCES BUT NO CONG TAG");
  console.log("───────────────────────────────────────────────────────────\n");
  for (const entry of results.hasOther.slice(0, 20)) {
    console.log(`  [${String(entry.occurrences).padStart(3)}x] ${entry.title}`);
  }
}

// ── Write gap list JSON ────────────────────────────────────────────────────────

const gapOutput = {
  generated: new Date().toISOString(),
  summary: {
    totalTitles: titleSet.size,
    withCongReprint: results.hasCong.length,
    withOtherResources: results.hasOther.length,
    noResources: results.noResources.length,
    notInLibrary: results.notInLibrary.length,
    coveragePercent: Math.round(100 * results.hasCong.length / matchable),
  },
  gapList: results.noResources,
  hasOtherOnly: results.hasOther,
  covered: results.hasCong,
};

const outPath = join(root, "scripts/reprint-gap-report.json");
writeFileSync(outPath, JSON.stringify(gapOutput, null, 2));
console.log(`\nFull report written to: ${outPath}`);
