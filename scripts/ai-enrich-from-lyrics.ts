/**
 * AI-powered liturgical metadata enrichment using full lyrics.
 * Uses Grok (x-ai/grok-4.1-fast via OpenRouter) to classify 604 Catholic hymns
 * by liturgical function and extract topics from actual lyric content.
 *
 * Higher accuracy than ai-enrich-songs.ts (title-only) because it reads
 * the refrain and first verses directly.
 *
 * Usage:
 *   npx tsx scripts/ai-enrich-from-lyrics.ts              # dry-run
 *   npx tsx scripts/ai-enrich-from-lyrics.ts --execute     # write to Supabase
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
const MODEL = "x-ai/grok-4.1-fast";
const BATCH_SIZE = 10;
const RATE_LIMIT_MS = 2000;
const LYRICS_PREVIEW_CHARS = 500;

// ----- Types -----

interface SongWithLyrics {
  id: string;
  legacy_id: string;
  title: string;
  topics: string[] | null;
  functions: string[] | null;
  lyrics_text: string;
}

interface GrokClassification {
  i: number;    // 1-based index within batch
  f: string;    // function: communion | gathering | sending | offertory | general
  t: string[];  // topics: 3-5 from the vocabulary list
}

// ----- OpenRouter API -----

const TOPIC_VOCABULARY = [
  "Praise", "Trust", "Comfort", "Discipleship", "Faith", "Love of God for Us",
  "Peace", "Joy", "Hope", "Jesus Christ", "Eternal Life", "Love for Others",
  "Guidance", "Burdens", "Petition/Prayer", "Healing", "Christian Life",
  "Mercy", "Heaven", "Service", "Refuge", "Freedom", "Holy Spirit", "Light",
  "Salvation", "Unity", "Presence of God", "Confidence", "Assurance",
  "Providence", "Courage", "Strength", "Thanksgiving", "Creation",
  "Second Coming", "Trinity", "Social Justice", "Paschal Mystery", "Church",
  "Baptism", "Eucharist", "Cross", "Commitment/Submission", "Gathering",
  "Community", "Mission", "Sending Forth", "Commissioning",
  "Jesus Christ/Blood", "Offering",
];

async function classifyBatch(
  songs: Pick<SongWithLyrics, "title" | "lyrics_text">[]
): Promise<GrokClassification[] | null> {
  if (!OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY is not set in .env.local");
  }

  const songList = songs
    .map((s, idx) => {
      const preview = s.lyrics_text.slice(0, LYRICS_PREVIEW_CHARS).trim();
      return `${idx + 1}. TITLE: ${s.title}\nLYRICS: ${preview}`;
    })
    .join("\n\n");

  const topicsStr = TOPIC_VOCABULARY.join(", ");

  const prompt = `You are a Catholic liturgist classifying hymns by analyzing their lyrics.

For each song, assign:
- function: communion | gathering | sending | offertory | general
- topics: 3-5 from this list: ${topicsStr}

Communion indicators: bread, wine, body, blood, table, feast, eucharist, sacrament, hunger/thirst in communion context, breaking bread, "take and eat", altar, sacrifice of the Mass
Gathering indicators: come together, processional, entrance, assembly, "sing to the Lord", worship
Sending indicators: go forth, mission, commission, go out, serve the world
Offertory indicators: offering, gifts, "all that we have", preparation

Respond as JSON ONLY (no markdown): [{"i": 1, "f": "communion", "t": ["Eucharist", "Unity", "Jesus Christ"]}]

Songs:
${songList}`;

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://ritualsong.app",
      "X-Title": "Ritual Song Lyrics Enrichment Script",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 4096,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`  OpenRouter error ${res.status}: ${text}`);
    return null;
  }

  const json = await res.json();
  const content: string = json.choices?.[0]?.message?.content ?? "";

  // Extract JSON array from response (Grok sometimes wraps in markdown)
  const match = content.match(/\[[\s\S]*\]/);
  if (!match) {
    console.error(`  Could not find JSON array in response:\n  ${content.slice(0, 200)}`);
    return null;
  }

  try {
    const parsed = JSON.parse(match[0]) as GrokClassification[];
    return parsed;
  } catch (err) {
    console.error(`  JSON parse failed: ${(err as Error).message}`);
    console.error(`  Raw content: ${match[0].slice(0, 300)}`);
    return null;
  }
}

// ----- Helpers -----

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const VALID_FUNCTIONS = new Set(["communion", "gathering", "sending", "offertory", "general"]);
const TOPIC_SET = new Set(TOPIC_VOCABULARY);

function normalizeTopics(raw: string[]): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((t) => {
      if (typeof t !== "string") return null;
      // Try exact match first
      if (TOPIC_SET.has(t)) return t;
      // Try case-insensitive match
      const lower = t.toLowerCase();
      for (const v of TOPIC_VOCABULARY) {
        if (v.toLowerCase() === lower) return v;
      }
      return null;
    })
    .filter((t): t is string => t !== null);
}

// ----- Main -----

async function main() {
  console.log(isDryRun ? "=== DRY RUN ===" : "=== EXECUTING ===");
  console.log(`Model: ${MODEL}`);
  console.log(`Batch size: ${BATCH_SIZE}`);
  console.log(`Lyrics preview: first ${LYRICS_PREVIEW_CHARS} chars`);
  console.log("");

  if (!OPENROUTER_API_KEY) {
    console.error("ERROR: OPENROUTER_API_KEY is not set in .env.local");
    process.exit(1);
  }

  // Load all songs where category='song' AND functions is empty AND lyrics exist.
  // Uses a JOIN via two queries (Supabase JS client doesn't support cross-table JOINs
  // in a single call without raw SQL). We fetch songs first, then lyrics.
  const allSongs: SongWithLyrics[] = [];

  let offset = 0;
  const pageSize = 1000;

  // Step 1: load songs missing functions
  const candidateSongs: Array<{ id: string; legacy_id: string; title: string; topics: string[] | null; functions: string[] | null }> = [];

  while (true) {
    const { data, error } = await supabase
      .from("songs")
      .select("id, legacy_id, title, topics, functions")
      .eq("category", "song")
      .or("functions.is.null,functions.eq.{}")
      .range(offset, offset + pageSize - 1)
      .order("title");

    if (error) {
      console.error("Fetch error (songs):", error.message);
      break;
    }
    if (!data || data.length === 0) break;
    candidateSongs.push(...data);
    if (data.length < pageSize) break;
    offset += pageSize;
  }

  console.log(`Songs missing functions: ${candidateSongs.length}`);

  if (candidateSongs.length === 0) {
    console.log("No songs need enrichment. Exiting.");
    return;
  }

  // Step 2: fetch lyrics for those song IDs via legacy_id
  const legacyIds = candidateSongs.map((s) => s.legacy_id);

  // Fetch in chunks to avoid URL length limits
  const CHUNK = 500;
  const lyricsMap = new Map<string, string>(); // legacy_id -> lyrics_text

  for (let i = 0; i < legacyIds.length; i += CHUNK) {
    const chunk = legacyIds.slice(i, i + CHUNK);
    const { data, error } = await supabase
      .from("song_metadata")
      .select("song_id, lyrics_text")
      .in("song_id", chunk)
      .not("lyrics_text", "is", null);

    if (error) {
      console.error(`Fetch error (song_metadata chunk ${i / CHUNK + 1}):`, error.message);
      continue;
    }
    if (data) {
      for (const row of data) {
        if (row.lyrics_text) {
          lyricsMap.set(row.song_id, row.lyrics_text);
        }
      }
    }
  }

  console.log(`Songs with lyrics in song_metadata: ${lyricsMap.size}`);

  // Step 3: join — only keep songs that have lyrics
  for (const song of candidateSongs) {
    const lyrics = lyricsMap.get(song.legacy_id);
    if (lyrics) {
      allSongs.push({ ...song, lyrics_text: lyrics });
    }
  }

  console.log(`Songs to classify (missing functions + have lyrics): ${allSongs.length}`);
  console.log("");

  if (allSongs.length === 0) {
    console.log("No songs qualify. Exiting.");
    return;
  }

  // Stats
  const stats = {
    totalProcessed: 0,
    functionsAdded: 0,
    topicsAdded: 0,
    batchErrors: 0,
    songErrors: 0,
    skipped: 0,
  };

  // Sample of changes for reporting
  const sampleChanges: Array<{ title: string; fn: string; topics: string[] }> = [];

  // Process in batches
  const totalBatches = Math.ceil(allSongs.length / BATCH_SIZE);

  for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
    const batch = allSongs.slice(batchIdx * BATCH_SIZE, (batchIdx + 1) * BATCH_SIZE);
    const batchNum = batchIdx + 1;

    console.log(`\nBatch ${batchNum}/${totalBatches} (${batch.length} songs)...`);

    const classifications = await classifyBatch(
      batch.map((s) => ({ title: s.title, lyrics_text: s.lyrics_text }))
    );

    if (!classifications) {
      console.error(`  Batch ${batchNum} failed — skipping.`);
      stats.batchErrors++;
      stats.skipped += batch.length;
      if (batchIdx < totalBatches - 1) await sleep(RATE_LIMIT_MS);
      continue;
    }

    // Build a map: 1-based index -> classification
    const classMap = new Map<number, GrokClassification>();
    for (const c of classifications) {
      if (typeof c.i === "number") {
        classMap.set(c.i, c);
      }
    }

    // Apply classifications to songs
    for (let i = 0; i < batch.length; i++) {
      const song = batch[i];
      const cls = classMap.get(i + 1);
      stats.totalProcessed++;

      if (!cls) {
        stats.skipped++;
        continue;
      }

      const fn = (cls.f ?? "general").toLowerCase().trim();

      if (!VALID_FUNCTIONS.has(fn)) {
        console.warn(`  [${song.title}] Unknown function "${fn}" — skipping.`);
        stats.skipped++;
        continue;
      }

      // Validate and filter topics against the allowed vocabulary
      const newTopics = normalizeTopics(cls.t ?? []);

      // Determine what actually changes
      const existingFunctions = song.functions ?? [];
      const existingTopics = song.topics ?? [];

      const fnToAdd = fn !== "general" && !existingFunctions.includes(fn) ? fn : null;
      const topicsToAdd = newTopics.filter((t) => !existingTopics.includes(t));

      if (!fnToAdd && topicsToAdd.length === 0) {
        stats.skipped++;
        continue;
      }

      const updatedFunctions = fnToAdd ? [...existingFunctions, fnToAdd] : existingFunctions;
      const updatedTopics = topicsToAdd.length > 0
        ? [...existingTopics, ...topicsToAdd]
        : existingTopics;

      if (sampleChanges.length < 40) {
        sampleChanges.push({
          title: song.title,
          fn: fnToAdd ?? "(no change)",
          topics: topicsToAdd,
        });
      }

      if (!isDryRun) {
        const updatePayload: Record<string, unknown> = {};
        if (fnToAdd) updatePayload.functions = updatedFunctions;
        if (topicsToAdd.length > 0) updatePayload.topics = updatedTopics;

        const { error } = await supabase
          .from("songs")
          .update(updatePayload)
          .eq("id", song.id);

        if (error) {
          console.error(`  Error updating "${song.title}": ${error.message}`);
          stats.songErrors++;
        } else {
          if (fnToAdd) stats.functionsAdded++;
          if (topicsToAdd.length > 0) stats.topicsAdded++;
        }
      } else {
        if (fnToAdd) stats.functionsAdded++;
        if (topicsToAdd.length > 0) stats.topicsAdded++;
      }
    }

    console.log(
      `  Batch ${batchNum} done. Running total: ${stats.functionsAdded} functions, ${stats.topicsAdded} topic enrichments, ${stats.batchErrors} batch errors.`
    );

    // Rate limit between batches
    if (batchIdx < totalBatches - 1) {
      await sleep(RATE_LIMIT_MS);
    }
  }

  // ----- Report -----
  console.log("\n=== RESULTS ===");
  console.log(`Total songs processed : ${stats.totalProcessed}`);
  console.log(`Functions added       : ${stats.functionsAdded}`);
  console.log(`Topic enrichments     : ${stats.topicsAdded}`);
  console.log(`Skipped (no change)   : ${stats.skipped}`);
  console.log(`Batch errors          : ${stats.batchErrors}`);
  console.log(`Song write errors     : ${stats.songErrors}`);

  if (sampleChanges.length > 0) {
    console.log(`\nSample changes (first ${Math.min(sampleChanges.length, 40)}):`);
    for (const c of sampleChanges) {
      const titlePad = c.title.substring(0, 38).padEnd(40);
      const fnNote = c.fn !== "(no change)" ? `+fn:${c.fn}` : "fn:unchanged";
      const topicNote = c.topics.length > 0 ? ` +topics:[${c.topics.join(", ")}]` : "";
      console.log(`  ${titlePad} ${fnNote}${topicNote}`);
    }
  }

  if (isDryRun) {
    console.log("\n[DRY RUN] No data written. Use --execute to apply.");
  } else {
    console.log("\nDone.");
  }
}

main().catch(console.error);
