import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/songs/[id]/ranking — Upsert ranking for current user
 * Body: { ranking: 1-5, notes?: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { ranking, notes } = body;

  if (!ranking || ranking < 1 || ranking > 5) {
    return NextResponse.json({ error: "Rating must be 1-5" }, { status: 400 });
  }

  // Get current user
  const supabaseAuth = await createClient();
  const { data: { user } } = await supabaseAuth.auth.getUser();

  // In development, use a placeholder user ID
  const userId = user?.id || "00000000-0000-0000-0000-000000000000";

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

  // Upsert ranking
  const { data, error } = await supabase
    .from("song_rankings")
    .upsert(
      {
        song_id: song.id,
        user_id: userId,
        ranking,
        notes: notes || null,
      },
      { onConflict: "song_id,user_id" }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
