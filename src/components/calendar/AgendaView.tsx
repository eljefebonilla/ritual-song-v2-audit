"use client";

import { useMemo } from "react";
import type { CalendarWeek } from "@/lib/calendar-types";
import type { LiturgicalDay } from "@/lib/types";
import type { EnsembleId } from "@/lib/grid-types";
import {
  filterEventsByEnsemble,
  groupEventsByDate,
  formatDateLabel,
  isDatePast,
} from "@/lib/calendar-utils";
import { LITURGICAL_COLOR_HEX, LITURGICAL_COLOR_LIGHT } from "@/lib/liturgical-colors";
import { buildLiturgicalDayMap, isSignificantRank, rankLabel } from "@/lib/liturgical-helpers";
import { SEASON_COLORS } from "@/lib/liturgical-colors";
import WeekHeader from "./WeekHeader";
import EventCard from "./EventCard";

interface AgendaViewProps {
  weeks: CalendarWeek[];
  ensembleFilter: EnsembleId | "all";
  hiddenWeekIds: string[];
  onToggleHidden: (weekId: string) => void;
  liturgicalDays?: LiturgicalDay[];
}

export default function AgendaView({
  weeks,
  ensembleFilter,
  hiddenWeekIds,
  onToggleHidden,
  liturgicalDays,
}: AgendaViewProps) {
  const litMap = useMemo(
    () => (liturgicalDays ? buildLiturgicalDayMap(liturgicalDays) : new Map<string, LiturgicalDay>()),
    [liturgicalDays]
  );

  if (weeks.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-stone-400">
        <div className="text-center">
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mx-auto mb-3 text-stone-300"
          >
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <p className="text-sm">No upcoming events</p>
          <p className="text-xs mt-1">
            Try showing past dates or changing the ensemble filter
          </p>
        </div>
      </div>
    );
  }

  // Track previous season for transition markers
  let prevSeason: string | null = null;

  return (
    <div className="divide-y divide-stone-100">
      {weeks.map((week) => {
        const isHidden = hiddenWeekIds.includes(week.weekId);
        const filteredEvents = filterEventsByEnsemble(
          week.events,
          ensembleFilter
        );

        if (filteredEvents.length === 0 && !isHidden && litMap.size === 0) return null;

        const eventsByDate = groupEventsByDate(filteredEvents);
        const sortedEventDates = Array.from(eventsByDate.keys()).sort();

        // Compute full week date range (Sun through Sat)
        const weekStart = new Date(week.sundayDate + "T12:00:00");
        const allDatesInWeek: string[] = [];
        for (let i = 0; i <= 6; i++) {
          const d = new Date(weekStart);
          d.setDate(d.getDate() + i);
          allDatesInWeek.push(d.toISOString().split("T")[0]);
        }

        // Merge: event dates + dates with liturgical significance
        const mergedDates = new Set([...sortedEventDates]);
        for (const d of allDatesInWeek) {
          const ld = litMap.get(d);
          if (ld) {
            // Include optional_memorial and above
            const showableRanks = ["solemnity", "feast", "memorial", "optional_memorial", "sunday"];
            if (showableRanks.includes(ld.rank) || ld.saintName) {
              mergedDates.add(d);
            }
          }
        }
        const finalDates = Array.from(mergedDates).sort();

        // If no dates to show in this week at all, skip
        if (finalDates.length === 0 && !isHidden) return null;

        // Check for season transition at the start of this week
        let seasonTransition: { from: string; to: string; label: string } | null = null;
        if (litMap.size > 0 && finalDates.length > 0) {
          const firstDate = finalDates[0];
          const litDay = litMap.get(firstDate);
          if (litDay && prevSeason && litDay.season !== prevSeason) {
            const seasonInfo = SEASON_COLORS[litDay.season];
            seasonTransition = {
              from: prevSeason,
              to: litDay.season,
              label: seasonInfo?.label || litDay.season,
            };
          }
          // Update prevSeason for next iteration
          const lastDate = finalDates[finalDates.length - 1];
          const lastLitDay = litMap.get(lastDate);
          if (lastLitDay) prevSeason = lastLitDay.season;
          else {
            const firstLitDay = litMap.get(finalDates[0]);
            if (firstLitDay) prevSeason = firstLitDay.season;
          }
        }

        return (
          <div key={week.weekId} className="py-3">
            {/* Season transition marker */}
            {seasonTransition && (
              <div className="flex items-center gap-2 px-3 py-2 mb-2">
                <div
                  className="h-[3px] flex-1 rounded"
                  style={{
                    backgroundColor:
                      SEASON_COLORS[seasonTransition.to as keyof typeof SEASON_COLORS]?.primary ||
                      "#78716c",
                  }}
                />
                <span
                  className="text-xs font-semibold uppercase tracking-wide px-2"
                  style={{
                    color:
                      SEASON_COLORS[seasonTransition.to as keyof typeof SEASON_COLORS]?.primary ||
                      "#78716c",
                  }}
                >
                  {seasonTransition.label}
                </span>
                <div
                  className="h-[3px] flex-1 rounded"
                  style={{
                    backgroundColor:
                      SEASON_COLORS[seasonTransition.to as keyof typeof SEASON_COLORS]?.primary ||
                      "#78716c",
                  }}
                />
              </div>
            )}

            <WeekHeader
              week={week}
              isHidden={isHidden}
              onToggleHidden={onToggleHidden}
            />

            {!isHidden && (
              <div className="mt-2 space-y-1">
                {finalDates.map((date) => {
                  const events = eventsByDate.get(date) || [];
                  const past = isDatePast(date);
                  const litDay = litMap.get(date);
                  const hasEvents = events.length > 0;
                  const isSignificant = litDay && isSignificantRank(litDay.rank);

                  return (
                    <div key={date}>
                      {/* Date subheader with liturgical color dot */}
                      <div className="flex items-center gap-2 px-3 py-1">
                        {litDay && (() => {
                          const hex = LITURGICAL_COLOR_HEX[litDay.colorPrimary] ?? LITURGICAL_COLOR_HEX.green;
                          const isHolyThursday = litDay.celebrationName?.toLowerCase().includes("holy thursday");
                          const isWhite = litDay.colorPrimary === "white";
                          return (
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={isWhite ? {
                                backgroundColor: "#ffffff",
                                border: `1.5px solid ${isHolyThursday ? "#2563EB" : hex}`,
                              } : {
                                backgroundColor: hex,
                              }}
                              title={litDay.colorPrimary}
                            />
                          );
                        })()}
                        <span
                          className={`text-xs font-medium ${
                            past ? "text-stone-400" : hasEvents ? "text-stone-600" : "text-stone-400"
                          }`}
                        >
                          {formatDateLabel(date)}
                        </span>
                        {/* Celebration name for significant days or days with saint */}
                        {litDay && (isSignificant || litDay.saintName) && (
                          <span className={`text-[10px] truncate ${hasEvents ? "text-stone-400" : "text-stone-500"}`}>
                            {litDay.celebrationName}
                          </span>
                        )}
                        {/* Rank badge for non-event liturgical days */}
                        {litDay && !hasEvents && isSignificant && (
                          <span className="text-[9px] text-stone-400 capitalize shrink-0">
                            {rankLabel(litDay.rank)}
                          </span>
                        )}
                        <div className="flex-1 h-px bg-stone-100" />
                      </div>

                      {/* Events for this date */}
                      {events.map((event, idx) => (
                        <EventCard
                          key={`${event.date}-${event.startTime}-${idx}`}
                          event={event}
                          isPast={past}
                        />
                      ))}

                      {/* Ghost row for liturgical days without events — significant rank */}
                      {!hasEvents && litDay && isSignificant && (
                        <div
                          className="mx-3 px-3 py-2 rounded-md border-l-[3px] flex items-center gap-2"
                          style={{
                            backgroundColor: LITURGICAL_COLOR_LIGHT[litDay.colorPrimary],
                            borderLeftColor: LITURGICAL_COLOR_HEX[litDay.colorPrimary],
                            opacity: past ? 0.5 : 0.7,
                          }}
                        >
                          <span className="text-xs text-stone-500">
                            {litDay.celebrationName}
                          </span>
                          <span className="text-[10px] text-stone-400 capitalize">
                            {litDay.rank.replace("_", " ")}
                          </span>
                          {litDay.saintName && (
                            <span className="text-[10px] text-stone-400 italic truncate">
                              {litDay.saintName}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Minimal row for non-event, non-significant days (optional memorials, saint days) */}
                      {!hasEvents && litDay && !isSignificant && litDay.saintName && (
                        <div
                          className="mx-3 px-3 py-1 flex items-center gap-2"
                          style={{ opacity: past ? 0.4 : 0.6 }}
                        >
                          <span className="text-[10px] text-stone-400">
                            {litDay.celebrationName}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
