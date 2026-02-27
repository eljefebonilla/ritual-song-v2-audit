import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/mass-comments — Fetch comments for a mass event
 * Query params:
 *   ?mass_event_id=uuid (required)
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const massEventId = searchParams.get("mass_event_id");

  if (!massEventId) {
    return NextResponse.json(
      { error: "mass_event_id is required" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("mass_comments")
    .select(`
      *,
      author:profiles (id, full_name, avatar_url)
    `)
    .eq("mass_event_id", massEventId)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

/**
 * POST /api/mass-comments — Post a comment on a mass event (authenticated)
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const body = await request.json();

  if (!body.mass_event_id || !body.body?.trim()) {
    return NextResponse.json(
      { error: "mass_event_id and body are required" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("mass_comments")
    .insert({
      mass_event_id: body.mass_event_id,
      author_id: user.id,
      body: body.body.trim(),
      is_pinned: false,
    })
    .select(`
      *,
      author:profiles (id, full_name, avatar_url)
    `)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
