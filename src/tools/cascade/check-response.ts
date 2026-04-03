/**
 * Check response status for a cascade candidate.
 * Handles timeout detection based on cascade urgency.
 * Ref: DESIGN-SPEC-v2.md 15.2 — 15 min default, 5 min urgent
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type { CheckResponseArgs, CandidateStatus } from "./types";

export async function checkCascadeResponse(args: CheckResponseArgs): Promise<{
  status: CandidateStatus;
  timedOut: boolean;
  waitingMinutes: number;
}> {
  const supabase = createAdminClient();

  // Get candidate and parent request
  const { data: candidate } = await supabase
    .from("cascade_candidates")
    .select("id, status, contacted_at, responded_at, cascade_request_id")
    .eq("id", args.candidateId)
    .single();

  if (!candidate) {
    return { status: "skipped", timedOut: false, waitingMinutes: 0 };
  }

  // Already resolved
  if (["accepted", "declined", "skipped"].includes(candidate.status)) {
    return { status: candidate.status as CandidateStatus, timedOut: false, waitingMinutes: 0 };
  }

  // Check timeout
  if (candidate.status === "contacted" && candidate.contacted_at) {
    const { data: request } = await supabase
      .from("cascade_requests")
      .select("timeout_minutes")
      .eq("id", candidate.cascade_request_id)
      .single();

    const timeoutMinutes = request?.timeout_minutes ?? 15;
    const contactedAt = new Date(candidate.contacted_at).getTime();
    const now = Date.now();
    const elapsedMinutes = (now - contactedAt) / 60_000;

    if (elapsedMinutes >= timeoutMinutes) {
      // Mark as timed out
      await supabase
        .from("cascade_candidates")
        .update({ status: "timeout", responded_at: new Date().toISOString() })
        .eq("id", args.candidateId);

      return { status: "timeout", timedOut: true, waitingMinutes: Math.round(elapsedMinutes) };
    }

    return {
      status: "contacted",
      timedOut: false,
      waitingMinutes: Math.round(elapsedMinutes),
    };
  }

  return { status: candidate.status as CandidateStatus, timedOut: false, waitingMinutes: 0 };
}
