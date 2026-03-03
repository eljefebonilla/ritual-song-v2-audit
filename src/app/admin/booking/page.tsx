export const dynamic = "force-dynamic";

import { createAdminClient } from "@/lib/supabase/admin";
import BookingShell from "@/components/booking/BookingShell";

function getWeekRange(): { from: string; to: string } {
  const now = new Date();
  // Start from this Sunday
  const day = now.getDay();
  const sunday = new Date(now);
  sunday.setDate(now.getDate() - day);
  // Show 4 weeks ahead
  const end = new Date(sunday);
  end.setDate(sunday.getDate() + 27);
  return {
    from: sunday.toISOString().split("T")[0],
    to: end.toISOString().split("T")[0],
  };
}

export default async function BookingPage() {
  const supabase = createAdminClient();
  const { from, to } = getWeekRange();

  const { data: masses } = await supabase
    .from("mass_events")
    .select(`
      id, title, event_date, start_time, start_time_12h, ensemble, celebrant,
      liturgical_name, occasion_id, season, booking_status, choir_descriptor,
      has_music, day_of_week,
      booking_slots (
        *,
        profile:profiles (id, full_name, avatar_url),
        ministry_role:ministry_roles (id, name, sort_order)
      )
    `)
    .gte("event_date", from)
    .lte("event_date", to)
    .eq("event_type", "mass")
    .eq("has_music", true)
    .order("event_date", { ascending: true })
    .order("start_time", { ascending: true });

  const { data: roles } = await supabase
    .from("ministry_roles")
    .select("id, name, sort_order")
    .order("sort_order", { ascending: true });

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, role, ensemble, voice_part, instrument")
    .order("full_name");

  return (
    <div className="min-h-screen">
      <BookingShell
        initialMasses={masses || []}
        roles={roles || []}
        profiles={profiles || []}
        initialFrom={from}
        initialTo={to}
      />
    </div>
  );
}
