import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * PUT /api/booking-slots/[id] — Update a booking slot
 * Admin: can update any field
 * Member: can only update own confirmation status (RLS enforced)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const body = await request.json();

  const isAdmin = await verifyAdmin();

  if (isAdmin) {
    // Admin can update all fields
    const { data, error } = await supabase
      .from("booking_slots")
      .update({
        mass_event_id: body.mass_event_id,
        ministry_role_id: body.ministry_role_id,
        profile_id: body.profile_id,
        person_name: body.person_name,
        confirmation: body.confirmation,
        is_recurring: body.is_recurring,
        slot_order: body.slot_order,
        role_label_override: body.role_label_override,
        instrument_detail: body.instrument_detail,
        notes: body.notes,
      })
      .eq("id", id)
      .select(`
        *,
        profile:profiles (id, full_name, avatar_url),
        ministry_role:ministry_roles (id, name, sort_order)
      `)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data);
  }

  // Member: can only update confirmation on own slots (RLS handles auth)
  if (!body.confirmation) {
    return NextResponse.json(
      { error: "Only confirmation status can be updated" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("booking_slots")
    .update({ confirmation: body.confirmation })
    .eq("id", id)
    .select(`
      *,
      profile:profiles (id, full_name, avatar_url),
      ministry_role:ministry_roles (id, name, sort_order)
    `)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

/**
 * DELETE /api/booking-slots/[id] — Delete a booking slot (admin only)
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
    .from("booking_slots")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
