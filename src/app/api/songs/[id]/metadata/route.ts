import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/songs/[id]/metadata — Get song metadata (lyrics, alleluia flag)
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("song_metadata")
    .select("*")
    .eq("song_id", id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || { song_id: id, has_alleluia: false, lyrics_text: null, lyrics_source: null });
}

/**
 * PUT /api/songs/[id]/metadata — Update song metadata (admin only)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const body = await request.json();
  const supabase = createAdminClient();

  // Auto-detect alleluia in lyrics
  const lyricsText: string | null = body.lyrics_text ?? null;
  let hasAlleluia = body.has_alleluia ?? false;

  if (lyricsText) {
    const lower = lyricsText.toLowerCase();
    if (lower.includes("alleluia") || lower.includes("hallelujah")) {
      hasAlleluia = true;
    }
  }

  const { data, error } = await supabase
    .from("song_metadata")
    .upsert(
      {
        song_id: id,
        lyrics_text: lyricsText,
        has_alleluia: hasAlleluia,
        lyrics_source: body.lyrics_source || "manual",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "song_id" }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
