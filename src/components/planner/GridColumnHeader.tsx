import Link from "next/link";
import type { LiturgicalOccasion } from "@/lib/types";
import { SEASON_COLORS, getOccasionColor } from "@/lib/liturgical-colors";
import { getOccasionDisplayDate } from "@/lib/grid-data";

interface GridColumnHeaderProps {
  occasion: LiturgicalOccasion;
  showTags?: boolean;
  onHide?: () => void;
}

export default function GridColumnHeader({ occasion, showTags = true, onHide }: GridColumnHeaderProps) {
  const colors = SEASON_COLORS[occasion.season] || SEASON_COLORS.ordinary;
  const occColor = getOccasionColor(occasion.id, occasion.season);
  const displayDate = getOccasionDisplayDate(occasion);

  const shortName = occasion.name
    .replace(/\[([ABC])\]/, "")
    .replace(/^(ORDINARY TIME|ORD\. TIME)\s*/, "OT ")
    .trim();

  // Extract key gospel reading abbreviation
  const gospel = occasion.readings?.find((r) => r.type === "gospel");
  const gospelShort = gospel ? abbreviateReading(gospel.citation, gospel.summary) : null;

  return (
    <div
      className="px-2 py-2 h-full flex flex-col items-center text-center relative group/col"
      style={{
        background: `linear-gradient(to bottom, color-mix(in srgb, ${occColor}, transparent 92%), transparent)`,
      }}
    >
      <div
        className="w-full h-1 rounded-full mb-1.5"
        style={{ backgroundColor: occColor }}
      />
      {displayDate && (
        <span className="text-[10px] font-medium text-stone-400 mb-0.5">
          {displayDate}
        </span>
      )}
      <Link
        href={`/occasion/${occasion.id}`}
        className="text-[11px] font-semibold text-stone-700 hover:text-stone-900 leading-tight transition-colors line-clamp-2"
        title={occasion.name}
      >
        {shortName}
      </Link>
      {occasion.year !== "ABC" && (
        <span className="text-[9px] font-bold text-stone-400 mt-0.5">
          {occasion.year}
        </span>
      )}
      {/* Hide button */}
      {onHide && (
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onHide(); }}
          className="absolute top-1.5 right-1.5 w-5 h-5 flex items-center justify-center rounded-full bg-stone-200 text-stone-500 hover:bg-red-100 hover:text-red-600 opacity-0 group-hover/col:opacity-100 transition-all"
          title="Hide this week"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
      {/* Season + reading tags */}
      {showTags && (
        <div className="flex flex-wrap items-center justify-center gap-0.5 mt-1.5">
          <span
            className="inline-block px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider rounded-sm text-white"
            style={{ backgroundColor: colors.primary }}
          >
            {occasion.seasonLabel}
          </span>
          {occasion.lectionary?.thematicTag && (
            <span
              className="inline-block px-1.5 py-0.5 text-[8px] font-medium rounded-sm bg-stone-100 text-stone-600 max-w-[120px] truncate"
              title={occasion.lectionary.thematicTag}
            >
              {occasion.lectionary.thematicTag}
            </span>
          )}
          {gospelShort && (
            <span
              className="inline-block px-1.5 py-0.5 text-[8px] font-medium rounded-sm bg-amber-50 text-amber-700 max-w-[120px] truncate"
              title={gospelShort}
            >
              {gospelShort}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Create a short label from a reading citation + summary.
 * e.g., "Jn 4:5-42" + "Jesus at the well" → "Jn 4 — Jesus at the well"
 */
function abbreviateReading(citation: string, summary: string): string {
  // Extract book + chapter from citation
  const m = citation.match(/^(\d?\s*[A-Za-z]+)\s+(\d+)/);
  if (!m) return citation.slice(0, 20);
  const bookChapter = `${m[1]} ${m[2]}`;

  // Use first ~30 chars of summary
  const shortSummary = summary.length > 35 ? summary.slice(0, 32) + "…" : summary;
  return shortSummary ? `${bookChapter} — ${shortSummary}` : bookChapter;
}
