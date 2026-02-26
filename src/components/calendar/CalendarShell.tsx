"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import type { MinistryCalendar, CalendarView } from "@/lib/calendar-types";
import type { CommunityId } from "@/lib/grid-types";
import { getVisibleWeeks } from "@/lib/calendar-utils";
import { useUser } from "@/lib/user-context";
import CalendarToolbar from "./CalendarToolbar";
import AgendaView from "./AgendaView";
import MonthView from "./MonthView";

interface CalendarShellProps {
  calendar: MinistryCalendar;
}

const HIDDEN_WEEKS_KEY = "rs_hidden_weeks";

export default function CalendarShell({ calendar }: CalendarShellProps) {
  const { isAdmin } = useUser();

  // View state
  const [view, setView] = useState<CalendarView>("agenda");
  const [showPastDates, setShowPastDates] = useState(false);
  const [communityFilter, setCommunityFilter] = useState<CommunityId | "all">(
    "all"
  );
  const [currentMonth, setCurrentMonth] = useState(() => new Date());

  // Admin hidden weeks (localStorage)
  const [hiddenWeekIds, setHiddenWeekIds] = useState<string[]>([]);

  // Load hidden weeks from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(HIDDEN_WEEKS_KEY);
      if (stored) {
        setHiddenWeekIds(JSON.parse(stored));
      }
    } catch {
      // ignore parse errors
    }
  }, []);

  // Toggle week hidden state
  const toggleHiddenWeek = useCallback(
    (weekId: string) => {
      setHiddenWeekIds((prev) => {
        const next = prev.includes(weekId)
          ? prev.filter((id) => id !== weekId)
          : [...prev, weekId];

        // Persist to localStorage
        try {
          localStorage.setItem(HIDDEN_WEEKS_KEY, JSON.stringify(next));
        } catch {
          // ignore storage errors
        }

        return next;
      });
    },
    []
  );

  // Compute visible weeks
  const visibleWeeks = useMemo(
    () =>
      getVisibleWeeks(calendar.weeks, {
        showPast: showPastDates,
        hiddenWeekIds,
        isAdmin,
      }),
    [calendar.weeks, showPastDates, hiddenWeekIds, isAdmin]
  );

  return (
    <div className="flex flex-col h-screen">
      <CalendarToolbar
        view={view}
        setView={setView}
        communityFilter={communityFilter}
        setCommunityFilter={setCommunityFilter}
        showPastDates={showPastDates}
        setShowPastDates={setShowPastDates}
        currentMonth={currentMonth}
        setCurrentMonth={setCurrentMonth}
        totalWeeks={calendar.weeks.length}
        visibleWeeks={visibleWeeks.length}
      />

      <div className="flex-1 overflow-y-auto">
        {view === "agenda" ? (
          <AgendaView
            weeks={visibleWeeks}
            communityFilter={communityFilter}
            hiddenWeekIds={hiddenWeekIds}
            onToggleHidden={toggleHiddenWeek}
          />
        ) : (
          <MonthView weeks={calendar.weeks} currentMonth={currentMonth} />
        )}
      </div>
    </div>
  );
}
