import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/brand-config — Fetch parish brand config for the current user's parish
 */
export async function GET() {
  const userSupabase = await createClient();
  const {
    data: { user },
  } = await userSupabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Get user's parish
  const { data: profile } = await supabase
    .from("profiles")
    .select("parish_id")
    .eq("id", user.id)
    .single();

  if (!profile?.parish_id) {
    return NextResponse.json({ error: "No parish found" }, { status: 404 });
  }

  const { data: config } = await supabase
    .from("parish_brand_config")
    .select("*")
    .eq("parish_id", profile.parish_id)
    .maybeSingle();

  return NextResponse.json({
    parishId: profile.parish_id,
    config: config || null,
  });
}

/**
 * PUT /api/brand-config — Update or create parish brand config
 */
export async function PUT(request: NextRequest) {
  const userSupabase = await createClient();
  const {
    data: { user },
  } = await userSupabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("parish_id, role")
    .eq("id", user.id)
    .single();

  if (!profile?.parish_id) {
    return NextResponse.json({ error: "No parish found" }, { status: 404 });
  }

  if (!["admin", "owner"].includes(profile.role || "")) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const body = await request.json();

  const { data, error } = await supabase
    .from("parish_brand_config")
    .upsert(
      {
        parish_id: profile.parish_id,
        parish_display_name: body.parish_display_name ?? "",
        primary_color: body.primary_color ?? "#333333",
        secondary_color: body.secondary_color ?? "#666666",
        accent_color: body.accent_color ?? "#4A90D9",
        heading_font: body.heading_font ?? "Playfair Display",
        body_font: body.body_font ?? "Inter",
        layout_preset: body.layout_preset ?? "modern",
        cover_style: body.cover_style ?? "gradient",
        header_overlay_mode: body.header_overlay_mode ?? "banner",
        logo_url: body.logo_url ?? null,
        logo_storage_path: body.logo_storage_path ?? null,
      },
      { onConflict: "parish_id" }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
