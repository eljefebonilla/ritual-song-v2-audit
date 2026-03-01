import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/songs/[id]/visibility — Toggle visibility for current user
 * Body: { isHidden: boolean }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { isHidden } = body;

  // Get current user
  const supabaseAuth = await createClient();
  const { data: { user } } = await supabaseAuth.auth.getUser();

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

  if (isHidden) {
    // Upsert hidden status
    const { error } = await supabase
      .from("song_visibility")
      .upsert(
        { song_id: song.id, user_id: userId, is_hidden: true },
        { onConflict: "song_id,user_id" }
      );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } else {
    // Remove hidden status
    await supabase
      .from("song_visibility")
      .delete()
      .eq("song_id", song.id)
      .eq("user_id", userId);
  }

  return NextResponse.json({ success: true, isHidden: !!isHidden });
}
