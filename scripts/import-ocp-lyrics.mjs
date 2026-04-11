/**
 * Import OCP Song Lyrics TXT files into Supabase song_resources_v2.
 *
 * - Reads .txt files from ~/Desktop/OCP Fresh Resource Files/Song Lyrics/
 * - Matches filenames to songs via song-library.json (tiered: exact, normalized, prefix, starts-with)
 * - Looks up Supabase UUID via songs table using legacy_id
 * - Inserts into song_resources_v2 with type "lyrics", value = full text content
 * - Skips songs that already have a LYR resource
 *
 * Usage:
 *   node scripts/import-ocp-lyrics.mjs --dry-run
 *   node scripts/import-ocp-lyrics.mjs
 */

import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "..", ".env.local") });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY.trim(), {
  auth: { persistSession: false },
});

const LYRICS_DIR = "/Users/jeffreybonilla/Desktop/OCP Fresh Resource Files/Song Lyrics";
const SONG_LIBRARY_PATH = path.join(__dirname, "../src/data/song-library.json");

// ───── TITLE MATCHING (mirrored from import-ocp-resources.ts) ─────

function normalize(t) {
  return t
    .toLowerCase()
    .replace(/[•–—]/g, " ")
    .replace(/['']/g, "'")
    .replace(/[""]/g, '"')
    .replace(/[^a-z0-9' ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeStrip(t) {
  return normalize(t)
    .replace(/\([^)]*\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildMatchers(songs) {
  const exact = new Map();
  const norm = new Map();
  const normStripped = new Map();
  const prefixMap = new Map();
  const allNormTitles = [];

  for (const s of songs) {
    if (!exact.has(s.title)) exact.set(s.title, s);

    const n = normalize(s.title);
    if (!norm.has(n)) norm.set(n, s);
    allNormTitles.push({ norm: n, song: s });

    const ns = normalizeStrip(s.title);
    if (!normStripped.has(ns)) normStripped.set(ns, s);

    if (s.title.includes("/")) {
      const first = s.title.split("/")[0].trim();
      if (!prefixMap.has(first)) prefixMap.set(first, s);
      const nFirst = normalize(first);
      if (!prefixMap.has(nFirst)) prefixMap.set(nFirst, s);
    }
    if (s.title.includes(" - ")) {
      const first = s.title.split(" - ")[0].trim();
      if (!prefixMap.has(first)) prefixMap.set(first, s);
    }
  }

  return { exact, norm, normStripped, prefixMap, allNormTitles };
}

function matchTitle(ocpTitle, matchers) {
  const { exact, norm, normStripped, prefixMap, allNormTitles } = matchers;

  // Tier 1: Exact
  if (exact.has(ocpTitle)) return { song: exact.get(ocpTitle), tier: "exact" };

  // Tier 2: Normalized
  const n = normalize(ocpTitle);
  if (norm.has(n)) return { song: norm.get(n), tier: "normalized" };

  // Tier 3: Normalized with parentheticals stripped
  const ns = normalizeStrip(ocpTitle);
  if (normStripped.has(ns)) return { song: normStripped.get(ns), tier: "norm-stripped" };

  // Tier 4: Prefix match
  if (prefixMap.has(ocpTitle)) return { song: prefixMap.get(ocpTitle), tier: "prefix" };
  if (prefixMap.has(n)) return { song: prefixMap.get(n), tier: "prefix-norm" };

  // Tier 5: Library title starts with OCP title
  if (n.split(" ").length >= 3) {
    const matches = allNormTitles.filter((t) => t.norm.startsWith(n + " "));
    if (matches.length === 1) {
      return { song: matches[0].song, tier: "starts-with" };
    }
  }

  return null;
}

// ───── MAIN ─────

async function main() {
  const isDryRun = process.argv.includes("--dry-run");
  console.log(`=== OCP Lyrics Import (${isDryRun ? "DRY RUN" : "LIVE"}) ===\n`);

  // 1. Load song library
  const songs = JSON.parse(fs.readFileSync(SONG_LIBRARY_PATH, "utf-8"));
  console.log(`Loaded ${songs.length} songs from song-library.json`);

  // 2. Load UUID map from Supabase songs table
  console.log("Loading song UUIDs from Supabase...");
  const uuidMap = new Map();
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from("songs")
      .select("id, legacy_id")
      .range(offset, offset + 999);
    if (error) {
      console.error("Error loading songs:", error.message);
      break;
    }
    if (!data || data.length === 0) break;
    for (const row of data) {
      if (row.legacy_id) uuidMap.set(row.legacy_id, row.id);
    }
    if (data.length < 1000) break;
    offset += 1000;
  }
  console.log(`  ${uuidMap.size} songs with UUIDs in Supabase`);

  // 3. Load existing LYR resources to skip duplicates
  console.log("Loading existing LYR resources...");
  const existingLyr = new Set();
  offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from("song_resources_v2")
      .select("song_id")
      .contains("tags", ["LYR"])
      .range(offset, offset + 999);
    if (error) {
      console.error("Error loading existing LYR resources:", error.message);
      break;
    }
    if (!data || data.length === 0) break;
    for (const row of data) {
      existingLyr.add(row.song_id);
    }
    if (data.length < 1000) break;
    offset += 1000;
  }
  console.log(`  ${existingLyr.size} songs already have LYR resources`);

  // 4. Build matchers
  const matchers = buildMatchers(songs);

  // 5. Collect .txt files
  const allFiles = fs.readdirSync(LYRICS_DIR).filter((f) => f.endsWith(".txt"));
  console.log(`\nFound ${allFiles.length} .txt files in Song Lyrics folder`);

  // 6. Match and prepare
  const matched = [];
  const unmatched = [];
  const skippedExisting = [];
  const skippedNoUuid = [];
  const tierCounts = new Map();

  for (const fileName of allFiles) {
    const baseName = path.basename(fileName, ".txt");
    const isSS = baseName.endsWith(" (S&S)");
    const ocpTitle = baseName.replace(/ \(S&S\)$/, "");

    const result = matchTitle(ocpTitle, matchers);
    if (!result) {
      unmatched.push(ocpTitle);
      continue;
    }

    const { song, tier } = result;
    tierCounts.set(tier, (tierCounts.get(tier) || 0) + 1);

    const uuid = uuidMap.get(song.id);
    if (!uuid) {
      skippedNoUuid.push({ ocpTitle, legacyId: song.id });
      continue;
    }

    if (existingLyr.has(uuid)) {
      skippedExisting.push(ocpTitle);
      continue;
    }

    const filePath = path.join(LYRICS_DIR, fileName);
    const textContent = fs.readFileSync(filePath, "utf-8");

    matched.push({
      ocpTitle,
      songTitle: song.title,
      legacyId: song.id,
      uuid,
      tier,
      isSS,
      label: isSS ? "Lyrics (S&S)" : "Lyrics",
      value: textContent,
    });
  }

  // 7. Summary
  console.log(`\n=== MATCHING SUMMARY ===`);
  console.log(`Matched and ready to insert: ${matched.length}`);
  console.log(`Skipped (already have LYR):  ${skippedExisting.length}`);
  console.log(`Skipped (no Supabase UUID):  ${skippedNoUuid.length}`);
  console.log(`Unmatched (no library song): ${unmatched.length}`);

  console.log(`\nMatch tiers:`);
  for (const [tier, count] of [...tierCounts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${tier}: ${count}`);
  }

  if (unmatched.length > 0) {
    console.log(`\nSample unmatched (first 20):`);
    for (const t of unmatched.slice(0, 20)) {
      console.log(`  "${t}"`);
    }
  }

  if (skippedNoUuid.length > 0) {
    console.log(`\nSample no-UUID (first 10):`);
    for (const s of skippedNoUuid.slice(0, 10)) {
      console.log(`  "${s.ocpTitle}" (legacy: ${s.legacyId})`);
    }
  }

  if (isDryRun) {
    console.log(`\nSample inserts (first 10):`);
    for (const m of matched.slice(0, 10)) {
      console.log(`  "${m.ocpTitle}" → ${m.songTitle} [${m.tier}] (${m.value.length} chars)`);
    }
    console.log(`\nDry run complete. Run without --dry-run to insert ${matched.length} lyrics rows.`);
    return;
  }

  // 8. Insert into song_resources_v2 in batches
  console.log(`\n=== INSERTING ${matched.length} LYRICS ROWS ===`);
  let inserted = 0;
  let errors = 0;
  const BATCH_SIZE = 100;

  for (let i = 0; i < matched.length; i += BATCH_SIZE) {
    const batch = matched.slice(i, i + BATCH_SIZE);
    const rows = batch.map((m) => ({
      song_id: m.uuid,
      type: "lyrics",
      label: m.label,
      tags: ["LYR"],
      source: "ocp_bb",
      is_highlighted: false,
      value: m.value,
    }));

    const { error } = await supabase.from("song_resources_v2").insert(rows);
    if (error) {
      console.error(`\n  Batch error at ${i}: ${error.message}`);
      errors += batch.length;
    } else {
      inserted += batch.length;
    }
    process.stdout.write(`  Progress: ${Math.min(i + BATCH_SIZE, matched.length)}/${matched.length} (inserted: ${inserted}, errors: ${errors})\r`);
  }

  console.log(`\n\n=== VERIFICATION ===`);
  const { count } = await supabase
    .from("song_resources_v2")
    .select("*", { count: "exact", head: true })
    .contains("tags", ["LYR"]);
  console.log(`  Total LYR rows in song_resources_v2: ${count}`);
  console.log(`\nImport complete. Inserted: ${inserted}, Errors: ${errors}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
