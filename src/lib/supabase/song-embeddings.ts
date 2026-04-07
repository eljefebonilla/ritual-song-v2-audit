/**
 * Song embedding utilities for semantic similarity search.
 * Embeds a query text via OpenRouter, then searches pgvector
 * for similar songs using the match_songs_by_embedding RPC.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const EMBEDDING_MODEL = "openai/text-embedding-3-small";
const EMBEDDING_DIMS = 512;

/**
 * Embed a text string via OpenRouter and return the 512-dim vector.
 */
async function embedText(text: string): Promise<number[] | null> {
  if (!OPENROUTER_API_KEY) return null;

  const res = await fetch("https://openrouter.ai/api/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://ritualsong.app",
      "X-Title": "Ritual Song Recommendations",
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: [text],
      dimensions: EMBEDDING_DIMS,
    }),
  });

  if (!res.ok) return null;

  const json = await res.json();
  return json.data?.[0]?.embedding ?? null;
}

/**
 * Build a query string from occasion readings for embedding.
 * Combines citations and summaries into a single searchable text.
 */
function buildReadingQuery(
  readings: { citation: string; summary: string }[]
): string {
  return readings
    .map((r) => `${r.citation}: ${r.summary}`)
    .join("\n");
}

/**
 * Find songs semantically similar to the given readings.
 * Returns a Map of songId (UUID) -> similarity score (0-1).
 *
 * Latency: ~200ms embedding + ~50ms pgvector = ~250ms total.
 */
export async function findSimilarSongs(
  supabase: SupabaseClient,
  readings: { citation: string; summary: string }[],
  threshold: number = 0.3,
  limit: number = 50
): Promise<Map<string, number>> {
  const similarityMap = new Map<string, number>();

  if (readings.length === 0) return similarityMap;

  const queryText = buildReadingQuery(readings);
  const embedding = await embedText(queryText);
  if (!embedding) return similarityMap;

  const { data, error } = await supabase.rpc("match_songs_by_embedding", {
    query_embedding: JSON.stringify(embedding),
    match_threshold: threshold,
    match_count: limit,
  });

  if (error || !data) return similarityMap;

  for (const row of data) {
    similarityMap.set(row.song_id, row.similarity);
  }

  return similarityMap;
}
