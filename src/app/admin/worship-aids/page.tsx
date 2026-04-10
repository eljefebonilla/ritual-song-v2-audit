/**
 * Admin: Worship Aid Builder — Occasion List
 * Lists upcoming occasions (next 8 weeks) with a Build button for each.
 */

export const dynamic = "force-dynamic";

import Link from "next/link";
import fs from "node:fs";
import path from "node:path";

interface OccasionSummary {
  id: string;
  name: string;
  season: string;
  seasonLabel: string;
  nextDate: string | null;
}

const SEASON_BADGE: Record<string, { bg: string; text: string }> = {
  advent: { bg: "bg-purple-100", text: "text-purple-700" },
  christmas: { bg: "bg-amber-100", text: "text-amber-700" },
  lent: { bg: "bg-violet-100", text: "text-violet-700" },
  easter: { bg: "bg-yellow-100", text: "text-yellow-700" },
  "ordinary-time": { bg: "bg-green-100", text: "text-green-700" },
  ordinary: { bg: "bg-green-100", text: "text-green-700" },
};

function getUpcomingOccasions(): OccasionSummary[] {
  const allPath = path.join(process.cwd(), "src/data/all-occasions.json");
  const all = JSON.parse(fs.readFileSync(allPath, "utf-8")) as OccasionSummary[];

  const today = new Date();
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() + 56); // 8 weeks

  const todayStr = today.toISOString().slice(0, 10);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  return all
    .filter((o) => o.nextDate && o.nextDate >= todayStr && o.nextDate <= cutoffStr)
    .sort((a, b) => (a.nextDate ?? "").localeCompare(b.nextDate ?? ""));
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "long",
    day: "numeric",
  });
}

export default function WorshipAidsAdminPage() {
  const occasions = getUpcomingOccasions();

  const badgeFor = (season: string) =>
    SEASON_BADGE[season?.toLowerCase()] ?? { bg: "bg-stone-100", text: "text-stone-600" };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-stone-900 font-serif">Worship Aid Builder</h1>
        <p className="text-sm text-stone-500 mt-1">
          Build and preview printable worship aids for upcoming occasions.
        </p>
      </div>

      {occasions.length === 0 ? (
        <div className="text-center py-12 text-stone-400">
          <p className="text-sm">No upcoming occasions in the next 8 weeks.</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {occasions.map((occasion) => {
            const badge = badgeFor(occasion.season);
            return (
              <div
                key={occasion.id}
                className="flex items-center justify-between p-3 rounded-lg border border-stone-200 hover:border-stone-300 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${badge.bg} ${badge.text} shrink-0`}
                  >
                    {occasion.seasonLabel || occasion.season}
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium text-sm text-stone-800 truncate">
                      {occasion.name}
                    </p>
                    {occasion.nextDate && (
                      <p className="text-xs text-stone-400 mt-0.5">
                        {formatDate(occasion.nextDate)}
                      </p>
                    )}
                  </div>
                </div>

                <Link
                  href={`/admin/worship-aids/${occasion.id}`}
                  className="ml-3 shrink-0 text-xs px-3 py-1.5 border border-stone-300 text-stone-600 rounded-md hover:bg-stone-50 transition-colors"
                >
                  Build
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
