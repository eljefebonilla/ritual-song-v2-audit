import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateSignedSlug } from "@/lib/generators/slug-signing";

/**
 * POST /api/wa-slug — Generate a signed mobile worship aid URL.
 * Body: { massEventId }
 * Returns: { slug, url }
 */
export async function POST(request: NextRequest) {
  const userSupabase = await createClient();
  const { data: { user } } = await userSupabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const body = await request.json();
  const { massEventId } = body;

  if (!massEventId) {
    return NextResponse.json({ error: "massEventId required" }, { status: 400 });
  }

  // Get parish info
  const { data: profile } = await supabase
    .from("profiles")
    .select("parish_id")
    .eq("id", user.id)
    .single();

  if (!profile?.parish_id) {
    return NextResponse.json({ error: "No parish" }, { status: 404 });
  }

  // Get parish name for slug
  const { data: parish } = await supabase
    .from("parishes")
    .select("name")
    .eq("id", profile.parish_id)
    .single();

  // Get mass event for occasion code
  const { data: massEvent } = await supabase
    .from("mass_events")
    .select("occasion_id")
    .eq("id", massEventId)
    .single();

  if (!massEvent?.occasion_id || !parish) {
    return NextResponse.json({ error: "Mass event or parish not found" }, { status: 404 });
  }

  const parishSlug = parish.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  const slug = generateSignedSlug(parishSlug, massEvent.occasion_id);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://stmonica-music-ministry.vercel.app";

  return NextResponse.json({
    slug,
    url: `${appUrl}/wa/${slug}`,
  });
}
