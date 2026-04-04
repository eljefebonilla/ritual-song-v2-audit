/**
 * Download lyrics .txt files from Supabase Storage, parse into
 * structured verse/refrain format, and store in song_metadata.
 *
 * Usage:
 *   npx tsx scripts/ingest-lyrics.ts                  # dry-run (10 files)
 *   npx tsx scripts/ingest-lyrics.ts --execute        # process all, write to DB
 *   npx tsx scripts/ingest-lyrics.ts --limit 50       # dry-run, 50 files
 */

import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.join(__dirname, "..", ".env.local") });

import { createClient } from "@supabase/supabase-js";

const isDryRun = !process.argv.includes("--execute");
const limitArg = process.argv.find((a, i) => process.argv[i - 1] === "--limit");
const limit = limitArg ? parseInt(limitArg, 10) : isDryRun ? 10 : 99999;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ----- Types -----

interface Verse {
  label: string; // "1", "2", "Refrain", "Bridge", "Coda"
  text: string;
}

interface ParsedLyrics {
  verses: Verse[];
}

// ----- Lyrics Parser -----

function parseLyrics(raw: string): ParsedLyrics | null {
  // Normalize line endings: \r\n, \r, or \n
  const normalized = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n");
  if (lines.length < 3) return null;

  const verses: Verse[] = [];
  let currentLabel: string | null = null;
  let currentLines: string[] = [];

  function flush() {
    if (currentLabel !== null && currentLines.length > 0) {
      verses.push({
        label: currentLabel,
        text: currentLines.join("\n").trim(),
      });
    }
    currentLines = [];
  }

  // Skip title and composer (first 1-3 lines before first verse/refrain)
  let started = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Detect numbered verse: "1.", "2.", "3." etc. at start of line
    const verseMatch = trimmed.match(/^(\d+)\.\s*(.*)/);
    if (verseMatch) {
      flush();
      currentLabel = verseMatch[1];
      started = true;
      if (verseMatch[2]) currentLines.push(verseMatch[2]);
      continue;
    }

    // Detect "Refrain" or "Refrain:" on its own line
    if (/^refrain:?\s*$/i.test(trimmed)) {
      flush();
      currentLabel = "Refrain";
      started = true;
      continue;
    }

    // Detect "Refrain:" with text following
    const refrainMatch = trimmed.match(/^refrain:?\s+(.+)/i);
    if (refrainMatch) {
      flush();
      currentLabel = "Refrain";
      started = true;
      currentLines.push(refrainMatch[1]);
      continue;
    }

    // Detect "Bridge", "Coda", "Final", "Tag"
    if (/^(bridge|coda|final|tag|interlude):?\s*$/i.test(trimmed)) {
      flush();
      currentLabel = trimmed.replace(/:?\s*$/, "");
      started = true;
      continue;
    }

    // Copyright line detection (stop parsing)
    if (/^[©\u00a9]|^text:|^tune:|^published|^all rights/i.test(trimmed)) {
      break;
    }

    // If we haven't started yet and see a non-empty line, check if it looks
    // like the beginning of lyrics without an explicit label
    if (!started && trimmed.length > 0) {
      // Skip title/composer header lines (short, often ALL CAPS or has /)
      if (lines.indexOf(line) < 4) continue;
      // If we get here, assume unlabeled verse 1
      currentLabel = "1";
      started = true;
      currentLines.push(trimmed);
      continue;
    }

    // Blank line within a verse: paragraph break
    if (started && trimmed === "" && currentLines.length > 0) {
      // Could be inter-verse gap. If next non-empty line starts a new verse,
      // the loop will flush. Otherwise this is just a stanza break.
      continue;
    }

    // Regular lyric line
    if (started && trimmed.length > 0) {
      currentLines.push(trimmed);
    }
  }

  flush();
  return verses.length > 0 ? { verses } : null;
}

// ----- Main -----

async function main() {
  console.log(isDryRun ? "=== DRY RUN ===" : "=== EXECUTING ===");
  console.log(`Limit: ${limit}`);

  // 1. Find lyrics resources with .txt storage paths
  console.log("\nFetching lyrics resources from song_resources_v2...");
  const allResources: Array<{
    id: string;
    song_id: string;
    storage_path: string;
  }> = [];

  let offset = 0;
  const pageSize = 500;
  while (true) {
    const { data, error } = await supabase
      .from("song_resources_v2")
      .select("id, song_id, storage_path")
      .eq("type", "lyrics")
      .like("storage_path", "%.txt")
      .range(offset, offset + pageSize - 1);
    if (error) { console.error("Fetch error:", error.message); break; }
    if (!data || data.length === 0) break;
    allResources.push(...data);
    if (data.length < pageSize) break;
    offset += pageSize;
  }
  console.log(`  Found ${allResources.length} .txt lyrics resources`);

  // 2. Build UUID → legacy_id map for the songs we need
  const songUuids = [...new Set(allResources.map((r) => r.song_id))];
  console.log(`  Resolving ${songUuids.length} song UUIDs to legacy IDs...`);
  const uuidToLegacy = new Map<string, string>();
  for (let i = 0; i < songUuids.length; i += 100) {
    const batch = songUuids.slice(i, i + 100);
    const { data } = await supabase
      .from("songs")
      .select("id, legacy_id")
      .in("id", batch);
    for (const row of data || []) {
      uuidToLegacy.set(row.id, row.legacy_id);
    }
  }
  console.log(`  Resolved ${uuidToLegacy.size} legacy IDs`);

  // 3. Check which songs already have lyrics_structured (skip them)
  const legacyIds = [...uuidToLegacy.values()];
  const alreadyParsed = new Set<string>();
  for (let i = 0; i < legacyIds.length; i += 100) {
    const batch = legacyIds.slice(i, i + 100);
    const { data } = await supabase
      .from("song_metadata")
      .select("song_id")
      .in("song_id", batch)
      .not("lyrics_structured", "is", null);
    for (const row of data || []) {
      alreadyParsed.add(row.song_id as string);
    }
  }
  console.log(`  Already parsed: ${alreadyParsed.size} (will skip)`);

  // 4. Filter to unprocessed, apply limit
  const toProcess = allResources.filter((r) => {
    const legacyId = uuidToLegacy.get(r.song_id);
    return legacyId && !alreadyParsed.has(legacyId);
  }).slice(0, limit);
  console.log(`  To process: ${toProcess.length}`);

  // 5. Download, parse, store
  let downloaded = 0;
  let parsed = 0;
  let failed = 0;
  let written = 0;

  for (let i = 0; i < toProcess.length; i++) {
    const res = toProcess[i];
    const legacyId = uuidToLegacy.get(res.song_id)!;

    // Download from storage
    const { data: fileData, error: dlError } = await supabase.storage
      .from("song-resources")
      .download(res.storage_path);

    if (dlError || !fileData) {
      failed++;
      if (i < 5) console.log(`  FAIL: ${res.storage_path} — ${dlError?.message || "no data"}`);
      continue;
    }

    downloaded++;
    const rawText = await fileData.text();

    // Parse
    const structured = parseLyrics(rawText);
    if (!structured) {
      failed++;
      if (i < 5) console.log(`  PARSE FAIL: ${res.storage_path} (no verses detected)`);
      continue;
    }
    parsed++;

    if (isDryRun && i < 5) {
      console.log(`\n--- ${legacyId} (${structured.verses.length} verses) ---`);
      for (const v of structured.verses.slice(0, 3)) {
        console.log(`  [${v.label}] ${v.text.substring(0, 80)}...`);
      }
    }

    if (!isDryRun) {
      const { error: writeError } = await supabase
        .from("song_metadata")
        .upsert({
          song_id: legacyId,
          lyrics_text: rawText,
          lyrics_structured: structured,
          lyrics_source: "ocp_storage",
          lyrics_parsed_at: new Date().toISOString(),
        }, { onConflict: "song_id" });

      if (writeError) {
        failed++;
        if (written < 5) console.error(`  WRITE FAIL: ${legacyId} — ${writeError.message}`);
      } else {
        written++;
      }
    }

    if ((i + 1) % 100 === 0) {
      console.log(`  Progress: ${i + 1}/${toProcess.length} (${downloaded} downloaded, ${parsed} parsed, ${failed} failed)`);
    }
  }

  console.log(`\n=== RESULTS ===`);
  console.log(`Downloaded: ${downloaded}`);
  console.log(`Parsed: ${parsed}`);
  console.log(`Failed: ${failed}`);
  if (!isDryRun) console.log(`Written: ${written}`);
  else console.log(`[DRY RUN] Use --execute to write to Supabase.`);
}

main().catch(console.error);
