/**
 * Send a cascade sub-request SMS to a candidate.
 * Uses the existing sendSMS() from lib/twilio.ts.
 * Ref: DESIGN-SPEC-v2.md 15.2 — SMS is non-negotiable
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { sendSMS } from "@/lib/twilio";
import type { SendSmsArgs } from "./types";

const APP_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000");

export async function sendCascadeSms(args: SendSmsArgs): Promise<{
  success: boolean;
  smsSid?: string;
  error?: string;
}> {
  const supabase = createAdminClient();

  // Get candidate + profile info
  const { data: candidate } = await supabase
    .from("cascade_candidates")
    .select("id, profile_id, status, profile:profiles(full_name, phone, sms_consent)")
    .eq("id", args.candidateId)
    .single();

  if (!candidate) return { success: false, error: "Candidate not found" };

  const profile = candidate.profile as unknown as {
    full_name: string;
    phone: string | null;
    sms_consent: boolean;
  };

  if (!profile?.phone || !profile?.sms_consent) {
    // Mark as skipped: no phone or no consent
    await supabase
      .from("cascade_candidates")
      .update({ status: "skipped" })
      .eq("id", args.candidateId);
    return { success: false, error: "No phone or consent revoked" };
  }

  // Build the SMS message
  const message = [
    `St. Monica Music Ministry: Can you sub for ${args.roleName}?`,
    `Date: ${args.massDate} at ${args.massTime}`,
    args.celebration ? `(${args.celebration})` : "",
    "",
    `Reply YES to accept or NO to decline.`,
    `View details: ${APP_URL}/booking`,
    "",
    `Reply STOP to opt out of all messages.`,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const sid = await sendSMS(profile.phone, message);

    // Update candidate record
    await supabase
      .from("cascade_candidates")
      .update({
        status: "contacted",
        contacted_at: new Date().toISOString(),
        sms_sid: sid,
      })
      .eq("id", args.candidateId);

    // Log to notifications_log
    await supabase.from("notifications_log").insert({
      recipient_id: candidate.profile_id,
      channel: "sms",
      message_type: "cascade_sub_request",
      external_id: sid,
      status: "sent",
    });

    return { success: true, smsSid: sid };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "SMS send failed";
    console.error(`Cascade SMS to ${profile.full_name} failed:`, err);
    return { success: false, error: errorMsg };
  }
}
