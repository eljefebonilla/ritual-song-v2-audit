import { notFound } from "next/navigation";
import Link from "next/link";
import { getOccasion, getAllOccasions } from "@/lib/data";
import { SEASON_COLORS } from "@/lib/liturgical-colors";
import MusicPlanTabs from "@/components/music/MusicPlanTabs";

export function generateStaticParams() {
  return getAllOccasions().map((o) => ({ id: o.id }));
}

export default async function OccasionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const occasion = getOccasion(id);

  if (!occasion) notFound();

  const colors = SEASON_COLORS[occasion.season] || SEASON_COLORS.ordinary;

  return (
    <div className="p-4 pt-14 md:p-8 md:pt-8 max-w-4xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-stone-400 mb-4">
        <Link href="/" className="hover:text-stone-600">
          Dashboard
        </Link>
        <span>/</span>
        <Link
          href={`/season/${occasion.season}`}
          className="hover:text-stone-600"
        >
          {occasion.seasonLabel}
        </Link>
        <span>/</span>
        <span className="text-stone-600">{occasion.name}</span>
      </div>

      {/* Header */}
      <div className="mb-8">
        <div
          className="w-12 h-1 rounded-full mb-3"
          style={{ backgroundColor: colors.primary }}
        />
        <h1 className="text-2xl font-bold text-stone-900">{occasion.name}</h1>
        <p className="text-sm text-stone-500 mt-1">
          {occasion.lectionary.number} &middot;{" "}
          {occasion.lectionary.thematicTag}
        </p>
        {occasion.lectionary.gospelTitle && (
          <p className="text-sm text-stone-600 mt-1 italic">
            {occasion.lectionary.gospelTitle}
          </p>
        )}
      </div>

      {/* Dates */}
      {occasion.dates.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xs uppercase tracking-widest font-bold text-stone-400 mb-2">
            Dates
          </h2>
          <div className="flex flex-wrap gap-2">
            {occasion.dates.map((d, i) => (
              <span
                key={i}
                className="px-3 py-1 text-xs bg-stone-100 rounded-full text-stone-600"
              >
                {d.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Readings */}
      {occasion.readings.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xs uppercase tracking-widest font-bold text-stone-400 mb-2">
            Readings
          </h2>
          <div className="space-y-3">
            {occasion.readings.map((r, i) => (
              <div
                key={i}
                className="border border-stone-200 rounded-lg p-3 bg-white"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded"
                    style={{
                      backgroundColor: colors.primary + "15",
                      color: colors.primary,
                    }}
                  >
                    {r.type.replace("_", " ")}
                  </span>
                  <span className="text-sm font-semibold text-stone-800">
                    {r.citation}
                  </span>
                </div>
                {r.summary && (
                  <p className="text-sm text-stone-600 mt-1">{r.summary}</p>
                )}
                {r.antiphon && (
                  <p className="text-sm text-stone-500 mt-1 italic">
                    &ldquo;{r.antiphon}&rdquo;
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Antiphons */}
      {occasion.antiphons.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xs uppercase tracking-widest font-bold text-stone-400 mb-2">
            Antiphons
          </h2>
          <div className="space-y-3">
            {occasion.antiphons.map((a, i) => (
              <div
                key={i}
                className="border border-stone-200 rounded-lg p-3 bg-white"
              >
                <span className="text-[10px] uppercase tracking-wider font-bold text-stone-400">
                  {a.type} — Option {a.option}
                </span>
                <p className="text-sm font-medium text-stone-700 mt-1">
                  {a.citation}
                </p>
                <p className="text-sm text-stone-600 italic mt-0.5">
                  &ldquo;{a.text}&rdquo;
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Planning Notes */}
      {occasion.planningNotes.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xs uppercase tracking-widest font-bold text-stone-400 mb-2">
            Planning Notes
          </h2>
          <div className="border border-stone-200 rounded-lg p-3 bg-white">
            {occasion.planningNotes.map((note, i) => (
              <p key={i} className="text-sm text-stone-600">
                {note}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Music Plans */}
      {occasion.musicPlans.length > 0 && (
        <div className="mt-10">
          <h2 className="text-lg font-bold text-stone-900 mb-4">
            Music Plans
          </h2>
          <div className="border border-stone-200 rounded-lg overflow-hidden bg-white">
            <MusicPlanTabs
              plans={occasion.musicPlans}
              seasonColor={colors.primary}
            />
          </div>
        </div>
      )}
    </div>
  );
}
