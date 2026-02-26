"use client";

import { useState, useMemo, useEffect } from "react";
import type { LiturgicalOccasion, LiturgicalSeason } from "@/lib/types";
import type { YearCycleFilter, CommunityId } from "@/lib/grid-types";
import {
  getFilteredOccasions,
  buildGridColumns,
  findNextUpcomingSundayIndex,
} from "@/lib/grid-data";
import FilterToolbar from "./FilterToolbar";
import PlannerGrid from "./PlannerGrid";

const HIDE_PAST_KEY = "rs_hide_past_weeks";

interface PlannerShellProps {
  occasions: LiturgicalOccasion[];
}

export default function PlannerShell({ occasions }: PlannerShellProps) {
  const [yearCycle, setYearCycle] = useState<YearCycleFilter>("A");
  const [season, setSeason] = useState<LiturgicalSeason | "all">("all");
  const [communityId, setCommunityId] = useState<CommunityId>("reflections");
  const [rangeStart, setRangeStart] = useState(0);
  const [rangeEnd, setRangeEnd] = useState(12);

  // Hide past weeks state (persisted to localStorage)
  const [hidePastWeeks, setHidePastWeeks] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(HIDE_PAST_KEY);
      if (stored !== null) {
        setHidePastWeeks(stored !== "false");
      }
    } catch {
      // ignore
    }
    setHydrated(true);
  }, []);

  // Persist to localStorage when changed
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(HIDE_PAST_KEY, String(hidePastWeeks));
    } catch {
      // ignore
    }
  }, [hidePastWeeks, hydrated]);

  const filteredOccasions = useMemo(
    () => getFilteredOccasions(occasions, yearCycle, season),
    [occasions, yearCycle, season]
  );

  // Find the index of the next upcoming Sunday
  const futureStartIndex = useMemo(
    () =>
      hidePastWeeks ? findNextUpcomingSundayIndex(filteredOccasions) : 0,
    [filteredOccasions, hidePastWeeks]
  );

  // Apply offset when hiding past weeks
  const effectiveStart = hidePastWeeks
    ? futureStartIndex + rangeStart
    : rangeStart;
  const effectiveEnd = hidePastWeeks
    ? futureStartIndex + (rangeEnd - rangeStart)
    : rangeEnd;

  const maxEnd = filteredOccasions.length;
  const clampedStart = Math.min(effectiveStart, maxEnd);
  const clampedEnd = Math.min(effectiveEnd, maxEnd);

  const visibleOccasions = filteredOccasions.slice(clampedStart, clampedEnd);

  const columns = useMemo(
    () => buildGridColumns(visibleOccasions, communityId),
    [visibleOccasions, communityId]
  );

  // When hidePastWeeks changes, reset range to start from 0 offset
  const handleHidePastToggle = (v: boolean) => {
    setHidePastWeeks(v);
    setRangeStart(0);
    setRangeEnd(12);
  };

  return (
    <div className="flex flex-col h-screen">
      <FilterToolbar
        yearCycle={yearCycle}
        setYearCycle={setYearCycle}
        season={season}
        setSeason={setSeason}
        communityId={communityId}
        setCommunityId={setCommunityId}
        rangeStart={rangeStart}
        rangeEnd={Math.min(rangeEnd - rangeStart + rangeStart, maxEnd - (hidePastWeeks ? futureStartIndex : 0))}
        setRangeStart={setRangeStart}
        setRangeEnd={setRangeEnd}
        totalOccasions={
          hidePastWeeks
            ? filteredOccasions.length - futureStartIndex
            : filteredOccasions.length
        }
        occasions={filteredOccasions}
        hidePastWeeks={hidePastWeeks}
        setHidePastWeeks={handleHidePastToggle}
      />
      <div className="flex-1 overflow-hidden">
        <PlannerGrid columns={columns} />
      </div>
    </div>
  );
}
