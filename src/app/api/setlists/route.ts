import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/setlists — Fetch setlist(s)
 * Query params:
 *   ?mass_event_id=uuid — setlist for a specific mass (returns single or null)
 *   ?from=2026-03-01    — setlists in date range (via mass_events join)
 *   ?to=2026-03-31
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);

  const massEventId = searchParams.get("mass_event_id");

  if (massEventId) {
    const { data, error } = await supabase
      .from("setlists")
      .select("*")
      .eq("mass_event_id", massEventId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data);
  }

  // Date range query via mass_events
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  let query = supabase
    .from("setlists")
    .select(`
      *,
      mass_event:mass_events (id, title, event_date, start_time_12h, ensemble, liturgical_name)
    `)
    .order("created_at", { ascending: false });

  if (from || to) {
    // Filter through mass_events relationship
    if (from) query = query.gte("mass_event.event_date", from);
    if (to) query = query.lte("mass_event.event_date", to);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

/**
 * POST /api/setlists — Create a setlist (admin only)
 */
export async function POST(request: NextRequest) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const body = await request.json();

  if (!body.mass_event_id) {
    return NextResponse.json(
      { error: "mass_event_id is required" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("setlists")
    .insert({
      mass_event_id: body.mass_event_id,
      occasion_name: body.occasion_name || null,
      special_designation: body.special_designation || null,
      occasion_id: body.occasion_id || null,
      songs: body.songs || [],
      personnel: body.personnel || [],
      choir_label: body.choir_label || null,
      safety_song: body.safety_song || null,
      last_edited_by: user?.id || null,
    })
    .select()
    .single();

  if (error) {
    // Unique constraint on mass_event_id
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "A setlist already exists for this mass" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
