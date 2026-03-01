import { createAdminClient } from "@/lib/supabase/admin";
import { rowToLiturgicalDay } from "@/lib/liturgical-helpers";
import type { LiturgicalDay } from "@/lib/types";
import TriduumShell from "@/components/planner/TriduumShell";

export const dynamic = "force-dynamic";

export default async function TriduumPage() {
  const adminClient = createAdminClient();

  // Find Triduum dates from liturgical_days
  // Holy Thursday = "Thursday of Holy Week (Holy Thursday)" or similar
  // Good Friday = "Friday of the Passion of the Lord (Good Friday)"
  // Easter Vigil = "Holy Saturday" or easter_sunday
  const { data, error } = await adminClient
    .from("liturgical_days")
    .select("*")
    .or(
      "celebration_name.ilike.%holy thursday%," +
      "celebration_name.ilike.%good friday%," +
      "celebration_name.ilike.%passion of the lord%," +
      "celebration_name.ilike.%holy saturday%," +
      "celebration_name.ilike.%easter sunday%"
    )
    .order("date", { ascending: true });

  if (error || !data || data.length === 0) {
    return (
      <div className="p-4 pt-14 md:p-8 md:pt-8 max-w-4xl">
        <h1 className="text-2xl font-bold text-stone-900 mb-2">Sacred Triduum</h1>
        <p className="text-stone-500">No Triduum data found in the liturgical calendar.</p>
      </div>
    );
  }

  const allDays = data.map((row: Record<string, unknown>) => rowToLiturgicalDay(row));

  // Group by liturgical year (use the date to determine year)
  // Find the nearest Triduum (current or next)
  const today = new Date().toISOString().split("T")[0];

  // Find upcoming or most recent Triduum set
  const holyThursdays = allDays.filter((d) =>
    d.celebrationName.toLowerCase().includes("holy thursday")
  );
  const goodFridays = allDays.filter((d) =>
    d.celebrationName.toLowerCase().includes("good friday") ||
    d.celebrationName.toLowerCase().includes("passion of the lord")
  );
  const easterVigils = allDays.filter((d) =>
    d.celebrationName.toLowerCase().includes("holy saturday")
  );
  const easterSundays = allDays.filter((d) =>
    d.celebrationName.toLowerCase().includes("easter sunday")
  );

  // Pick the set closest to today (prefer upcoming)
  const pickNearest = (days: LiturgicalDay[]): LiturgicalDay | null => {
    const upcoming = days.filter((d) => d.date >= today);
    if (upcoming.length > 0) return upcoming[0];
    return days[days.length - 1] || null;
  };

  const triduum = {
    holyThursday: pickNearest(holyThursdays),
    goodFriday: pickNearest(goodFridays),
    easterVigil: pickNearest(easterVigils),
    easterSunday: pickNearest(easterSundays),
  };

  return <TriduumShell triduum={triduum} />;
}
