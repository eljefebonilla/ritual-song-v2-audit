import { createClient, SupabaseClient } from "@supabase/supabase-js";

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

/**
 * Resolve a legacy string song ID to its UUID in the songs table.
 * Returns null if not found.
 */
export async function resolveSongUuid(
  supabase: SupabaseClient,
  legacyId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("songs")
    .select("id")
    .eq("legacy_id", legacyId)
    .single();
  return data?.id ?? null;
}

/**
 * Batch-resolve legacy string song IDs to UUIDs.
 * Returns a Map of legacyId → uuid.
 */
export async function resolveSongUuids(
  supabase: SupabaseClient,
  legacyIds: string[]
): Promise<Map<string, string>> {
  const { data } = await supabase
    .from("songs")
    .select("id, legacy_id")
    .in("legacy_id", legacyIds);
  const map = new Map<string, string>();
  for (const row of data || []) {
    if (row.legacy_id) map.set(row.legacy_id, row.id);
  }
  return map;
}
