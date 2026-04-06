/**
 * AI-powered liturgical metadata enrichment for songs missing functions.
 * Uses Grok (x-ai/grok-4.1-fast via OpenRouter) to classify 1,861 Catholic hymns
 * by liturgical function and season from title alone.
 *
 * Usage:
 *   npx tsx scripts/ai-enrich-songs.ts              # dry-run
 *   npx tsx scripts/ai-enrich-songs.ts --execute     # write to Supabase
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
const BATCH_SIZE = 50;
const RATE_LIMIT_MS = 1000;

// ----- Types -----

interface Song {
  id: string;
  legacy_id: string;
  title: string;
  category: string | null;
  topics: string[] | null;
  functions: string[] | null;
}

interface GrokClassification {
  i: number;   // 1-based index within batch
  f: string;   // function: communion | gathering | sending | offertory | general
  s: string;   // season: advent | christmas | lent | easter | any
}

// ----- OpenRouter API -----

async function classifyBatch(
  titles: string[]
): Promise<GrokClassification[] | null> {
  if (!OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY is not set in .env.local");
  }

  const numbered = titles
    .map((title, idx) => `${idx + 1}. ${title}`)
    .join("\n");

  const prompt = `You are a Catholic liturgist. Classify each song by liturgical function and season.

Functions: communion, gathering, sending, offertory, or general
Seasons: advent, christmas, lent, easter, or any

ONLY tag when confident from the title. Default to general/any.
Respond with ONLY a JSON array: [{"i": 1, "f": "communion", "s": "christmas"}, ...]

Songs:
${numbered}`;

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://ritualsong.app",
      "X-Title": "Ritual Song Enrichment Script",
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
const VALID_SEASONS = new Set(["advent", "christmas", "lent", "easter", "any"]);

// ----- Main -----

async function main() {
  console.log(isDryRun ? "=== DRY RUN ===" : "=== EXECUTING ===");
  console.log(`Model: ${MODEL}`);
  console.log(`Batch size: ${BATCH_SIZE}`);
  console.log("");

  if (!OPENROUTER_API_KEY) {
    console.error("ERROR: OPENROUTER_API_KEY is not set in .env.local");
    process.exit(1);
  }

  // Load all songs where category='song' AND functions is empty AND topics is empty
  // Resume-capable: skip songs that already have functions populated.
  const allSongs: Song[] = [];

  let offset = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from("songs")
      .select("id, legacy_id, title, category, topics, functions")
      .eq("category", "song")
      .or("functions.is.null,functions.eq.{}")
      .range(offset, offset + pageSize - 1)
      .order("title");

    if (error) {
      console.error("Fetch error:", error.message);
      break;
    }
    if (!data || data.length === 0) break;
    allSongs.push(...data);
    if (data.length < pageSize) break;
    offset += pageSize;
  }

  console.log(`Loaded ${allSongs.length} songs to classify`);

  if (allSongs.length === 0) {
    console.log("No songs need enrichment. Exiting.");
    return;
  }

  // Stats
  const stats = {
    totalProcessed: 0,
    functionsAdded: 0,
    batchErrors: 0,
    songErrors: 0,
    skipped: 0,
  };

  // Sample of changes for reporting
  const sampleChanges: Array<{ title: string; fn: string; season: string }> = [];

  // Process in batches
  const totalBatches = Math.ceil(allSongs.length / BATCH_SIZE);

  for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
    const batch = allSongs.slice(batchIdx * BATCH_SIZE, (batchIdx + 1) * BATCH_SIZE);
    const batchNum = batchIdx + 1;

    console.log(`\nBatch ${batchNum}/${totalBatches} (${batch.length} songs)...`);

    const titles = batch.map((s) => s.title);
    const classifications = await classifyBatch(titles);

    if (!classifications) {
      console.error(`  Batch ${batchNum} failed — skipping.`);
      stats.batchErrors++;
      stats.skipped += batch.length;
      // Rate limit even on error to avoid hammering the API
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
        // Grok didn't return a classification for this song — treat as general/any
        stats.skipped++;
        continue;
      }

      const fn = (cls.f ?? "general").toLowerCase().trim();
      const season = (cls.s ?? "any").toLowerCase().trim();

      // Validate values
      if (!VALID_FUNCTIONS.has(fn)) {
        console.warn(`  [${song.title}] Unknown function "${fn}" — skipping.`);
        stats.skipped++;
        continue;
      }
      if (!VALID_SEASONS.has(season)) {
        console.warn(`  [${song.title}] Unknown season "${season}" — skipping.`);
        stats.skipped++;
        continue;
      }

      // Skip "general" — not meaningful to store
      if (fn === "general") {
        stats.skipped++;
        continue;
      }

      const existing = song.functions ?? [];
      if (existing.includes(fn)) {
        stats.skipped++;
        continue;
      }

      const newFunctions = [...existing, fn];

      if (sampleChanges.length < 40) {
        sampleChanges.push({ title: song.title, fn, season });
      }

      if (!isDryRun) {
        const { error } = await supabase
          .from("songs")
          .update({ functions: newFunctions })
          .eq("id", song.id);

        if (error) {
          console.error(`  Error updating "${song.title}": ${error.message}`);
          stats.songErrors++;
        } else {
          stats.functionsAdded++;
        }
      } else {
        stats.functionsAdded++;
      }
    }

    console.log(
      `  Batch ${batchNum} done. Running total: ${stats.functionsAdded} functions added, ${stats.batchErrors} batch errors.`
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
  console.log(`Skipped (general/dup) : ${stats.skipped}`);
  console.log(`Batch errors          : ${stats.batchErrors}`);
  console.log(`Song write errors     : ${stats.songErrors}`);

  if (sampleChanges.length > 0) {
    console.log(`\nSample changes (first ${Math.min(sampleChanges.length, 40)}):`);
    for (const c of sampleChanges) {
      const titlePad = c.title.substring(0, 42).padEnd(44);
      const seasonNote = c.season !== "any" ? ` [${c.season}]` : "";
      console.log(`  ${titlePad} +${c.fn}${seasonNote}`);
    }
  }

  if (isDryRun) {
    console.log("\n[DRY RUN] No data written. Use --execute to apply.");
  } else {
    console.log("\nDone.");
  }
}

main().catch(console.error);
