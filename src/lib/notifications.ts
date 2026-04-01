import { createAdminClient } from "@/lib/supabase/admin";
import { sendSMS } from "@/lib/twilio";
import { sendEmail } from "@/lib/resend";

interface NotifyOptions {
  userId: string;
  messageType: string;
  smsBody?: string;
  emailSubject?: string;
  emailHtml?: string;
}

// Core: send notification via SMS and/or email, log to notifications_log
async function notify({
  userId,
  messageType,
  smsBody,
  emailSubject,
  emailHtml,
}: NotifyOptions) {
  const supabase = createAdminClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("phone, email, sms_consent, full_name")
    .eq("id", userId)
    .single();
  if (!profile) return;

  // SMS (only if consent given and phone exists)
  if (smsBody && profile.sms_consent && profile.phone) {
    try {
      const sid = await sendSMS(profile.phone, smsBody);
      await supabase.from("notifications_log").insert({
        recipient_id: userId,
        channel: "sms",
        message_type: messageType,
        external_id: sid,
        status: "sent",
      });
    } catch (err) {
      console.error("SMS send failed:", err);
    }
  }

  // Email
  if (emailSubject && emailHtml && profile.email) {
    try {
      const resendId = await sendEmail(profile.email, emailSubject, emailHtml);
      await supabase.from("notifications_log").insert({
        recipient_id: userId,
        channel: "email",
        message_type: messageType,
        external_id: resendId,
        status: "sent",
      });
    } catch (err) {
      console.error("Email send failed:", err);
    }
  }
}

const APP_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000");

// Notify admins of a new pending signup
export async function notifyNewSignup(newUserId: string) {
  const supabase = createAdminClient();
  const { data: newUser } = await supabase
    .from("profiles")
    .select("full_name, ensemble, musician_role")
    .eq("id", newUserId)
    .single();
  if (!newUser) return;

  const { data: admins } = await supabase
    .from("profiles")
    .select("id")
    .eq("role", "admin")
    .eq("status", "active");
  if (!admins) return;

  for (const admin of admins) {
    await notify({
      userId: admin.id,
      messageType: "new_signup",
      smsBody: `New signup: ${newUser.full_name} wants to join ${newUser.ensemble || "the ministry"}. Review at ${APP_URL}/admin/members`,
      emailSubject: `New signup: ${newUser.full_name}`,
      emailHtml: `<p><strong>${newUser.full_name}</strong> (${newUser.musician_role || "volunteer"}) wants to join ${newUser.ensemble || "the ministry"}.</p><p><a href="${APP_URL}/admin/members">Review in Ritual Song</a></p>`,
    });
  }
}

// Notify user they've been approved
export async function notifyApproval(userId: string) {
  await notify({
    userId,
    messageType: "approved",
    smsBody: `Welcome to St. Monica Music Ministry! You've been approved. Log in at ${APP_URL} Reply STOP to opt out.`,
    emailSubject: "You've been approved!",
    emailHtml: `<p>Welcome to St. Monica Music Ministry! Your account has been approved.</p><p><a href="${APP_URL}">Log in to Ritual Song</a></p>`,
  });
}

// Notify user they've been declined
export async function notifyRejection(userId: string) {
  await notify({
    userId,
    messageType: "rejected",
    emailSubject: "St. Monica Music Ministry — Application Update",
    emailHtml: `<p>Thank you for your interest in St. Monica Music Ministry. Unfortunately, we're unable to approve your application at this time.</p><p>If you have questions, please contact the music office.</p>`,
  });
}

// Send bulk SMS to a list of profile IDs (admin action)
export async function sendBulkSMS(profileIds: string[], message: string) {
  const supabase = createAdminClient();

  // Fetch all selected profiles (not just consented) to report skip reasons
  const { data: allProfiles } = await supabase
    .from("profiles")
    .select("id, phone, sms_consent")
    .in("id", profileIds);
  if (!allProfiles) return { sent: 0, skipped: 0, noConsent: 0, noPhone: 0, failed: 0 };

  let sent = 0;
  let noConsent = 0;
  let noPhone = 0;
  let failed = 0;

  for (const p of allProfiles) {
    if (!p.sms_consent) { noConsent++; continue; }
    if (!p.phone) { noPhone++; continue; }
    try {
      const sid = await sendSMS(p.phone, message);
      await supabase.from("notifications_log").insert({
        recipient_id: p.id,
        channel: "sms",
        message_type: "announcement",
        external_id: sid,
        status: "sent",
      });
      sent++;
    } catch (err) {
      console.error(`SMS to ${p.id} failed:`, err);
      failed++;
    }
  }
  return { sent, skipped: profileIds.length - sent, noConsent, noPhone, failed };
}

// Send bulk email to a list of profile IDs (admin action)
export async function sendBulkEmail(
  profileIds: string[],
  subject: string,
  html: string
) {
  const supabase = createAdminClient();
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email")
    .in("id", profileIds);
  if (!profiles) return { sent: 0, skipped: 0 };

  let sent = 0;
  for (const p of profiles) {
    if (!p.email) continue;
    try {
      const resendId = await sendEmail(p.email, subject, html);
      await supabase.from("notifications_log").insert({
        recipient_id: p.id,
        channel: "email",
        message_type: "announcement",
        external_id: resendId,
        status: "sent",
      });
      sent++;
    } catch (err) {
      console.error(`Email to ${p.id} failed:`, err);
    }
  }
  return { sent, skipped: profileIds.length - sent };
}
