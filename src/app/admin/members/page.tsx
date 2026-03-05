export const dynamic = "force-dynamic";

import { createAdminClient } from "@/lib/supabase/admin";
import MembersShell from "@/components/admin/MembersShell";

export default async function MembersPage() {
  const supabase = createAdminClient();

  const { data: profiles } = await supabase
    .from("profiles")
    .select(
      "id, full_name, email, phone, ensemble, voice_part, instrument, instrument_detail, musician_role, role, avatar_url, created_at, status, sms_consent"
    )
    .order("full_name");

  const allProfiles = profiles || [];
  const pendingCount = allProfiles.filter((p) => p.status === "pending").length;

  return (
    <div className="min-h-screen">
      <MembersShell profiles={allProfiles} pendingCount={pendingCount} />
    </div>
  );
}
