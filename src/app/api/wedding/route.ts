import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/wedding — Create or update a wedding event
 * Body: { eventId?, details, selections }
 */
export async function POST(request: NextRequest) {
  const supabase = createAdminClient();
  const body = await request.json();
  const { eventId, details, selections, eventType } = body;

  const row = {
    event_type: (eventType || "wedding") as "wedding" | "funeral",
    status: "in_progress" as const,
    contact_name: details.coupleName1,
    contact_email: details.contactEmail || null,
    contact_phone: details.contactPhone || null,
    couple_names:
      details.coupleName1 && details.coupleName2
        ? `${details.coupleName1} & ${details.coupleName2}`
        : null,
    deceased_name: details.deceasedName || null,
    event_date: details.eventDate || null,
    event_time: details.eventTime || null,
    rehearsal_date: details.rehearsalDate || null,
    rehearsal_time: details.rehearsalTime || null,
    celebrant: details.celebrant || null,
    cantor_id: details.cantorId || null,
    selections: selections || {},
    custom_notes: details.notes || null,
  };

  if (eventId) {
    // Update existing event
    const { data, error } = await supabase
      .from("sacramental_events")
      .update(row)
      .eq("id", eventId)
      .select("id, share_token")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ event: data });
  }

  // Create new event
  const { data, error } = await supabase
    .from("sacramental_events")
    .insert(row)
    .select("id, share_token")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ event: data }, { status: 201 });
}

/**
 * GET /api/wedding?token=xxx — Load a wedding event by share token
 * GET /api/wedding?id=xxx — Load by event ID (admin)
 */
export async function GET(request: NextRequest) {
  const supabase = createAdminClient();
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  const id = searchParams.get("id");

  if (!token && !id) {
    return NextResponse.json(
      { error: "Provide token or id" },
      { status: 400 }
    );
  }

  let query = supabase.from("sacramental_events").select("*");

  if (token) {
    query = query.eq("share_token", token);
  } else {
    query = query.eq("id", id!);
  }

  const { data, error } = await query.single();

  if (error || !data) {
    return NextResponse.json(
      { error: "Event not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({ event: data });
}
