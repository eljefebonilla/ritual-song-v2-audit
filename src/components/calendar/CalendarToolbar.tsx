"use client";

import { useState } from "react";
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
  onAddEvent?: () => void;
  weekStartsOnMonday?: boolean;
  onToggleWeekStart?: () => void;
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
  onAddEvent,
  weekStartsOnMonday,
  onToggleWeekStart,
}: CalendarToolbarProps) {
  const { isAdmin } = useUser();
  const [showSubscribe, setShowSubscribe] = useState(false);

  const icalUrl = typeof window !== "undefined"
    ? `${window.location.origin}/api/calendar/ical${communityFilter !== "all" ? `?community=${communityFilter}` : ""}`
    : "";

  const handleCopyIcal = () => {
    navigator.clipboard.writeText(icalUrl);
    setShowSubscribe(false);
  };

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
        <div className="flex items-center gap-2">
          {/* Subscribe button */}
          <div className="relative">
            <button
              onClick={() => setShowSubscribe(!showSubscribe)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-600 border border-stone-200 rounded-md hover:bg-stone-50 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              Subscribe
            </button>
            {showSubscribe && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setShowSubscribe(false)} />
                <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-stone-200 rounded-lg shadow-lg z-40 p-4">
                  <h3 className="text-sm font-bold text-stone-900 mb-2">Subscribe to Calendar</h3>
                  <p className="text-xs text-stone-500 mb-3">
                    Copy this URL and add it to your calendar app (Google Calendar, Apple Calendar, Outlook) as a subscription.
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={icalUrl}
                      className="flex-1 text-xs border border-stone-200 rounded px-2 py-1.5 bg-stone-50 text-stone-600 truncate"
                    />
                    <button
                      onClick={handleCopyIcal}
                      className="px-3 py-1.5 text-xs font-medium text-white bg-stone-900 rounded hover:bg-stone-800"
                    >
                      Copy
                    </button>
                  </div>
                  {communityFilter !== "all" && (
                    <p className="text-xs text-amber-600 mt-2">
                      Filtered to: {communityFilter}
                    </p>
                  )}
                </div>
              </>
            )}
          </div>

          {onAddEvent && (
            <button
              onClick={onAddEvent}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-stone-900 rounded-md hover:bg-stone-800 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add Event
            </button>
          )}
        </div>
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

        {/* Month navigation + week start toggle (visible in month view) */}
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

            {/* Mon / Sun toggle */}
            {onToggleWeekStart && (
              <>
                <div className="w-px h-6 bg-stone-200" />
                <div className="flex bg-stone-100 rounded-lg p-0.5">
                  <button
                    onClick={weekStartsOnMonday ? undefined : onToggleWeekStart}
                    className={`px-2 py-0.5 text-[10px] font-medium rounded-md transition-colors ${
                      weekStartsOnMonday
                        ? "bg-white text-stone-900 shadow-sm"
                        : "text-stone-500 hover:text-stone-700"
                    }`}
                  >
                    Mon
                  </button>
                  <button
                    onClick={weekStartsOnMonday ? onToggleWeekStart : undefined}
                    className={`px-2 py-0.5 text-[10px] font-medium rounded-md transition-colors ${
                      !weekStartsOnMonday
                        ? "bg-white text-stone-900 shadow-sm"
                        : "text-stone-500 hover:text-stone-700"
                    }`}
                  >
                    Sun
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
