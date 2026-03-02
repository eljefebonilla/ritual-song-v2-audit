import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

/**
 * Verify that the current user has admin access.
 * Checks (in order):
 * 1. Local development → always true
 * 2. Supabase auth user with admin role in profiles table
 * 3. Gate-code user with Music Director toggle active (rs_role_override cookie)
 */
export async function verifyAdmin(): Promise<boolean> {
  // Allow all admin actions in local development
  if (process.env.NODE_ENV === "development") {
    return true;
  }

  // Check Supabase auth first (full account users)
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

  // Fallback: gate-code user with Music Director role toggle
  const cookieStore = await cookies();
  const accessCode = cookieStore.get("rs_access")?.value;
  const roleOverride = cookieStore.get("rs_role_override")?.value;
  if (accessCode && accessCode === process.env.SITE_ACCESS_CODE && roleOverride === "admin") {
    return true;
  }

  return false;
}
