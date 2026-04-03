import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import MassPlanWizardShell from "@/components/planning/MassPlanWizardShell";

export const dynamic = "force-dynamic";

/**
 * Public planning page accessible via share token.
 * Collaborators get this link from the plan creator.
 */
export default async function SharedPlanPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = createAdminClient();

  // Find the session by share token
  const { data: session } = await supabase
    .from("planning_sessions")
    .select("*")
    .eq("share_token", token)
    .single();

  if (!session) notFound();

  // Fetch song library
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
      sessionId={session.id}
      shareToken={session.share_token}
      initialData={{
        massType: session.mass_type,
        schoolLevel: session.school_level,
        title: session.title || "",
        eventDate: session.event_date || "",
        eventTime: session.event_time || "",
        celebrant: session.celebrant || "",
        isBishopCelebrating: session.is_bishop_celebrating,
        hasMusic: session.has_music,
        ensemble: session.ensemble || "",
        cantorRequested: session.cantor_requested,
        pianoRequested: session.piano_requested,
        instrumentRequests: session.instrument_requests || [],
        usesDailyReadings: session.uses_daily_readings,
        customReadings: session.custom_readings || [],
        selections: session.selections || {},
        personnel: session.personnel || {},
        planningNotes: session.planning_notes || "",
      }}
      isDirector={false}
    />
  );
}
