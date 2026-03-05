// ---------------------------------------------------------------------------
// MonthHeader — Sticky month divider with season label
// ---------------------------------------------------------------------------

const SEASON_COLORS: Record<string, string> = {
  Advent: "#6B21A8",
  Christmas: "#CA8A04",
  Lent: "#581C87",
  "Holy Week": "#7F1D1D",
  Easter: "#B45309",
  "Ordinary Time": "#166534",
};

interface MonthHeaderProps {
  month: string; // "DECEMBER"
  year: number;
  season: string; // "Advent", "Lent", etc.
}

export default function MonthHeader({ month, year, season }: MonthHeaderProps) {
  const seasonColor = SEASON_COLORS[season] ?? SEASON_COLORS["Ordinary Time"];

  return (
    <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm pt-8 pb-4 px-3 border-b border-stone-100 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
      <h2 className="font-serif text-2xl font-light uppercase tracking-[0.2em] text-stone-700">
        {month} {year}
      </h2>
      <div className="mt-2 flex items-center gap-3">
        <div className="h-px w-24 bg-stone-200" />
        <span
          className="text-xs font-medium uppercase tracking-widest"
          style={{ color: seasonColor }}
        >
          {season}
        </span>
      </div>
    </div>
  );
}
