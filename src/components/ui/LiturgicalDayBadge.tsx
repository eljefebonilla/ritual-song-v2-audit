"use client";

import type { LiturgicalDay } from "@/lib/types";
import { LITURGICAL_COLOR_HEX, LITURGICAL_COLOR_LABEL } from "@/lib/liturgical-colors";
import { rankLabel } from "@/lib/liturgical-helpers";

interface LiturgicalDayBadgeProps {
  day: LiturgicalDay;
  /** Compact: color dot + rank only. Full: dot + rank + name. */
  variant?: "compact" | "full";
  className?: string;
}

export default function LiturgicalDayBadge({
  day,
  variant = "full",
  className = "",
}: LiturgicalDayBadgeProps) {
  const colorHex = LITURGICAL_COLOR_HEX[day.colorPrimary] || "#78716c";
  const colorName = LITURGICAL_COLOR_LABEL[day.colorPrimary] || day.colorPrimary;
  const rank = rankLabel(day.rank);

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs ${className}`}
      title={`${day.celebrationName} — ${rank} — ${colorName}`}
    >
      {/* Color dot */}
      <span
        className="w-2.5 h-2.5 rounded-full shrink-0"
        style={{ backgroundColor: colorHex }}
      />

      {/* Rank text */}
      <span className="text-stone-500 font-medium">{rank}</span>

      {/* Celebration name (full variant only) */}
      {variant === "full" && (
        <span className="text-stone-700 truncate">{day.celebrationName}</span>
      )}
    </span>
  );
}
