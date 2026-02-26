"use client";

import type { CalendarWeek } from "@/lib/calendar-types";
import { getEventsForMonth, getSeasonColorClass } from "@/lib/calendar-utils";

interface MonthViewProps {
  weeks: CalendarWeek[];
  currentMonth: Date;
}

const DAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function MonthView({ weeks, currentMonth }: MonthViewProps) {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  // Get events for this month
  const eventsMap = getEventsForMonth(weeks, year, month);

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
  const cells: Array<{ day: number | null; isToday: boolean }> = [];

  // Leading empty cells
  for (let i = 0; i < startDayOfWeek; i++) {
    cells.push({ day: null, isToday: false });
  }

  // Day cells
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${(month + 1).toString().padStart(2, "0")}-${d
      .toString()
      .padStart(2, "0")}`;
    cells.push({ day: d, isToday: dateStr === todayStr });
  }

  // Trailing empty cells to fill the last row
  while (cells.length % 7 !== 0) {
    cells.push({ day: null, isToday: false });
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
          const isPast =
            isCurrentMonth &&
            cell.day < today.getDate() &&
            !cell.isToday;

          // Group events by season for colored dots
          const seasonDots = new Map<string, number>();
          for (const evt of dayEvents) {
            const season = evt.eventType === "mass" ? "mass" : "other";
            seasonDots.set(season, (seasonDots.get(season) || 0) + 1);
          }

          return (
            <div
              key={cell.day}
              className={`bg-white min-h-[5rem] p-1 relative ${
                cell.isToday ? "ring-2 ring-parish-burgundy ring-inset" : ""
              } ${isPast ? "opacity-50" : ""}`}
            >
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

              {/* Event dots */}
              {dayEvents.length > 0 && (
                <div className="mt-1 space-y-0.5">
                  {dayEvents.slice(0, 3).map((evt, i) => {
                    // Determine dot color based on event type
                    let dotColor = "bg-stone-300";
                    if (evt.eventType === "mass") {
                      if (evt.community) {
                        const communityColors: Record<string, string> = {
                          reflections: "bg-purple-400",
                          foundations: "bg-blue-400",
                          generations: "bg-green-400",
                          heritage: "bg-amber-400",
                          elevations: "bg-rose-400",
                        };
                        dotColor =
                          communityColors[evt.community.toLowerCase()] ||
                          "bg-parish-burgundy";
                      } else {
                        dotColor = "bg-parish-burgundy";
                      }
                    } else if (evt.eventType === "rehearsal") {
                      dotColor = "bg-parish-gold";
                    } else if (evt.eventType === "devotion") {
                      dotColor = "bg-indigo-400";
                    }

                    return (
                      <div
                        key={i}
                        className={`h-1 rounded-full ${dotColor}`}
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
      <div className="flex items-center gap-4 mt-3 px-1">
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
      </div>
    </div>
  );
}
