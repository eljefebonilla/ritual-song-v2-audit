import { notFound } from "next/navigation";
import Link from "next/link";
import { getSeasons, getOccasionsByseason } from "@/lib/data";
import { SEASON_COLORS } from "@/lib/liturgical-colors";
import type { LiturgicalSeason } from "@/lib/types";

export function generateStaticParams() {
  return getSeasons().map((s) => ({ id: s.id }));
}

export default async function SeasonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const seasons = getSeasons();
  const season = seasons.find((s) => s.id === id);

  if (!season) notFound();

  const colors = SEASON_COLORS[id as LiturgicalSeason] || SEASON_COLORS.ordinary;
  const occasions = getOccasionsByseason(id);

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center gap-2 text-xs text-stone-400 mb-4">
        <Link href="/" className="hover:text-stone-600">Dashboard</Link>
        <span>/</span>
        <span className="text-stone-600">{season.label}</span>
      </div>

      <div
        className="w-12 h-1 rounded-full mb-3"
        style={{ backgroundColor: colors.primary }}
      />
      <h1 className="text-2xl font-bold text-stone-900 mb-1">
        {season.label}
      </h1>
      <p className="text-sm text-stone-500 mb-8">
        {occasions.length} occasions
      </p>

      <div className="space-y-2">
        {occasions.map((occ) => (
          <Link
            key={occ.id}
            href={`/occasion/${occ.id}`}
            className="flex items-center gap-3 p-3 border border-stone-200 rounded-lg bg-white hover:shadow-sm transition-shadow"
          >
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: colors.primary }}
            />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-stone-800">{occ.name}</p>
              <p className="text-xs text-stone-400">Year {occ.year}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
