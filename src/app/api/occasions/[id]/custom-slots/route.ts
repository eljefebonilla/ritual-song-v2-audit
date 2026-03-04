import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CustomSlotRow } from "@/lib/types";

const VALID_SLOT_TYPES = ["song", "reading", "ritual_moment", "note", "mass_part"];

/**
 * GET /api/occasions/[id]/custom-slots
 * Returns all custom worship slots for an occasion, grouped by ensemble_id.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("custom_worship_slots")
      .select("*")
      .eq("occasion_id", id)
      .order("order_position", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Group by ensemble_id
    const grouped: Record<string, CustomSlotRow[]> = {};
    for (const row of data ?? []) {
      if (!grouped[row.ensemble_id]) {
        grouped[row.ensemble_id] = [];
      }
      grouped[row.ensemble_id].push(row as CustomSlotRow);
    }

    return NextResponse.json(grouped);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/occasions/[id]/custom-slots
 * Creates a new custom worship slot.
 *
 * Body: {
 *   ensembleId: string;
 *   slotType: string;
 *   label: string;
 *   orderPosition: number;
 *   content: object;
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const body = await request.json();
  const { ensembleId, slotType, label, orderPosition, content } = body;

  if (!ensembleId || !slotType || !label || orderPosition == null) {
    return NextResponse.json(
      { error: "ensembleId, slotType, label, and orderPosition are required" },
      { status: 400 }
    );
  }

  if (!VALID_SLOT_TYPES.includes(slotType)) {
    return NextResponse.json(
      { error: `slotType must be one of: ${VALID_SLOT_TYPES.join(", ")}` },
      { status: 400 }
    );
  }

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("custom_worship_slots")
      .insert({
        occasion_id: id,
        ensemble_id: ensembleId,
        slot_type: slotType,
        label,
        order_position: orderPosition,
        content: content ?? {},
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
