import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * PUT /api/calendar/[id] — Update a calendar event (admin only)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const supabase = await createClient();
  const body = await request.json();

  const { data, error } = await supabase
    .from("mass_events")
    .update({
      title: body.title,
      event_date: body.event_date,
      start_time: body.start_time,
      end_time: body.end_time,
      start_time_12h: body.start_time_12h,
      end_time_12h: body.end_time_12h,
      location: body.location,
      event_type: body.event_type,
      community: body.community,
      day_of_week: body.day_of_week,
      has_music: body.has_music,
      is_auto_mix: body.is_auto_mix,
      needs_volunteers: body.needs_volunteers,
      celebrant: body.celebrant,
      notes: body.notes,
      sidebar_note: body.sidebar_note,
      occasion_id: body.occasion_id,
      liturgical_week: body.liturgical_week,
      liturgical_name: body.liturgical_name,
      season: body.season,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

/**
 * DELETE /api/calendar/[id] — Delete a calendar event (admin only)
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("mass_events")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
