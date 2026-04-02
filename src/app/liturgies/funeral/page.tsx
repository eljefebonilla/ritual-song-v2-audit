import { createAdminClient } from "@/lib/supabase/admin";
import FuneralWizardShell from "@/components/funeral/FuneralWizardShell";

export const dynamic = "force-dynamic";

export default async function FuneralPage() {
  const supabase = createAdminClient();

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
      isDirector={true}
    />
  );
}
