import { notFound } from "next/navigation";
import Link from "next/link";
import { getSeasons, getOccasionsByseason, getSynopsis } from "@/lib/data";
import type { OccasionSummary } from "@/lib/data";
import { SEASON_COLORS } from "@/lib/liturgical-colors";
import type { LiturgicalSeason } from "@/lib/types";

export function generateStaticParams() {
  return getSeasons().map((s) => ({ id: s.id }));
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return String(d.getFullYear());
}

interface SeasonRow {
  seasonOrder: number;
  type: "abc" | "yearly";
  a?: OccasionSummary;
  b?: OccasionSummary;
  c?: OccasionSummary;
  abc?: OccasionSummary;
}

function buildRows(occasions: OccasionSummary[]): SeasonRow[] {
  // Separate ABC occasions from year-specific ones
  const abcOccasions = occasions.filter((o) => o.year === "ABC");
  const yearlyOccasions = occasions.filter((o) => o.year !== "ABC");

  // Group year-specific by seasonOrder
  const orderMap = new Map<number, { a?: OccasionSummary; b?: OccasionSummary; c?: OccasionSummary }>();
  for (const occ of yearlyOccasions) {
    if (!orderMap.has(occ.seasonOrder)) {
      orderMap.set(occ.seasonOrder, {});
    }
    const group = orderMap.get(occ.seasonOrder)!;
    if (occ.year === "A") group.a = occ;
    else if (occ.year === "B") group.b = occ;
    else if (occ.year === "C") group.c = occ;
  }

  // Collect all entries with their sort keys
  const entries: { sortKey: number; row: SeasonRow }[] = [];

  for (const occ of abcOccasions) {
    entries.push({
      sortKey: occ.seasonOrder,
      row: { seasonOrder: occ.seasonOrder, type: "abc", abc: occ },
    });
  }

  for (const [order, group] of orderMap) {
    entries.push({
      sortKey: order,
      row: { seasonOrder: order, type: "yearly", ...group },
    });
  }

  // Sort by seasonOrder, then ABC rows before yearly rows at the same order
  entries.sort((a, b) => {
    if (a.sortKey !== b.sortKey) return a.sortKey - b.sortKey;
    if (a.row.type === "abc" && b.row.type !== "abc") return -1;
    if (a.row.type !== "abc" && b.row.type === "abc") return 1;
    return 0;
  });

  return entries.map((e) => e.row);
}

/** Format multi-year dates for ABC occasions. Shows "Mon D, YYYY · YYYY · YYYY" when all share
 *  the same month+day, otherwise shows each date in full separated by " · ". */
function formatAbcDates(nextDates: { a: string; b: string; c: string }): string {
  const dA = new Date(nextDates.a + "T00:00:00");
  const dB = new Date(nextDates.b + "T00:00:00");
  const dC = new Date(nextDates.c + "T00:00:00");

  const sameMonthDay =
    dA.getMonth() === dB.getMonth() &&
    dA.getMonth() === dC.getMonth() &&
    dA.getDate() === dB.getDate() &&
    dA.getDate() === dC.getDate();

  if (sameMonthDay) {
    // e.g. "Dec 25, 2025 · 2026 · 2027"
    const base = formatDate(nextDates.a);
    return `${base} · ${formatDateShort(nextDates.b)} · ${formatDateShort(nextDates.c)}`;
  }

  // Different dates — show all three in full
  return `${formatDate(nextDates.a)} · ${formatDate(nextDates.b)} · ${formatDate(nextDates.c)}`;
}

function OccasionCard({
  occ,
  colors,
}: {
  occ: OccasionSummary;
  colors: { primary: string };
}) {
  const synopsis = getSynopsis(occ.id);

  // Build date display
  let dateDisplay: string | null = null;
  if (occ.year === "ABC" && occ.nextDates) {
    dateDisplay = formatAbcDates(occ.nextDates);
  } else if (occ.nextDate) {
    dateDisplay = formatDate(occ.nextDate);
  }

  const isNotCelebrated = occ.year !== "ABC" && !occ.nextDate;

  return (
    <Link
      href={`/occasion/${occ.id}`}
      className="flex items-start gap-2.5 p-3 border border-stone-200 rounded-lg bg-white hover:shadow-sm transition-shadow"
    >
      <span
        className="w-2 h-2 rounded-full shrink-0 mt-1"
        style={{ backgroundColor: colors.primary }}
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-stone-800 whitespace-pre-line leading-tight">
          {occ.name}
        </p>
        {dateDisplay && (
          <p className="text-[11px] text-stone-400 mt-0.5">{dateDisplay}</p>
        )}
        {isNotCelebrated && (
          <p className="text-[11px] text-stone-300 italic mt-0.5">
            Not celebrated this cycle
          </p>
        )}
        {synopsis?.logline && (
          <p className="text-xs text-stone-400 mt-0.5 line-clamp-1">
            {synopsis.logline}
          </p>
        )}
      </div>
    </Link>
  );
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
  const rows = buildRows(occasions);

  return (
    <div className="p-4 pt-14 md:p-8 md:pt-8 max-w-6xl">
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

      {/* Column headers - desktop only */}
      <div className="hidden md:grid md:grid-cols-3 gap-3 mb-3">
        {["Year A", "Year B", "Year C"].map((label) => (
          <div key={label} className="text-xs font-semibold text-stone-500 uppercase tracking-wide px-1">
            {label}
          </div>
        ))}
      </div>

      {/* Rows */}
      <div className="space-y-2">
        {rows.map((row, i) => {
          if (row.type === "abc" && row.abc) {
            return (
              <div key={row.abc.id} className="md:col-span-3">
                <OccasionCard occ={row.abc} colors={colors} />
              </div>
            );
          }

          // Yearly row: 3 columns
          return (
            <div key={`row-${row.seasonOrder}-${i}`} className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <div>
                {row.a ? (
                  <OccasionCard occ={row.a} colors={colors} />
                ) : (
                  <div className="hidden md:block h-full" />
                )}
              </div>
              <div>
                {row.b ? (
                  <OccasionCard occ={row.b} colors={colors} />
                ) : (
                  <div className="hidden md:block h-full" />
                )}
              </div>
              <div>
                {row.c ? (
                  <OccasionCard occ={row.c} colors={colors} />
                ) : (
                  <div className="hidden md:block h-full" />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
