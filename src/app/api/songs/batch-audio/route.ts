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

    // Query song_resources_v2 for audio with Supabase URLs or storage paths
    const { data: rows, error } = await supabase
      .from("song_resources_v2")
      .select("song_id, type, url, storage_path")
      .in("song_id", ids)
      .in("type", ["audio", "practice_track"])
      .order("created_at", { ascending: true });

    if (error) {
      // Fallback to legacy table
      const { data: legacyRows, error: legacyError } = await supabase
        .from("song_resources")
        .select("song_id, type, url")
        .in("song_id", ids)
        .in("type", ["audio", "practice_track"])
        .not("url", "is", null)
        .order("created_at", { ascending: true });

      if (legacyError) {
        return NextResponse.json({ error: legacyError.message }, { status: 500 });
      }

      const audioUrls: Record<string, string> = {};
      for (const row of legacyRows || []) {
        if (!audioUrls[row.song_id] && row.url) {
          audioUrls[row.song_id] = row.url;
        }
      }
      return NextResponse.json({ audioUrls });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    // First audio resource per song wins. Prefer resources with URLs.
    const audioUrls: Record<string, string> = {};
    for (const row of rows || []) {
      if (audioUrls[row.song_id]) continue;
      if (row.url) {
        audioUrls[row.song_id] = row.url;
      } else if (row.storage_path && supabaseUrl) {
        audioUrls[row.song_id] = `${supabaseUrl}/storage/v1/object/public/song-resources/${row.storage_path}`;
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
