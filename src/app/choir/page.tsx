export const dynamic = "force-dynamic";

import { createAdminClient } from "@/lib/supabase/admin";
import ChoirShell from "@/components/choir/ChoirShell";

export default async function ChoirPage() {
  const supabase = createAdminClient();
  const today = new Date().toISOString().split("T")[0];

  // Fetch upcoming masses that accept choir volunteers
  // Include both traditional volunteer masses AND those flagged with needs_volunteers
  const { data: masses } = await supabase
    .from("mass_events")
    .select("id, title, event_date, start_time_12h, ensemble, choir_descriptor, liturgical_name, occasion_id, celebrant, day_of_week, season, needs_volunteers")
    .gte("event_date", today)
    .eq("event_type", "mass")
    .eq("has_music", true)
    .or("choir_descriptor.in.(Volunteers,Volunteers + SMPREP,SMPREP),needs_volunteers.eq.true")
    .in("ensemble", ["Generations", "Heritage", "Elevations"])
    .order("event_date", { ascending: true })
    .order("start_time", { ascending: true });

  // Fetch signups for these masses
  const massIds = (masses || []).map((m) => m.id);
  const { data: signups } = massIds.length
    ? await supabase
        .from("choir_signups")
        .select("*, profile:profiles (id, full_name, avatar_url, ensemble)")
        .in("mass_event_id", massIds)
        .eq("status", "confirmed")
    : { data: [] };

  return (
    <div className="min-h-screen">
      <ChoirShell masses={masses || []} signups={signups || []} />
    </div>
  );
}
