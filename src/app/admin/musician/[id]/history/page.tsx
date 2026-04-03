import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import MusicianHistoryShell from "@/components/musician/MusicianHistoryShell";

export const dynamic = "force-dynamic";

/**
 * /admin/musician/[id]/history — Admin view of any musician's history.
 * Can set pay rates and generate invoices on their behalf.
 */
export default async function AdminMusicianHistoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("id", id)
    .single();

  if (!profile) notFound();

  return (
    <MusicianHistoryShell
      profileId={profile.id}
      musicianName={profile.full_name || "Musician"}
      isAdmin={true}
    />
  );
}
