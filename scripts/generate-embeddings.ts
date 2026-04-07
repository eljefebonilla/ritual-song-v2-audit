/**
 * Generate song-level embeddings for all songs with lyrics.
 * Uses OpenAI text-embedding-3-small (512 dims) via OpenRouter.
 * Stores results in song_embeddings table (pgvector).
 *
 * Usage:
 *   npx tsx scripts/generate-embeddings.ts              # dry-run (count only)
 *   npx tsx scripts/generate-embeddings.ts --execute     # write to Supabase
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

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const EMBEDDING_MODEL = "openai/text-embedding-3-small";
const EMBEDDING_DIMS = 512;
const BATCH_SIZE = 50; // OpenRouter batch limit for embeddings
const RATE_LIMIT_MS = 500;

interface SongRow {
  id: string;
  title: string;
  lyrics_text: string | null;
  lyrics_structured: { label: string; text: string }[] | null;
}

/**
 * Build the source text for embedding: title + refrain + first verse.
 * This gives the embedding a good semantic fingerprint of the song.
 */
function buildSourceText(song: SongRow): string {
  const parts: string[] = [song.title];

  const verses = song.lyrics_structured?.verses ?? song.lyrics_structured;
  if (verses && Array.isArray(verses)) {
    const refrain = verses.find(
      (v: any) => v.label?.toLowerCase() === "refrain"
    );
    if (refrain) parts.push(refrain.text);

    const firstVerse = verses.find(
      (v: any) => v.label === "1" || v.label?.toLowerCase() === "verse 1"
    );
    if (firstVerse) parts.push(firstVerse.text);
  } else if (song.lyrics_text) {
    // Fallback: use first 500 chars of plain text lyrics
    parts.push(song.lyrics_text.slice(0, 500));
  }

  return parts.join("\n\n").trim();
}

/**
 * Call OpenRouter embeddings endpoint for a batch of texts.
 */
async function getEmbeddings(
  texts: string[]
): Promise<number[][] | null> {
  if (!OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY is not set in .env.local");
  }

  const res = await fetch("https://openrouter.ai/api/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://ritualsong.app",
      "X-Title": "Ritual Song Embedding Script",
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: texts,
      dimensions: EMBEDDING_DIMS,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`Embedding API error ${res.status}: ${body}`);
    return null;
  }

  const json = await res.json();
  return json.data.map((d: { embedding: number[] }) => d.embedding);
}

async function main() {
  console.log(`\n=== Song Embedding Generator ===`);
  console.log(`Mode: ${isDryRun ? "DRY RUN" : "EXECUTE"}`);
  console.log(`Model: ${EMBEDDING_MODEL} (${EMBEDDING_DIMS} dims)\n`);

  // Fetch all songs (paginated, Supabase defaults to 1000 rows)
  const songs: { id: string; legacy_id: string; title: string }[] = [];
  const PAGE = 1000;
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from("songs")
      .select("id, legacy_id, title")
      .range(offset, offset + PAGE - 1);
    if (error) {
      console.error("Failed to fetch songs:", error.message);
      process.exit(1);
    }
    if (!data || data.length === 0) break;
    songs.push(...data);
    if (data.length < PAGE) break;
    offset += PAGE;
  }

  // Fetch lyrics from song_metadata (paginated)
  const lyricsMap = new Map<string, { lyrics_text: string; lyrics_structured: any }>();
  offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from("song_metadata")
      .select("song_id, lyrics_text, lyrics_structured")
      .not("lyrics_text", "is", null)
      .range(offset, offset + PAGE - 1);
    if (error) {
      console.error("Failed to fetch metadata:", error.message);
      process.exit(1);
    }
    if (!data || data.length === 0) break;
    for (const m of data) {
      if (m.lyrics_text) {
        lyricsMap.set(m.song_id, {
          lyrics_text: m.lyrics_text,
          lyrics_structured: m.lyrics_structured,
        });
      }
    }
    if (data.length < PAGE) break;
    offset += PAGE;
  }

  // Check which songs already have embeddings (paginated)
  const existingSet = new Set<string>();
  offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from("song_embeddings")
      .select("song_id")
      .range(offset, offset + PAGE - 1);
    if (error) {
      console.log("song_embeddings table may not exist yet, will embed all songs");
      break;
    }
    if (!data || data.length === 0) break;
    for (const e of data) existingSet.add(e.song_id);
    if (data.length < PAGE) break;
    offset += PAGE;
  }

  // Build embedding candidates: all songs (with lyrics get better embeddings, without get title-only)
  // song_metadata.song_id = songs.legacy_id, so look up by legacy_id
  const candidates: SongRow[] = songs.map((s) => {
    const lyrics = lyricsMap.get(s.legacy_id);
    return {
      id: s.id,
      title: s.title,
      lyrics_text: lyrics?.lyrics_text || null,
      lyrics_structured: lyrics?.lyrics_structured || null,
    };
  }).filter((s) => !existingSet.has(s.id));

  const withLyrics = candidates.filter((s) => s.lyrics_text);
  const titleOnly = candidates.filter((s) => !s.lyrics_text);

  console.log(`Total songs: ${songs.length}`);
  console.log(`Already embedded: ${existingSet.size}`);
  console.log(`To embed: ${candidates.length} (${withLyrics.length} with lyrics, ${titleOnly.length} title-only)`);

  if (isDryRun) {
    console.log("\nDry run complete. Use --execute to generate embeddings.");
    return;
  }

  // Process in batches
  let embedded = 0;
  let failed = 0;

  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    const batch = candidates.slice(i, i + BATCH_SIZE);
    const sourceTexts = batch.map(buildSourceText);

    const embeddings = await getEmbeddings(sourceTexts);
    if (!embeddings) {
      console.error(`Batch ${Math.floor(i / BATCH_SIZE) + 1} failed, skipping`);
      failed += batch.length;
      await new Promise((r) => setTimeout(r, RATE_LIMIT_MS * 3));
      continue;
    }

    // Upsert into song_embeddings
    const rows = batch.map((song, idx) => ({
      song_id: song.id,
      embedding: JSON.stringify(embeddings[idx]),
      source_text: sourceTexts[idx].slice(0, 2000), // cap stored text
      model: EMBEDDING_MODEL,
    }));

    const { error: upsertErr } = await supabase
      .from("song_embeddings")
      .upsert(rows, { onConflict: "song_id" });

    if (upsertErr) {
      console.error(`Upsert error batch ${Math.floor(i / BATCH_SIZE) + 1}:`, upsertErr.message);
      failed += batch.length;
    } else {
      embedded += batch.length;
    }

    const pct = Math.round(((i + batch.length) / candidates.length) * 100);
    process.stdout.write(`\rProgress: ${pct}% (${embedded} embedded, ${failed} failed)`);

    await new Promise((r) => setTimeout(r, RATE_LIMIT_MS));
  }

  console.log(`\n\nDone! Embedded: ${embedded}, Failed: ${failed}`);
}

main().catch(console.error);
