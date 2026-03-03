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

  // Check Supabase auth (full account users)
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    return profile?.role === "admin";
  }

  return false;
}
