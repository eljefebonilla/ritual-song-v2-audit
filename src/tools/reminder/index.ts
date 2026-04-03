/**
 * Reminder Tool — MCP-style tool server for staffing checks + reminders
 * Ref: DESIGN-SPEC-v2.md 11.11
 *
 * Tool handlers:
 * - reminder.scanUpcoming: Scan upcoming Masses for understaffing + pending reminders
 * - reminder.sendReminders: Send SMS/email reminders to confirmed musicians
 * - reminder.sendUnderstaffedAlert: Alert admin about understaffed Masses
 */

import type { ToolDefinition } from "@/runtime/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendSMS } from "@/lib/twilio";
import { sendEmail } from "@/lib/resend";
import type {
  UnderstaffedMass,
  MissingRole,
  FilledRole,
  ReminderCandidate,
  ScanResult,
  StaffingConfig,
} from "./types";
import { DEFAULT_STAFFING_CONFIG } from "./types";

export type { UnderstaffedMass, ReminderCandidate, ScanResult, StaffingConfig } from "./types";
export { DEFAULT_STAFFING_CONFIG } from "./types";

const APP_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

export function createReminderTools(): ToolDefinition[] {
  return [
    {
      name: "reminder.scanUpcoming",
      description:
        "Scan upcoming Masses within the lookahead window. Returns understaffed Masses (missing required roles) and musicians due for reminders.",
      permissionLevel: "allow",
      handler: async (args) => {
        const config = (args as { config?: Partial<StaffingConfig> }).config;
        return scanUpcoming({ ...DEFAULT_STAFFING_CONFIG, ...config });
      },
    },
    {
      name: "reminder.sendReminders",
      description:
        "Send SMS/email reminders to confirmed musicians for upcoming Masses. Respects SMS consent and notification preferences.",
      permissionLevel: "prompt",
      handler: async (args) => {
        const { candidates } = args as { candidates: ReminderCandidate[] };
        return sendReminders(candidates);
      },
    },
    {
      name: "reminder.sendUnderstaffedAlert",
      description:
        "Send an alert to admins about understaffed Masses that need attention.",
      permissionLevel: "prompt",
      handler: async (args) => {
        const { masses } = args as { masses: UnderstaffedMass[] };
        return sendUnderstaffedAlert(masses);
      },
    },
  ];
}

async function scanUpcoming(config: StaffingConfig): Promise<ScanResult> {
  const supabase = createAdminClient();
  const today = new Date();
  const lookAhead = new Date(today);
  lookAhead.setDate(today.getDate() + config.understaffedLookaheadDays);

  const todayStr = today.toISOString().split("T")[0];
  const lookAheadStr = lookAhead.toISOString().split("T")[0];

  // Fetch upcoming Masses with music
  const { data: masses } = await supabase
    .from("mass_events")
    .select(`
      id, event_date, start_time_12h, liturgical_name, community, celebrant, has_music,
      booking_slots (
        id, profile_id, person_name, confirmation,
        ministry_role:ministry_roles(id, name),
        profile:profiles(id, full_name, phone, email, sms_consent)
      )
    `)
    .gte("event_date", todayStr)
    .lte("event_date", lookAheadStr)
    .eq("has_music", true)
    .in("event_type", ["mass", "school", "holy_day"])
    .order("event_date")
    .order("start_time");

  // Fetch required roles
  const { data: roles } = await supabase
    .from("ministry_roles")
    .select("id, name")
    .in("name", config.requiredRoles);

  const requiredRoleMap = new Map((roles || []).map((r) => [r.name, r.id]));

  const understaffedMasses: UnderstaffedMass[] = [];
  const upcomingReminders: ReminderCandidate[] = [];

  for (const mass of masses || []) {
    const slots = (mass.booking_slots || []) as unknown as Array<{
      id: string;
      profile_id: string | null;
      person_name: string | null;
      confirmation: string;
      ministry_role: { id: string; name: string } | null;
      profile: { id: string; full_name: string; phone: string | null; email: string | null; sms_consent: boolean } | null;
    }>;

    const eventDate = new Date(mass.event_date + "T12:00:00");
    const daysUntil = Math.ceil((eventDate.getTime() - today.getTime()) / 86_400_000);

    // Check for missing required roles
    const filledRoleNames = new Set(
      slots
        .filter((s) => s.confirmation !== "declined")
        .map((s) => (s.ministry_role as { name: string } | null)?.name)
        .filter(Boolean)
    );

    const missingRoles: MissingRole[] = [];
    for (const [roleName, roleId] of requiredRoleMap) {
      if (!filledRoleNames.has(roleName)) {
        missingRoles.push({ roleId, roleName });
      }
    }

    const filledRoles: FilledRole[] = slots
      .filter((s) => s.confirmation !== "declined")
      .map((s) => ({
        roleId: (s.ministry_role as { id: string } | null)?.id || "",
        roleName: (s.ministry_role as { name: string } | null)?.name || "",
        profileId: s.profile_id,
        personName: s.person_name,
        fullName: (s.profile as { full_name: string } | null)?.full_name || null,
        confirmation: s.confirmation,
      }));

    if (missingRoles.length > 0) {
      understaffedMasses.push({
        massEventId: mass.id,
        eventDate: mass.event_date,
        startTime12h: mass.start_time_12h,
        liturgicalName: mass.liturgical_name,
        ensemble: mass.community,
        celebrant: mass.celebrant,
        daysUntil,
        missingRoles,
        filledRoles,
        totalExpected: config.requiredRoles.length,
        totalFilled: filledRoles.length,
      });
    }

    // Build reminder candidates for musicians who need a nudge
    for (const daysBefore of config.reminderDaysBefore) {
      if (daysUntil === daysBefore) {
        for (const slot of slots) {
          if (slot.confirmation === "declined" || !slot.profile_id) continue;
          const profile = slot.profile as { id: string; full_name: string; phone: string | null; email: string | null; sms_consent: boolean } | null;
          if (!profile) continue;

          upcomingReminders.push({
            profileId: profile.id,
            fullName: profile.full_name,
            phone: profile.phone,
            email: profile.email,
            smsConsent: profile.sms_consent,
            massEventId: mass.id,
            eventDate: mass.event_date,
            startTime12h: mass.start_time_12h,
            liturgicalName: mass.liturgical_name,
            roleName: (slot.ministry_role as { name: string } | null)?.name || "musician",
            confirmation: slot.confirmation,
          });
        }
      }
    }
  }

  return {
    understaffedMasses,
    upcomingReminders,
    scannedAt: new Date().toISOString(),
  };
}

async function sendReminders(
  candidates: ReminderCandidate[]
): Promise<{ sent: number; skipped: number; errors: number }> {
  const supabase = createAdminClient();
  let sent = 0;
  let skipped = 0;
  let errors = 0;

  for (const c of candidates) {
    const dateStr = new Date(c.eventDate + "T12:00:00").toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
    const timeStr = c.startTime12h || "";
    const celebration = c.liturgicalName || "Mass";

    // SMS (if consent + phone)
    if (c.smsConsent && c.phone) {
      const isUnconfirmed = c.confirmation === "unconfirmed" || c.confirmation === "pending";
      const body = isUnconfirmed
        ? `St. Monica Music: ${c.fullName}, you're scheduled as ${c.roleName} for ${celebration} on ${dateStr} ${timeStr}. Can you make it? Reply YES to confirm or NO if you need a sub.`
        : `St. Monica Music: Reminder, you're confirmed as ${c.roleName} for ${celebration} on ${dateStr} ${timeStr}. See your setlist: ${APP_URL}/booking`;

      try {
        const sid = await sendSMS(c.phone, body);
        await supabase.from("notifications_log").insert({
          recipient_id: c.profileId,
          channel: "sms",
          message_type: isUnconfirmed ? "confirmation_request" : "mass_reminder",
          external_id: sid,
          status: "sent",
        });
        sent++;
      } catch (err) {
        console.error(`Reminder SMS to ${c.fullName} failed:`, err);
        errors++;
      }
    } else if (c.email) {
      // Fallback to email
      try {
        const subject = `Reminder: ${c.roleName} for ${celebration} on ${dateStr}`;
        const html = `<p>Hi ${c.fullName},</p><p>You're scheduled as <strong>${c.roleName}</strong> for ${celebration} on ${dateStr} ${timeStr}.</p><p><a href="${APP_URL}/booking">View your assignments</a></p><p>St. Monica Music Ministry</p>`;
        const resendId = await sendEmail(c.email, subject, html);
        await supabase.from("notifications_log").insert({
          recipient_id: c.profileId,
          channel: "email",
          message_type: "mass_reminder",
          external_id: resendId,
          status: "sent",
        });
        sent++;
      } catch (err) {
        console.error(`Reminder email to ${c.fullName} failed:`, err);
        errors++;
      }
    } else {
      skipped++;
    }
  }

  return { sent, skipped, errors };
}

async function sendUnderstaffedAlert(
  masses: UnderstaffedMass[]
): Promise<{ alertsSent: number }> {
  if (masses.length === 0) return { alertsSent: 0 };

  const supabase = createAdminClient();

  // Get admin profiles with SMS consent
  const { data: admins } = await supabase
    .from("profiles")
    .select("id, phone, email, sms_consent, full_name")
    .eq("role", "admin")
    .eq("status", "active");

  if (!admins || admins.length === 0) return { alertsSent: 0 };

  // Build alert message
  const lines = masses.slice(0, 5).map((m) => {
    const dateStr = new Date(m.eventDate + "T12:00:00").toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    const missing = m.missingRoles.map((r) => r.roleName).join(", ");
    return `${dateStr} ${m.startTime12h || ""} ${m.liturgicalName || "Mass"}: needs ${missing}`;
  });

  const smsBody = `Ritual Song Staffing Alert:\n${lines.join("\n")}\n\nView: ${APP_URL}/admin/staffing`;
  const emailHtml = `<h2>Staffing Alert</h2><p>${masses.length} upcoming Mass${masses.length > 1 ? "es" : ""} need${masses.length === 1 ? "s" : ""} attention:</p><ul>${lines.map((l) => `<li>${l}</li>`).join("")}</ul><p><a href="${APP_URL}/admin/staffing">View staffing dashboard</a></p>`;

  let alertsSent = 0;

  for (const admin of admins) {
    if (admin.sms_consent && admin.phone) {
      try {
        await sendSMS(admin.phone, smsBody);
        alertsSent++;
      } catch (err) {
        console.error(`Staffing alert to ${admin.full_name} failed:`, err);
      }
    } else if (admin.email) {
      try {
        await sendEmail(admin.email, `Staffing Alert: ${masses.length} Masses need musicians`, emailHtml);
        alertsSent++;
      } catch (err) {
        console.error(`Staffing alert email to ${admin.full_name} failed:`, err);
      }
    }
  }

  return { alertsSent };
}
