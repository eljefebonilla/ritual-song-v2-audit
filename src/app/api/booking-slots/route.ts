import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/booking-slots — Fetch booking slots for the booking grid
 * Query params:
 *   ?from=2026-03-01    — start date
 *   ?to=2026-03-31      — end date
 *   ?mass_event_id=uuid — single mass event
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);

  const massEventId = searchParams.get("mass_event_id");

  if (massEventId) {
    // Single mass — return slots with joins
    const { data, error } = await supabase
      .from("booking_slots")
      .select(`
        *,
        profile:profiles (id, full_name, avatar_url),
        ministry_role:ministry_roles (id, name, sort_order)
      `)
      .eq("mass_event_id", massEventId)
      .order("slot_order", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data);
  }

  // Date range — return mass events with nested booking slots
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  let query = supabase
    .from("mass_events")
    .select(`
      *,
      booking_slots (
        *,
        profile:profiles (id, full_name, avatar_url),
        ministry_role:ministry_roles (id, name, sort_order)
      )
    `)
    .eq("event_type", "mass")
    .order("event_date", { ascending: true })
    .order("start_time", { ascending: true });

  if (from) query = query.gte("event_date", from);
  if (to) query = query.lte("event_date", to);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

/**
 * POST /api/booking-slots — Create a booking slot (admin only)
 */
export async function POST(request: NextRequest) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const supabase = await createClient();
  const body = await request.json();

  if (!body.mass_event_id || !body.ministry_role_id) {
    return NextResponse.json(
      { error: "mass_event_id and ministry_role_id are required" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("booking_slots")
    .insert({
      mass_event_id: body.mass_event_id,
      ministry_role_id: body.ministry_role_id,
      profile_id: body.profile_id || null,
      person_name: body.person_name || null,
      confirmation: body.confirmation || "unconfirmed",
      is_recurring: body.is_recurring ?? false,
      slot_order: body.slot_order ?? 0,
      role_label_override: body.role_label_override || null,
      instrument_detail: body.instrument_detail || null,
      notes: body.notes || null,
    })
    .select(`
      *,
      profile:profiles (id, full_name, avatar_url),
      ministry_role:ministry_roles (id, name, sort_order)
    `)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
