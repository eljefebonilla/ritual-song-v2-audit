import { createClient } from "@supabase/supabase-js";

/**
 * Server-side Supabase client using the service role key.
 * Bypasses RLS — use only in admin-verified API routes.
 * Uses SUPABASE_URL (server-side) with NEXT_PUBLIC fallback.
 */
export function createAdminClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(`Missing Supabase env vars: url=${!!url}, key=${!!key}`);
  }
  return createClient(url, key, { auth: { persistSession: false } });
}
