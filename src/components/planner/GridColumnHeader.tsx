import Link from "next/link";
import type { LiturgicalOccasion } from "@/lib/types";
import { SEASON_COLORS } from "@/lib/liturgical-colors";
import { getOccasionDisplayDate } from "@/lib/grid-data";

interface GridColumnHeaderProps {
  occasion: LiturgicalOccasion;
}

export default function GridColumnHeader({ occasion }: GridColumnHeaderProps) {
  const colors = SEASON_COLORS[occasion.season] || SEASON_COLORS.ordinary;
  const displayDate = getOccasionDisplayDate(occasion);

  const shortName = occasion.name
    .replace(/\[([ABC])\]/, "")
    .replace(/^(ORDINARY TIME|ORD\. TIME)\s*/, "OT ")
    .trim();

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
    </div>
  );
}
