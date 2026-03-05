"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { notifyNewSignup } from "@/lib/notifications";

interface OnboardingData {
  userId: string;
  fullName: string;
  email: string;
  phone: string;
  musicianRole: string;
  voicePart: string | null;
  instrumentDetail: string | null;
  ensemble: string;
  smsConsent: boolean;
  inviteCode: string | null;
}

export async function completeOnboarding(data: OnboardingData) {
  const supabase = createAdminClient();

  // Upsert profile with pending status
  const { error: profileError } = await supabase.from("profiles").upsert(
    {
      id: data.userId,
      full_name: data.fullName,
      email: data.email,
      phone: data.phone || null,
      musician_role: data.musicianRole,
      voice_part: data.voicePart || null,
      instrument: data.instrumentDetail || null,
      instrument_detail: data.instrumentDetail || null,
      ensemble: data.ensemble || null,
      role: "member",
      status: "pending",
      sms_consent: data.smsConsent,
      sms_consent_at: data.smsConsent ? new Date().toISOString() : null,
      sms_consent_method: data.smsConsent ? "signup_form" : null,
    },
    { onConflict: "id" }
  );

  if (profileError) {
    return { success: false, error: profileError.message };
  }

  // Claim invitation if provided
  if (data.inviteCode) {
    await supabase
      .from("invitations")
      .update({
        status: "claimed",
        claimed_by: data.userId,
        claimed_at: new Date().toISOString(),
      })
      .eq("code", data.inviteCode)
      .eq("status", "pending");
  }

  // Notify admins
  try {
    await notifyNewSignup(data.userId);
  } catch (err) {
    // Don't fail the whole operation if notification fails
    console.error("Failed to notify admins:", err);
  }

  return { success: true, error: null };
}
