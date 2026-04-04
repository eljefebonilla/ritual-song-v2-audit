import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/cover-art/upload — Upload a cover art image file.
 * Accepts multipart form data with file + occasionCode + cycle.
 * Stores in Supabase storage under covers/{parish_id}/{occasionCode}_{cycle}.ext
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
  const occasionCode = formData.get("occasionCode") as string;
  const cycle = formData.get("cycle") as string;

  if (!file || !occasionCode || !cycle) {
    return NextResponse.json(
      { error: "file, occasionCode, and cycle are required" },
      { status: 400 }
    );
  }

  // Determine extension
  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const storagePath = `covers/${profile.parish_id}/${occasionCode}_${cycle}.${ext}`;

  const bytes = new Uint8Array(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from("song-resources")
    .upload(storagePath, bytes, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: urlData } = supabase.storage
    .from("song-resources")
    .getPublicUrl(storagePath);

  return NextResponse.json({
    storagePath,
    publicUrl: urlData.publicUrl,
  });
}
