import { NextRequest, NextResponse } from "next/server";
import { getOccasion } from "@/lib/data";
import { getSongLibrary, loadSongLibrary } from "@/lib/song-library";
import { recommendForOccasion } from "@/lib/recommendations";
import { createAdminClient } from "@/lib/supabase/admin";
import { getScriptureSongsForOccasion } from "@/lib/supabase/scripture-mappings";
import {
  ConversationRuntime,
  LayeredConfig,
  PermissionPolicy,
  DEFAULT_PERMISSION_RULES,
} from "@/runtime";
import { createRecommendationTools } from "@/tools/recommendation";
import type { NpmScriptureMatch } from "@/tools/recommendation/scoring";

interface SlimRec {
  id: string;
  title: string;
  composer?: string;
  score: number;
  reasons: string[];
}

/**
 * GET /api/recommendations/[occasionId]
 * Returns song recommendations for all positions of an occasion.
 *
 * Fast path: reads from pre-computed song_recommendations table.
 * Fallback: runs the recommendation engine live.
 *
 * Optional query params: ?limit=5&exclude=songId1,songId2&live=true
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ occasionId: string }> }
) {
  const { occasionId } = await params;
  const searchParams = request.nextUrl.searchParams;
  const limit = parseInt(searchParams.get("limit") || "5", 10);
  const forceLive = searchParams.get("live") === "true";

  // Try pre-computed recommendations first (unless live mode requested)
  if (!forceLive) {
    const cached = await getCachedRecommendations(occasionId, limit);
    if (cached && Object.keys(cached).length > 0) {
      return NextResponse.json(cached);
    }
  }

  // Fallback: compute live
  const occasion = getOccasion(occasionId);
  if (!occasion) {
    return NextResponse.json(
      { error: `Occasion not found: ${occasionId}` },
      { status: 404 }
    );
  }

  const excludeRaw = searchParams.get("exclude") || "";
  const excludeSongIds = excludeRaw ? excludeRaw.split(",").filter(Boolean) : [];

  const allSongs = await loadSongLibrary();
  const recommendations = recommendForOccasion(occasion, allSongs, {
    limit,
    excludeSongIds,
  });

  // Slim down the response
  const slimmed: Record<string, SlimRec[]> = {};
  for (const [position, recs] of Object.entries(recommendations)) {
    slimmed[position] = recs.map((r) => ({
      id: r.song.id,
      title: r.song.title,
      composer: r.song.composer,
      score: r.score,
      reasons: r.reasons,
    }));
  }

  return NextResponse.json(slimmed);
}

/**
 * Read pre-computed recommendations from Supabase.
 */
async function getCachedRecommendations(
  occasionId: string,
  limit: number
): Promise<Record<string, SlimRec[]> | null> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("song_recommendations")
      .select("position, score, match_reasons, songs!inner(legacy_id, title, composer)")
      .eq("occasion_id", occasionId)
      .order("score", { ascending: false });

    if (error || !data || data.length === 0) return null;

    const result: Record<string, SlimRec[]> = {};
    for (const row of data) {
      const pos = row.position;
      if (!result[pos]) result[pos] = [];
      if (result[pos].length >= limit) continue;

      const song = row.songs as unknown as { legacy_id: string; title: string; composer: string | null };
      result[pos].push({
        id: song.legacy_id,
        title: song.title,
        composer: song.composer || undefined,
        score: row.score,
        reasons: (row.match_reasons as string[]) || [],
      });
    }

    return result;
  } catch {
    return null;
  }
}

/**
 * POST /api/recommendations/[occasionId]
 * Runtime-powered recommendation engine (Section 16 architecture).
 * Uses ConversationRuntime + configurable weights + usage metadata.
 *
 * Body: { position, limit?, excludeSongIds? }
 * Returns: ScoredSong[] with reasons, weeksSinceUsed, weeksUntilNext
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ occasionId: string }> }
) {
  const { occasionId } = await params;
  const body = await request.json();
  const {
    position,
    limit = 8,
    excludeSongIds = [],
    explain: explainSongId,
  } = body;

  if (!position) {
    return NextResponse.json(
      { error: "position is required (e.g. gathering, psalm, communion1)" },
      { status: 400 }
    );
  }

  // 1. Build layered config (single-tenant for now, multi-parish ready)
  const config = LayeredConfig.forContext({ maxTokens: 128_000 });

  // 2. Permissions
  const permissions = new PermissionPolicy("allow");
  permissions.setRules(DEFAULT_PERMISSION_RULES);

  // 3. Register recommendation tools
  const tools = new Map();
  for (const tool of createRecommendationTools()) {
    tools.set(tool.name, tool);
  }

  // 4. Create runtime
  const runtime = new ConversationRuntime(config, permissions, tools);

  // 5. Load occasion data
  const occasion = getOccasion(occasionId);
  if (!occasion) {
    return NextResponse.json(
      { error: `Occasion not found: ${occasionId}` },
      { status: 404 }
    );
  }

  // 6. Load songs
  const allSongs = await loadSongLibrary();

  // 7. Fetch usage records from Supabase (if table exists)
  let usageRecords: Array<{
    songId: string;
    lastUsedDate: string;
    nextScheduledDate: string | null;
    timesUsedThisYear: number;
  }> = [];

  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("song_usage")
      .select("song_id, last_used_date, next_scheduled_date, times_used_this_year");

    if (data) {
      usageRecords = data.map((r: Record<string, unknown>) => ({
        songId: r.song_id as string,
        lastUsedDate: r.last_used_date as string,
        nextScheduledDate: (r.next_scheduled_date as string) ?? null,
        timesUsedThisYear: (r.times_used_this_year as number) ?? 0,
      }));
    }
  } catch {
    // song_usage table may not exist yet. Proceed without usage data.
  }

  // 8. Build candidate list from song library (include functions for slot-aware scoring)
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

  // 9. Fetch NPM scripture mappings for this occasion
  const scriptureMappings = await getScriptureSongsForOccasion(occasionId);
  const npmScriptureMap: Record<string, NpmScriptureMatch[]> = {};
  for (const m of scriptureMappings) {
    const key = m.legacyId;
    if (!key) continue;
    if (!npmScriptureMap[key]) npmScriptureMap[key] = [];
    npmScriptureMap[key].push({
      readingType: m.readingType,
      readingReference: m.readingReference,
      matchedVerseLabel: m.matchedVerseLabel,
      matchedVerseExcerpt: m.matchedVerseExcerpt,
    });
  }

  // 10. Run the recommendation tool via runtime
  const toolResult = await runtime.executeTool({
    name: "recommendation.score",
    args: {
      occasionId,
      position,
      season: occasion.season,
      readings: (occasion.readings || []).map((r) => ({
        citation: r.citation,
        summary: r.summary,
      })),
      candidates,
      usageRecords,
      excludeSongIds,
      limit,
      npmScriptureMap,
    },
  });

  if (toolResult.error) {
    return NextResponse.json({ error: toolResult.error }, { status: 500 });
  }

  const scoredSongs = toolResult.output as Array<Record<string, unknown>>;

  // If explain requested, run the explain tool for the specific song
  if (explainSongId) {
    const explainResult = await runtime.executeTool({
      name: "recommendation.explain",
      args: {
        songId: explainSongId,
        results: scoredSongs,
      },
    });

    return NextResponse.json({
      recommendations: scoredSongs,
      explanation: explainResult.error ? null : explainResult.output,
    });
  }

  return NextResponse.json(scoredSongs);
}
