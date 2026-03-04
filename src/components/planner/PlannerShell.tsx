"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import type { LiturgicalOccasion, LiturgicalSeason, MusicPlan } from "@/lib/types";
import type { YearCycleFilter, EnsembleId } from "@/lib/grid-types";
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
const HIDE_SYNOPSES_KEY = "rs_hide_synopses";

export type PlannerViewMode = "grid" | "cards";

interface PlannerShellProps {
  occasions: LiturgicalOccasion[];
}

export default function PlannerShell({ occasions }: PlannerShellProps) {
  const [yearCycle, setYearCycle] = useState<YearCycleFilter>("A");
  const [season, setSeason] = useState<LiturgicalSeason | "all">("all");
  const [ensembleId, setEnsembleId] = useState<EnsembleId>("reflections");
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

  // Hide synopses toggle (hidden by default, persisted to localStorage)
  const [hideSynopses, setHideSynopses] = useState(() => {
    if (typeof window === "undefined") return true;
    try {
      const stored = localStorage.getItem(HIDE_SYNOPSES_KEY);
      return stored !== null ? stored !== "false" : true;
    } catch {
      return true;
    }
  });

  // Persist to localStorage when changed
  useEffect(() => {
    try {
      localStorage.setItem(HIDE_PAST_KEY, String(hidePastWeeks));
      localStorage.setItem(HIDE_MASS_PARTS_KEY, String(hideMassParts));
      localStorage.setItem(HIDE_READINGS_KEY, String(hideReadings));
      localStorage.setItem(HIDE_SYNOPSES_KEY, String(hideSynopses));
    } catch {
      // ignore
    }
  }, [hidePastWeeks, hideMassParts, hideReadings, hideSynopses]);

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

  const visibleOccasions = useMemo(
    () => filteredOccasions.slice(clampedStart, clampedEnd),
    [filteredOccasions, clampedStart, clampedEnd]
  );

  // Fetch Supabase music plan overrides for visible occasions
  const [planOverrides, setPlanOverrides] = useState<Record<string, Record<string, Record<string, unknown>>>>({});
  const [refreshVersion, setRefreshVersion] = useState(0);

  const handlePlanChange = useCallback(() => {
    setRefreshVersion(v => v + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const ids = visibleOccasions.map(o => o.id);
    if (ids.length === 0) return;

    Promise.all(
      ids.map(id =>
        fetch(`/api/occasions/${id}/music-plan`)
          .then(res => res.ok ? res.json() : {})
          .catch(() => ({}))
      )
    ).then(results => {
      if (cancelled) return;
      const next: Record<string, Record<string, Record<string, unknown>>> = {};
      ids.forEach((id, i) => {
        if (results[i] && Object.keys(results[i]).length > 0) {
          next[id] = results[i];
        }
      });
      setPlanOverrides(next);
    });

    return () => { cancelled = true; };
  }, [visibleOccasions, refreshVersion]);

  const columns = useMemo(() => {
    const base = buildGridColumns(visibleOccasions, ensembleId);
    return base.map(col => {
      const overrides = planOverrides[col.occasion.id]?.[ensembleId];
      if (!overrides) return col;
      const basePlan = col.plan ?? ({} as MusicPlan);
      return { ...col, plan: { ...basePlan, ...overrides } as MusicPlan };
    });
  }, [visibleOccasions, ensembleId, planOverrides]);

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
        ensembleId={ensembleId}
        setEnsembleId={setEnsembleId}
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
        hideSynopses={hideSynopses}
        setHideSynopses={setHideSynopses}
        viewMode={viewMode}
        setViewMode={setViewMode}
      />
      <div className="flex-1 overflow-hidden">
        <PlannerGrid columns={columns} viewMode={viewMode} hideMassParts={hideMassParts} hideReadings={hideReadings} hideSynopses={hideSynopses} ensembleId={ensembleId} onPlanChange={handlePlanChange} />
      </div>
    </div>
  );
}
