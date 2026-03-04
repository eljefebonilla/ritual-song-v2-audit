import PrintButton from "./PrintButton";
import { createAdminClient } from "@/lib/supabase/admin";
import { rowToLiturgicalDay } from "@/lib/liturgical-helpers";
import { LITURGICAL_COLOR_HEX } from "@/lib/liturgical-colors";
import type { LiturgicalDay, LiturgicalSeason } from "@/lib/types";
import Link from "next/link";

export const dynamic = "force-dynamic";

const SEASON_LABELS: Record<LiturgicalSeason, string> = {
  advent: "Advent",
  christmas: "Christmas",
  lent: "Lent",
  triduum: "Triduum",
  easter: "Easter",
  ordinary: "Ordinary Time",
  solemnity: "Solemnity",
  feast: "Feast",
};

const SEASON_ORDER: LiturgicalSeason[] = [
  "advent",
  "christmas",
  "ordinary",
  "lent",
  "triduum",
  "easter",
];

interface SeasonBlock {
  season: LiturgicalSeason;
  startDate: string;
  endDate: string;
  days: LiturgicalDay[];
  sundays: LiturgicalDay[];
  feasts: LiturgicalDay[];
  gloriaStatus: string;
  alleluiaStatus: string;
}

function buildSeasonBlocks(days: LiturgicalDay[]): SeasonBlock[] {
  const blocks: SeasonBlock[] = [];
  let currentSeason: LiturgicalSeason | null = null;
  let currentDays: LiturgicalDay[] = [];

  for (const day of days) {
    if (day.season !== currentSeason) {
      if (currentSeason && currentDays.length > 0) {
        blocks.push(finalizeBlock(currentSeason, currentDays));
      }
      currentSeason = day.season;
      currentDays = [day];
    } else {
      currentDays.push(day);
    }
  }

  if (currentSeason && currentDays.length > 0) {
    blocks.push(finalizeBlock(currentSeason, currentDays));
  }

  return blocks;
}

function finalizeBlock(season: LiturgicalSeason, days: LiturgicalDay[]): SeasonBlock {
  const sundays = days.filter((d) => d.rank === "sunday" || d.rank === "solemnity");
  const feasts = days.filter(
    (d) => d.rank === "feast" || d.rank === "memorial" || d.rank === "solemnity"
  );

  const hasGloria = days.some((d) => d.gloria);
  const hasNoGloria = days.some((d) => !d.gloria);
  const gloriaStatus = !hasNoGloria
    ? "Gloria at all liturgies"
    : !hasGloria
    ? "Gloria omitted"
    : "Gloria on Sundays/Solemnities only";

  const hasAlleluia = days.some((d) => d.alleluia);
  const hasNoAlleluia = days.some((d) => !d.alleluia);
  const alleluiaStatus = !hasNoAlleluia
    ? "Alleluia sung"
    : !hasAlleluia
    ? "Alleluia suppressed — use Lenten Gospel Acclamation"
    : "Alleluia suppressed during part of this season";

  return {
    season,
    startDate: days[0].date,
    endDate: days[days.length - 1].date,
    days,
    sundays,
    feasts,
    gloriaStatus,
    alleluiaStatus,
  };
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default async function SeasonBriefingPage() {
  const supabase = createAdminClient();

  // Get current liturgical year (roughly Nov to Nov)
  const now = new Date();
  const year = now.getMonth() >= 10 ? now.getFullYear() : now.getFullYear() - 1;
  const startDate = `${year}-11-01`;
  const endDate = `${year + 2}-01-31`;

  const { data: rows, error } = await supabase
    .from("liturgical_days")
    .select("*")
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: true });

  if (error) {
    return (
      <div className="p-8 max-w-4xl">
        <h1 className="text-lg font-bold text-stone-900">Season Briefing</h1>
        <p className="text-sm text-red-600 mt-2">Error loading data: {error.message}</p>
      </div>
    );
  }

  const days = (rows || []).map((r) => rowToLiturgicalDay(r as Record<string, unknown>));
  const blocks = buildSeasonBlocks(days);

  // Find current season
  const todayStr = now.toISOString().slice(0, 10);
  const currentBlock = blocks.find(
    (b) => b.startDate <= todayStr && b.endDate >= todayStr
  );

  return (
    <div className="p-4 pt-14 md:p-8 md:pt-8 max-w-4xl print:p-4 print:max-w-none">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-stone-400 mb-4 print:hidden">
        <Link href="/" className="hover:text-stone-600">Dashboard</Link>
        <span>/</span>
        <span className="text-stone-600">Season Briefing</span>
      </div>

      <h1 className="text-2xl font-bold text-stone-900 mb-1">
        Liturgical Season Briefing
      </h1>
      <p className="text-sm text-stone-500 mb-6">
        {year}/{year + 1} Liturgical Year
      </p>

      {/* Print button */}
      <PrintButton />

      {/* Season blocks */}
      <div className="space-y-8">
        {blocks
          .filter((b) => SEASON_ORDER.includes(b.season))
          .map((block, i) => {
            const isCurrent = block === currentBlock;
            const colorHex = LITURGICAL_COLOR_HEX[block.days[0]?.colorPrimary] || "#78716c";

            return (
              <div
                key={i}
                className="rounded-lg overflow-hidden print:break-inside-avoid"
                style={{
                  border: isCurrent ? `2px solid ${colorHex}` : "1px solid #e7e5e4",
                  boxShadow: isCurrent ? `0 0 0 3px ${colorHex}30` : undefined,
                }}
              >
                {/* Season header */}
                <div
                  className="px-4 py-3 text-white"
                  style={{ backgroundColor: colorHex }}
                >
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold">
                      {SEASON_LABELS[block.season] || block.season}
                    </h2>
                    {isCurrent && (
                      <span className="text-xs font-medium bg-white/20 px-2 py-0.5 rounded-full">
                        Current Season
                      </span>
                    )}
                  </div>
                  <p className="text-sm opacity-90 mt-0.5">
                    {formatDate(block.startDate)} — {formatDate(block.endDate)} &middot;{" "}
                    {block.sundays.length} Sundays &middot; {block.days.length} days
                  </p>
                </div>

                {/* Status cards */}
                <div className="p-4 bg-white">
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-stone-50 rounded-md p-3">
                      <p className="text-[10px] uppercase tracking-widest font-bold text-stone-400 mb-1">
                        Gloria
                      </p>
                      <p className="text-xs text-stone-700">{block.gloriaStatus}</p>
                    </div>
                    <div className="bg-stone-50 rounded-md p-3">
                      <p className="text-[10px] uppercase tracking-widest font-bold text-stone-400 mb-1">
                        Alleluia
                      </p>
                      <p className="text-xs text-stone-700">{block.alleluiaStatus}</p>
                    </div>
                  </div>

                  {/* Key feasts/solemnities */}
                  {block.feasts.length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase tracking-widest font-bold text-stone-400 mb-2">
                        Key Celebrations
                      </p>
                      <div className="space-y-1">
                        {block.feasts.slice(0, 15).map((f) => (
                          <div key={f.id} className="flex items-center gap-2 text-xs">
                            <span className="text-stone-400 w-20 shrink-0">
                              {formatDate(f.date).replace(/, \d{4}$/, "")}
                            </span>
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: LITURGICAL_COLOR_HEX[f.colorPrimary] }}
                            />
                            <span className="text-stone-700 font-medium">
                              {f.celebrationName}
                            </span>
                            <span className="text-stone-400 text-[10px] uppercase">
                              {f.rank}
                            </span>
                            {f.occasionId && (
                              <Link
                                href={`/occasion/${f.occasionId}`}
                                className="text-[10px] text-stone-400 hover:text-stone-600 print:hidden"
                              >
                                View
                              </Link>
                            )}
                          </div>
                        ))}
                        {block.feasts.length > 15 && (
                          <p className="text-[10px] text-stone-400">
                            + {block.feasts.length - 15} more celebrations
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Sundays list */}
                  {block.sundays.length > 0 && (
                    <div className="mt-4">
                      <p className="text-[10px] uppercase tracking-widest font-bold text-stone-400 mb-2">
                        Sundays
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                        {block.sundays.map((s) => (
                          <div key={s.id} className="flex items-center gap-2 text-xs">
                            <span className="text-stone-400 w-20 shrink-0">
                              {formatDate(s.date).replace(/, \d{4}$/, "")}
                            </span>
                            <span className="text-stone-700 truncate">
                              {s.celebrationName}
                            </span>
                            {s.occasionId && (
                              <Link
                                href={`/occasion/${s.occasionId}`}
                                className="text-[10px] text-stone-400 hover:text-stone-600 shrink-0 print:hidden"
                              >
                                View
                              </Link>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}
