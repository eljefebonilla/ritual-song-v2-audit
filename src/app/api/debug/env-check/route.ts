import { NextResponse } from "next/server";

/**
 * GET /api/debug/env-check — Check which env vars are set (names only, no values)
 * TEMPORARY: Remove after confirming env vars are working.
 */
export async function GET() {
  const vars = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "TWILIO_ACCOUNT_SID",
    "TWILIO_AUTH_TOKEN",
    "TWILIO_PHONE_NUMBER",
    "TWILIO_MESSAGING_SERVICE_SID",
    "RESEND_API_KEY",
    "RESEND_FROM_EMAIL",
    "OPENROUTER_API_KEY",
    "CRON_SECRET",
  ];

  const status: Record<string, boolean> = {};
  for (const v of vars) {
    status[v] = !!process.env[v];
  }

  return NextResponse.json({
    env: status,
    nodeEnv: process.env.NODE_ENV,
    vercelUrl: process.env.VERCEL_URL || null,
  });
}
