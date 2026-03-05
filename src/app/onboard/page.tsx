import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { OnboardWizard } from "@/components/onboard/OnboardWizard";

export const dynamic = "force-dynamic";

export default async function OnboardPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  const { invite } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Not authenticated — go to join
  if (!user) {
    redirect("/join");
  }

  // Check existing profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("status, full_name, phone, musician_role, voice_part, instrument_detail, ensemble")
    .eq("id", user.id)
    .single();

  if (profile?.status === "active") {
    redirect("/");
  }

  // Pre-fill from existing profile (pending user editing) or auth metadata (new user)
  const userEmail = user.email || "";
  const userPhone = profile?.phone || user.phone || "";
  const userName = profile?.full_name || user.user_metadata?.full_name || "";

  // Look up invite ensemble server-side (RLS blocks client reads)
  let inviteEnsemble: string | null = null;
  if (invite) {
    const admin = createAdminClient();
    const { data: invitation } = await admin
      .from("invitations")
      .select("ensemble")
      .eq("code", invite)
      .eq("status", "pending")
      .single();
    inviteEnsemble = invitation?.ensemble || null;
  }

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <OnboardWizard
          userId={user.id}
          defaultEmail={userEmail}
          defaultPhone={userPhone}
          defaultName={userName}
          inviteCode={invite || null}
          inviteEnsemble={inviteEnsemble}
          existingProfile={
            profile
              ? {
                  musicianRole: profile.musician_role || "",
                  voicePart: profile.voice_part || "",
                  instrumentDetail: profile.instrument_detail || "",
                  ensemble: profile.ensemble || "",
                }
              : null
          }
        />
      </div>
    </div>
  );
}
