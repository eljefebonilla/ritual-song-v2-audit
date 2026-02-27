import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSongById } from "@/lib/song-library";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { type, label, url, source } = body;

    if (!type || !label) {
      return NextResponse.json(
        { error: "type and label are required" },
        { status: 400 }
      );
    }

    // Validate song exists
    const song = getSongById(id);
    if (!song) {
      return NextResponse.json({ error: "Song not found" }, { status: 404 });
    }

    // Determine source from URL or explicit source
    let resolvedSource = source || "manual";
    if (url && (url.includes("youtube.com") || url.includes("youtu.be"))) {
      resolvedSource = "youtube";
    }

    const supabase = createAdminClient();

    const { data: resource, error: insertError } = await supabase
      .from("song_resources")
      .insert({
        song_id: id,
        type,
        label,
        url: url || null,
        source: resolvedSource,
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({
      resource: {
        id: resource.id,
        type: resource.type,
        label: resource.label,
        url: resource.url,
        source: resource.source,
        isHighlighted: resource.is_highlighted,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to add resource" },
      { status: 500 }
    );
  }
}
