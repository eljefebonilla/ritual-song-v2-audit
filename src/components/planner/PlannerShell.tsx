"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import type { LiturgicalOccasion, LiturgicalSeason, MusicPlan } from "@/lib/types";
import type { YearCycleFilter, EnsembleId } from "@/lib/grid-types";
import type { SharedViewConfig } from "@/lib/shared-view";
import {
  getFilteredOccasions,
  buildGridColumns,
  findNextUpcomingSundayIndex,
} from "@/lib/grid-data";
import FilterToolbar from "./FilterToolbar";
import PlannerGrid from "./PlannerGrid";
import MobileWeekView from "./MobileWeekView";
import { LS_HIDE_PAST_WEEKS, LS_HIDE_MASS_PARTS, LS_HIDE_READINGS, LS_HIDE_SYNOPSES, LS_YEAR_CYCLE, LS_SEASON, LS_ENSEMBLE } from "@/lib/storage-keys";

const HIDE_PAST_KEY = LS_HIDE_PAST_WEEKS;
const HIDE_MASS_PARTS_KEY = LS_HIDE_MASS_PARTS;
const HIDE_READINGS_KEY = LS_HIDE_READINGS;
const HIDE_SYNOPSES_KEY = LS_HIDE_SYNOPSES;
const LS_HIDDEN_OCCASIONS = "rs:hiddenOccasions";

export type PlannerViewMode = "grid" | "cards";

interface PlannerShellProps {
  occasions: LiturgicalOccasion[];
  viewerMode?: boolean;
  viewerConfig?: SharedViewConfig;
  viewerName?: string;
}

export default function PlannerShell({ occasions, viewerMode = false, viewerConfig, viewerName }: PlannerShellProps) {
  // Defaults from the next upcoming Sunday — used only when nothing is persisted yet
  const { initialSeason, initialYearCycle } = useMemo(() => {
    const idx = findNextUpcomingSundayIndex(occasions);
    if (idx < 0) return { initialSeason: "all" as const, initialYearCycle: "A" as YearCycleFilter };
    const occ = occasions[idx];
    const season = (occ?.season || "all") as LiturgicalSeason | "all";
    const year = occ?.year;
    const yearCycle: YearCycleFilter = year === "A" || year === "B" || year === "C" ? year : "A";
    return { initialSeason: season, initialYearCycle: yearCycle };
  }, [occasions]);

  // yearCycle: persisted, falling back to current liturgical year.
  // In viewer mode, forced from viewerConfig and never read/write localStorage.
  const [yearCycle, setYearCycle] = useState<YearCycleFilter>(() => {
    if (viewerMode && viewerConfig) return viewerConfig.yearCycle;
    if (typeof window === "undefined") return initialYearCycle;
    try {
      const stored = localStorage.getItem(LS_YEAR_CYCLE);
      if (stored === "A" || stored === "B" || stored === "C" || stored === "all") return stored;
    } catch { /* ignore */ }
    return initialYearCycle;
  });

  // season: persisted, falling back to current season
  const [season, setSeason] = useState<LiturgicalSeason | "all">(() => {
    if (viewerMode && viewerConfig) return viewerConfig.season;
    if (typeof window === "undefined") return initialSeason;
    try {
      const stored = localStorage.getItem(LS_SEASON);
      if (stored) return stored as LiturgicalSeason | "all";
    } catch { /* ignore */ }
    return initialSeason;
  });

  // ensembleId: persisted, defaulting to reflections
  const [ensembleId, setEnsembleId] = useState<EnsembleId>(() => {
    if (viewerMode && viewerConfig) return viewerConfig.ensembleId;
    if (typeof window === "undefined") return "reflections";
    try {
      const stored = localStorage.getItem(LS_ENSEMBLE);
      if (stored) return stored as EnsembleId;
    } catch { /* ignore */ }
    return "reflections";
  });
  const [rangeStart, setRangeStart] = useState(0);
  const [rangeEnd, setRangeEnd] = useState(12);

  // Selectively hidden occasion IDs (persisted to localStorage in admin mode,
  // sourced from viewerConfig in viewer mode).
  const [hiddenOccasionIds, setHiddenOccasionIds] = useState<Set<string>>(() => {
    if (viewerMode && viewerConfig) {
      return new Set(viewerConfig.hiddenOccasionIds || []);
    }
    if (typeof window === "undefined") return new Set();
    try {
      const stored = localStorage.getItem(LS_HIDDEN_OCCASIONS);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  const hideOccasion = useCallback((id: string) => {
    if (viewerMode) return; // No-op: viewers cannot modify hidden set
    setHiddenOccasionIds(prev => {
      const next = new Set(prev);
      next.add(id);
      try { localStorage.setItem(LS_HIDDEN_OCCASIONS, JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  }, [viewerMode]);

  const showAllHidden = useCallback(() => {
    if (viewerMode) return;
    setHiddenOccasionIds(new Set());
    try { localStorage.removeItem(LS_HIDDEN_OCCASIONS); } catch { /* ignore */ }
  }, [viewerMode]);

  // View mode: auto-detect mobile on mount
  const [viewMode, setViewMode] = useState<PlannerViewMode>(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) return "cards";
    return "grid";
  });

  // Hide past weeks state (persisted to localStorage — lazy init)
  const [hidePastWeeks, setHidePastWeeks] = useState(() => {
    if (viewerMode) return Boolean(viewerConfig?.hidePastWeeks);
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
    if (viewerMode) return Boolean(viewerConfig?.hideMassParts);
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
    if (viewerMode) return Boolean(viewerConfig?.hideReadings);
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
    if (viewerMode) return viewerConfig?.hideSynopses ?? true;
    if (typeof window === "undefined") return true;
    try {
      const stored = localStorage.getItem(HIDE_SYNOPSES_KEY);
      return stored !== null ? stored !== "false" : true;
    } catch {
      return true;
    }
  });

  // Persist to localStorage when changed (skipped in viewer mode)
  useEffect(() => {
    if (viewerMode) return;
    try {
      localStorage.setItem(HIDE_PAST_KEY, String(hidePastWeeks));
      localStorage.setItem(HIDE_MASS_PARTS_KEY, String(hideMassParts));
      localStorage.setItem(HIDE_READINGS_KEY, String(hideReadings));
      localStorage.setItem(HIDE_SYNOPSES_KEY, String(hideSynopses));
    } catch {
      // ignore
    }
  }, [hidePastWeeks, hideMassParts, hideReadings, hideSynopses, viewerMode]);

  // Persist primary filters (year cycle, season, ensemble) — skipped in viewer mode
  useEffect(() => {
    if (viewerMode) return;
    try {
      localStorage.setItem(LS_YEAR_CYCLE, yearCycle);
      localStorage.setItem(LS_SEASON, season);
      localStorage.setItem(LS_ENSEMBLE, ensembleId);
    } catch {
      // ignore
    }
  }, [yearCycle, season, ensembleId, viewerMode]);

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

  // In viewer mode, derive a fixed range from startOccasionId/endOccasionId.
  // Outside viewer mode, honor the existing hidePastWeeks + rangeStart/rangeEnd logic.
  const viewerRange = useMemo(() => {
    if (!viewerMode || !viewerConfig) return null;
    const startIdxRaw = viewerConfig.startOccasionId
      ? filteredOccasions.findIndex((o) => o.id === viewerConfig.startOccasionId)
      : -1;
    const endIdxRaw = viewerConfig.endOccasionId
      ? filteredOccasions.findIndex((o) => o.id === viewerConfig.endOccasionId)
      : -1;
    const startIdx = startIdxRaw >= 0 ? startIdxRaw : 0;
    const endIdx = endIdxRaw >= 0 ? endIdxRaw + 1 : filteredOccasions.length;
    return { start: Math.min(startIdx, filteredOccasions.length), end: Math.min(endIdx, filteredOccasions.length) };
  }, [viewerMode, viewerConfig, filteredOccasions]);

  // Apply offset when hiding past weeks
  const effectiveStart = viewerRange
    ? viewerRange.start
    : hidePastWeeks
    ? futureStartIndex + rangeStart
    : rangeStart;
  const effectiveEnd = viewerRange
    ? viewerRange.end
    : hidePastWeeks
    ? futureStartIndex + (rangeEnd - rangeStart)
    : rangeEnd;

  const maxEnd = filteredOccasions.length;
  const clampedStart = Math.min(effectiveStart, maxEnd);
  const clampedEnd = Math.min(effectiveEnd, maxEnd);

  const visibleOccasions = useMemo(
    () => filteredOccasions.slice(clampedStart, clampedEnd).filter(o => !hiddenOccasionIds.has(o.id)),
    [filteredOccasions, clampedStart, clampedEnd, hiddenOccasionIds]
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

  const viewerHideOccasion = useCallback((_id: string) => {
    // no-op in viewer mode
  }, []);
  const effectiveHideOccasion = viewerMode ? viewerHideOccasion : hideOccasion;

  return (
    <div className="flex flex-col h-screen bg-white">
      {viewerMode ? (
        <div className="px-4 py-3 border-b bg-white flex items-center justify-between gap-4 flex-shrink-0">
          <div className="flex flex-col">
            <div className="font-serif text-lg leading-tight text-stone-900">{viewerName || "Ritual Song"}</div>
            <div className="text-xs text-stone-500 capitalize">
              {season} · Year {yearCycle} · {ensembleId}
            </div>
          </div>
          <div className="text-xs text-stone-400 hidden sm:block">Read-only preview</div>
        </div>
      ) : (
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
          hiddenCount={hiddenOccasionIds.size}
          onShowAllHidden={showAllHidden}
        />
      )}
      <div className="flex-1 overflow-hidden">
        {/* Mobile: single-week swipeable view */}
        <div className="block md:hidden h-full">
          <MobileWeekView columns={columns} hideMassParts={hideMassParts} hideReadings={hideReadings} ensembleId={ensembleId} onHideOccasion={effectiveHideOccasion} />
        </div>
        {/* Desktop: full grid */}
        <div className="hidden md:block h-full">
          <PlannerGrid columns={columns} viewMode={viewMode} hideMassParts={hideMassParts} hideReadings={hideReadings} hideSynopses={hideSynopses} ensembleId={ensembleId} onPlanChange={handlePlanChange} onHideOccasion={effectiveHideOccasion} />
        </div>
      </div>
    </div>
  );
}
