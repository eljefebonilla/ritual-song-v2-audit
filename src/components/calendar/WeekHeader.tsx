"use client";

import type { CalendarWeek } from "@/lib/calendar-types";
import {
  getSeasonBorderClass,
  getSeasonTextClass,
  formatDateLabel,
} from "@/lib/calendar-utils";
import { useUser } from "@/lib/user-context";

interface WeekHeaderProps {
  week: CalendarWeek;
  isHidden: boolean;
  onToggleHidden?: (weekId: string) => void;
}

export default function WeekHeader({
  week,
  isHidden,
  onToggleHidden,
}: WeekHeaderProps) {
  const { isAdmin } = useUser();
  const borderClass = getSeasonBorderClass(week.season);
  const textClass = getSeasonTextClass(week.season);

  return (
    <div
      className={`border-l-4 ${borderClass} pl-3 py-2 flex items-center justify-between ${
        isHidden ? "opacity-50" : ""
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-base">{week.seasonEmoji}</span>
          <h3
            className={`text-sm font-bold ${textClass} ${
              isHidden ? "line-through" : ""
            }`}
          >
            {week.liturgicalName}
          </h3>
          {isHidden && (
            <span className="text-[10px] px-1.5 py-0.5 bg-stone-200 text-stone-500 rounded font-medium">
              Hidden
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {week.theme && (
            <span className="text-xs text-stone-500 italic">
              {week.theme}
            </span>
          )}
          <span className="text-xs text-stone-400">
            {formatDateLabel(week.sundayDate)}
          </span>
        </div>
      </div>

      {/* Admin: hide/show toggle */}
      {isAdmin && onToggleHidden && (
        <button
          onClick={() => onToggleHidden(week.weekId)}
          className="p-1.5 rounded hover:bg-stone-100 transition-colors group"
          title={isHidden ? "Show this week" : "Hide this week"}
        >
          {isHidden ? (
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-stone-400 group-hover:text-stone-600"
            >
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
              <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
              <line x1="1" y1="1" x2="23" y2="23" />
            </svg>
          ) : (
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-stone-300 group-hover:text-stone-500"
            >
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      )}
    </div>
  );
}
