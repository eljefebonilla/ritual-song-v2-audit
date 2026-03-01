import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/calendar — Fetch calendar events
 * Query params:
 *   ?community=Reflections  — filter by community
 *   ?from=2025-11-01        — start date filter
 *   ?to=2026-06-01          — end date filter
 *   ?week=advent-01          — filter by liturgical week
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);

  let query = supabase
    .from("mass_events")
    .select("*")
    .order("event_date", { ascending: true })
    .order("start_time", { ascending: true });

  const community = searchParams.get("community");
  if (community && community !== "all") {
    query = query.eq("community", community);
  }

  const from = searchParams.get("from");
  if (from) {
    query = query.gte("event_date", from);
  }

  const to = searchParams.get("to");
  if (to) {
    query = query.lte("event_date", to);
  }

  const week = searchParams.get("week");
  if (week) {
    query = query.eq("liturgical_week", week);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

/**
 * POST /api/calendar — Create a new calendar event (admin only)
 */
export async function POST(request: NextRequest) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const supabase = await createClient();
  const body = await request.json();

  // Get user ID for created_by if authenticated
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("mass_events")
    .insert({
      title: body.title,
      event_date: body.event_date,
      start_time: body.start_time || null,
      end_time: body.end_time || null,
      start_time_12h: body.start_time_12h || null,
      end_time_12h: body.end_time_12h || null,
      location: body.location || "St. Monica Catholic Community",
      event_type: body.event_type || "mass",
      community: body.community || null,
      day_of_week: body.day_of_week || null,
      has_music: body.has_music ?? false,
      is_auto_mix: body.is_auto_mix ?? false,
      needs_volunteers: body.needs_volunteers ?? false,
      celebrant: body.celebrant || null,
      notes: body.notes || null,
      sidebar_note: body.sidebar_note || null,
      occasion_id: body.occasion_id || null,
      liturgical_week: body.liturgical_week || null,
      liturgical_name: body.liturgical_name || null,
      season: body.season || null,
      created_by: user?.id || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
