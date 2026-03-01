"use client";

import type { LiturgicalDay } from "@/lib/types";
import { SEASON_COLORS } from "@/lib/liturgical-colors";
import { buildLiturgicalDayMap } from "@/lib/liturgical-helpers";
import { useMemo } from "react";

interface SeasonAlertProps {
  liturgicalDays: LiturgicalDay[];
}

interface TransitionInfo {
  daysUntil: number;
  date: string;
  name: string;
  season: string;
  notes: string[];
}

const TRANSITION_MARKERS: Record<string, { notes: string[] }> = {
  "Ash Wednesday": {
    notes: ["Alleluia suppressed until Easter Vigil", "Gloria omitted on Sundays"],
  },
  "FIRST SUNDAY OF ADVENT": {
    notes: ["Gloria omitted for 4 weeks", "Begin Advent preparations"],
  },
};

export default function SeasonAlert({ liturgicalDays }: SeasonAlertProps) {
  const alert = useMemo(() => {
    if (!liturgicalDays || liturgicalDays.length === 0) return null;

    const litMap = buildLiturgicalDayMap(liturgicalDays);
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    // Look at the next 14 days for season transitions
    let prevSeason: string | null = null;
    const todayLit = litMap.get(todayStr);
    if (todayLit) prevSeason = todayLit.season;

    const transitions: TransitionInfo[] = [];

    for (let i = 1; i <= 14; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(today.getDate() + i);
      const checkStr = checkDate.toISOString().split("T")[0];
      const dayInfo = litMap.get(checkStr);

      if (!dayInfo) continue;

      // Check for season change
      if (prevSeason && dayInfo.season !== prevSeason) {
        const markerNotes = TRANSITION_MARKERS[dayInfo.celebrationName];
        transitions.push({
          daysUntil: i,
          date: checkStr,
          name: dayInfo.celebrationName,
          season: dayInfo.season,
          notes: markerNotes?.notes || [],
        });
        break; // Only show the nearest transition
      }

      // Also check for named transition markers even without season change
      if (TRANSITION_MARKERS[dayInfo.celebrationName] && dayInfo.season !== prevSeason) {
        // Already handled above
      }

      prevSeason = dayInfo.season;
    }

    return transitions[0] || null;
  }, [liturgicalDays]);

  if (!alert) return null;

  const seasonInfo = SEASON_COLORS[alert.season as keyof typeof SEASON_COLORS];
  const borderColor = seasonInfo?.primary || "#78716c";

  return (
    <div
      className="flex items-start gap-3 px-4 py-3 rounded-lg border-l-[3px] bg-white"
      style={{ borderLeftColor: borderColor }}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-stone-800">
          {alert.name}
          <span className="text-stone-400 font-normal">
            {" "}in {alert.daysUntil === 1 ? "1 day" : `${alert.daysUntil} days`}
          </span>
        </p>
        {alert.notes.length > 0 && (
          <div className="mt-1 space-y-0.5">
            {alert.notes.map((note, i) => (
              <p key={i} className="text-xs text-stone-500">
                {note}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
