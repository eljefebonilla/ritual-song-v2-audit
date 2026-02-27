import { createClient } from "@/lib/supabase/server";

/**
 * Verify that the current user has admin access.
 * In local development (localhost), skips auth to allow gate-code users
 * to use admin features without a Supabase account.
 */
export async function verifyAdmin(): Promise<boolean> {
  // Allow all admin actions in local development
  if (process.env.NODE_ENV === "development") {
    return true;
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  return profile?.role === "admin";
}
