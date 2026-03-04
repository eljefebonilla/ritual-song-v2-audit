import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * PUT /api/occasions/[id]/custom-slots/[slotId]
 * Updates an existing custom worship slot.
 *
 * Body (partial): {
 *   label?: string;
 *   orderPosition?: number;
 *   content?: object;
 *   slotType?: string;
 * }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; slotId: string }> }
) {
  const { id, slotId } = await params;

  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const body = await request.json();
  const { label, orderPosition, content, slotType } = body;

  const VALID_SLOT_TYPES = ["song", "reading", "ritual_moment", "note", "mass_part"];
  if (slotType !== undefined && !VALID_SLOT_TYPES.includes(slotType)) {
    return NextResponse.json(
      { error: `slotType must be one of: ${VALID_SLOT_TYPES.join(", ")}` },
      { status: 400 }
    );
  }

  // Build partial update object
  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (label !== undefined) updates.label = label;
  if (orderPosition !== undefined) updates.order_position = orderPosition;
  if (content !== undefined) updates.content = content;
  if (slotType !== undefined) updates.slot_type = slotType;

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("custom_worship_slots")
      .update(updates)
      .eq("id", slotId)
      .eq("occasion_id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "Slot not found" }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/occasions/[id]/custom-slots/[slotId]
 * Deletes a custom worship slot.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; slotId: string }> }
) {
  const { id, slotId } = await params;

  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("custom_worship_slots")
      .delete()
      .eq("id", slotId)
      .eq("occasion_id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
