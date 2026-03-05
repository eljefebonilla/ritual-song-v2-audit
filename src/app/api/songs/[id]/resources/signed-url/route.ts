import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin";
import { createAdminClient, resolveSongUuid } from "@/lib/supabase/admin";
import { getSongById } from "@/lib/song-library";
import { buildStorageName, FILE_TYPE_TAG_IDS } from "@/lib/resource-tags";

/**
 * Sanitize a string for use as a Supabase Storage key.
 * Keeps alphanumeric, hyphens, underscores, dots. Replaces everything else.
 */
function sanitizeForStorage(str: string): string {
  return str
    .replace(/[^\w\s.-]/g, "")   // strip special chars (•, &, etc.)
    .replace(/\s+/g, "_")        // spaces → underscores
    .replace(/_+/g, "_")         // collapse multiple underscores
    .slice(0, 120);              // cap length
}

/**
 * Generate a signed upload URL for direct browser-to-Supabase upload.
 * Bypasses Vercel's 4.5 MB body size limit for serverless functions.
 *
 * Accepts either:
 *   - { tags, fileName } — new tag-based upload (auto-generates storage name)
 *   - { label, fileName } — legacy upload (uses label for storage path)
 */
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
    const { fileName, tags, label } = body;

    if (!fileName || (!tags && !label)) {
      return NextResponse.json(
        { error: "fileName and either tags or label are required" },
        { status: 400 }
      );
    }

    const song = getSongById(id);
    if (!song) {
      return NextResponse.json({ error: "Song not found" }, { status: 404 });
    }

    const ext = fileName.includes(".") ? fileName.slice(fileName.lastIndexOf(".")) : "";

    let storagePath: string;

    if (tags && Array.isArray(tags) && tags.length > 0) {
      // New tag-based path: {songId}/{Title}_{Composer}_{TAG}_{MODIFIER}.ext
      const typeTag = tags.find((t: string) => FILE_TYPE_TAG_IDS.includes(t));
      const modifiers = tags.filter((t: string) => !FILE_TYPE_TAG_IDS.includes(t));
      const storageName = buildStorageName(
        song.title,
        song.composer,
        typeTag || "FILE",
        modifiers,
        ext,
      );
      storagePath = `${id}/${storageName}`;
    } else {
      // Legacy label-based path
      const safeName = sanitizeForStorage(
        song.composer ? `${song.title} - ${song.composer}` : song.title
      );
      const safeLabel = sanitizeForStorage(label);
      storagePath = `${id}/${safeName}_${safeLabel}${ext}`;
    }

    const supabase = createAdminClient();

    const songUuid = await resolveSongUuid(supabase, id);

    // Check for duplicate (only if song exists in DB)
    if (songUuid) {
      const { data: existing } = await supabase
        .from("song_resources_v2")
        .select("id")
        .eq("song_id", songUuid)
        .eq("storage_path", storagePath)
        .maybeSingle();

      if (existing) {
        return NextResponse.json(
          { error: "Resource already exists" },
          { status: 409 }
        );
      }
    }

    // Generate signed upload URL (valid 5 minutes)
    const { data, error } = await supabase.storage
      .from("song-resources")
      .createSignedUploadUrl(storagePath);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      signedUrl: data.signedUrl,
      token: data.token,
      storagePath,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
