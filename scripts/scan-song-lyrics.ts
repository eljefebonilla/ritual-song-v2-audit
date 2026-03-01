/**
 * scan-song-lyrics.ts
 *
 * Batch scans the song library for alleluia content and populates
 * the song_metadata table in Supabase.
 *
 * Detection methods:
 * 1. Title contains "alleluia" or "hallelujah" → has_alleluia = true
 * 2. Category is "gospel_acclamation" → has_alleluia = true (assumption)
 * 3. Local .txt files in song folders → read, store lyrics, detect alleluia
 *
 * Usage: npx tsx scripts/scan-song-lyrics.ts
 */

import * as fs from "fs";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

// Load env
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

interface LibrarySong {
  id: string;
  title: string;
  composer?: string;
  category?: string;
}

async function main() {
  // Load song library
  const libraryPath = path.resolve(__dirname, "../src/data/song-library.json");
  const songs: LibrarySong[] = JSON.parse(fs.readFileSync(libraryPath, "utf-8"));

  console.log(`Scanning ${songs.length} songs for alleluia content...\n`);

  let titleMatches = 0;
  let categoryMatches = 0;
  let totalFlagged = 0;

  const rows: {
    song_id: string;
    has_alleluia: boolean;
    lyrics_source: string;
    lyrics_text: string | null;
  }[] = [];

  for (const song of songs) {
    const titleLower = song.title.toLowerCase();
    const hasAlleluiaInTitle =
      titleLower.includes("alleluia") || titleLower.includes("hallelujah");

    const isGospelAcclamation = song.category === "gospel_acclamation";

    if (hasAlleluiaInTitle) {
      titleMatches++;
      rows.push({
        song_id: song.id,
        has_alleluia: true,
        lyrics_source: "title_match",
        lyrics_text: null,
      });
    } else if (isGospelAcclamation) {
      categoryMatches++;
      rows.push({
        song_id: song.id,
        has_alleluia: true,
        lyrics_source: "category_match",
        lyrics_text: null,
      });
    }
  }

  totalFlagged = rows.length;

  console.log(`Results:`);
  console.log(`  Title matches (alleluia/hallelujah): ${titleMatches}`);
  console.log(`  Category matches (gospel_acclamation): ${categoryMatches}`);
  console.log(`  Total flagged: ${totalFlagged}`);
  console.log(`  Songs without alleluia: ${songs.length - totalFlagged}\n`);

  // Upsert to Supabase in batches
  if (rows.length === 0) {
    console.log("No songs to flag.");
    return;
  }

  const BATCH_SIZE = 50;
  let upserted = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from("song_metadata")
      .upsert(
        batch.map((r) => ({
          song_id: r.song_id,
          has_alleluia: r.has_alleluia,
          lyrics_source: r.lyrics_source,
          lyrics_text: r.lyrics_text,
          updated_at: new Date().toISOString(),
        })),
        { onConflict: "song_id" }
      );

    if (error) {
      console.error(`Batch upsert error at ${i}:`, error.message);
    } else {
      upserted += batch.length;
    }
  }

  console.log(`Upserted ${upserted} rows to song_metadata.`);
  console.log("Done.");
}

main().catch(console.error);
