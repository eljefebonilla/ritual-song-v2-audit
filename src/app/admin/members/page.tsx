export const dynamic = "force-dynamic";

import { createAdminClient } from "@/lib/supabase/admin";
import MembersShell from "@/components/admin/MembersShell";

export default async function MembersPage() {
  const supabase = createAdminClient();

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, email, phone, ensemble, voice_part, instrument, role, avatar_url, created_at")
    .order("full_name");

  return (
    <div className="min-h-screen">
      <MembersShell profiles={profiles || []} />
    </div>
  );
}
