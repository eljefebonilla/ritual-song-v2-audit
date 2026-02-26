import Link from "next/link";
import { getAllOccasions, getSeasons, getCurrentWeekOccasions } from "@/lib/data";
import { SEASON_COLORS } from "@/lib/liturgical-colors";

export default function DashboardPage() {
  const occasions = getAllOccasions();
  const seasons = getSeasons();
  const { thisWeek, nextWeek } = getCurrentWeekOccasions();

  return (
    <div className="p-8 max-w-6xl">
      <h1 className="text-2xl font-bold text-stone-900 mb-1">Dashboard</h1>
      <p className="text-sm text-stone-500 mb-8">
        {occasions.length} liturgical occasions across the 3-year lectionary cycle
      </p>

      {/* This Week / Next Week */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
        {thisWeek && (
          <Link
            href={`/occasion/${thisWeek.id}`}
            className="border border-stone-200 rounded-lg p-5 bg-white hover:shadow-md transition-shadow"
          >
            <p className="text-[10px] uppercase tracking-widest text-stone-400 font-semibold mb-1">
              This Week
            </p>
            <p className="text-lg font-bold text-stone-900">{thisWeek.name}</p>
            <p className="text-sm text-stone-500 mt-1">
              {thisWeek.lectionary.thematicTag}
            </p>
          </Link>
        )}
        {nextWeek && (
          <Link
            href={`/occasion/${nextWeek.id}`}
            className="border border-stone-200 rounded-lg p-5 bg-white hover:shadow-md transition-shadow"
          >
            <p className="text-[10px] uppercase tracking-widest text-stone-400 font-semibold mb-1">
              Next Week
            </p>
            <p className="text-lg font-bold text-stone-900">{nextWeek.name}</p>
            <p className="text-sm text-stone-500 mt-1">
              {nextWeek.lectionary.thematicTag}
            </p>
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

      {/* Seasons overview */}
      <h2 className="text-lg font-bold text-stone-900 mb-4">
        Liturgical Seasons
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {seasons.map((season) => {
          const colors = SEASON_COLORS[season.id];
          return (
            <Link
              key={season.id}
              href={`/season/${season.id}`}
              className="border border-stone-200 rounded-lg overflow-hidden bg-white hover:shadow-md transition-shadow"
            >
              <div
                className="h-2"
                style={{ backgroundColor: colors.primary }}
              />
              <div className="p-4">
                <h3 className="font-bold text-stone-900">{season.label}</h3>
                <p className="text-xs text-stone-400 mt-1">
                  {season.occasions.length} occasions
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
