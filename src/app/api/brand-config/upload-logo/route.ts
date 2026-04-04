import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/brand-config/upload-logo — Upload a parish logo image.
 * Stores in Supabase storage under logos/{parish_id}/logo.{ext}
 * Updates the brand config record with the new URL.
 */
export async function POST(request: NextRequest) {
  const userSupabase = await createClient();
  const { data: { user } } = await userSupabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("parish_id, role")
    .eq("id", user.id)
    .single();

  if (!profile?.parish_id || !["admin", "owner"].includes(profile.role || "")) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const storagePath = `logos/${profile.parish_id}/logo.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from("song-resources")
    .upload(storagePath, bytes, { contentType: file.type, upsert: true });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: urlData } = supabase.storage
    .from("song-resources")
    .getPublicUrl(storagePath);

  // Update brand config with new logo
  await supabase
    .from("parish_brand_config")
    .upsert(
      {
        parish_id: profile.parish_id,
        logo_url: urlData.publicUrl,
        logo_storage_path: storagePath,
      },
      { onConflict: "parish_id" }
    );

  return NextResponse.json({
    logoUrl: urlData.publicUrl,
    storagePath,
  });
}
