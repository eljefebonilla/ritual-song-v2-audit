import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/cover-art?occasionCode=xxx&cycle=A
 * Fetch cover art for an occasion.
 */
export async function GET(request: NextRequest) {
  const userSupabase = await createClient();
  const { data: { user } } = await userSupabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("parish_id")
    .eq("id", user.id)
    .single();

  if (!profile?.parish_id) {
    return NextResponse.json({ error: "No parish" }, { status: 404 });
  }

  const occasionCode = request.nextUrl.searchParams.get("occasionCode");
  if (!occasionCode) {
    return NextResponse.json({ error: "occasionCode required" }, { status: 400 });
  }

  const { data } = await supabase
    .from("parish_cover_art")
    .select("*")
    .eq("parish_id", profile.parish_id)
    .eq("occasion_code", occasionCode);

  return NextResponse.json({ covers: data || [] });
}

/**
 * POST /api/cover-art — Upload or set cover art for an occasion.
 * Body: { occasionCode, cycle, source, imageUrl?, storagePath? }
 * For file uploads, use a separate presigned URL flow.
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

  const body = await request.json();
  const { occasionCode, cycle, source, imageUrl, storagePath } = body;

  if (!occasionCode || !cycle || !source) {
    return NextResponse.json(
      { error: "occasionCode, cycle, and source are required" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("parish_cover_art")
    .upsert(
      {
        parish_id: profile.parish_id,
        occasion_code: occasionCode,
        cycle,
        source,
        image_url: imageUrl || null,
        storage_path: storagePath || null,
      },
      { onConflict: "parish_id,occasion_code,cycle" }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

/**
 * DELETE /api/cover-art?id=xxx
 */
export async function DELETE(request: NextRequest) {
  const userSupabase = await createClient();
  const { data: { user } } = await userSupabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("parish_cover_art")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
