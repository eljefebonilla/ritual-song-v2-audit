/**
 * Infer liturgical functions for songs that are missing them.
 * Uses title patterns, topic tags, and category to assign functions
 * with high confidence. Never removes existing functions.
 *
 * Usage:
 *   npx tsx scripts/infer-song-functions.ts              # dry-run
 *   npx tsx scripts/infer-song-functions.ts --execute     # write to Supabase
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

// ----- Inference Rules -----

interface InferredFunction {
  fn: string;
  reason: string;
}

const TITLE_RULES: Array<{ pattern: RegExp; fn: string }> = [
  // Communion (expanded from Grok swarm audit)
  { pattern: /\bbread of life\b/i, fn: "communion" },
  { pattern: /\bbread of the world\b/i, fn: "communion" },
  { pattern: /\btable of plenty\b/i, fn: "communion" },
  { pattern: /\bbody of christ\b/i, fn: "communion" },
  { pattern: /\bcup of\b/i, fn: "communion" },
  { pattern: /\bone bread\b/i, fn: "communion" },
  { pattern: /\btaste and see\b/i, fn: "communion" },
  { pattern: /\beat this bread\b/i, fn: "communion" },
  { pattern: /\bbread.+broken\b/i, fn: "communion" },
  { pattern: /\bdraw near\b/i, fn: "communion" },
  { pattern: /\bcome to (the|your) (table|feast|banquet)\b/i, fn: "communion" },
  { pattern: /\bblessed and broken\b/i, fn: "communion" },
  { pattern: /\bbread.+wine\b/i, fn: "communion" },
  { pattern: /\beucharist\b/i, fn: "communion" },
  { pattern: /\bcommunion hymn\b/i, fn: "communion" },
  { pattern: /\badoro te devote\b/i, fn: "communion" },
  { pattern: /\bave verum\b/i, fn: "communion" },
  { pattern: /\bwho hunger\b/i, fn: "communion" },
  { pattern: /\bgift of finest wheat\b/i, fn: "communion" },
  { pattern: /\bbreaking of the bread\b/i, fn: "communion" },
  { pattern: /\bpan de vida\b/i, fn: "communion" },
  { pattern: /\bseed.+scattered\b/i, fn: "communion" },
  { pattern: /\btake and eat\b/i, fn: "communion" },
  { pattern: /\bpartir el pan\b/i, fn: "communion" },
  { pattern: /\bbreak this bread\b/i, fn: "communion" },
  { pattern: /\bwe come to your feast\b/i, fn: "communion" },
  { pattern: /\baltar of\b/i, fn: "communion" },
  // Gathering
  { pattern: /\bgather us\b/i, fn: "gathering" },
  { pattern: /\bgather your people\b/i, fn: "gathering" },
  { pattern: /\bgather together\b/i, fn: "gathering" },
  { pattern: /\bwe gather\b/i, fn: "gathering" },
  { pattern: /\ball are welcome\b/i, fn: "gathering" },
  { pattern: /\bcome.*worship\b/i, fn: "gathering" },
  { pattern: /\blet us enter\b/i, fn: "gathering" },
  { pattern: /\bintroit\b/i, fn: "gathering" },
  { pattern: /\bgathering song\b/i, fn: "gathering" },
  { pattern: /\bgather us in\b/i, fn: "gathering" },
  // Sending
  { pattern: /\bgo forth\b/i, fn: "sending" },
  { pattern: /\bgo.*in peace\b/i, fn: "sending" },
  { pattern: /\byou are sent\b/i, fn: "sending" },
  { pattern: /\bsend (us|me)\b/i, fn: "sending" },
  { pattern: /\bgo.*to all the world\b/i, fn: "sending" },
  { pattern: /\bwe are called\b/i, fn: "sending" },
  { pattern: /\bgo make a difference\b/i, fn: "sending" },
  { pattern: /\bgreat commission\b/i, fn: "sending" },
  { pattern: /\blet us go rejoicing\b/i, fn: "sending" },
  // Offertory
  { pattern: /\boffering\b/i, fn: "offertory" },
  { pattern: /\btake.*receive\b/i, fn: "offertory" },
  { pattern: /\bperfect sacrifice\b/i, fn: "offertory" },
];

const TOPIC_RULES: Array<{ topics: string[]; fn: string }> = [
  { topics: ["Eucharist", "First Communion"], fn: "communion" },
  { topics: ["Jesus Christ/Blood"], fn: "communion" },
  { topics: ["Gathering"], fn: "gathering" },
  { topics: ["Sending Forth", "Commissioning"], fn: "sending" },
  { topics: ["Offering"], fn: "offertory" },
];

function inferFunctions(
  title: string,
  topics: string[],
  category: string | null,
  existingFunctions: string[]
): InferredFunction[] {
  const existing = new Set(existingFunctions);
  const inferred: InferredFunction[] = [];
  const added = new Set<string>();

  // Tier 1: Title patterns
  for (const rule of TITLE_RULES) {
    if (rule.pattern.test(title) && !existing.has(rule.fn) && !added.has(rule.fn)) {
      inferred.push({ fn: rule.fn, reason: `title: "${title}" matches /${rule.pattern.source}/` });
      added.add(rule.fn);
    }
  }

  // Tier 2: Topic inference (skip communion inference for gospel acclamation category)
  for (const rule of TOPIC_RULES) {
    if (added.has(rule.fn) || existing.has(rule.fn)) continue;
    if (rule.fn === "communion" && (category === "gospel_acclamation" || category === "gospel_acclamation_refrain" || category === "mass_part")) continue;
    const match = topics.find((t) => rule.topics.includes(t));
    if (match) {
      inferred.push({ fn: rule.fn, reason: `topic: "${match}"` });
      added.add(rule.fn);
    }
  }

  // Tier 3: Category-derived
  if (category === "psalm" && !existing.has("psalm") && !added.has("psalm")) {
    inferred.push({ fn: "psalm", reason: "category: psalm" });
    added.add("psalm");
  }
  if (
    (category === "gospel_acclamation" || category === "gospel_acclamation_refrain") &&
    !existing.has("gospel_acclamation") &&
    !added.has("gospel_acclamation")
  ) {
    inferred.push({ fn: "gospel_acclamation", reason: `category: ${category}` });
    added.add("gospel_acclamation");
  }

  return inferred;
}

// ----- Main -----

async function main() {
  console.log(isDryRun ? "=== DRY RUN ===" : "=== EXECUTING ===");

  // Load all songs from Supabase
  const allSongs: Array<{
    id: string;
    legacy_id: string;
    title: string;
    category: string | null;
    topics: string[] | null;
    functions: string[] | null;
  }> = [];

  let offset = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from("songs")
      .select("id, legacy_id, title, category, topics, functions")
      .range(offset, offset + pageSize - 1)
      .order("title");
    if (error) { console.error("Fetch error:", error.message); break; }
    if (!data || data.length === 0) break;
    allSongs.push(...data);
    if (data.length < pageSize) break;
    offset += pageSize;
  }

  console.log(`Loaded ${allSongs.length} songs from Supabase`);

  // Process
  const updates: Array<{ id: string; title: string; newFunctions: string[]; reasons: string[] }> = [];
  const stats: Record<string, number> = {};

  for (const song of allSongs) {
    const existing = song.functions || [];
    const topics = song.topics || [];
    const inferred = inferFunctions(song.title, topics, song.category, existing);
    if (inferred.length === 0) continue;

    const newFunctions = [...existing, ...inferred.map((i) => i.fn)];
    updates.push({
      id: song.id,
      title: song.title,
      newFunctions,
      reasons: inferred.map((i) => `+${i.fn} (${i.reason})`),
    });

    for (const i of inferred) {
      stats[i.fn] = (stats[i.fn] || 0) + 1;
    }
  }

  // Report
  console.log(`\n=== RESULTS ===`);
  console.log(`Songs to update: ${updates.length}`);
  for (const [fn, count] of Object.entries(stats).sort((a, b) => b[1] - a[1])) {
    console.log(`  +${fn}: ${count} songs`);
  }

  // Show sample
  console.log(`\nSample (first 30):`);
  for (const u of updates.slice(0, 30)) {
    console.log(`  ${u.title.substring(0, 40).padEnd(42)} ${u.reasons.join(", ")}`);
  }

  if (isDryRun) {
    console.log(`\n[DRY RUN] No data written. Use --execute to apply.`);
    return;
  }

  // Write to Supabase
  console.log(`\nWriting ${updates.length} updates...`);
  let written = 0;
  let errors = 0;
  const batchSize = 50;

  for (let i = 0; i < updates.length; i += batchSize) {
    const batch = updates.slice(i, i + batchSize);
    for (const u of batch) {
      const { error } = await supabase
        .from("songs")
        .update({ functions: u.newFunctions })
        .eq("id", u.id);
      if (error) {
        console.error(`  Error updating "${u.title}": ${error.message}`);
        errors++;
      } else {
        written++;
      }
    }
    if ((i + batchSize) % 200 === 0) console.log(`  ${written} written...`);
  }

  console.log(`\nDone. Written: ${written}, Errors: ${errors}`);
}

main().catch(console.error);
