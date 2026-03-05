import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendSMS } from "@/lib/twilio";
import { sendEmail } from "@/lib/resend";
import { createClient } from "@/lib/supabase/server";

const APP_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000");

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I/O/0/1 for clarity
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/**
 * POST /api/admin/invitations
 * Body: { phone?: string, email?: string, ensemble?: string }
 * Creates an invitation record and sends via SMS or email.
 */
export async function POST(req: NextRequest) {
  const isAdmin = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await req.json();
  const { phone, email, ensemble } = body as {
    phone?: string;
    email?: string;
    ensemble?: string;
  };

  if (!phone && !email) {
    return NextResponse.json(
      { error: "phone or email is required" },
      { status: 400 }
    );
  }

  // Resolve inviting admin's ID
  let invitedBy: string | null = null;
  try {
    const userSupabase = await createClient();
    const {
      data: { user },
    } = await userSupabase.auth.getUser();
    invitedBy = user?.id ?? null;
  } catch {
    // Not critical if we can't resolve inviter in dev
  }

  const supabase = createAdminClient();
  const code = generateCode();

  const { error: insertError } = await supabase.from("invitations").insert({
    code,
    invited_by: invitedBy,
    invited_phone: phone ?? null,
    invited_email: email ?? null,
    ensemble: ensemble ?? null,
    status: "pending",
  });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  const joinUrl = `${APP_URL}/join/${code}`;
  const errors: string[] = [];

  // Send SMS if phone provided
  if (phone) {
    try {
      await sendSMS(
        phone,
        `St. Monica Music Ministry: You've been invited to join! Sign up here: ${joinUrl} Reply STOP to opt out.`
      );
    } catch (err) {
      console.error("Invitation SMS failed:", err);
      errors.push("SMS send failed");
    }
  }

  // Send email if email provided
  if (email) {
    try {
      await sendEmail(
        email,
        "You're invited to join St. Monica Music Ministry",
        `<p>You've been invited to join St. Monica Music Ministry's Ritual Song scheduling system.</p>
        <p><a href="${joinUrl}" style="background:#1a1a1a;color:#fff;padding:10px 20px;text-decoration:none;border-radius:4px;display:inline-block;">Sign Up Now</a></p>
        <p>Or copy this link: ${joinUrl}</p>
        <p>This invitation expires in 30 days.</p>`
      );
    } catch (err) {
      console.error("Invitation email failed:", err);
      errors.push("Email send failed");
    }
  }

  return NextResponse.json({
    success: true,
    code,
    joinUrl,
    warnings: errors.length > 0 ? errors : undefined,
  });
}

/**
 * GET /api/admin/invitations
 * Returns recent invitations for the admin UI.
 */
export async function GET(_req: NextRequest) {
  const isAdmin = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("invitations")
    .select("id, code, invited_phone, invited_email, ensemble, status, created_at, expires_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ invitations: data });
}
