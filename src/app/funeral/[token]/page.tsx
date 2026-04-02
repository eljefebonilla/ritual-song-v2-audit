import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import FuneralWizardShell from "@/components/funeral/FuneralWizardShell";

export const dynamic = "force-dynamic";

/**
 * Public funeral planning page accessible via share token.
 * No authentication required. Families get this link from the music director.
 */
export default async function SharedFuneralPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = createAdminClient();

  const { data: event } = await supabase
    .from("sacramental_events")
    .select("*")
    .eq("share_token", token)
    .eq("event_type", "funeral")
    .single();

  if (!event) notFound();

  const { data: songs } = await supabase
    .from("sacramental_songs")
    .select("id, title, composer, category, subcategory, instrumentation, is_starred, together_for_life_code, notes, song_id, step_number, audio_url, youtube_url, psalm_number")
    .eq("liturgy_type", "funeral")
    .order("step_number")
    .order("sort_order");

  const { data: cantors } = await supabase
    .from("cantor_profiles")
    .select("id, display_name, is_bilingual, voice_type, bio, favorite_wedding_songs, regular_masses, audio_samples")
    .eq("is_active", true)
    .order("display_name");

  return (
    <FuneralWizardShell
      songs={songs || []}
      cantors={cantors || []}
      eventId={event.id}
      initialSelections={event.selections || {}}
      initialDetails={{
        deceasedName: event.deceased_name || "",
        contactName: event.contact_name || "",
        contactEmail: event.contact_email || "",
        contactPhone: event.contact_phone || "",
        eventDate: event.event_date || "",
        eventTime: event.event_time || "",
        celebrant: event.celebrant || "",
        cantorId: event.cantor_id || null,
        serviceType: "full_mass",
        notes: event.custom_notes || "",
      }}
    />
  );
}
