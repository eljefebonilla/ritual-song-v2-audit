import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildCandidateList } from "@/tools/cascade/build-candidates";
import type { CascadeStatus } from "@/tools/cascade/types";

/**
 * POST /api/cascade — Initiate a sub-request cascade
 * Body: { bookingSlotId, massEventId, ministryRoleId, originalMusicianId?, urgency?, instrument?, ensemble? }
 */
export async function POST(request: NextRequest) {
  const isAdmin = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const body = await request.json();
  const {
    bookingSlotId,
    massEventId,
    ministryRoleId,
    originalMusicianId,
    urgency = "normal",
    instrument,
    ensemble,
  } = body;

  if (!bookingSlotId || !massEventId || !ministryRoleId) {
    return NextResponse.json(
      { error: "bookingSlotId, massEventId, and ministryRoleId are required" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  // Check for existing active cascade on this slot
  const { data: existing } = await supabase
    .from("cascade_requests")
    .select("id, status")
    .eq("booking_slot_id", bookingSlotId)
    .in("status", ["pending", "active"])
    .limit(1)
    .single();

  if (existing) {
    return NextResponse.json(
      { error: "Active cascade already exists for this slot", cascadeId: existing.id },
      { status: 409 }
    );
  }

  // Get the initiator (current admin user)
  const { createClient } = await import("@/lib/supabase/server");
  const userSupabase = await createClient();
  const { data: { user } } = await userSupabase.auth.getUser();
  const initiatedBy = user?.id;

  if (!initiatedBy) {
    return NextResponse.json({ error: "Could not identify initiator" }, { status: 401 });
  }

  // Create the cascade request
  const timeoutMinutes = urgency === "urgent" ? 5 : 15;
  const { data: cascadeRequest, error: createError } = await supabase
    .from("cascade_requests")
    .insert({
      booking_slot_id: bookingSlotId,
      mass_event_id: massEventId,
      initiated_by: initiatedBy,
      original_musician_id: originalMusicianId || null,
      ministry_role_id: ministryRoleId,
      status: "pending" as CascadeStatus,
      urgency,
      timeout_minutes: timeoutMinutes,
    })
    .select()
    .single();

  if (createError) {
    return NextResponse.json({ error: createError.message }, { status: 500 });
  }

  // Build candidate list
  const candidates = await buildCandidateList({
    cascadeRequestId: cascadeRequest.id,
    massEventId,
    ministryRoleId,
    originalMusicianId,
    instrument,
    ensemble,
  });

  return NextResponse.json({
    cascadeId: cascadeRequest.id,
    status: "pending",
    candidateCount: candidates.length,
    candidates: candidates.map((c) => ({
      id: c.id,
      name: c.profile?.full_name,
      seniority: c.seniority_tier,
      order: c.contact_order,
    })),
  });
}

/**
 * GET /api/cascade?id=<cascadeRequestId> — Get cascade status
 * GET /api/cascade?slotId=<bookingSlotId> — Get cascade for a slot
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const cascadeId = searchParams.get("id");
  const slotId = searchParams.get("slotId");

  if (!cascadeId && !slotId) {
    return NextResponse.json({ error: "id or slotId required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  let query = supabase
    .from("cascade_requests")
    .select("*, candidates:cascade_candidates(*, profile:profiles(id, full_name, instrument, voice_part))");

  if (cascadeId) {
    query = query.eq("id", cascadeId);
  } else {
    query = query.eq("booking_slot_id", slotId!);
  }

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: error.code === "PGRST116" ? 404 : 500 });
  }

  return NextResponse.json(data);
}
