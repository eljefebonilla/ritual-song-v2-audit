import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateTwilioSignature } from "@/lib/twilio";

// Keywords that trigger a join invitation
const JOIN_KEYWORDS = new Set(["JOIN", "STMONICA", "SIGNUP"]);

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I/O/0/1 for clarity
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const params: Record<string, string> = {};
  formData.forEach((value, key) => {
    params[key] = value.toString();
  });

  const body = (params.Body || "").trim().toUpperCase();
  const from = params.From || "";

  // Validate Twilio signature in production
  if (process.env.NODE_ENV === "production") {
    const signature = req.headers.get("x-twilio-signature") || "";
    const url = `${process.env.NEXT_PUBLIC_SITE_URL || `https://${process.env.VERCEL_URL}`}/api/webhooks/twilio`;
    if (!validateTwilioSignature(url, params, signature)) {
      return new NextResponse("Forbidden", { status: 403 });
    }
  }

  const supabase = createAdminClient();

  // Handle STOP — update sms_consent
  if (body === "STOP") {
    await supabase
      .from("profiles")
      .update({ sms_consent: false, sms_consent_at: new Date().toISOString() })
      .eq("phone", from);

    // Twilio auto-handles STOP replies, so we just update our DB
    return twiml("You have been unsubscribed. Reply JOIN to re-subscribe.");
  }

  // Handle HELP
  if (body === "HELP") {
    return twiml(
      "St. Monica Music Ministry. Reply JOIN to sign up. Reply STOP to unsubscribe. Contact: music@stmonica.net"
    );
  }

  // Handle JOIN keywords
  if (JOIN_KEYWORDS.has(body)) {
    // Check if phone already has a pending invitation
    const { data: existing } = await supabase
      .from("invitations")
      .select("code")
      .eq("invited_phone", from)
      .eq("status", "pending")
      .limit(1)
      .single();

    let code: string;
    if (existing) {
      code = existing.code;
    } else {
      code = generateCode();
      await supabase.from("invitations").insert({
        code,
        invited_phone: from,
        status: "pending",
      });
    }

    const appUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://ritualsong.app");
    return twiml(
      `St. Monica Music Ministry: Welcome! Sign up here: ${appUrl}/join/${code} For help, reply HELP. To opt out, reply STOP. Msg & data rates may apply.`
    );
  }

  // Default: unrecognized message
  return twiml(
    "St. Monica Music Ministry: Reply JOIN to sign up, HELP for info, or STOP to unsubscribe."
  );
}

// Build TwiML response
function twiml(message: string): NextResponse {
  const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(message)}</Message></Response>`;
  return new NextResponse(xml, {
    headers: { "Content-Type": "text/xml" },
  });
}

function escapeXml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
