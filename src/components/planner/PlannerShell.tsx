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
  const [viewMode, setViewMode] = useState<PlannerViewMode>("grid");

  // Hide past weeks state (persisted to localStorage)
  const [hidePastWeeks, setHidePastWeeks] = useState(true);
  // Hide mass parts toggle (persisted to localStorage)
  const [hideMassParts, setHideMassParts] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage on mount + detect mobile
  useEffect(() => {
    try {
      const stored = localStorage.getItem(HIDE_PAST_KEY);
      if (stored !== null) {
        setHidePastWeeks(stored !== "false");
      }
      const storedMP = localStorage.getItem(HIDE_MASS_PARTS_KEY);
      if (storedMP !== null) {
        setHideMassParts(storedMP === "true");
      }
    } catch {
      // ignore
    }
    // Auto-set to cards on mobile
    if (window.innerWidth < 768) {
      setViewMode("cards");
    }
    setHydrated(true);
  }, []);

  // Persist to localStorage when changed
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(HIDE_PAST_KEY, String(hidePastWeeks));
      localStorage.setItem(HIDE_MASS_PARTS_KEY, String(hideMassParts));
    } catch {
      // ignore
    }
  }, [hidePastWeeks, hideMassParts, hydrated]);

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
        hideMassParts={hideMassParts}
        setHideMassParts={setHideMassParts}
        viewMode={viewMode}
        setViewMode={setViewMode}
      />
      <div className="flex-1 overflow-hidden">
        <PlannerGrid columns={columns} viewMode={viewMode} hideMassParts={hideMassParts} communityId={communityId} />
      </div>
    </div>
  );
}
