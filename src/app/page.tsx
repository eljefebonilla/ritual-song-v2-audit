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
  seasonIds: string[];
  label: string;
  filter?: (occ: { seasonOrder: number }) => boolean;
}[] = [
  { key: "advent", seasonIds: ["advent"], label: "Advent" },
  { key: "christmas", seasonIds: ["christmas"], label: "Christmas" },
  {
    key: "ordinary-i",
    seasonIds: ["ordinary"],
    label: "Ordinary Time I",
    filter: (occ) => occ.seasonOrder > 0 && occ.seasonOrder <= 8,
  },
  { key: "lent", seasonIds: ["lent"], label: "Lent" },
  { key: "holyweek", seasonIds: ["holyweek"], label: "Holy Week" },
  { key: "easter", seasonIds: ["easter"], label: "Easter" },
  {
    key: "ordinary-ii",
    seasonIds: ["ordinary"],
    label: "Ordinary Time II",
    filter: (occ) => occ.seasonOrder > 8,
  },
  { key: "holydays", seasonIds: ["solemnity", "feast"], label: "Holy Days" },
  { key: "holidays", seasonIds: ["holiday"], label: "Holidays" },
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
    <div className="max-w-3xl">
      {/* Ombre hero */}
      <div className="bg-gradient-to-b from-[color-mix(in_srgb,var(--liturgical-theme),transparent_85%)] to-background px-4 pt-14 md:px-8 md:pt-8 pb-6">
        <h1 className="font-serif text-[1.375rem] font-semibold text-parish-charcoal mb-1">Dashboard</h1>
        <p className="text-sm text-muted">
          {occasions.length} liturgical occasions across the 3-year lectionary cycle
        </p>
      </div>
      <div className="px-4 md:px-8">

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
            className="border border-border rounded-lg p-5 bg-surface hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-1">
              <p className="text-[11px] uppercase tracking-widest text-muted font-medium">
                This Week
              </p>
              {thisWeek.dates.length > 0 && (
                <p className="text-[11px] text-muted">
                  {getNearestDate(thisWeek.dates)}
                </p>
              )}
            </div>
            <p className="font-serif text-lg font-semibold text-parish-charcoal">{thisWeek.name}</p>
            <p className="text-sm text-muted mt-1">
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
            className="border border-border rounded-lg p-5 bg-surface hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-1">
              <p className="text-[11px] uppercase tracking-widest text-muted font-medium">
                Next Week
              </p>
              {nextWeek.dates.length > 0 && (
                <p className="text-[11px] text-muted">
                  {getNearestDate(nextWeek.dates)}
                </p>
              )}
            </div>
            <p className="font-serif text-lg font-semibold text-parish-charcoal">{nextWeek.name}</p>
            <p className="text-sm text-muted mt-1">
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
          className="px-4 py-2 bg-parish-burgundy text-white text-sm font-medium rounded-lg hover:bg-parish-burgundy/90 transition-colors"
        >
          Open Planner
        </Link>
        <Link
          href="/library"
          className="px-4 py-2 border border-border bg-surface text-foreground text-sm font-medium rounded-lg hover:bg-subtle transition-colors"
        >
          Song Library
        </Link>
      </div>

      {/* Seasons overview — single column, liturgical order */}
      <h2 className="font-serif text-[1.125rem] font-semibold text-parish-charcoal mb-4">
        Liturgical Year
      </h2>
      <div className="flex flex-col gap-3">
        {LITURGICAL_DISPLAY_ORDER.map((entry) => {
          // Collect occasions from seasons.json OR from all-occasions.json directly
          const entryOccasions = entry.seasonIds.flatMap((sid) => {
            const season = seasonMap.get(sid);
            if (season) return season.occasions;
            // Fallback: filter from all occasions (for seasons not in seasons.json like "holiday")
            return occasions.filter((o) => o.season === sid);
          });

          if (entryOccasions.length === 0) return null;

          const filteredOccasions = entry.filter
            ? entryOccasions.filter(entry.filter)
            : entryOccasions;

          if (filteredOccasions.length === 0) return null;

          // Use the first season's color, or the design system color
          const firstSeason = seasonMap.get(entry.seasonIds[0]);
          const colorKey = entry.seasonIds[0] as keyof typeof SEASON_COLORS;
          const colors = firstSeason ? SEASON_COLORS[firstSeason.id] : (SEASON_COLORS[colorKey] || SEASON_COLORS.ordinary);

          // Link to the first season page (if it exists in seasons.json)
          const linkHref = `/season/${entry.seasonIds[0]}`;

          return (
            <Link
              key={entry.key}
              href={linkHref}
              className="border border-border rounded-lg overflow-hidden bg-surface hover:shadow-md transition-shadow"
            >
              <div
                className="h-1.5"
                style={{ backgroundColor: colors.primary }}
              />
              <div className="p-4 flex items-center justify-between">
                <h3 className="font-serif font-semibold text-parish-charcoal">{entry.label}</h3>
                <p className="text-[11px] text-muted font-medium">
                  {filteredOccasions.length} occasions
                </p>
              </div>
            </Link>
          );
        })}
      </div>
      </div>
    </div>
  );
}
