import { createClient } from "@/lib/supabase/server";

/**
 * Verify that the current user has admin access.
 * Checks (in order):
 * 1. Local development → always true
 * 2. Supabase auth user with admin role in profiles table
 */
export async function verifyAdmin(): Promise<boolean> {
  // Allow all admin actions in local development
  if (process.env.NODE_ENV === "development") {
    return true;
  }

  return verifyAdminStrict();
}

/**
 * Strict admin verification that ALWAYS requires a real Supabase session
 * with role=admin, regardless of NODE_ENV. Use this in endpoints that
 * publish or affect public surfaces (e.g. shared view CRUD).
 */
export async function verifyAdminStrict(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  return profile?.role === "admin";
}
