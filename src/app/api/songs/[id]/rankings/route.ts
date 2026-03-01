import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/songs/[id]/rankings — Get all admin rankings for a song
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createAdminClient();

  // Look up song UUID from legacy_id
  const { data: song } = await supabase
    .from("songs")
    .select("id")
    .eq("legacy_id", id)
    .single();

  if (!song) {
    return NextResponse.json({ error: "Song not found" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("song_rankings")
    .select("ranking, notes, user_id, created_at")
    .eq("song_id", song.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rankings = data || [];
  const avg = rankings.length > 0
    ? rankings.reduce((sum: number, r: { ranking: number }) => sum + r.ranking, 0) / rankings.length
    : 0;

  return NextResponse.json({
    rankings,
    average: Math.round(avg * 10) / 10,
    count: rankings.length,
  });
}
