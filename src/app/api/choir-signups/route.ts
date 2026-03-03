import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/choir-signups — Fetch choir signups
 * Query params:
 *   ?mass_event_id=uuid — signups for a specific mass
 *   ?user_id=uuid       — signups for a specific user (upcoming)
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);

  const massEventId = searchParams.get("mass_event_id");
  const userId = searchParams.get("user_id");

  if (massEventId) {
    const { data, error } = await supabase
      .from("choir_signups")
      .select(`
        *,
        profile:profiles (id, full_name, avatar_url, ensemble)
      `)
      .eq("mass_event_id", massEventId)
      .eq("status", "confirmed")
      .order("voice_part");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data);
  }

  if (userId) {
    // Get user's upcoming signups
    const today = new Date().toISOString().split("T")[0];
    const { data, error } = await supabase
      .from("choir_signups")
      .select(`
        *,
        mass_event:mass_events (id, title, event_date, start_time_12h, ensemble, liturgical_name)
      `)
      .eq("user_id", userId)
      .eq("status", "confirmed")
      .gte("mass_event.event_date", today)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data);
  }

  return NextResponse.json(
    { error: "mass_event_id or user_id is required" },
    { status: 400 }
  );
}

/**
 * POST /api/choir-signups — Sign up for a mass (authenticated user)
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const body = await request.json();

  if (!body.mass_event_id || !body.voice_part) {
    return NextResponse.json(
      { error: "mass_event_id and voice_part are required" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("choir_signups")
    .insert({
      mass_event_id: body.mass_event_id,
      user_id: user.id,
      voice_part: body.voice_part,
      status: "confirmed",
    })
    .select(`
      *,
      profile:profiles (id, full_name, avatar_url, ensemble)
    `)
    .single();

  if (error) {
    // Unique constraint violation = already signed up
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "Already signed up for this mass" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
