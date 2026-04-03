import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import ParishOnboardWizard from "@/components/parish/ParishOnboardWizard";

export const dynamic = "force-dynamic";

/**
 * /parish/setup — First-time parish setup wizard.
 * Redirects to dashboard if parish is already configured.
 */
export default async function ParishSetupPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  // Check if user already has a parish
  const adminSupabase = createAdminClient();
  const { data: membership } = await adminSupabase
    .from("parish_members")
    .select("parish_id, role")
    .eq("profile_id", user.id)
    .limit(1)
    .single();

  if (membership) {
    // Already has a parish. Check if onboarding is complete.
    const { data: parish } = await adminSupabase
      .from("parishes")
      .select("onboard_status")
      .eq("id", membership.parish_id)
      .single();

    if (parish?.onboard_status === "complete") {
      redirect("/?welcome=returning");
    }
  }

  // Load song library for favorites step
  const { data: songs } = await adminSupabase
    .from("songs")
    .select("id, title, composer")
    .eq("is_hidden_global", false)
    .order("title")
    .limit(300);

  return (
    <div className="min-h-screen bg-stone-50">
      <ParishOnboardWizard
        songs={(songs || []).map((s) => ({
          id: s.id,
          title: s.title,
          composer: s.composer,
        }))}
        userId={user.id}
      />
    </div>
  );
}
