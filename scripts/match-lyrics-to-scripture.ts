/**
 * Match song verses to scripture readings.
 * For each scripture_song_mapping row that has both a matched song
 * (with lyrics) and reading_text, find the verse that best matches
 * the reading content. Stores the verse label and excerpt.
 *
 * Usage:
 *   npx tsx scripts/match-lyrics-to-scripture.ts              # dry-run
 *   npx tsx scripts/match-lyrics-to-scripture.ts --execute     # write to DB
 */

import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.join(__dirname, "..", ".env.local") });

import { createClient } from "@supabase/supabase-js";

const isDryRun = !process.argv.includes("--execute");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ----- Keyword Matching -----

// Common liturgical stop words to skip
const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
  "of", "with", "by", "from", "is", "are", "was", "were", "be", "been",
  "has", "have", "had", "do", "does", "did", "will", "shall", "may",
  "can", "not", "no", "so", "as", "if", "it", "he", "she", "his", "her",
  "they", "them", "their", "we", "us", "our", "you", "your", "my", "me",
  "i", "am", "this", "that", "who", "whom", "which", "what", "all",
  "o", "oh", "let", "come", "said", "says",
]);

function extractKeywords(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^a-z\s'-]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
  return new Set(words);
}

interface Verse {
  label: string;
  text: string;
}

function scoreVerse(verse: Verse, keywords: Set<string>): number {
  const verseWords = extractKeywords(verse.text);
  let hits = 0;
  for (const kw of keywords) {
    if (verseWords.has(kw)) hits++;
    // Partial match for stems (e.g., "pardoned" matches "pardon")
    for (const vw of verseWords) {
      if (vw !== kw && (vw.startsWith(kw.slice(0, -1)) || kw.startsWith(vw.slice(0, -1)))) {
        hits += 0.5;
        break;
      }
    }
  }
  // Boost Refrain slightly (it's what the assembly sings)
  if (verse.label === "Refrain") hits *= 1.15;
  return hits;
}

function findBestVerse(
  verses: Verse[],
  readingText: string
): { label: string; excerpt: string; score: number } | null {
  const keywords = extractKeywords(readingText);
  if (keywords.size < 2) return null;

  let bestScore = 0;
  let bestVerse: Verse | null = null;

  for (const verse of verses) {
    const score = scoreVerse(verse, keywords);
    if (score > bestScore) {
      bestScore = score;
      bestVerse = verse;
    }
  }

  if (!bestVerse || bestScore < 1.5) return null;

  // Excerpt: first 120 chars of the verse
  const excerpt = bestVerse.text
    .replace(/\n/g, " ")
    .substring(0, 120)
    .trim();

  return {
    label: bestVerse.label,
    excerpt: excerpt.length < bestVerse.text.length ? excerpt + "..." : excerpt,
    score: bestScore,
  };
}

// ----- Main -----

async function main() {
  console.log(isDryRun ? "=== DRY RUN ===" : "=== EXECUTING ===");

  // Fetch matchable rows: scripture mappings with both song lyrics and reading text
  console.log("\nFetching matchable scripture-song pairs...");

  const { data: rows, error } = await supabase.rpc("get_matchable_verse_pairs" as never);

  // If the RPC doesn't exist, fall back to a manual join
  let matchable: Array<{
    ssm_id: string;
    reading_text: string;
    legacy_id: string;
    song_title: string;
    reading_type: string;
    reading_reference: string;
    lyrics_structured: { verses: Verse[] };
  }> = [];

  if (error || !rows) {
    console.log("  RPC not available, using manual query...");

    // Get all scripture mappings with matched songs
    const { data: ssmRows } = await supabase
      .from("scripture_song_mappings")
      .select("id, song_id, reading_text, song_title, reading_type, reading_reference")
      .not("song_id", "is", null)
      .not("reading_text", "is", null)
      .is("matched_verse_label", null);

    if (!ssmRows || ssmRows.length === 0) {
      console.log("  No unmatched rows found.");
      return;
    }

    // Get song UUIDs → legacy IDs
    const songUuids = [...new Set(ssmRows.map((r) => r.song_id))];
    const uuidToLegacy = new Map<string, string>();
    for (let i = 0; i < songUuids.length; i += 100) {
      const batch = songUuids.slice(i, i + 100);
      const { data } = await supabase.from("songs").select("id, legacy_id").in("id", batch);
      for (const row of data || []) uuidToLegacy.set(row.id, row.legacy_id);
    }

    // Get lyrics for these songs
    const legacyIds = [...new Set(uuidToLegacy.values())];
    const lyricsMap = new Map<string, { verses: Verse[] }>();
    for (let i = 0; i < legacyIds.length; i += 100) {
      const batch = legacyIds.slice(i, i + 100);
      const { data } = await supabase
        .from("song_metadata")
        .select("song_id, lyrics_structured")
        .in("song_id", batch)
        .not("lyrics_structured", "is", null);
      for (const row of data || []) {
        lyricsMap.set(row.song_id, row.lyrics_structured as { verses: Verse[] });
      }
    }

    // Join
    for (const ssm of ssmRows) {
      const legacyId = uuidToLegacy.get(ssm.song_id);
      if (!legacyId) continue;
      const lyrics = lyricsMap.get(legacyId);
      if (!lyrics || !ssm.reading_text || ssm.reading_text.length < 10) continue;

      matchable.push({
        ssm_id: ssm.id,
        reading_text: ssm.reading_text,
        legacy_id: legacyId,
        song_title: ssm.song_title,
        reading_type: ssm.reading_type,
        reading_reference: ssm.reading_reference,
        lyrics_structured: lyrics,
      });
    }
  }

  console.log(`  Found ${matchable.length} matchable pairs`);

  // Process
  let matched = 0;
  let noMatch = 0;
  const samples: string[] = [];

  for (const row of matchable) {
    const result = findBestVerse(row.lyrics_structured.verses, row.reading_text);

    if (!result) {
      noMatch++;
      continue;
    }

    matched++;

    if (samples.length < 15) {
      const verseLabel = result.label === "Refrain" ? "Ref" : `V${result.label}`;
      samples.push(
        `  ${row.song_title.substring(0, 30).padEnd(32)} ${row.reading_type.padEnd(18)} ${verseLabel}: "${result.excerpt.substring(0, 60)}..."`
      );
    }

    if (!isDryRun) {
      const { error: updateError } = await supabase
        .from("scripture_song_mappings")
        .update({
          matched_verse_label: result.label,
          matched_verse_excerpt: result.excerpt,
        })
        .eq("id", row.ssm_id);

      if (updateError && matched <= 3) {
        console.error(`  Update error: ${updateError.message}`);
      }
    }
  }

  console.log(`\n=== RESULTS ===`);
  console.log(`Matched: ${matched}`);
  console.log(`No match (low confidence): ${noMatch}`);

  if (samples.length > 0) {
    console.log(`\nSample matches:`);
    for (const s of samples) console.log(s);
  }

  if (isDryRun) console.log(`\n[DRY RUN] Use --execute to write.`);
  else console.log(`\nDone. ${matched} verse matches written.`);
}

main().catch(console.error);
