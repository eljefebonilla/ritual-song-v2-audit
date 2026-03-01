"use client";

import type { CalendarWeek } from "@/lib/calendar-types";
import type { LiturgicalDay } from "@/lib/types";
import { getEventsForMonth } from "@/lib/calendar-utils";
import { LITURGICAL_COLOR_LIGHT, LITURGICAL_COLOR_HEX } from "@/lib/liturgical-colors";
import { buildLiturgicalDayMap, isSignificantRank } from "@/lib/liturgical-helpers";
import { useMemo } from "react";

interface MonthViewProps {
  weeks: CalendarWeek[];
  currentMonth: Date;
  liturgicalDays?: LiturgicalDay[];
}

const DAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function MonthView({ weeks, currentMonth, liturgicalDays }: MonthViewProps) {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  // Get events for this month
  const eventsMap = getEventsForMonth(weeks, year, month);

  // Build liturgical day lookup
  const litMap = useMemo(
    () => (liturgicalDays ? buildLiturgicalDayMap(liturgicalDays) : new Map<string, LiturgicalDay>()),
    [liturgicalDays]
  );

  // Build calendar grid
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDayOfWeek = firstDay.getDay(); // 0=Sun
  const daysInMonth = lastDay.getDate();

  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const isCurrentMonth =
    today.getFullYear() === year && today.getMonth() === month;

  // Build grid cells
  const cells: Array<{ day: number | null; dateStr: string; isToday: boolean }> = [];

  // Leading empty cells
  for (let i = 0; i < startDayOfWeek; i++) {
    cells.push({ day: null, dateStr: "", isToday: false });
  }

  // Day cells
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${(month + 1).toString().padStart(2, "0")}-${d
      .toString()
      .padStart(2, "0")}`;
    cells.push({ day: d, dateStr, isToday: dateStr === todayStr });
  }

  // Trailing empty cells to fill the last row
  while (cells.length % 7 !== 0) {
    cells.push({ day: null, dateStr: "", isToday: false });
  }

  return (
    <div className="p-4">
      {/* Day headers */}
      <div className="grid grid-cols-7 gap-px mb-1">
        {DAY_HEADERS.map((d) => (
          <div
            key={d}
            className="text-center text-xs font-medium text-stone-500 py-1"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-px bg-stone-200 rounded-lg overflow-hidden">
        {cells.map((cell, idx) => {
          if (cell.day === null) {
            return (
              <div
                key={`empty-${idx}`}
                className="bg-stone-50 min-h-[5rem] p-1"
              />
            );
          }

          const dayEvents = eventsMap.get(cell.day) || [];
          const litDay = litMap.get(cell.dateStr);
          const isPast =
            isCurrentMonth &&
            cell.day < today.getDate() &&
            !cell.isToday;

          // Liturgical color tint for cell background
          const bgColor = litDay
            ? LITURGICAL_COLOR_LIGHT[litDay.colorPrimary]
            : undefined;

          // Show celebration name for Sundays and significant ranks
          const showName =
            litDay &&
            (isSignificantRank(litDay.rank) || idx % 7 === 0); // idx%7===0 is Sunday column

          return (
            <div
              key={cell.day}
              className={`min-h-[5rem] p-1 relative ${
                cell.isToday ? "ring-2 ring-parish-burgundy ring-inset" : ""
              } ${isPast ? "opacity-50" : ""}`}
              style={{ backgroundColor: bgColor || "#ffffff" }}
            >
              {/* Liturgical color bar — 3px top border */}
              {litDay && (
                <div
                  className="absolute top-0 left-0 right-0 h-[3px]"
                  style={{ backgroundColor: LITURGICAL_COLOR_HEX[litDay.colorPrimary] }}
                />
              )}

              {/* Day number */}
              <span
                className={`text-xs font-medium ${
                  cell.isToday
                    ? "bg-parish-burgundy text-white rounded-full w-5 h-5 flex items-center justify-center"
                    : "text-stone-700"
                }`}
              >
                {cell.day}
              </span>

              {/* Celebration name */}
              {showName && litDay && (
                <div
                  className="mt-0.5 text-[9px] leading-tight text-stone-600 line-clamp-2"
                  title={litDay.celebrationName}
                >
                  {litDay.celebrationName}
                </div>
              )}

              {/* Event dots */}
              {dayEvents.length > 0 && (
                <div className="mt-0.5 space-y-0.5">
                  {dayEvents.slice(0, 3).map((evt, i) => {
                    // Determine dot color based on event type
                    let dotColor = "bg-stone-300";
                    if (evt.eventType === "mass") {
                      if (evt.community) {
                        const communityDotColors: Record<string, string> = {
                          reflections: "#5a6a78",
                          foundations: "#8b6b5a",
                          generations: "#8a7a3a",
                          heritage: "#5a6b54",
                          elevations: "#6b5a8a",
                        };
                        dotColor =
                          communityDotColors[evt.community.toLowerCase()] ||
                          "";
                      } else {
                        dotColor = "bg-parish-burgundy";
                      }
                    } else if (evt.eventType === "rehearsal") {
                      dotColor = "bg-parish-gold";
                    } else if (evt.eventType === "devotion") {
                      dotColor = "bg-indigo-400";
                    }

                    const isHex = dotColor.startsWith("#");
                    return (
                      <div
                        key={i}
                        className={`h-1 rounded-full ${isHex ? "" : dotColor}`}
                        style={isHex ? { backgroundColor: dotColor } : undefined}
                        title={`${evt.startTime12h || ""} ${evt.title}`}
                      />
                    );
                  })}
                  {dayEvents.length > 3 && (
                    <span className="text-[9px] text-stone-400">
                      +{dayEvents.length - 3}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 mt-3 px-1">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-parish-burgundy" />
          <span className="text-[10px] text-stone-500">Mass</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-parish-gold" />
          <span className="text-[10px] text-stone-500">Rehearsal</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-indigo-400" />
          <span className="text-[10px] text-stone-500">Devotion</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-stone-300" />
          <span className="text-[10px] text-stone-500">Other</span>
        </div>
        {/* Liturgical color swatches */}
        <div className="border-l border-stone-300 pl-3 flex items-center gap-2">
          {(["violet", "white", "red", "green", "rose"] as const).map((c) => (
            <div key={c} className="flex items-center gap-0.5" title={c}>
              <div
                className="w-2 h-2 rounded-full border border-stone-200"
                style={{ backgroundColor: LITURGICAL_COLOR_HEX[c] }}
              />
              <span className="text-[9px] text-stone-400 capitalize">{c}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
