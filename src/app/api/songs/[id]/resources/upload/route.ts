import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin";
import { createAdminClient, resolveSongUuid } from "@/lib/supabase/admin";
import { getSongById } from "@/lib/song-library";
import type { SongResourceType } from "@/lib/types";
import path from "path";

function sanitizeForStorage(str: string): string {
  return str
    .replace(/[^\w\s.-]/g, "")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 120);
}

function classifyByExtension(ext: string): SongResourceType {
  const lower = ext.toLowerCase();
  if ([".mp3", ".wav", ".m4a", ".aif", ".aiff", ".ogg", ".flac"].includes(lower)) return "audio";
  if ([".pdf"].includes(lower)) return "sheet_music";
  if ([".musx", ".mxl", ".musicxml", ".sib"].includes(lower)) return "notation";
  if ([".txt"].includes(lower)) return "lyrics";
  if ([".png", ".jpg", ".jpeg", ".gif", ".tif", ".tiff"].includes(lower)) return "sheet_music";
  return "other";
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const label = formData.get("label") as string | null;
    const type = formData.get("type") as string | null;

    if (!file || !label) {
      return NextResponse.json(
        { error: "file and label are required" },
        { status: 400 }
      );
    }

    // Validate song exists
    const song = getSongById(id);
    if (!song) {
      return NextResponse.json({ error: "Song not found" }, { status: 404 });
    }

    const supabase = createAdminClient();

    const songUuid = await resolveSongUuid(supabase, id);
    if (!songUuid) {
      return NextResponse.json({ error: "Song not found in database" }, { status: 404 });
    }

    // Build filename (sanitized for Supabase Storage)
    const ext = path.extname(file.name);
    const safeName = sanitizeForStorage(
      song.composer ? `${song.title} - ${song.composer}` : song.title
    );
    const safeLabel = sanitizeForStorage(label);
    const storagePath = `${id}/${safeName}_${safeLabel}${ext}`;

    // Check for duplicate
    const { data: existing } = await supabase
      .from("song_resources_v2")
      .select("id")
      .eq("song_id", songUuid)
      .eq("storage_path", storagePath)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: "Resource already exists", id: existing.id }, { status: 409 });
    }

    // Upload to Supabase Storage
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await supabase.storage
      .from("song-resources")
      .upload(storagePath, buffer, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("song-resources")
      .getPublicUrl(storagePath);

    const resolvedType: SongResourceType =
      (type as SongResourceType) || classifyByExtension(ext);

    const isHighlighted = label.toUpperCase().includes("AIM") || undefined;

    // Insert metadata into DB
    const { data: resource, error: insertError } = await supabase
      .from("song_resources_v2")
      .insert({
        song_id: songUuid,
        type: resolvedType,
        label,
        url: urlData.publicUrl,
        storage_path: storagePath,
        source: "supabase",
        is_highlighted: isHighlighted || false,
      })
      .select()
      .single();

    if (insertError) {
      // Clean up uploaded file on DB failure
      await supabase.storage.from("song-resources").remove([storagePath]);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // Return in SongResource shape for frontend compatibility
    return NextResponse.json({
      resource: {
        id: resource.id,
        type: resource.type,
        label: resource.label,
        url: resource.url,
        storagePath: resource.storage_path,
        source: resource.source,
        isHighlighted: resource.is_highlighted,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
