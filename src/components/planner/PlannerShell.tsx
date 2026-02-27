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
const HIDE_MASS_PARTS_KEY = "rs_hide_mass_parts";
const HIDE_READINGS_KEY = "rs_hide_readings";

export type PlannerViewMode = "grid" | "cards";

interface PlannerShellProps {
  occasions: LiturgicalOccasion[];
}

export default function PlannerShell({ occasions }: PlannerShellProps) {
  const [yearCycle, setYearCycle] = useState<YearCycleFilter>("A");
  const [season, setSeason] = useState<LiturgicalSeason | "all">("all");
  const [communityId, setCommunityId] = useState<CommunityId>("reflections");
  const [rangeStart, setRangeStart] = useState(0);
  const [rangeEnd, setRangeEnd] = useState(12);

  // View mode: auto-detect mobile on mount
  const [viewMode, setViewMode] = useState<PlannerViewMode>(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) return "cards";
    return "grid";
  });

  // Hide past weeks state (persisted to localStorage — lazy init)
  const [hidePastWeeks, setHidePastWeeks] = useState(() => {
    if (typeof window === "undefined") return true;
    try {
      const stored = localStorage.getItem(HIDE_PAST_KEY);
      return stored !== null ? stored !== "false" : true;
    } catch {
      return true;
    }
  });

  // Hide mass parts toggle (persisted to localStorage — lazy init)
  const [hideMassParts, setHideMassParts] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      const stored = localStorage.getItem(HIDE_MASS_PARTS_KEY);
      return stored === "true";
    } catch {
      return false;
    }
  });

  // Hide readings toggle (persisted to localStorage — lazy init)
  const [hideReadings, setHideReadings] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      const stored = localStorage.getItem(HIDE_READINGS_KEY);
      return stored === "true";
    } catch {
      return false;
    }
  });

  // Persist to localStorage when changed
  useEffect(() => {
    try {
      localStorage.setItem(HIDE_PAST_KEY, String(hidePastWeeks));
      localStorage.setItem(HIDE_MASS_PARTS_KEY, String(hideMassParts));
      localStorage.setItem(HIDE_READINGS_KEY, String(hideReadings));
    } catch {
      // ignore
    }
  }, [hidePastWeeks, hideMassParts, hideReadings]);

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
    <div className="flex flex-col h-screen bg-white">
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
        hideMassParts={hideMassParts}
        setHideMassParts={setHideMassParts}
        hideReadings={hideReadings}
        setHideReadings={setHideReadings}
        viewMode={viewMode}
        setViewMode={setViewMode}
      />
      <div className="flex-1 overflow-hidden">
        <PlannerGrid columns={columns} viewMode={viewMode} hideMassParts={hideMassParts} hideReadings={hideReadings} communityId={communityId} />
      </div>
    </div>
  );
}
