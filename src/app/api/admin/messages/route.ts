import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendBulkSMS, sendBulkEmail } from "@/lib/notifications";

type RecipientType = "all" | "ensemble" | "custom";
type Channel = "sms" | "email" | "both";

interface MessageBody {
  recipientType: RecipientType;
  ensemble?: string;
  profileIds?: string[];
  channel: Channel;
  smsBody?: string;
  emailSubject?: string;
  emailBody?: string;
}

/**
 * POST /api/admin/messages
 * Send a bulk SMS and/or email to a resolved recipient list.
 */
export async function POST(req: NextRequest) {
  const isAdmin = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = (await req.json()) as MessageBody;
  const { recipientType, ensemble, profileIds, channel, smsBody, emailSubject, emailBody } = body;

  if (!channel || !["sms", "email", "both"].includes(channel)) {
    return NextResponse.json({ error: "Invalid channel" }, { status: 400 });
  }
  if ((channel === "sms" || channel === "both") && !smsBody?.trim()) {
    return NextResponse.json({ error: "smsBody is required for SMS sends" }, { status: 400 });
  }
  if ((channel === "email" || channel === "both") && (!emailSubject?.trim() || !emailBody?.trim())) {
    return NextResponse.json(
      { error: "emailSubject and emailBody are required for email sends" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  // Resolve recipient list
  let resolvedIds: string[] = [];

  if (recipientType === "all") {
    const { data } = await supabase
      .from("profiles")
      .select("id")
      .eq("status", "active");
    resolvedIds = (data ?? []).map((p) => p.id);
  } else if (recipientType === "ensemble") {
    if (!ensemble) {
      return NextResponse.json({ error: "ensemble is required for ensemble sends" }, { status: 400 });
    }
    const { data } = await supabase
      .from("profiles")
      .select("id")
      .eq("status", "active")
      .eq("ensemble", ensemble);
    resolvedIds = (data ?? []).map((p) => p.id);
  } else if (recipientType === "custom") {
    if (!profileIds?.length) {
      return NextResponse.json({ error: "profileIds required for custom sends" }, { status: 400 });
    }
    resolvedIds = profileIds;
  } else {
    return NextResponse.json({ error: "Invalid recipientType" }, { status: 400 });
  }

  if (resolvedIds.length === 0) {
    return NextResponse.json({ smsSent: 0, emailSent: 0, skipped: 0, total: 0 });
  }

  let smsSent = 0;
  let emailSent = 0;
  let skipped = 0;
  let noConsent = 0;
  let noPhone = 0;

  if (channel === "sms" || channel === "both") {
    const result = await sendBulkSMS(resolvedIds, smsBody!);
    smsSent = result.sent;
    skipped += result.skipped;
    noConsent = result.noConsent;
    noPhone = result.noPhone;
  }

  if (channel === "email" || channel === "both") {
    // Convert plain text body to simple HTML
    const html = emailBody!
      .split("\n\n")
      .map((p) => `<p>${p.replace(/\n/g, "<br/>")}</p>`)
      .join("");
    const result = await sendBulkEmail(resolvedIds, emailSubject!, html);
    emailSent = result.sent;
    skipped += result.skipped;
  }

  return NextResponse.json({
    success: true,
    smsSent,
    emailSent,
    skipped,
    noConsent,
    noPhone,
    total: resolvedIds.length,
  });
}

/**
 * GET /api/admin/messages
 * Returns recent notification log entries for the sent messages history.
 */
export async function GET(_req: NextRequest) {
  const isAdmin = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("notifications_log")
    .select("id, channel, message_type, status, created_at, recipient_id, profiles(full_name)")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ logs: data });
}
