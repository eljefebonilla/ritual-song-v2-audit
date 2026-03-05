"use client";

import { useMemo, useRef, useState, useCallback, useEffect } from "react";
import type { USCCBDay, MassEventV2, BookingPersonnel, Holiday, DayData } from "./types";
import DayRow from "./DayRow";
import MonthHeader from "./MonthHeader";
import CalendarV2Toolbar from "./CalendarV2Toolbar";
import EventCreatorModal from "./EventCreatorModal";

// ---------------------------------------------------------------------------
// Season detection from date ranges (approximate for liturgical year 2025-26)
// ---------------------------------------------------------------------------

function getSeason(dateStr: string): string {
  const d = dateStr;
  if (d >= "2025-11-30" && d <= "2025-12-24") return "Advent";
  if (d >= "2025-12-25" && d <= "2026-01-11") return "Christmas";
  if (d >= "2026-01-12" && d <= "2026-02-17") return "Ordinary Time";
  if (d >= "2026-02-18" && d <= "2026-03-28") return "Lent";
  if (d >= "2026-03-29" && d <= "2026-04-04") return "Holy Week";
  if (d >= "2026-04-05" && d <= "2026-05-24") return "Easter";
  if (d >= "2026-05-25" && d <= "2026-11-28") return "Ordinary Time";
  return "Ordinary Time";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface CalendarV2ShellProps {
  liturgicalDays: USCCBDay[];
  massEvents: MassEventV2[];
  bookings: BookingPersonnel[];
}

export default function CalendarV2Shell({
  liturgicalDays,
  massEvents,
  bookings,
}: CalendarV2ShellProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // State
  const [showFederalHolidays, setShowFederalHolidays] = useState(true);
  const [showStateHolidays, setShowStateHolidays] = useState(false);
  const [zipCode, setZipCode] = useState("");
  const [stateLabel, setStateLabel] = useState("");
  const [eventCreatorDate, setEventCreatorDate] = useState<string | null>(null);

  // Holiday data (placeholder — files may not exist yet)
  const [holidays, setHolidays] = useState<Holiday[]>([]);

  // Load holiday data from JSON
  useEffect(() => {
    async function loadHolidays() {
      try {
        const mod = await import("@/data/us-holidays-2026.json");
        const raw = mod.default as {
          federal: { date: string; name: string }[];
          statesByFips: Record<string, { date: string; name: string }[]>;
        };
        const result: Holiday[] = [];
        for (const h of raw.federal ?? []) {
          result.push({ date: h.date, name: h.name, type: "federal" });
        }
        for (const [state, items] of Object.entries(raw.statesByFips ?? {})) {
          for (const h of items) {
            result.push({ date: h.date, name: h.name, type: "state", state });
          }
        }
        setHolidays(result);
      } catch {
        setHolidays([]);
      }
    }
    loadHolidays();
  }, []);

  // Resolve zip to state
  useEffect(() => {
    if (zipCode.length !== 5) {
      setStateLabel("");
      setShowStateHolidays(false);
      return;
    }
    async function resolveZip() {
      try {
        const mod = await import("@/lib/zip-to-state");
        const state = (mod.zipToState as (z: string) => string | null)?.(zipCode);
        setStateLabel(state ?? "");
        if (state) setShowStateHolidays(true);
      } catch {
        setStateLabel("");
      }
    }
    resolveZip();
  }, [zipCode]);

  // Build personnel lookup: massEventId -> BookingPersonnel[]
  const personnelMap = useMemo(() => {
    const map = new Map<string, BookingPersonnel[]>();
    for (const b of bookings) {
      const arr = map.get(b.massEventId) ?? [];
      arr.push(b);
      map.set(b.massEventId, arr);
    }
    return map;
  }, [bookings]);

  // Build events lookup: date -> MassEventV2[]
  const eventsMap = useMemo(() => {
    const map = new Map<string, MassEventV2[]>();
    for (const e of massEvents) {
      const arr = map.get(e.date) ?? [];
      arr.push(e);
      map.set(e.date, arr);
    }
    return map;
  }, [massEvents]);

  // Build holidays lookup: date -> Holiday[]
  const holidaysMap = useMemo(() => {
    const map = new Map<string, Holiday[]>();
    for (const h of holidays) {
      if (h.type === "federal" && !showFederalHolidays) continue;
      if (h.type === "state" && !showStateHolidays) continue;
      if (h.type === "state" && stateLabel && h.state && h.state !== stateLabel) continue;
      const arr = map.get(h.date) ?? [];
      arr.push(h);
      map.set(h.date, arr);
    }
    return map;
  }, [holidays, showFederalHolidays, showStateHolidays, stateLabel]);

  // Build liturgical lookup: date -> USCCBDay
  const litMap = useMemo(() => {
    const map = new Map<string, USCCBDay>();
    for (const d of liturgicalDays) {
      map.set(d.date, d);
    }
    return map;
  }, [liturgicalDays]);

  // Generate all dates in range
  const allDates = useMemo(() => {
    const dates: string[] = [];
    const start = new Date("2025-11-30");
    const end = new Date("2026-11-28");
    const cursor = new Date(start);
    while (cursor <= end) {
      dates.push(cursor.toISOString().slice(0, 10));
      cursor.setDate(cursor.getDate() + 1);
    }
    return dates;
  }, []);

  // Group dates by month
  const monthGroups = useMemo(() => {
    const groups: { key: string; label: string; year: number; season: string; dates: string[] }[] = [];
    let current: (typeof groups)[number] | null = null;

    for (const dateStr of allDates) {
      const d = new Date(dateStr + "T12:00:00");
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const monthLabel = d.toLocaleString("en-US", { month: "long" }).toUpperCase();

      if (!current || current.key !== monthKey) {
        current = {
          key: monthKey,
          label: monthLabel,
          year: d.getFullYear(),
          season: getSeason(dateStr),
          dates: [],
        };
        groups.push(current);
      }
      current.dates.push(dateStr);
    }
    return groups;
  }, [allDates]);

  // Build DayData for a date
  const buildDayData = useCallback(
    (dateStr: string): DayData => ({
      date: dateStr,
      liturgical: litMap.get(dateStr) ?? null,
      events: eventsMap.get(dateStr) ?? [],
      personnel: personnelMap,
      holidays: holidaysMap.get(dateStr) ?? [],
    }),
    [litMap, eventsMap, personnelMap, holidaysMap]
  );

  // Today's date string
  const today = new Date().toISOString().slice(0, 10);

  // Scroll to today
  const scrollToToday = useCallback(() => {
    const el = document.getElementById(`day-${today}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [today]);

  // Scroll to today on mount
  useEffect(() => {
    // Small delay to let DOM render
    const timer = setTimeout(scrollToToday, 300);
    return () => clearTimeout(timer);
  }, [scrollToToday]);

  // Handle event creation
  const handleAddEvent = useCallback((date: string) => {
    setEventCreatorDate(date);
  }, []);

  const handleCloseCreator = useCallback(() => {
    setEventCreatorDate(null);
  }, []);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <CalendarV2Toolbar
        showFederalHolidays={showFederalHolidays}
        setShowFederalHolidays={setShowFederalHolidays}
        showStateHolidays={showStateHolidays}
        setShowStateHolidays={setShowStateHolidays}
        zipCode={zipCode}
        setZipCode={setZipCode}
        stateLabel={stateLabel}
        onScrollToToday={scrollToToday}
      />

      <div ref={scrollRef} className="flex-1 overflow-y-auto scroll-smooth">
        <div className="mx-auto max-w-4xl px-4 pb-24 pt-2">
          {monthGroups.map((month) => (
            <div key={month.key}>
              <MonthHeader
                month={month.label}
                year={month.year}
                season={month.season}
              />
              <div className="space-y-0">
                {month.dates.map((dateStr) => (
                  <DayRow
                    key={dateStr}
                    day={buildDayData(dateStr)}
                    isToday={dateStr === today}
                    onAddEvent={handleAddEvent}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {eventCreatorDate && (
        <EventCreatorModal
          date={eventCreatorDate}
          onClose={handleCloseCreator}
        />
      )}
    </div>
  );
}
