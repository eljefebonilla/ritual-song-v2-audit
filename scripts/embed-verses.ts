/**
 * Generate verse-level embeddings for songs with structured lyrics.
 * Each verse/refrain gets its own 512-dim vector for fine-grained
 * scripture matching (e.g., "which verse of this song echoes today's Gospel?").
 *
 * Usage:
 *   npx tsx scripts/embed-verses.ts              # dry-run (count only)
 *   npx tsx scripts/embed-verses.ts --execute     # write to Supabase
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
const BATCH_SIZE = 50;
const RATE_LIMIT_MS = 500;

interface VerseCandidate {
  song_id: string;
  verse_label: string;
  verse_text: string;
}

async function getEmbeddings(texts: string[]): Promise<number[][] | null> {
  if (!OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY is not set in .env.local");
  }

  const res = await fetch("https://openrouter.ai/api/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://ritualsong.app",
      "X-Title": "Ritual Song Verse Embedding Script",
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
  console.log(`\n=== Verse Embedding Generator ===`);
  console.log(`Mode: ${isDryRun ? "DRY RUN" : "EXECUTE"}`);
  console.log(`Model: ${EMBEDDING_MODEL} (${EMBEDDING_DIMS} dims)\n`);

  // Fetch songs with structured lyrics (paginated)
  const PAGE = 1000;
  const metadata: { song_id: string; lyrics_structured: any }[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from("song_metadata")
      .select("song_id, lyrics_structured")
      .not("lyrics_structured", "is", null)
      .range(offset, offset + PAGE - 1);
    if (error) {
      console.error("Failed to fetch metadata:", error.message);
      process.exit(1);
    }
    if (!data || data.length === 0) break;
    metadata.push(...data);
    if (data.length < PAGE) break;
    offset += PAGE;
  }

  // Build legacy_id -> UUID mapping (song_metadata uses legacy_id, verse_embeddings FK requires UUID)
  const legacyToUuid = new Map<string, string>();
  offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from("songs")
      .select("id, legacy_id")
      .range(offset, offset + PAGE - 1);
    if (error || !data || data.length === 0) break;
    for (const s of data) legacyToUuid.set(s.legacy_id, s.id);
    if (data.length < PAGE) break;
    offset += PAGE;
  }

  // Check which songs already have verse embeddings (paginated, keyed by UUID)
  const existingSongIds = new Set<string>();
  offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from("verse_embeddings")
      .select("song_id")
      .range(offset, offset + PAGE - 1);
    if (error) break;
    if (!data || data.length === 0) break;
    for (const e of data) existingSongIds.add(e.song_id);
    if (data.length < PAGE) break;
    offset += PAGE;
  }

  // Build verse candidates
  const candidates: VerseCandidate[] = [];
  let songsWithStructured = 0;
  let skippedNoUuid = 0;

  for (const row of metadata) {
    const uuid = legacyToUuid.get(row.song_id);
    if (!uuid) { skippedNoUuid++; continue; }
    if (existingSongIds.has(uuid)) continue;
    const verses = row.lyrics_structured?.verses ?? row.lyrics_structured;
    if (!Array.isArray(verses)) continue;

    songsWithStructured++;
    for (const verse of verses) {
      if (!verse.text || verse.text.trim().length < 10) continue;
      candidates.push({
        song_id: uuid,
        verse_label: verse.label || "Unknown",
        verse_text: verse.text.trim(),
      });
    }
  }

  console.log(`Songs with structured lyrics: ${metadata.length}`);
  console.log(`Skipped (no UUID mapping): ${skippedNoUuid}`);
  console.log(`Songs to process (not yet embedded): ${songsWithStructured}`);
  console.log(`Total verse candidates: ${candidates.length}`);

  if (isDryRun) {
    console.log("\nDry run complete. Use --execute to generate verse embeddings.");
    return;
  }

  let embedded = 0;
  let failed = 0;

  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    const batch = candidates.slice(i, i + BATCH_SIZE);
    const texts = batch.map((v) => v.verse_text);

    const embeddings = await getEmbeddings(texts);
    if (!embeddings) {
      console.error(`Batch ${Math.floor(i / BATCH_SIZE) + 1} failed, skipping`);
      failed += batch.length;
      await new Promise((r) => setTimeout(r, RATE_LIMIT_MS * 3));
      continue;
    }

    const rows = batch.map((verse, idx) => ({
      song_id: verse.song_id,
      verse_label: verse.verse_label,
      verse_text: verse.verse_text.slice(0, 2000),
      embedding: JSON.stringify(embeddings[idx]),
      model: EMBEDDING_MODEL,
    }));

    const { error: insertErr } = await supabase
      .from("verse_embeddings")
      .insert(rows);

    if (insertErr) {
      console.error(`Insert error batch ${Math.floor(i / BATCH_SIZE) + 1}:`, insertErr.message);
      failed += batch.length;
    } else {
      embedded += batch.length;
    }

    const pct = Math.round(((i + batch.length) / candidates.length) * 100);
    process.stdout.write(`\rProgress: ${pct}% (${embedded} embedded, ${failed} failed)`);

    await new Promise((r) => setTimeout(r, RATE_LIMIT_MS));
  }

  console.log(`\n\nDone! Embedded: ${embedded} verses, Failed: ${failed}`);
}

main().catch(console.error);
