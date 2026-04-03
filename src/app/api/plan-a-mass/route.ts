import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/plan-a-mass — Create or update a planning session
 */
export async function POST(request: NextRequest) {
  const userSupabase = await createClient();
  const { data: { user } } = await userSupabase.auth.getUser();

  const body = await request.json();
  const { sessionId, ...sessionData } = body;

  const supabase = createAdminClient();

  if (sessionId) {
    // Update existing session
    const { data, error } = await supabase
      .from("planning_sessions")
      .update({
        ...sessionData,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sessionId)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ session: data });
  }

  // Create new session
  const { data, error } = await supabase
    .from("planning_sessions")
    .insert({
      ...sessionData,
      created_by: user?.id || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ session: data });
}

/**
 * GET /api/plan-a-mass?id=<sessionId> — Fetch a planning session
 * GET /api/plan-a-mass?token=<shareToken> — Fetch by share token (public)
 * GET /api/plan-a-mass?list=true — List all sessions for current user
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("id");
  const token = searchParams.get("token");
  const listAll = searchParams.get("list");

  const supabase = createAdminClient();

  if (token) {
    // Public access via share token
    const { data, error } = await supabase
      .from("planning_sessions")
      .select("*")
      .eq("share_token", token)
      .single();

    if (error || !data) return NextResponse.json({ error: "Session not found" }, { status: 404 });
    return NextResponse.json(data);
  }

  if (sessionId) {
    const { data, error } = await supabase
      .from("planning_sessions")
      .select("*")
      .eq("id", sessionId)
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  if (listAll) {
    const isAdmin = await verifyAdmin();
    if (!isAdmin) return NextResponse.json({ error: "Admin required" }, { status: 403 });

    const { data, error } = await supabase
      .from("planning_sessions")
      .select("id, title, mass_type, event_date, event_time, status, created_at, share_token")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  return NextResponse.json({ error: "Provide id, token, or list=true" }, { status: 400 });
}
