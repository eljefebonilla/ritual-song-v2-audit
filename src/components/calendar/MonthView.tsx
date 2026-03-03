"use client";

import { useState, useMemo } from "react";
import type { CalendarWeek } from "@/lib/calendar-types";
import type { LiturgicalDay } from "@/lib/types";
import { getEventsForMonthByDateStr, dayOfWeekToGridIndex } from "@/lib/calendar-utils";
import { LITURGICAL_COLOR_LIGHT, LITURGICAL_COLOR_HEX } from "@/lib/liturgical-colors";
import { buildLiturgicalDayMap, isSignificantRank } from "@/lib/liturgical-helpers";
import DayDetailPanel from "./DayDetailPanel";

interface MonthViewProps {
  weeks: CalendarWeek[];
  currentMonth: Date;
  liturgicalDays?: LiturgicalDay[];
  weekStartsOnMonday?: boolean;
  onEditEvent?: (event: CalendarWeek["events"][number]) => void;
  onAddEventForDate?: (dateStr: string) => void;
}

const MON_HEADERS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const SUN_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function MonthView({
  weeks,
  currentMonth,
  liturgicalDays,
  weekStartsOnMonday = true,
  onEditEvent,
  onAddEventForDate,
}: MonthViewProps) {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const eventsMap = getEventsForMonthByDateStr(weeks, year, month);

  const litMap = useMemo(
    () => (liturgicalDays ? buildLiturgicalDayMap(liturgicalDays) : new Map<string, LiturgicalDay>()),
    [liturgicalDays]
  );

  // Build calendar grid
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDayOfWeek = dayOfWeekToGridIndex(firstDay.getDay(), weekStartsOnMonday);
  const daysInMonth = lastDay.getDate();

  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

  // Build grid cells
  const cells: Array<{ day: number | null; dateStr: string; isToday: boolean; gridCol: number }> = [];

  // Leading empty cells
  for (let i = 0; i < startDayOfWeek; i++) {
    cells.push({ day: null, dateStr: "", isToday: false, gridCol: i });
  }

  // Day cells
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${(month + 1).toString().padStart(2, "0")}-${d.toString().padStart(2, "0")}`;
    const jsDay = new Date(year, month, d).getDay();
    const gridCol = dayOfWeekToGridIndex(jsDay, weekStartsOnMonday);
    cells.push({ day: d, dateStr, isToday: dateStr === todayStr, gridCol });
  }

  // Trailing empty cells
  while (cells.length % 7 !== 0) {
    cells.push({ day: null, dateStr: "", isToday: false, gridCol: cells.length % 7 });
  }

  const dayHeaders = weekStartsOnMonday ? MON_HEADERS : SUN_HEADERS;
  // Sunday column index
  const sundayCol = weekStartsOnMonday ? 6 : 0;

  const handleDayClick = (dateStr: string) => {
    setSelectedDate((prev) => (prev === dateStr ? null : dateStr));
  };

  // Data for selected day
  const selectedLitDay = selectedDate ? litMap.get(selectedDate) ?? null : null;
  const selectedEvents = selectedDate ? eventsMap.get(selectedDate) || [] : [];

  return (
    <div className="p-4">
      {/* Day headers */}
      <div className="grid grid-cols-7 gap-px mb-1">
        {dayHeaders.map((d) => (
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

          const dayEvents = eventsMap.get(cell.dateStr) || [];
          const litDay = litMap.get(cell.dateStr);
          const isPast = isCurrentMonth && cell.day < today.getDate() && !cell.isToday;
          const isSelected = selectedDate === cell.dateStr;

          // Liturgical color tint for cell background
          const bgColor = litDay
            ? LITURGICAL_COLOR_LIGHT[litDay.colorPrimary]
            : undefined;

          // Show celebration name for Sundays and significant ranks
          const showName =
            litDay &&
            (isSignificantRank(litDay.rank) || cell.gridCol === sundayCol);

          return (
            <div
              key={cell.day}
              onClick={() => handleDayClick(cell.dateStr)}
              className={`min-h-[5rem] p-1 relative cursor-pointer transition-shadow ${
                isSelected ? "ring-2 ring-parish-burgundy ring-inset" : ""
              } ${cell.isToday && !isSelected ? "ring-1 ring-parish-burgundy/40 ring-inset" : ""} ${
                isPast ? "opacity-50" : ""
              }`}
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
                className={`text-xs font-medium inline-flex ${
                  cell.isToday
                    ? "bg-parish-burgundy text-white rounded-full w-5 h-5 items-center justify-center"
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

              {/* Event text labels */}
              {dayEvents.length > 0 && (
                <div className="mt-0.5 space-y-0.5">
                  {dayEvents.slice(0, 3).map((evt, i) => (
                    <div
                      key={i}
                      className="text-[9px] leading-tight text-stone-600 truncate"
                      title={`${evt.startTime12h || ""} ${evt.title}`}
                    >
                      {evt.startTime12h && (
                        <span className="text-stone-400 mr-0.5 tabular-nums">
                          {evt.startTime12h}
                        </span>
                      )}
                      {evt.title}
                    </div>
                  ))}
                  {dayEvents.length > 3 && (
                    <span className="text-[9px] text-stone-400">
                      +{dayEvents.length - 3} more
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend — liturgical colors only */}
      <div className="flex flex-wrap items-center gap-2 mt-3 px-1">
        <span className="text-[10px] text-stone-400 font-medium uppercase tracking-wide mr-1">Liturgical color:</span>
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

      {/* Day detail panel */}
      {selectedDate && (
        <div className="mt-4">
          <DayDetailPanel
            date={selectedDate}
            litDay={selectedLitDay}
            events={selectedEvents}
            onClose={() => setSelectedDate(null)}
            onEditEvent={onEditEvent}
            onAddEvent={
              onAddEventForDate
                ? () => onAddEventForDate(selectedDate)
                : undefined
            }
          />
        </div>
      )}
    </div>
  );
}
