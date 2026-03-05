import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, resolveSongUuid } from "@/lib/supabase/admin";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const supabase = createAdminClient();

    const songUuid = await resolveSongUuid(supabase, id);
    if (!songUuid) {
      return NextResponse.json({ resources: [] });
    }

    const { data: rows, error } = await supabase
      .from("song_resources_v2")
      .select("id, type, label, url, storage_path, source, is_highlighted, tags, visibility")
      .eq("song_id", songUuid)
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Map to SongResource shape
    const resources = (rows || []).map((r) => ({
      id: r.id,
      type: r.type,
      label: r.label,
      url: r.url,
      storagePath: r.storage_path,
      source: r.source,
      isHighlighted: r.is_highlighted,
      tags: r.tags || [],
      visibility: r.visibility || "all",
    }));

    return NextResponse.json({ resources });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch resources" },
      { status: 500 }
    );
  }
}
