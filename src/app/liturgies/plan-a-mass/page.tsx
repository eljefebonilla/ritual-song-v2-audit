import { createAdminClient } from "@/lib/supabase/admin";
import MassPlanWizardShell from "@/components/planning/MassPlanWizardShell";

export const dynamic = "force-dynamic";

export default async function PlanAMassPage() {
  const supabase = createAdminClient();

  // Fetch song library for selection step
  const { data: songs } = await supabase
    .from("songs")
    .select("id, title, composer")
    .eq("is_hidden_global", false)
    .order("title")
    .limit(500);

  return (
    <MassPlanWizardShell
      songs={(songs || []).map((s) => ({
        id: s.id,
        title: s.title,
        composer: s.composer,
      }))}
      isDirector={true}
    />
  );
}
