/**
 * Cascade Tool — MCP-style tool server for sub-request cascades
 * Ref: DESIGN-SPEC-v2.md 11.11, 15.2, 16.3
 *
 * Registers tool handlers that the ConversationRuntime can invoke:
 * - cascade.buildCandidateList: Build ordered candidate list by seniority
 * - cascade.sendSms: Send sub-request SMS to a candidate
 * - cascade.checkResponse: Check if a candidate has responded or timed out
 * - cascade.executeFullCascade: Run the full sequential cascade end-to-end
 */

import type { ToolDefinition } from "@/runtime/types";
import { buildCandidateList } from "./build-candidates";
import { sendCascadeSms } from "./send-sms";
import { checkCascadeResponse } from "./check-response";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  BuildCandidatesArgs,
  SendSmsArgs,
  CheckResponseArgs,
  ExecuteCascadeArgs,
  CascadeProgress,
} from "./types";

export type {
  CascadeRequest,
  CascadeCandidate,
  CascadeProgress,
  CascadeStatus,
  CandidateStatus,
} from "./types";

export function createCascadeTools(): ToolDefinition[] {
  return [
    {
      name: "cascade.buildCandidateList",
      description:
        "Build an ordered list of substitute candidates for a booking slot. Filters by instrument, ensemble, seniority, availability, and SMS consent.",
      permissionLevel: "allow",
      handler: async (args) => {
        const typedArgs = args as unknown as BuildCandidatesArgs;
        return buildCandidateList(typedArgs);
      },
    },
    {
      name: "cascade.sendSms",
      description:
        "Send a sub-request SMS to a specific cascade candidate. Includes mass date, time, role, and accept/decline instructions.",
      permissionLevel: "prompt",
      handler: async (args) => {
        const typedArgs = args as unknown as SendSmsArgs;
        return sendCascadeSms(typedArgs);
      },
    },
    {
      name: "cascade.checkResponse",
      description:
        "Check whether a contacted candidate has responded (accepted/declined) or timed out.",
      permissionLevel: "allow",
      handler: async (args) => {
        const typedArgs = args as unknown as CheckResponseArgs;
        return checkCascadeResponse(typedArgs);
      },
    },
    {
      name: "cascade.executeFullCascade",
      description:
        "Execute the full sequential cascade: build candidates, contact one at a time in seniority order, wait for response or timeout, advance until filled or exhausted.",
      permissionLevel: "prompt",
      handler: async (args) => {
        const typedArgs = args as unknown as ExecuteCascadeArgs;
        return executeFullCascade(typedArgs);
      },
    },
  ];
}

/**
 * Full cascade execution: contacts candidates sequentially until one accepts
 * or the list is exhausted. Updates cascade_requests status throughout.
 */
async function executeFullCascade(
  args: ExecuteCascadeArgs
): Promise<CascadeProgress> {
  const supabase = createAdminClient();

  // Load the cascade request
  const { data: request } = await supabase
    .from("cascade_requests")
    .select("*, booking_slot:booking_slots(*, ministry_role:ministry_roles(name)), mass_event:mass_events(date, time_12h, occasion:occasions(liturgical_name))")
    .eq("id", args.cascadeRequestId)
    .single();

  if (!request) throw new Error("Cascade request not found");

  // Mark as active
  await supabase
    .from("cascade_requests")
    .update({ status: "active" })
    .eq("id", request.id);

  const slot = request.booking_slot as Record<string, unknown>;
  const role = slot?.ministry_role as Record<string, unknown>;
  const massEvent = request.mass_event as Record<string, unknown>;
  const occasion = massEvent?.occasion as Record<string, unknown>;

  // Load candidates in order
  const { data: candidates } = await supabase
    .from("cascade_candidates")
    .select("id, profile_id, contact_order, status, seniority_tier")
    .eq("cascade_request_id", request.id)
    .order("contact_order", { ascending: true });

  if (!candidates || candidates.length === 0) {
    await supabase
      .from("cascade_requests")
      .update({ status: "exhausted" })
      .eq("id", request.id);

    return {
      requestId: request.id,
      status: "exhausted",
      totalCandidates: 0,
      contacted: 0,
      currentCandidate: null,
      accepted: null,
      declined: [],
      timedOut: [],
      remaining: 0,
    };
  }

  const declined: typeof candidates = [];
  const timedOut: typeof candidates = [];
  let accepted: (typeof candidates)[number] | null = null;

  for (const candidate of candidates) {
    // Skip already-resolved candidates (from a resumed cascade)
    if (["accepted", "declined", "timeout", "skipped"].includes(candidate.status)) {
      if (candidate.status === "declined") declined.push(candidate);
      if (candidate.status === "timeout") timedOut.push(candidate);
      if (candidate.status === "accepted") { accepted = candidate; break; }
      continue;
    }

    // Send SMS
    const smsResult = await sendCascadeSms({
      cascadeRequestId: request.id,
      candidateId: candidate.id,
      massDate: (massEvent?.date as string) || "TBD",
      massTime: (massEvent?.time_12h as string) || "TBD",
      roleName: (role?.name as string) || "musician",
      celebration: (occasion?.liturgical_name as string) || undefined,
    });

    if (!smsResult.success) {
      // Skip this candidate, move to next
      continue;
    }

    // Poll for response until timeout
    const timeoutMs = (request.timeout_minutes || 15) * 60_000;
    const pollIntervalMs = 30_000; // check every 30 seconds
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      await sleep(pollIntervalMs);

      const response = await checkCascadeResponse({
        cascadeRequestId: request.id,
        candidateId: candidate.id,
      });

      if (response.status === "accepted") {
        accepted = candidate;
        break;
      }
      if (response.status === "declined") {
        declined.push(candidate);
        break;
      }
      if (response.timedOut) {
        timedOut.push(candidate);
        break;
      }
    }

    // If still contacted after loop, force timeout
    if (!accepted && !declined.includes(candidate) && !timedOut.includes(candidate)) {
      await supabase
        .from("cascade_candidates")
        .update({ status: "timeout", responded_at: new Date().toISOString() })
        .eq("id", candidate.id);
      timedOut.push(candidate);
    }

    if (accepted) break;
  }

  // Update cascade request final status
  const finalStatus = accepted ? "filled" : "exhausted";
  await supabase
    .from("cascade_requests")
    .update({
      status: finalStatus,
      filled_at: accepted ? new Date().toISOString() : null,
      filled_by: accepted ? accepted.profile_id : null,
    })
    .eq("id", request.id);

  // If filled, update the booking slot
  if (accepted) {
    await supabase
      .from("booking_slots")
      .update({
        profile_id: accepted.profile_id,
        confirmation: "confirmed",
      })
      .eq("id", request.booking_slot_id);
  }

  // If exhausted, notify the admin who initiated
  if (!accepted) {
    const { sendSMS: sendSmsNotify } = await import("@/lib/twilio");
    const { data: initiator } = await supabase
      .from("profiles")
      .select("phone, sms_consent")
      .eq("id", request.initiated_by)
      .single();

    if (initiator?.phone && initiator?.sms_consent) {
      await sendSmsNotify(
        initiator.phone,
        `Ritual Song: Sub-request cascade exhausted. No one accepted the ${(role?.name as string) || "musician"} slot for ${(massEvent?.date as string) || "the upcoming mass"}. Manual intervention needed.`
      );
    }
  }

  return {
    requestId: request.id,
    status: finalStatus,
    totalCandidates: candidates.length,
    contacted: declined.length + timedOut.length + (accepted ? 1 : 0),
    currentCandidate: null,
    accepted: accepted as unknown as import("./types").CascadeCandidate | null,
    declined: declined as unknown as import("./types").CascadeCandidate[],
    timedOut: timedOut as unknown as import("./types").CascadeCandidate[],
    remaining: candidates.filter((c) => c.status === "queued").length,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
