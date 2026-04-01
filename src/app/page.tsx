import Link from "next/link";
import { getAllOccasions, getSeasons, getCurrentWeekOccasions, getSynopsis } from "@/lib/data";
import { SEASON_COLORS } from "@/lib/liturgical-colors";
import type { SeasonGroup, LiturgicalDay } from "@/lib/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { rowToLiturgicalDay } from "@/lib/liturgical-helpers";
import SeasonAlert from "@/components/ui/SeasonAlert";

/**
 * Liturgical year display order, splitting Ordinary Time into two halves:
 * Advent → Christmas → OT I (seasonOrder ≤ 8) → Lent → Easter → OT II (seasonOrder > 8)
 * Solemnities and Feasts go at the end.
 */
const LITURGICAL_DISPLAY_ORDER: {
  key: string;
  seasonId: string;
  label: string;
  filter?: (occ: { seasonOrder: number }) => boolean;
}[] = [
  { key: "advent", seasonId: "advent", label: "Advent" },
  { key: "christmas", seasonId: "christmas", label: "Christmas" },
  {
    key: "ordinary-i",
    seasonId: "ordinary",
    label: "Ordinary Time I",
    filter: (occ) => occ.seasonOrder > 0 && occ.seasonOrder <= 8,
  },
  { key: "lent", seasonId: "lent", label: "Lent" },
  { key: "holyweek", seasonId: "holyweek", label: "Holy Week" },
  { key: "easter", seasonId: "easter", label: "Easter" },
  {
    key: "ordinary-ii",
    seasonId: "ordinary",
    label: "Ordinary Time II",
    filter: (occ) => occ.seasonOrder > 8,
  },
  { key: "solemnity", seasonId: "solemnity", label: "Solemnities" },
  { key: "feast", seasonId: "feast", label: "Feasts" },
];

function getNearestDate(dates: { date: string; label: string }[]): string | null {
  if (!dates.length) return null;
  const now = Date.now();
  let best = dates[0];
  let bestDiff = Infinity;
  for (const d of dates) {
    const diff = Math.abs(new Date(d.date).getTime() - now);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = d;
    }
  }
  return new Date(best.date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const occasions = getAllOccasions();
  const seasons = getSeasons();
  const { thisWeek, nextWeek } = getCurrentWeekOccasions();
  const thisWeekSynopsis = thisWeek ? getSynopsis(thisWeek.id) : null;
  const nextWeekSynopsis = nextWeek ? getSynopsis(nextWeek.id) : null;

  // Fetch liturgical days for season alert (next 21 days)
  let liturgicalDays: LiturgicalDay[] = [];
  try {
    const adminClient = createAdminClient();
    const today = new Date().toISOString().split("T")[0];
    const future = new Date();
    future.setDate(future.getDate() + 21);
    const futureStr = future.toISOString().split("T")[0];
    const { data } = await adminClient
      .from("liturgical_days")
      .select("*")
      .gte("date", today)
      .lte("date", futureStr)
      .order("date", { ascending: true });
    if (data) {
      liturgicalDays = data.map((row: Record<string, unknown>) => rowToLiturgicalDay(row));
    }
  } catch {
    // Silently fail — season alert is non-critical
  }

  const seasonMap = new Map<string, SeasonGroup>();
  for (const s of seasons) {
    seasonMap.set(s.id, s);
  }

  return (
    <div className="p-4 pt-14 md:p-8 md:pt-8 max-w-3xl">
      <h1 className="text-2xl font-bold text-stone-900 mb-1">Dashboard</h1>
      <p className="text-sm text-stone-500 mb-8">
        {occasions.length} liturgical occasions across the 3-year lectionary cycle
      </p>

      {/* Season transition alert */}
      {liturgicalDays.length > 0 && (
        <div className="mb-6">
          <SeasonAlert liturgicalDays={liturgicalDays} />
        </div>
      )}

      {/* This Week / Next Week */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
        {thisWeek && (
          <Link
            href={`/occasion/${thisWeek.id}`}
            className="border border-stone-200 rounded-lg p-5 bg-white hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] uppercase tracking-widest text-stone-400 font-semibold">
                This Week
              </p>
              {thisWeek.dates.length > 0 && (
                <p className="text-[10px] text-stone-400">
                  {getNearestDate(thisWeek.dates)}
                </p>
              )}
            </div>
            <p className="text-lg font-bold text-stone-900">{thisWeek.name}</p>
            <p className="text-sm text-stone-500 mt-1">
              {thisWeek.lectionary.thematicTag}
            </p>
            {thisWeekSynopsis?.logline && (
              <p className="text-xs text-stone-400 mt-1 line-clamp-2">
                {thisWeekSynopsis.logline}
              </p>
            )}
          </Link>
        )}
        {nextWeek && (
          <Link
            href={`/occasion/${nextWeek.id}`}
            className="border border-stone-200 rounded-lg p-5 bg-white hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] uppercase tracking-widest text-stone-400 font-semibold">
                Next Week
              </p>
              {nextWeek.dates.length > 0 && (
                <p className="text-[10px] text-stone-400">
                  {getNearestDate(nextWeek.dates)}
                </p>
              )}
            </div>
            <p className="text-lg font-bold text-stone-900">{nextWeek.name}</p>
            <p className="text-sm text-stone-500 mt-1">
              {nextWeek.lectionary.thematicTag}
            </p>
            {nextWeekSynopsis?.logline && (
              <p className="text-xs text-stone-400 mt-1 line-clamp-2">
                {nextWeekSynopsis.logline}
              </p>
            )}
          </Link>
        )}
      </div>

      {/* Quick links */}
      <div className="flex gap-3 mb-10">
        <Link
          href="/planner"
          className="px-4 py-2 bg-stone-900 text-white text-sm font-medium rounded-lg hover:bg-stone-800 transition-colors"
        >
          Open Planner
        </Link>
        <Link
          href="/library"
          className="px-4 py-2 border border-stone-300 text-stone-700 text-sm font-medium rounded-lg hover:bg-stone-50 transition-colors"
        >
          Song Library
        </Link>
      </div>

      {/* Seasons overview — single column, liturgical order */}
      <h2 className="text-lg font-bold text-stone-900 mb-4">
        Liturgical Year
      </h2>
      <div className="flex flex-col gap-3">
        {LITURGICAL_DISPLAY_ORDER.map((entry) => {
          const season = seasonMap.get(entry.seasonId);
          if (!season) return null;

          const filteredOccasions = entry.filter
            ? season.occasions.filter(entry.filter)
            : season.occasions;

          const colors = SEASON_COLORS[season.id];

          return (
            <Link
              key={entry.key}
              href={`/season/${season.id}`}
              className="border border-stone-200 rounded-lg overflow-hidden bg-white hover:shadow-md transition-shadow"
            >
              <div
                className="h-2"
                style={{ backgroundColor: colors.primary }}
              />
              <div className="p-4 flex items-center justify-between">
                <h3 className="font-bold text-stone-900">{entry.label}</h3>
                <p className="text-xs text-stone-400">
                  {filteredOccasions.length} occasions
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
