import { createAdminClient } from "@/lib/supabase/admin";
import WeddingWizardShell from "@/components/wedding/WeddingWizardShell";

export const dynamic = "force-dynamic";

export default async function WeddingPage() {
  const supabase = createAdminClient();

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
    />
  );
}
