import Link from "next/link";
import type { LiturgicalOccasion } from "@/lib/types";
import { SEASON_COLORS } from "@/lib/liturgical-colors";
import { getOccasionDisplayDate } from "@/lib/grid-data";

interface GridColumnHeaderProps {
  occasion: LiturgicalOccasion;
  showTags?: boolean;
}

export default function GridColumnHeader({ occasion, showTags = true }: GridColumnHeaderProps) {
  const colors = SEASON_COLORS[occasion.season] || SEASON_COLORS.ordinary;
  const displayDate = getOccasionDisplayDate(occasion);

  const shortName = occasion.name
    .replace(/\[([ABC])\]/, "")
    .replace(/^(ORDINARY TIME|ORD\. TIME)\s*/, "OT ")
    .trim();

  // Extract key gospel reading abbreviation
  const gospel = occasion.readings?.find((r) => r.type === "gospel");
  const gospelShort = gospel ? abbreviateReading(gospel.citation, gospel.summary) : null;

  return (
    <div className="px-2 py-2 h-full flex flex-col items-center text-center">
      <div
        className="w-full h-1 rounded-full mb-1.5"
        style={{ backgroundColor: colors.primary }}
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
