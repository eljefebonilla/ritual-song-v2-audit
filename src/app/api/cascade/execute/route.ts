import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendCascadeSms } from "@/tools/cascade/send-sms";

/**
 * POST /api/cascade/execute — Start contacting the next candidate in a cascade.
 * Body: { cascadeId }
 *
 * This contacts ONE candidate at a time. The client polls /api/cascade?id=X
 * to check progress, then calls this again to advance to the next candidate
 * if the current one declined or timed out.
 *
 * This avoids long-running server functions. The polling loop lives in the client.
 */
export async function POST(request: NextRequest) {
  const isAdmin = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { cascadeId } = await request.json();
  if (!cascadeId) {
    return NextResponse.json({ error: "cascadeId required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Load cascade request with mass event details
  const { data: request_ } = await supabase
    .from("cascade_requests")
    .select("*, booking_slot:booking_slots(ministry_role:ministry_roles(name)), mass_event:mass_events(date, time_12h, occasion:occasions(liturgical_name))")
    .eq("id", cascadeId)
    .single();

  if (!request_) {
    return NextResponse.json({ error: "Cascade not found" }, { status: 404 });
  }

  if (request_.status === "filled" || request_.status === "cancelled") {
    return NextResponse.json({ error: `Cascade is ${request_.status}` }, { status: 400 });
  }

  // Mark as active if still pending
  if (request_.status === "pending") {
    await supabase
      .from("cascade_requests")
      .update({ status: "active" })
      .eq("id", cascadeId);
  }

  // Find the next queued candidate
  const { data: nextCandidate } = await supabase
    .from("cascade_candidates")
    .select("id, profile_id, contact_order")
    .eq("cascade_request_id", cascadeId)
    .eq("status", "queued")
    .order("contact_order", { ascending: true })
    .limit(1)
    .single();

  if (!nextCandidate) {
    // No more candidates: mark exhausted
    await supabase
      .from("cascade_requests")
      .update({ status: "exhausted" })
      .eq("id", cascadeId);

    return NextResponse.json({ status: "exhausted", message: "All candidates contacted, none accepted" });
  }

  const slot = request_.booking_slot as Record<string, unknown>;
  const role = slot?.ministry_role as Record<string, unknown>;
  const massEvent = request_.mass_event as Record<string, unknown>;
  const occasion = massEvent?.occasion as Record<string, unknown>;

  // Send SMS to the next candidate
  const result = await sendCascadeSms({
    cascadeRequestId: cascadeId,
    candidateId: nextCandidate.id,
    massDate: (massEvent?.date as string) || "TBD",
    massTime: (massEvent?.time_12h as string) || "TBD",
    roleName: (role?.name as string) || "musician",
    celebration: (occasion?.liturgical_name as string) || undefined,
  });

  if (!result.success) {
    // This candidate was skipped (no phone/consent). Client should call again to advance.
    return NextResponse.json({
      status: "skipped",
      candidateId: nextCandidate.id,
      error: result.error,
    });
  }

  return NextResponse.json({
    status: "contacted",
    candidateId: nextCandidate.id,
    contactOrder: nextCandidate.contact_order,
    smsSid: result.smsSid,
  });
}
