"use client";

import type { LiturgicalDay } from "@/lib/types";
import type { CalendarEvent } from "@/lib/calendar-types";
import { LITURGICAL_COLOR_HEX, LITURGICAL_COLOR_LABEL } from "@/lib/liturgical-colors";
import { SEASON_COLORS } from "@/lib/liturgical-colors";
import { rankLabel } from "@/lib/liturgical-helpers";
import { getCommunityColor } from "@/lib/calendar-utils";

interface CantorBriefingCardProps {
  event: CalendarEvent;
  liturgicalDay: LiturgicalDay;
}

function buildContextSentence(day: LiturgicalDay): string {
  const seasonInfo = SEASON_COLORS[day.season];
  const seasonLabel = seasonInfo?.label || day.season;

  if (day.saintName && (day.rank === "feast" || day.rank === "memorial" || day.rank === "solemnity")) {
    return `Today we celebrate the ${rankLabel(day.rank).toLowerCase()} of ${day.saintName}${day.saintTitle ? `, ${day.saintTitle}` : ""}.`;
  }

  return `Today we celebrate ${day.celebrationName}, a ${rankLabel(day.rank).toLowerCase()} in the ${seasonLabel} season.`;
}

export default function CantorBriefingCard({
  event,
  liturgicalDay,
}: CantorBriefingCardProps) {
  const colorHex = LITURGICAL_COLOR_HEX[liturgicalDay.colorPrimary];
  const colorName = LITURGICAL_COLOR_LABEL[liturgicalDay.colorPrimary];
  const communityStyle = getCommunityColor(event.community);

  return (
    <div className="bg-white border border-stone-200 rounded-lg overflow-hidden print:break-inside-avoid">
      {/* Top color bar */}
      <div className="h-[4px]" style={{ backgroundColor: colorHex }} />

      <div className="p-4 space-y-4">
        {/* Mass header */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-stone-800">
            {event.startTime12h || "TBD"}
          </span>
          <span className="text-sm text-stone-600">{event.title}</span>
          {event.community && (
            <span
              className="text-[10px] font-medium px-2 py-0.5 rounded-full"
              style={communityStyle}
            >
              {event.community}
            </span>
          )}
        </div>

        {/* Context sentence */}
        <p className="text-sm text-stone-600 italic">
          {buildContextSentence(liturgicalDay)}
        </p>

        {/* Color + Gloria + Alleluia row */}
        <div className="flex flex-wrap gap-4">
          {/* Color swatch */}
          <div className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded-full border border-stone-200"
              style={{ backgroundColor: colorHex }}
            />
            <span className="text-sm font-medium text-stone-700">
              {colorName}
            </span>
          </div>

          {/* Gloria */}
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-stone-500">Gloria:</span>
            {liturgicalDay.gloria ? (
              <span className="text-sm font-semibold text-green-700">YES</span>
            ) : (
              <span className="text-sm font-semibold text-stone-400">NO</span>
            )}
            {!liturgicalDay.gloria &&
              (liturgicalDay.season === "advent" || liturgicalDay.season === "lent") && (
                <span className="text-[10px] text-stone-400">
                  (Omitted during {liturgicalDay.season === "advent" ? "Advent" : "Lent"})
                </span>
              )}
          </div>

          {/* Alleluia */}
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-stone-500">Alleluia:</span>
            {liturgicalDay.alleluia ? (
              <span className="text-sm font-semibold text-green-700">YES</span>
            ) : (
              <span className="text-sm font-semibold text-stone-400">NO</span>
            )}
            {!liturgicalDay.alleluia && (
              <span className="text-[10px] text-stone-400">
                (Use Lenten Gospel Acclamation)
              </span>
            )}
          </div>
        </div>

        {/* Saint context */}
        {liturgicalDay.saintName &&
          (liturgicalDay.rank === "feast" ||
            liturgicalDay.rank === "memorial" ||
            liturgicalDay.rank === "solemnity") && (
            <div className="p-3 bg-stone-50 rounded border-l-[3px]" style={{ borderLeftColor: colorHex }}>
              <p className="text-xs font-semibold text-stone-700">
                {liturgicalDay.saintName}
              </p>
              {liturgicalDay.saintTitle && (
                <p className="text-[11px] text-stone-500">
                  {liturgicalDay.saintTitle}
                </p>
              )}
            </div>
          )}

        {/* Occasion link */}
        {event.occasionId && (
          <div className="pt-2 border-t border-stone-100">
            <a
              href={`/occasion/${event.occasionId}`}
              className="text-xs text-parish-burgundy hover:underline"
            >
              View music plan &rarr;
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
