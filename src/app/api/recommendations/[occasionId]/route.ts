import { NextRequest, NextResponse } from "next/server";
import { getOccasion } from "@/lib/data";
import { getSongLibrary } from "@/lib/song-library";
import { recommendForOccasion } from "@/lib/recommendations";
import { createAdminClient } from "@/lib/supabase/admin";

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

  const allSongs = getSongLibrary();
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
