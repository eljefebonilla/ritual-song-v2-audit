import { notFound } from "next/navigation";
import Link from "next/link";
import { getOccasion, getAllOccasions, getSynopsis } from "@/lib/data";
import { SEASON_COLORS, getOccasionColor } from "@/lib/liturgical-colors";
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
  const occasionColor = getOccasionColor(id, occasion.season);
  const synopsis = getSynopsis(id);
  const resolvedSongs = resolveAllSongs(occasion.musicPlans, occasion.occasionResources);
  const librarySongs = resolveFullSongs(occasion.musicPlans);

  // Compute prev/next occasions within the same season and year
  const allOccasions = getAllOccasions();
  const sameSeasonYear = allOccasions
    .filter((o) => o.season === occasion.season && o.year === occasion.year)
    .sort((a, b) => a.seasonOrder - b.seasonOrder);
  const currentIdx = sameSeasonYear.findIndex((o) => o.id === id);
  const prevOccasion = currentIdx > 0 ? sameSeasonYear[currentIdx - 1] : null;
  const nextOccasion = currentIdx >= 0 && currentIdx < sameSeasonYear.length - 1 ? sameSeasonYear[currentIdx + 1] : null;

  return (
    <div className="max-w-5xl">
      {/* Ombre hero — colored by this occasion's season */}
      <div
        className="bg-gradient-to-b to-background px-4 pt-14 md:px-8 md:pt-8 pb-6"
        style={{ backgroundImage: `linear-gradient(to bottom, color-mix(in srgb, ${occasionColor}, transparent 85%), var(--color-background))` }}
      >
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-muted mb-4">
          <Link href="/" className="hover:text-foreground">
            Dashboard
          </Link>
          <span>/</span>
          <Link
            href={`/season/${occasion.season}`}
            className="hover:text-foreground"
          >
            {occasion.seasonLabel}
          </Link>
          <span>/</span>
          <span className="text-foreground">{occasion.name}</span>
        </div>

        {/* Prev / Next navigation */}
        {(prevOccasion || nextOccasion) && (
          <div className="flex items-center justify-between mb-4">
            {prevOccasion ? (
              <Link
                href={`/occasion/${prevOccasion.id}`}
                className="flex items-center gap-1.5 text-xs text-muted hover:text-foreground transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
                <span className="max-w-[200px] truncate">{prevOccasion.name}</span>
              </Link>
            ) : (
              <span />
            )}
            {nextOccasion ? (
              <Link
                href={`/occasion/${nextOccasion.id}`}
                className="flex items-center gap-1.5 text-xs text-muted hover:text-foreground transition-colors"
              >
                <span className="max-w-[200px] truncate">{nextOccasion.name}</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </Link>
            ) : (
              <span />
            )}
          </div>
        )}

        {/* Header */}
        <div>
          <h1 className="font-serif text-[1.375rem] font-semibold text-parish-charcoal">{occasion.name}</h1>
          <p className="text-sm text-muted mt-1">
            {occasion.lectionary.number} &middot;{" "}
            {occasion.lectionary.thematicTag}
          </p>
          {occasion.lectionary.gospelTitle && (
            <p className="text-sm text-foreground/70 mt-1 font-serif italic">
              {occasion.lectionary.gospelTitle}
            </p>
          )}
        </div>
      </div>
      {/* Action bar */}
      <div className="px-4 md:px-8 pt-4 pb-2 flex flex-wrap gap-2 border-b border-border">
        <Link
          href={`/liturgies/plan-a-mass`}
          className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-green-600 text-white hover:bg-green-700 transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          Plan a Mass
        </Link>
        <a
          href={`/admin/setlist/${occasion.id}/print`}
          target="_blank"
          className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-stone-300 text-stone-600 hover:bg-stone-50 transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>
          Setlist PDF
        </a>
        <a
          href={`/admin/setlist/${occasion.id}/print`}
          target="_blank"
          className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-parish-burgundy/30 text-parish-burgundy hover:bg-parish-burgundy/5 transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></svg>
          Worship Aid
        </a>
      </div>

      <div className="px-4 md:px-8 pt-6">

      {/* Dates */}
      {occasion.dates.length > 0 && (
        <div className="mb-6">
          <h2 className="text-[11px] uppercase tracking-widest font-medium text-muted mb-2">
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
          <h2 className="text-[11px] uppercase tracking-widest font-medium text-muted mb-2">
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

      {/* Lectionary Synopsis — logline + invites-us-to (per-reading synopses live in SlotList reading rows) */}
      {synopsis && (
        <div className="mb-6">
          <div
            className="w-12 h-1 rounded-full mb-3"
            style={{ backgroundColor: occasionColor }}
          />
          <h2 className="text-[11px] uppercase tracking-widest font-medium text-muted mb-2">
            Lectionary Synopsis
          </h2>
          <p className="text-sm font-medium text-[#4A5568]">{synopsis.logline}</p>
          {synopsis.trajectory && (
            <p className="text-xs text-[#4A5568] mt-1">{synopsis.trajectory}</p>
          )}
          <div className="bg-stone-50/50 rounded-lg p-3 mt-3 border border-stone-200 italic text-sm text-[#4A5568]">
            {synopsis.invitesUsTo}
          </div>
        </div>
      )}

      {/* Order of Worship — unified music + readings + antiphons + resources */}
      {occasion.musicPlans.length > 0 && (
        <OccasionMusicSection
          occasionId={id}
          plans={occasion.musicPlans}
          readings={occasion.readings}
          antiphons={occasion.antiphons}
          occasionResources={occasion.occasionResources}
          seasonColor={occasionColor}
          resolvedSongs={resolvedSongs}
          librarySongs={librarySongs}
          synopsis={synopsis}
          occasionDates={occasion.dates}
        />
      )}
      </div>
    </div>
  );
}
