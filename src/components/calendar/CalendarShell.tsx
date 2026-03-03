"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { MinistryCalendar, CalendarView, CalendarEvent } from "@/lib/calendar-types";
import type { LiturgicalDay } from "@/lib/types";
import type { EnsembleId } from "@/lib/grid-types";
import { getVisibleWeeks } from "@/lib/calendar-utils";
import { useUser } from "@/lib/user-context";
import CalendarToolbar from "./CalendarToolbar";
import AgendaView from "./AgendaView";
import MonthView from "./MonthView";
import EventEditor from "./EventEditor";

interface CalendarShellProps {
  calendar: MinistryCalendar;
  liturgicalDays?: LiturgicalDay[];
}

const HIDDEN_WEEKS_KEY = "rs_hidden_weeks";

export default function CalendarShell({ calendar, liturgicalDays }: CalendarShellProps) {
  const { isAdmin } = useUser();
  const router = useRouter();

  // View state
  const [view, setView] = useState<CalendarView>("agenda");
  const [showPastDates, setShowPastDates] = useState(false);
  const [ensembleFilter, setEnsembleFilter] = useState<EnsembleId | "all">(
    "all"
  );
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [weekStartsOnMonday, setWeekStartsOnMonday] = useState(true);

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

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      router.refresh();
    }
  };

  const handleDeleteEvent = async () => {
    if (!editingEvent?.id) return;
    const res = await fetch(`/api/calendar/${editingEvent.id}`, { method: "DELETE" });
    if (res.ok) {
      router.refresh();
    }
  };

  return (
    <div className="flex flex-col h-screen">
      <CalendarToolbar
        view={view}
        setView={setView}
        ensembleFilter={ensembleFilter}
        setEnsembleFilter={setEnsembleFilter}
        showPastDates={showPastDates}
        setShowPastDates={setShowPastDates}
        currentMonth={currentMonth}
        setCurrentMonth={setCurrentMonth}
        totalWeeks={calendar.weeks.length}
        visibleWeeks={visibleWeeks.length}
        onAddEvent={isAdmin ? handleAddEvent : undefined}
        weekStartsOnMonday={weekStartsOnMonday}
        onToggleWeekStart={() => setWeekStartsOnMonday((v) => !v)}
      />

      <div className="flex-1 overflow-y-auto">
        {view === "agenda" ? (
          <AgendaView
            weeks={visibleWeeks}
            ensembleFilter={ensembleFilter}
            hiddenWeekIds={hiddenWeekIds}
            onToggleHidden={toggleHiddenWeek}
            liturgicalDays={liturgicalDays}
          />
        ) : (
          <MonthView weeks={calendar.weeks} currentMonth={currentMonth} liturgicalDays={liturgicalDays} weekStartsOnMonday={weekStartsOnMonday} />
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
