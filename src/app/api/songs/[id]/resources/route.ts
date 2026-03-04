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
    const { type, label, url, source, storagePath, tags, visibility } = body;

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
    if (storagePath) {
      resolvedSource = "supabase";
    } else if (url && (url.includes("youtube.com") || url.includes("youtu.be"))) {
      resolvedSource = "youtube";
    }

    // If storagePath provided (direct upload), derive public URL
    let resolvedUrl = url || null;
    if (storagePath && !resolvedUrl) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (supabaseUrl) {
        resolvedUrl = `${supabaseUrl}/storage/v1/object/public/song-resources/${storagePath}`;
      }
    }

    // Determine isHighlighted from tags or label
    const resolvedTags: string[] = Array.isArray(tags) ? tags : [];
    const isHighlighted =
      resolvedTags.includes("AIM") || label.toUpperCase().includes("AIM") || undefined;

    const supabase = createAdminClient();

    const insertData: Record<string, unknown> = {
      song_id: id,
      type,
      label,
      url: resolvedUrl,
      storage_path: storagePath || null,
      source: resolvedSource,
      is_highlighted: isHighlighted || false,
    };

    // Only include tags/visibility if provided (avoids errors before migration runs)
    if (resolvedTags.length > 0) {
      insertData.tags = resolvedTags;
    }
    if (visibility && (visibility === "all" || visibility === "admin")) {
      insertData.visibility = visibility;
    }

    const { data: resource, error: insertError } = await supabase
      .from("song_resources")
      .insert(insertData)
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
        storagePath: resource.storage_path,
        source: resource.source,
        isHighlighted: resource.is_highlighted,
        tags: resource.tags || [],
        visibility: resource.visibility || "all",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to add resource" },
      { status: 500 }
    );
  }
}
