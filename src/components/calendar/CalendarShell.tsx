"use client";

import { useState, useMemo, useCallback } from "react";
import type { MinistryCalendar, CalendarView, CalendarEvent } from "@/lib/calendar-types";
import type { CommunityId } from "@/lib/grid-types";
import { getVisibleWeeks } from "@/lib/calendar-utils";
import { useUser } from "@/lib/user-context";
import CalendarToolbar from "./CalendarToolbar";
import AgendaView from "./AgendaView";
import MonthView from "./MonthView";
import EventEditor from "./EventEditor";

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

  // Admin hidden weeks (localStorage — lazy init)
  const [hiddenWeekIds, setHiddenWeekIds] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem(HIDDEN_WEEKS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Event editor state
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<(CalendarEvent & { id?: string }) | undefined>(undefined);

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

  const handleAddEvent = () => {
    setEditingEvent(undefined);
    setEditorOpen(true);
  };

  const handleSaveEvent = async (data: Record<string, unknown>) => {
    const url = editingEvent?.id
      ? `/api/calendar/${editingEvent.id}`
      : "/api/calendar";
    const method = editingEvent?.id ? "PUT" : "POST";

    await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    // In a full implementation, we'd refetch or update local state here.
    // For now, the calendar still reads from JSON, so new events will show
    // after the migration script is run.
  };

  const handleDeleteEvent = async () => {
    if (!editingEvent?.id) return;
    await fetch(`/api/calendar/${editingEvent.id}`, { method: "DELETE" });
  };

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
        onAddEvent={isAdmin ? handleAddEvent : undefined}
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

      {/* Event Editor */}
      {editorOpen && (
        <EventEditor
          event={editingEvent}
          onSave={handleSaveEvent}
          onDelete={editingEvent?.id ? handleDeleteEvent : undefined}
          onClose={() => {
            setEditorOpen(false);
            setEditingEvent(undefined);
          }}
        />
      )}
    </div>
  );
}
