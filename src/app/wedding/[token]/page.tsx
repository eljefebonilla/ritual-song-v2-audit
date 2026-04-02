import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import WeddingWizardShell from "@/components/wedding/WeddingWizardShell";

export const dynamic = "force-dynamic";

/**
 * Public wedding planning page accessible via share token.
 * No authentication required. Couples get this link from the music director.
 */
export default async function SharedWeddingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = createAdminClient();

  // Find the event by share token
  const { data: event } = await supabase
    .from("sacramental_events")
    .select("*")
    .eq("share_token", token)
    .eq("event_type", "wedding")
    .single();

  if (!event) notFound();

  // Fetch curated wedding songs
  const { data: songs } = await supabase
    .from("sacramental_songs")
    .select("id, title, composer, category, subcategory, instrumentation, is_starred, together_for_life_code, notes, song_id")
    .eq("liturgy_type", "wedding")
    .order("step_number")
    .order("sort_order");

  // Fetch active cantor profiles
  const { data: cantors } = await supabase
    .from("cantor_profiles")
    .select("id, display_name, is_bilingual, voice_type, bio, favorite_wedding_songs, regular_masses, audio_samples")
    .eq("is_active", true)
    .order("display_name");

  return (
    <WeddingWizardShell
      songs={songs || []}
      cantors={cantors || []}
      eventId={event.id}
      initialSelections={event.selections || {}}
      initialDetails={{
        coupleName1: event.couple_names?.split(" & ")[0] || "",
        coupleName2: event.couple_names?.split(" & ")[1] || "",
        contactEmail: event.contact_email || "",
        contactPhone: event.contact_phone || "",
        eventDate: event.event_date || "",
        eventTime: event.event_time || "",
        rehearsalDate: event.rehearsal_date || "",
        rehearsalTime: event.rehearsal_time || "",
        celebrant: event.celebrant || "",
        cantorId: event.cantor_id || null,
        notes: event.custom_notes || "",
      }}
    />
  );
}
