import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSongById } from "@/lib/song-library";

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
    const { label, fileName } = await request.json();

    if (!label || !fileName) {
      return NextResponse.json(
        { error: "label and fileName are required" },
        { status: 400 }
      );
    }

    const song = getSongById(id);
    if (!song) {
      return NextResponse.json({ error: "Song not found" }, { status: 404 });
    }

    const ext = fileName.includes(".") ? fileName.slice(fileName.lastIndexOf(".")) : "";
    const safeName = sanitizeForStorage(
      song.composer ? `${song.title} - ${song.composer}` : song.title
    );
    const safeLabel = sanitizeForStorage(label);
    const storagePath = `${id}/${safeName}_${safeLabel}${ext}`;

    const supabase = createAdminClient();

    // Check for duplicate
    const { data: existing } = await supabase
      .from("song_resources")
      .select("id")
      .eq("song_id", id)
      .eq("storage_path", storagePath)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "Resource already exists" },
        { status: 409 }
      );
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
