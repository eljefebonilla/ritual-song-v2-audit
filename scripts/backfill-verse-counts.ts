#!/usr/bin/env npx tsx
import "dotenv/config";
import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: ".env.local", override: true });

/**
 * Backfill verse_count — Downloads LYR.txt files from Supabase Storage,
 * parses verse markers, and updates the songs table.
 *
 * Usage: npx tsx scripts/backfill-verse-counts.ts [--dry-run]
 *
 * Verse detection patterns:
 *   - "1.", "2.", "3." at start of line (numbered verses)
 *   - "Verse 1", "Verse 2" (labeled verses)
 *   - "V1", "V2" markers
 *   - Double-newline separated stanzas (fallback)
 */

import { createClient } from "@supabase/supabase-js";

const DRY_RUN = process.argv.includes("--dry-run");

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}

function countVerses(text: string): number | null {
  const lines = text.split("\n").map((l) => l.trim());

  // Pattern 1: "Verse N" or "VERSE N"
  const verseLabels = lines.filter((l) => /^verse\s+\d+/i.test(l));
  if (verseLabels.length >= 2) return verseLabels.length;

  // Pattern 2: "V1", "V2" standalone or at line start
  const vMarkers = lines.filter((l) => /^V\d+[\s.:)]/i.test(l) || /^V\d+$/i.test(l));
  if (vMarkers.length >= 2) return vMarkers.length;

  // Pattern 3: Numbered lines "1.", "2.", "3." at start
  // Only count sequential numbers starting from 1
  const numbered = lines.filter((l) => /^\d+\.\s/.test(l));
  if (numbered.length >= 2) {
    const nums = numbered.map((l) => parseInt(l.match(/^(\d+)/)![1]));
    const unique = [...new Set(nums)].sort((a, b) => a - b);
    if (unique[0] === 1 && unique.length >= 2) return unique.length;
  }

  // Pattern 4: Stanza counting (double-newline separated blocks)
  // Filter out short blocks (likely refrains/headers) — only count blocks with 2+ lines
  const stanzas = text
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .filter((s) => {
      const stanzaLines = s.split("\n").filter((l) => l.trim().length > 0);
      return stanzaLines.length >= 2;
    });
  if (stanzas.length >= 2) return stanzas.length;

  return null; // Can't determine
}

async function main() {
  const supabase = getSupabase();

  // Get all lyrics resources with storage paths
  const { data: resources, error } = await supabase
    .from("song_resources_v2")
    .select("song_id, storage_path, url")
    .eq("type", "lyrics")
    .not("storage_path", "is", null);

  if (error) throw error;
  console.log(`Found ${resources.length} lyrics resources`);

  // Dedupe by song_id (take first)
  const bySong = new Map<string, typeof resources[0]>();
  for (const r of resources) {
    if (!bySong.has(r.song_id)) bySong.set(r.song_id, r);
  }
  console.log(`${bySong.size} unique songs with lyrics`);

  let updated = 0;
  let failed = 0;
  let skipped = 0;

  for (const [songId, resource] of bySong) {
    try {
      // Download the lyrics file from storage
      const { data: fileData, error: dlError } = await supabase.storage
        .from("song-resources")
        .download(resource.storage_path!);

      if (dlError || !fileData) {
        console.log(`  SKIP ${songId}: download failed — ${dlError?.message}`);
        failed++;
        continue;
      }

      const text = await fileData.text();
      if (!text || text.length < 10) {
        skipped++;
        continue;
      }

      const count = countVerses(text);
      if (!count) {
        skipped++;
        continue;
      }

      if (DRY_RUN) {
        console.log(`  DRY: ${songId} → ${count} verses`);
      } else {
        const { error: upErr } = await supabase
          .from("songs")
          .update({ verse_count: count })
          .eq("id", songId);
        if (upErr) {
          console.log(`  ERR updating ${songId}: ${upErr.message}`);
          failed++;
          continue;
        }
      }
      updated++;
    } catch (e) {
      console.log(`  ERR ${songId}: ${e}`);
      failed++;
    }
  }

  console.log(`\nDone. Updated: ${updated}, Skipped: ${skipped}, Failed: ${failed}`);
  if (DRY_RUN) console.log("(dry run — no changes written)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
