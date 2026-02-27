import { createAdminClient } from "@/lib/supabase/admin";
import ChoirShell from "@/components/choir/ChoirShell";

export default async function ChoirPage() {
  const supabase = createAdminClient();
  const today = new Date().toISOString().split("T")[0];

  // Fetch upcoming masses that accept choir volunteers
  const { data: masses } = await supabase
    .from("mass_events")
    .select("id, title, event_date, start_time_12h, community, choir_descriptor, liturgical_name, occasion_id, celebrant, day_of_week, season")
    .gte("event_date", today)
    .eq("event_type", "mass")
    .eq("has_music", true)
    .in("choir_descriptor", ["Volunteers", "Volunteers + SMPREP", "SMPREP"])
    .order("event_date", { ascending: true })
    .order("start_time", { ascending: true });

  // Fetch signups for these masses
  const massIds = (masses || []).map((m) => m.id);
  const { data: signups } = massIds.length
    ? await supabase
        .from("choir_signups")
        .select("*, profile:profiles (id, full_name, avatar_url, community)")
        .in("mass_event_id", massIds)
        .eq("status", "confirmed")
    : { data: [] };

  return (
    <div className="min-h-screen">
      <ChoirShell masses={masses || []} signups={signups || []} />
    </div>
  );
}
