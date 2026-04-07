/**
 * Batch pre-compute song recommendations for all occasions.
 * Uses the full scoring engine with semantic similarity, NPM scripture,
 * and function/season/topic matching. Writes to song_recommendations table.
 *
 * Usage:
 *   npx tsx scripts/precompute-recommendations.ts              # dry-run
 *   npx tsx scripts/precompute-recommendations.ts --execute     # write to Supabase
 *   npx tsx scripts/precompute-recommendations.ts --execute --occasion easter-sunday
 */

import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.join(__dirname, "..", ".env.local") });

import { createClient } from "@supabase/supabase-js";
import { getAllOccasions, getOccasion } from "../src/lib/data";
import { loadSongLibrary } from "../src/lib/song-library";
import { rankSongs } from "../src/tools/recommendation/scoring";
import type { NpmScriptureMatch } from "../src/tools/recommendation/scoring";
import { DEFAULT_RECOMMENDATION_WEIGHTS } from "../src/runtime/types";
import { getScriptureSongsForOccasion } from "../src/lib/supabase/scripture-mappings";
import { findSimilarSongsByLegacyId } from "../src/lib/supabase/song-embeddings";

const isDryRun = !process.argv.includes("--execute");
const targetOccasion = process.argv.find((a, i) => process.argv[i - 1] === "--occasion");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const POSITIONS = [
  "gathering", "offertory", "communion1", "communion2",
  "sending", "prelude", "psalm", "gospelAcclamation",
];
const RECS_PER_POSITION = 10;

async function main() {
  console.log(`\n=== Recommendation Pre-compute ===`);
  console.log(`Mode: ${isDryRun ? "DRY RUN" : "EXECUTE"}`);

  const allSongs = await loadSongLibrary();
  const candidates = allSongs.map((s) => ({
    id: s.id,
    title: s.title,
    composer: s.composer,
    category: s.category,
    scriptureRefs: s.scriptureRefs,
    topics: s.topics,
    liturgicalUse: s.liturgicalUse,
    occasions: s.occasions,
    functions: s.functions,
    isHiddenGlobal: s.isHiddenGlobal,
  }));

  // Build legacy_id -> UUID map for writing to song_recommendations (which uses UUID song_id)
  const PAGE = 1000;
  const legacyToUuid = new Map<string, string>();
  let offset = 0;
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

  const occasions = targetOccasion
    ? [{ id: targetOccasion }]
    : getAllOccasions();

  console.log(`Occasions to process: ${occasions.length}`);
  console.log(`Songs in library: ${allSongs.length}`);
  console.log(`Legacy->UUID mappings: ${legacyToUuid.size}\n`);

  let processed = 0;
  let totalRecs = 0;
  let failed = 0;

  for (const occ of occasions) {
    const occasion = getOccasion(occ.id);
    if (!occasion || !occasion.readings || occasion.readings.length === 0) {
      continue;
    }

    const readings = occasion.readings.map((r) => ({
      citation: r.citation,
      summary: r.summary,
    }));

    // Fetch semantic similarity + NPM scripture
    const [similarityMap, scriptureMappings] = await Promise.all([
      findSimilarSongsByLegacyId(supabase, readings),
      getScriptureSongsForOccasion(occ.id),
    ]);

    const npmMap = new Map<string, NpmScriptureMatch[]>();
    for (const m of scriptureMappings) {
      if (!m.legacyId) continue;
      if (!npmMap.has(m.legacyId)) npmMap.set(m.legacyId, []);
      npmMap.get(m.legacyId)!.push({
        readingType: m.readingType,
        readingReference: m.readingReference,
        matchedVerseLabel: m.matchedVerseLabel,
        matchedVerseExcerpt: m.matchedVerseExcerpt,
      });
    }

    const rows: {
      occasion_id: string;
      position: string;
      song_id: string;
      score: number;
      match_reasons: string[];
    }[] = [];

    const usedSongIds = new Set<string>();

    for (const pos of POSITIONS) {
      const results = rankSongs(
        candidates,
        {
          occasionId: occ.id,
          position: pos,
          season: occasion.season,
          readings,
          excludeSongIds: [...usedSongIds],
          limit: RECS_PER_POSITION,
        },
        new Map(),
        DEFAULT_RECOMMENDATION_WEIGHTS,
        undefined,
        npmMap,
        similarityMap
      );

      for (const r of results) {
        const uuid = legacyToUuid.get(r.songId);
        if (!uuid) continue;
        rows.push({
          occasion_id: occ.id,
          position: pos,
          song_id: uuid,
          score: r.score,
          match_reasons: r.reasons.map((reason) => reason.explanation || reason.detail),
        });
      }

      if (results.length > 0) {
        usedSongIds.add(results[0].songId);
      }
    }

    if (!isDryRun && rows.length > 0) {
      // Delete old recommendations for this occasion, then insert new
      await supabase
        .from("song_recommendations")
        .delete()
        .eq("occasion_id", occ.id);

      const { error } = await supabase
        .from("song_recommendations")
        .insert(rows);

      if (error) {
        console.error(`  ERROR ${occ.id}: ${error.message}`);
        failed++;
      }
    }

    totalRecs += rows.length;
    processed++;

    if (processed % 20 === 0 || targetOccasion) {
      const semHits = rows.filter((r) =>
        r.match_reasons.some((reason) => reason.includes("thematic match"))
      ).length;
      console.log(
        `  ${occ.id}: ${rows.length} recs (${semHits} with semantic similarity)`
      );
    }

    // Rate limit for embedding API
    await new Promise((r) => setTimeout(r, 300));
  }

  console.log(`\nDone! Processed: ${processed} occasions, ${totalRecs} total recommendations, ${failed} failed`);
}

main().catch(console.error);
