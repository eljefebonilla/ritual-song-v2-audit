"use client";

import { useMemo, useRef, useState, useCallback, useEffect } from "react";
import type { USCCBDay, MassEventV2, BookingPersonnel, Holiday, DayData, CalendarV2Filters } from "./types";
import DayRow from "./DayRow";
import MonthHeader from "./MonthHeader";
import CalendarV2Toolbar from "./CalendarV2Toolbar";
import CalendarV2FilterPanel from "./CalendarV2FilterPanel";
import EventCreatorModal from "./EventCreatorModal";
import { getLiturgicalSeason } from "@/lib/liturgical-year";
import { useUser } from "@/lib/user-context";

// ---------------------------------------------------------------------------
// Default filter values
// ---------------------------------------------------------------------------

const ALL_EVENT_TYPES = new Set([
  "mass", "rehearsal", "special", "school", "sacrament", "devotion", "meeting", "other",
]);
const ALL_RANKS = new Set([
  "sunday", "solemnity", "feast", "memorial", "optional_memorial", "weekday",
]);
const ALL_COLORS = new Set([
  "green", "violet", "white", "red", "rose", "black",
]);

function makeDefaultFilters(): CalendarV2Filters {
  return {
    eventTypes: new Set(ALL_EVENT_TYPES),
    ranks: new Set(ALL_RANKS),
    colors: new Set(ALL_COLORS),
    staffingMode: "all",
    staffingRole: null,
    holydaysOnly: false,
    bvmOnly: false,
    hasMusicOnly: false,
    celebrant: "all",
  };
}

function countActiveFilters(f: CalendarV2Filters): number {
  return (
    (ALL_EVENT_TYPES.size - f.eventTypes.size) +
    (ALL_RANKS.size - f.ranks.size) +
    (ALL_COLORS.size - f.colors.size) +
    (f.staffingMode !== "all" ? 1 : 0) +
    (f.holydaysOnly ? 1 : 0) +
    (f.bvmOnly ? 1 : 0) +
    (f.hasMusicOnly ? 1 : 0) +
    (f.celebrant !== "all" ? 1 : 0)
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface CalendarV2ShellProps {
  liturgicalDays: USCCBDay[];
  massEvents: MassEventV2[];
  bookings: BookingPersonnel[];
  dateRange: { start: string; end: string };
}

export default function CalendarV2Shell({
  liturgicalDays,
  massEvents,
  bookings,
  dateRange,
}: CalendarV2ShellProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { isAdmin } = useUser();

  // Tier 1 state (toolbar)
  const [showFederalHolidays, setShowFederalHolidays] = useState(true);
  const [showStateHolidays, setShowStateHolidays] = useState(false);
  const [zipCode, setZipCode] = useState("");
  const [stateLabel, setStateLabel] = useState("");
  const [eventCreatorDate, setEventCreatorDate] = useState<string | null>(null);
  const [editingEvent, setEditingEvent] = useState<MassEventV2 | undefined>(undefined);
  const [ensembleFilter, setEnsembleFilter] = useState("all");
  const [hidePast, setHidePast] = useState(false);

  // Tier 2 state (filter panel)
  const [filters, setFilters] = useState<CalendarV2Filters>(makeDefaultFilters);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const activeFilterCount = countActiveFilters(filters);

  // Holiday data
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

  // Extract unique celebrants from events
  const celebrants = useMemo(() => {
    const set = new Set<string>();
    for (const e of massEvents) {
      if (e.celebrant) set.add(e.celebrant);
    }
    return Array.from(set).sort();
  }, [massEvents]);

  // Build events lookup: date -> MassEventV2[] (with ensemble + Tier 2 filters)
  const eventsMap = useMemo(() => {
    const map = new Map<string, MassEventV2[]>();
    for (const e of massEvents) {
      // Ensemble filter (Tier 1)
      if (ensembleFilter !== "all") {
        if (e.ensemble && e.ensemble.toLowerCase() !== ensembleFilter) continue;
      }
      // Event type filter (Tier 2)
      if (!filters.eventTypes.has(e.eventType)) continue;
      // Celebrant filter (Tier 2)
      if (filters.celebrant !== "all" && e.celebrant !== filters.celebrant) continue;
      // Has music filter (Tier 2)
      if (filters.hasMusicOnly && !e.hasMusic) continue;
      // Staffing filters (Tier 2)
      if (filters.staffingMode !== "all") {
        const eventPersonnel = personnelMap.get(e.id) ?? [];
        if (filters.staffingMode === "needs" && eventPersonnel.length > 0) continue;
        if (filters.staffingMode === "has" && eventPersonnel.length === 0) continue;
        if (filters.staffingMode === "role" && filters.staffingRole) {
          const hasRole = eventPersonnel.some((p) => p.roleName === filters.staffingRole);
          if (!hasRole) continue;
        }
      }

      const arr = map.get(e.date) ?? [];
      arr.push(e);
      map.set(e.date, arr);
    }
    return map;
  }, [massEvents, ensembleFilter, filters.eventTypes, filters.celebrant, filters.hasMusicOnly, filters.staffingMode, filters.staffingRole, personnelMap]);

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

  // Build set of dates that pass Tier 2 liturgical filters
  const filteredDateSet = useMemo(() => {
    const hasRankFilter = filters.ranks.size < ALL_RANKS.size;
    const hasColorFilter = filters.colors.size < ALL_COLORS.size;
    const hasFeatureFilter = filters.holydaysOnly || filters.bvmOnly;

    // If no liturgical filters active, skip building the set
    if (!hasRankFilter && !hasColorFilter && !hasFeatureFilter) return null;

    const set = new Set<string>();
    for (const [date, lit] of litMap) {
      // Rank filter
      if (hasRankFilter && !filters.ranks.has(lit.rank)) continue;
      // Color filter
      if (hasColorFilter && !filters.colors.has(lit.colorPrimary)) continue;
      // Feature filters
      if (filters.holydaysOnly && !lit.isHolyday) continue;
      if (filters.bvmOnly && !lit.isBVM) continue;
      set.add(date);
    }
    return set;
  }, [litMap, filters.ranks, filters.colors, filters.holydaysOnly, filters.bvmOnly]);

  // Generate all dates in range
  const allDates = useMemo(() => {
    const dates: string[] = [];
    const start = new Date(dateRange.start + "T12:00:00");
    const end = new Date(dateRange.end + "T12:00:00");
    const cursor = new Date(start);
    while (cursor <= end) {
      dates.push(cursor.toISOString().slice(0, 10));
      cursor.setDate(cursor.getDate() + 1);
    }
    return dates;
  }, [dateRange]);

  // Group dates by month
  const monthGroups = useMemo(() => {
    const groups: { key: string; label: string; year: number; season: string; dates: string[] }[] = [];
    let current: (typeof groups)[number] | null = null;

    for (const dateStr of allDates) {
      // If liturgical filters are active and this date doesn't pass, skip
      if (filteredDateSet && !filteredDateSet.has(dateStr)) continue;

      const d = new Date(dateStr + "T12:00:00");
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const monthLabel = d.toLocaleString("en-US", { month: "long" }).toUpperCase();

      if (!current || current.key !== monthKey) {
        current = {
          key: monthKey,
          label: monthLabel,
          year: d.getFullYear(),
          season: getLiturgicalSeason(dateStr),
          dates: [],
        };
        groups.push(current);
      }
      current.dates.push(dateStr);
    }
    return groups;
  }, [allDates, filteredDateSet]);

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
    const timer = setTimeout(scrollToToday, 300);
    return () => clearTimeout(timer);
  }, [scrollToToday]);

  // Handle event creation
  const handleAddEvent = useCallback((date: string) => {
    setEditingEvent(undefined);
    setEventCreatorDate(date);
  }, []);

  // Handle event editing
  const handleEditEvent = useCallback((event: MassEventV2) => {
    setEditingEvent(event);
    setEventCreatorDate(event.date);
  }, []);

  const handleCloseCreator = useCallback(() => {
    setEventCreatorDate(null);
    setEditingEvent(undefined);
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
        ensembleFilter={ensembleFilter}
        setEnsembleFilter={setEnsembleFilter}
        hidePast={hidePast}
        setHidePast={setHidePast}
        totalDays={allDates.length}
        activeFilterCount={activeFilterCount}
        onToggleFilterPanel={() => setFilterPanelOpen(!filterPanelOpen)}
      />

      <div ref={scrollRef} className="flex-1 overflow-y-auto scroll-smooth">
        <div className="mx-auto max-w-4xl px-4 pb-24 pt-2">
          {monthGroups.map((month) => {
            // Skip entire month if hidePast and all dates are past
            if (hidePast && month.dates[month.dates.length - 1] < today) return null;
            return (
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
                      isPast={dateStr < today}
                      hidePast={hidePast}
                      onAddEvent={isAdmin ? handleAddEvent : undefined}
                      onEditEvent={isAdmin ? handleEditEvent : undefined}
                    />
                  ))}
                </div>
              </div>
            );
          })}
          {monthGroups.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <svg className="mb-4 h-12 w-12 text-stone-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <p className="text-sm font-medium text-stone-500">No days match your filters</p>
              <p className="mt-1 text-xs text-stone-400">Try adjusting your filter criteria</p>
            </div>
          )}
        </div>
      </div>

      {filterPanelOpen && (
        <CalendarV2FilterPanel
          filters={filters}
          onFiltersChange={setFilters}
          onClose={() => setFilterPanelOpen(false)}
          celebrants={celebrants}
        />
      )}

      {eventCreatorDate && (
        <EventCreatorModal
          date={eventCreatorDate}
          event={editingEvent}
          onClose={handleCloseCreator}
        />
      )}
    </div>
  );
}
