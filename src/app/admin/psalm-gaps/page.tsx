import { getAllOccasions, getOccasion } from "@/lib/data";
import { getSongLibrary } from "@/lib/song-library";
import { analyzePsalmCoverage, coverageSummary } from "@/lib/psalm-coverage";

export default function PsalmGapsPage() {
  const occasionSummaries = getAllOccasions();
  const library = getSongLibrary();

  // Load full occasion data to get readings
  const occasions = occasionSummaries
    .map((s) => {
      const occ = getOccasion(s.id);
      if (!occ) return null;
      return { id: s.id, readings: occ.readings };
    })
    .filter((o): o is NonNullable<typeof o> => o !== null);

  const entries = analyzePsalmCoverage(occasions, library);
  const summary = coverageSummary(entries);

  return (
    <div className="p-4 pt-14 md:p-8 md:pt-8 max-w-4xl">
      <h1 className="text-2xl font-bold text-stone-900 mb-1">
        Psalm Coverage Report
      </h1>
      <p className="text-sm text-stone-500 mb-6">
        Cross-references lectionary psalm citations against song library settings.
      </p>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <StatCard label="Total Psalms" value={summary.total} />
        <StatCard label="Covered" value={summary.covered} accent="text-green-700" />
        <StatCard label="Gaps" value={summary.gapCount} accent="text-red-700" />
        <StatCard label="Unused Settings" value={summary.unusedCount} accent="text-amber-600" />
      </div>

      {/* Gaps section */}
      {summary.gaps.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-red-700 uppercase tracking-wide mb-3">
            Gaps — No Settings Available
          </h2>
          <div className="border border-stone-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-red-50 text-left">
                  <th className="px-4 py-2 font-medium text-stone-600">Psalm</th>
                  <th className="px-4 py-2 font-medium text-stone-600">Occasions</th>
                  <th className="px-4 py-2 font-medium text-stone-600 hidden md:table-cell">Used In</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {summary.gaps
                  .sort((a, b) => b.occasionCount - a.occasionCount)
                  .map((entry) => (
                    <tr key={entry.psalmNumber} className="hover:bg-stone-50">
                      <td className="px-4 py-2 font-medium text-stone-800">
                        Ps {entry.psalmNumber}
                      </td>
                      <td className="px-4 py-2 text-stone-600">
                        {entry.occasionCount}
                      </td>
                      <td className="px-4 py-2 text-stone-400 text-xs hidden md:table-cell">
                        {entry.occasionIds.slice(0, 3).join(", ")}
                        {entry.occasionIds.length > 3 && ` +${entry.occasionIds.length - 3}`}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Full coverage table */}
      <h2 className="text-sm font-semibold text-stone-700 uppercase tracking-wide mb-3">
        All Psalms
      </h2>
      <div className="border border-stone-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-stone-50 text-left">
              <th className="px-4 py-2 font-medium text-stone-600">Psalm</th>
              <th className="px-4 py-2 font-medium text-stone-600">Occasions</th>
              <th className="px-4 py-2 font-medium text-stone-600">Settings</th>
              <th className="px-4 py-2 font-medium text-stone-600">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {entries.map((entry) => (
              <tr key={entry.psalmNumber} className="hover:bg-stone-50">
                <td className="px-4 py-2 font-medium text-stone-800">
                  Ps {entry.psalmNumber}
                </td>
                <td className="px-4 py-2 text-stone-600">
                  {entry.occasionCount}
                </td>
                <td className="px-4 py-2 text-stone-500">
                  {entry.settings.length > 0 ? (
                    <span title={entry.settings.map((s) => s.title).join("\n")}>
                      {entry.settings.length} ({entry.settings.map((s) => s.composer.split(" ")[0] || "?").join(", ")})
                    </span>
                  ) : (
                    <span className="text-stone-300">--</span>
                  )}
                </td>
                <td className="px-4 py-2">
                  {entry.covered ? (
                    <span className="text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                      Covered
                    </span>
                  ) : entry.occasionCount > 0 ? (
                    <span className="text-xs font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded-full">
                      Gap
                    </span>
                  ) : (
                    <span className="text-xs text-stone-400">No occasions</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: string;
}) {
  return (
    <div className="border border-stone-200 rounded-lg p-4 bg-white">
      <p className="text-[10px] uppercase tracking-wide text-stone-400 font-semibold">
        {label}
      </p>
      <p className={`text-2xl font-bold ${accent || "text-stone-900"}`}>
        {value}
      </p>
    </div>
  );
}
