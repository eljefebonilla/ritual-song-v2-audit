import { notFound } from "next/navigation";
import Link from "next/link";
import { getOccasion, getAllOccasions, getSynopsis } from "@/lib/data";
import { SEASON_COLORS } from "@/lib/liturgical-colors";
import { resolveAllSongs, resolveFullSongs } from "@/lib/song-library";
import OccasionMusicSection from "@/components/music/OccasionMusicSection";

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
  const synopsis = getSynopsis(id);
  const resolvedSongs = resolveAllSongs(occasion.musicPlans, occasion.occasionResources);
  const librarySongs = resolveFullSongs(occasion.musicPlans);

  return (
    <div className="p-4 pt-14 md:p-8 md:pt-8 max-w-5xl">
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

      {/* Lectionary Synopsis */}
      {synopsis && (
        <div className="mb-6">
          <div
            className="w-12 h-1 rounded-full mb-3"
            style={{ backgroundColor: colors.primary }}
          />
          <h2 className="text-xs uppercase tracking-widest font-bold text-stone-400 mb-2">
            Lectionary Synopsis
          </h2>
          <p className="text-sm font-medium text-stone-700">{synopsis.logline}</p>
          {synopsis.trajectory && (
            <p className="text-xs text-stone-500 mt-1">{synopsis.trajectory}</p>
          )}
          <div className="border border-stone-200 rounded-lg p-3 bg-white mt-3 space-y-3">
            {(["first", "second", "gospel"] as const).map((key) => {
              const r = synopsis.readings[key];
              const label = key === "gospel" ? "Gospel" : key === "first" ? "First Reading" : "Second Reading";
              return (
                <div key={key}>
                  <p className="text-[10px] uppercase tracking-widest font-bold text-stone-400">
                    {label}{r.citation ? ` — ${r.citation}` : ""}
                  </p>
                  <p className="text-sm text-stone-600 mt-0.5">{r.synopsis}</p>
                </div>
              );
            })}
          </div>
          <div className="bg-stone-50 border-l-2 rounded-r-md p-3 mt-3 italic text-sm text-stone-600" style={{ borderColor: colors.primary }}>
            {synopsis.invitesUsTo}
          </div>
        </div>
      )}

      {/* Order of Worship — unified music + readings + antiphons + resources */}
      {occasion.musicPlans.length > 0 && (
        <OccasionMusicSection
          plans={occasion.musicPlans}
          readings={occasion.readings}
          antiphons={occasion.antiphons}
          occasionResources={occasion.occasionResources}
          seasonColor={colors.primary}
          resolvedSongs={resolvedSongs}
          librarySongs={librarySongs}
          synopsis={synopsis}
        />
      )}
    </div>
  );
}
