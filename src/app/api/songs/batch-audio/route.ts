import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/songs/batch-audio?ids=id1,id2,id3
 * Returns { [songId]: audioUrl } for any songs that have uploaded audio resources.
 */
export async function GET(request: NextRequest) {
  const idsParam = request.nextUrl.searchParams.get("ids");
  if (!idsParam) {
    return NextResponse.json({ audioUrls: {} });
  }

  const ids = idsParam.split(",").filter(Boolean);
  if (ids.length === 0) {
    return NextResponse.json({ audioUrls: {} });
  }

  try {
    const supabase = createAdminClient();

    const { data: rows, error } = await supabase
      .from("song_resources")
      .select("song_id, type, url")
      .in("song_id", ids)
      .in("type", ["audio", "practice_track"])
      .not("url", "is", null)
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // First audio resource per song wins
    const audioUrls: Record<string, string> = {};
    for (const row of rows || []) {
      if (!audioUrls[row.song_id] && row.url) {
        audioUrls[row.song_id] = row.url;
      }
    }

    return NextResponse.json({ audioUrls });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch audio URLs" },
      { status: 500 }
    );
  }
}
