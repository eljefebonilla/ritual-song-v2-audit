import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, resolveSongUuids } from "@/lib/supabase/admin";

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

    // Resolve legacy IDs to UUIDs for v2 query
    const uuidMap = await resolveSongUuids(supabase, ids);
    const uuids = [...uuidMap.values()];
    // Reverse map: uuid → legacyId (for response keys)
    const uuidToLegacy = new Map<string, string>();
    for (const [legacy, uuid] of uuidMap) uuidToLegacy.set(uuid, legacy);

    if (uuids.length === 0) {
      return NextResponse.json({ audioUrls: {} });
    }

    // Query song_resources_v2 for audio with Supabase URLs or storage paths
    const { data: rows, error } = await supabase
      .from("song_resources_v2")
      .select("song_id, type, url, storage_path")
      .in("song_id", uuids)
      .in("type", ["audio", "practice_track"])
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    // First audio resource per song wins. Map back to legacy IDs for frontend.
    const audioUrls: Record<string, string> = {};
    for (const row of rows || []) {
      const legacyId = uuidToLegacy.get(row.song_id);
      if (!legacyId || audioUrls[legacyId]) continue;
      if (row.url) {
        audioUrls[legacyId] = row.url;
      } else if (row.storage_path && supabaseUrl) {
        audioUrls[legacyId] = `${supabaseUrl}/storage/v1/object/public/song-resources/${row.storage_path}`;
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
