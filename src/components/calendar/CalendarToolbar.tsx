"use client";

import type { CommunityId } from "@/lib/grid-types";
import type { CalendarView } from "@/lib/calendar-types";
import { COMMUNITY_OPTIONS } from "@/lib/grid-types";
import { formatMonthYear } from "@/lib/calendar-utils";
import { useUser } from "@/lib/user-context";

interface CalendarToolbarProps {
  view: CalendarView;
  setView: (v: CalendarView) => void;
  communityFilter: CommunityId | "all";
  setCommunityFilter: (v: CommunityId | "all") => void;
  showPastDates: boolean;
  setShowPastDates: (v: boolean) => void;
  currentMonth: Date;
  setCurrentMonth: (d: Date) => void;
  totalWeeks: number;
  visibleWeeks: number;
}

export default function CalendarToolbar({
  view,
  setView,
  communityFilter,
  setCommunityFilter,
  showPastDates,
  setShowPastDates,
  currentMonth,
  setCurrentMonth,
  totalWeeks,
  visibleWeeks,
}: CalendarToolbarProps) {
  const { isAdmin } = useUser();

  const handlePrevMonth = () => {
    const d = new Date(currentMonth);
    d.setMonth(d.getMonth() - 1);
    setCurrentMonth(d);
  };

  const handleNextMonth = () => {
    const d = new Date(currentMonth);
    d.setMonth(d.getMonth() + 1);
    setCurrentMonth(d);
  };

  return (
    <div className="bg-white border-b border-stone-200 px-4 py-3 shrink-0">
      {/* Top row */}
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-lg font-bold text-stone-900">
          Calendar
          <span className="text-sm font-normal text-stone-400 ml-2">
            {visibleWeeks} of {totalWeeks} weeks
          </span>
        </h1>
      </div>

      {/* Filter row */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* View toggle */}
        <div className="flex items-center gap-1.5">
          <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">
            View
          </label>
          <div className="flex bg-stone-100 rounded-lg p-0.5">
            <button
              onClick={() => setView("agenda")}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                view === "agenda"
                  ? "bg-white text-stone-900 shadow-sm"
                  : "text-stone-500 hover:text-stone-700"
              }`}
            >
              Agenda
            </button>
            <button
              onClick={() => setView("month")}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                view === "month"
                  ? "bg-white text-stone-900 shadow-sm"
                  : "text-stone-500 hover:text-stone-700"
              }`}
            >
              Month
            </button>
          </div>
        </div>

        <div className="w-px h-6 bg-stone-200" />

        {/* Community filter */}
        <div className="flex items-center gap-1.5">
          <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">
            Community
          </label>
          <select
            value={communityFilter}
            onChange={(e) =>
              setCommunityFilter(e.target.value as CommunityId | "all")
            }
            className="text-xs border border-stone-200 rounded-md px-2 py-1.5 bg-white text-stone-700 focus:outline-none focus:ring-1 focus:ring-stone-400"
          >
            <option value="all">All Communities</option>
            {COMMUNITY_OPTIONS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <div className="w-px h-6 bg-stone-200" />

        {/* Past dates toggle */}
        <label className="flex items-center gap-1.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={!showPastDates}
            onChange={(e) => setShowPastDates(!e.target.checked)}
            className="rounded border-stone-300 text-parish-burgundy focus:ring-parish-burgundy"
          />
          <span className="text-xs text-stone-600">Hide past dates</span>
        </label>

        {isAdmin && showPastDates && (
          <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
            Showing past dates (admin)
          </span>
        )}

        {/* Month navigation (visible in month view) */}
        {view === "month" && (
          <>
            <div className="w-px h-6 bg-stone-200" />
            <div className="flex items-center gap-1">
              <button
                onClick={handlePrevMonth}
                className="p-1 rounded text-stone-500 hover:text-stone-900 hover:bg-stone-100 transition-colors"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
              <span className="text-xs font-medium text-stone-700 min-w-[8rem] text-center">
                {formatMonthYear(currentMonth)}
              </span>
              <button
                onClick={handleNextMonth}
                className="p-1 rounded text-stone-500 hover:text-stone-900 hover:bg-stone-100 transition-colors"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
