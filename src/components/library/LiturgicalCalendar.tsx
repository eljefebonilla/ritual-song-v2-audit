"use client";

import { useState } from "react";

const SEASON_COLORS: Record<string, string> = {
  advent: "bg-purple-700",
  christmas: "bg-yellow-600",
  lent: "bg-purple-900",
  easter: "bg-amber-600",
  ordinary: "bg-green-700",
  solemnity: "bg-red-800",
  feast: "bg-red-700",
};

// Light background tints for liturgical seasons
const SEASON_BG: Record<string, string> = {
  advent: "bg-purple-50",
  christmas: "bg-amber-50",
  lent: "bg-violet-50",
  easter: "bg-amber-50/60",
  ordinary: "bg-emerald-50/50",
  solemnity: "bg-red-50",
  feast: "bg-red-50/60",
};

// Gaudete (3rd Advent) & Laetare (4th Lent) get rose
function isRoseDay(name: string): boolean {
  const upper = name.toUpperCase();
  return upper.includes("THIRD SUNDAY OF ADVENT") || upper.includes("FOURTH SUNDAY OF LENT");
}

const ROSE_DOT = "bg-pink-400";
const ROSE_BG = "bg-pink-50";

const DAY_HEADERS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

interface DateOccasion {
  date: string;
  occasionId: string;
  season: string;
  name: string;
}

interface LiturgicalCalendarProps {
  selectedDate: string | null;
  onDateSelect: (date: string | null) => void;
  dateOccasionMap: Map<string, DateOccasion>;
}

function formatYYYYMMDD(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function LiturgicalCalendar({
  selectedDate,
  onDateSelect,
  dateOccasionMap,
}: LiturgicalCalendarProps) {
  // Initialize view to the selected date's month if present, otherwise today
  const initDate = selectedDate ? new Date(selectedDate + "T00:00:00") : new Date();
  const [viewYear, setViewYear] = useState(initDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initDate.getMonth());

  const goBack = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const goForward = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  // Build the calendar grid
  const firstDay = new Date(viewYear, viewMonth, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [];

  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  // Pad to fill last row
  while (cells.length % 7 !== 0) cells.push(null);

  const selectedOccasion = selectedDate
    ? dateOccasionMap.get(selectedDate)
    : null;

  return (
    <div className="space-y-1.5">
      {/* Month/year header */}
      <div className="flex items-center justify-between">
        <button
          onClick={goBack}
          className="p-0.5 rounded hover:bg-stone-200 text-stone-500 transition-colors"
          aria-label="Previous month"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span className="text-[11px] font-semibold text-stone-700">
          {MONTH_NAMES[viewMonth]} {viewYear}
        </span>
        <button
          onClick={goForward}
          className="p-0.5 rounded hover:bg-stone-200 text-stone-500 transition-colors"
          aria-label="Next month"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 text-center">
        {DAY_HEADERS.map((d) => (
          <div key={d} className="text-[9px] font-semibold text-stone-400 uppercase py-0.5">
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((day, idx) => {
          if (day === null) {
            return <div key={`empty-${idx}`} className="h-6" />;
          }

          const dateStr = formatYYYYMMDD(viewYear, viewMonth, day);
          const occasion = dateOccasionMap.get(dateStr);
          const isSelected = selectedDate === dateStr;
          const hasOccasion = !!occasion;
          const isSunday = idx % 7 === 0;
          const rose = occasion ? isRoseDay(occasion.name) : false;
          const seasonBg = rose ? ROSE_BG : (occasion ? (SEASON_BG[occasion.season] || "") : "");

          return (
            <button
              key={dateStr}
              disabled={!hasOccasion}
              onClick={() => {
                if (isSelected) {
                  onDateSelect(null);
                } else {
                  onDateSelect(dateStr);
                }
              }}
              className={`
                h-6 flex flex-col items-center justify-center rounded text-[10px] leading-none transition-colors relative
                ${isSelected
                  ? "bg-stone-800 text-white font-bold"
                  : hasOccasion && isSunday
                    ? `${seasonBg} text-stone-900 hover:bg-stone-200 cursor-pointer font-bold ring-1 ring-inset ring-stone-300/60`
                    : hasOccasion
                      ? `${seasonBg} text-stone-700 hover:bg-stone-200 cursor-pointer font-medium`
                      : "text-stone-300 cursor-default"
                }
              `}
            >
              {day}
              {hasOccasion && (
                <span
                  className={`absolute bottom-0 w-1.5 h-1 rounded-full ${
                    isSelected ? "bg-white" : rose ? ROSE_DOT : (SEASON_COLORS[occasion.season] || "bg-stone-400")
                  }`}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Selected occasion label */}
      {selectedOccasion && (() => {
        const selRose = isRoseDay(selectedOccasion.name);
        return (
        <div className={`text-[10px] text-stone-700 rounded px-2 py-1.5 mt-1 leading-tight flex items-center gap-1.5 ${selRose ? ROSE_BG : (SEASON_BG[selectedOccasion.season] || "bg-stone-100")}`}>
          <span className={`w-2 h-2 rounded-full shrink-0 ${selRose ? ROSE_DOT : (SEASON_COLORS[selectedOccasion.season] || "bg-stone-400")}`} />
          <span className="font-medium">{selectedOccasion.name}</span>
        </div>
        );
      })()}
    </div>
  );
}
