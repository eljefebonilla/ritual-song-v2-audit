"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import type { LiturgicalOccasion, LiturgicalSeason, MusicPlan, LibrarySong } from "@/lib/types";
import type { YearCycleFilter, EnsembleId, GridColumn } from "@/lib/grid-types";
import { ENSEMBLE_OPTIONS, SEASON_OPTIONS } from "@/lib/grid-types";
import { getFilteredOccasions, buildGridColumns } from "@/lib/grid-data";
import { ENSEMBLE_BADGES } from "@/lib/occasion-helpers";
import ComparisonGrid from "./ComparisonGrid";
import SongDetailPanel from "@/components/library/SongDetailPanel";

interface ComparisonShellProps {
  occasions: LiturgicalOccasion[];
  songs: LibrarySong[];
}

const YEAR_CYCLES: YearCycleFilter[] = ["A", "B", "C", "all"];
const MAX_ENSEMBLES = 3;
const PANEL_MIN = 320;
import { LS_COMPARE_PANEL_WIDTH } from "@/lib/storage-keys";

const LS_PANEL_WIDTH = LS_COMPARE_PANEL_WIDTH;

function findNextOccasion(occasions: LiturgicalOccasion[]): LiturgicalOccasion | null {
  const today = new Date().toISOString().split("T")[0];
  let best: { occ: LiturgicalOccasion; date: string } | null = null;
  for (const occ of occasions) {
    for (const d of occ.dates) {
      if (d.date >= today && (!best || d.date < best.date)) {
        best = { occ, date: d.date };
      }
    }
  }
  return best?.occ ?? null;
}

export default function ComparisonShell({ occasions, songs }: ComparisonShellProps) {
  const nextOcc = useMemo(() => findNextOccasion(occasions), [occasions]);
  const [yearCycle, setYearCycle] = useState<YearCycleFilter>(() => (nextOcc?.year as YearCycleFilter) || "A");
  const [season, setSeason] = useState<LiturgicalSeason | "all">(() => nextOcc?.season || "all");
  const [occasionId, setOccasionId] = useState<string>(() => nextOcc?.id || "");
  const [ensembles, setEnsembles] = useState<EnsembleId[]>(["reflections", "foundations"]);
  const [hideMassParts, setHideMassParts] = useState(false);
  const [hideReadings, setHideReadings] = useState(false);
  const [selectedSong, setSelectedSong] = useState<LibrarySong | null>(null);

  const [panelWidth, setPanelWidth] = useState<number>(() => {
    if (typeof window === "undefined") return PANEL_MIN;
    const saved = localStorage.getItem(LS_PANEL_WIDTH);
    return saved ? Math.max(PANEL_MIN, parseInt(saved, 10) || PANEL_MIN) : PANEL_MIN;
  });

  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragStartX.current = e.clientX;
    dragStartWidth.current = panelWidth;

    const onMove = (ev: MouseEvent) => {
      const delta = dragStartX.current - ev.clientX;
      const maxW = Math.floor(window.innerWidth * 0.65);
      const next = Math.min(maxW, Math.max(PANEL_MIN, dragStartWidth.current + delta));
      setPanelWidth(next);
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      setPanelWidth((w) => {
        localStorage.setItem(LS_PANEL_WIDTH, String(w));
        return w;
      });
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [panelWidth]);

  const [planOverrides, setPlanOverrides] = useState<
    Record<string, Record<string, Record<string, unknown>>>
  >({});
  const [refreshVersion, setRefreshVersion] = useState(0);

  const handlePlanChange = useCallback(() => {
    setRefreshVersion((v) => v + 1);
  }, []);

  const filteredOccasions = useMemo(
    () => getFilteredOccasions(occasions, yearCycle, season),
    [occasions, yearCycle, season]
  );

  // Auto-select first occasion when filter changes
  useEffect(() => {
    if (filteredOccasions.length > 0 && !filteredOccasions.find((o) => o.id === occasionId)) {
      setOccasionId(filteredOccasions[0].id);
    }
  }, [filteredOccasions, occasionId]);

  const selectedOccasion = useMemo(
    () => filteredOccasions.find((o) => o.id === occasionId) ?? null,
    [filteredOccasions, occasionId]
  );

  // Fetch overrides for the selected occasion
  useEffect(() => {
    if (!occasionId) return;
    let cancelled = false;

    fetch(`/api/occasions/${occasionId}/music-plan`)
      .then((res) => (res.ok ? res.json() : {}))
      .catch(() => ({}))
      .then((result) => {
        if (cancelled) return;
        if (result && Object.keys(result).length > 0) {
          setPlanOverrides({ [occasionId]: result });
        } else {
          setPlanOverrides({});
        }
      });

    return () => {
      cancelled = true;
    };
  }, [occasionId, refreshVersion]);

  // Build columns for each selected ensemble
  const compareColumns = useMemo(() => {
    if (!selectedOccasion) return null;
    return ensembles.map((ensId) => {
      const [col] = buildGridColumns([selectedOccasion], ensId);
      const overrides = planOverrides[selectedOccasion.id]?.[ensId];
      if (!overrides) return { column: col, ensembleId: ensId };
      const basePlan = col.plan ?? ({} as MusicPlan);
      return {
        column: { ...col, plan: { ...basePlan, ...overrides } as MusicPlan },
        ensembleId: ensId,
      };
    });
  }, [selectedOccasion, ensembles, planOverrides]);

  const updateEnsemble = (index: number, value: EnsembleId) => {
    setEnsembles((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const addEnsemble = () => {
    if (ensembles.length >= MAX_ENSEMBLES) return;
    // Pick the first ensemble not already selected
    const used = new Set(ensembles);
    const next = ENSEMBLE_OPTIONS.find((o) => !used.has(o.id));
    setEnsembles((prev) => [...prev, next?.id ?? "generations"]);
  };

  const removeEnsemble = (index: number) => {
    if (ensembles.length <= 1) return;
    setEnsembles((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Toolbar */}
      <div className="shrink-0 border-b border-stone-200 bg-white px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Year cycle buttons */}
          <div className="flex rounded-md border border-stone-200 overflow-hidden">
            {YEAR_CYCLES.map((yc) => (
              <button
                key={yc}
                onClick={() => setYearCycle(yc)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  yearCycle === yc
                    ? "bg-stone-800 text-white"
                    : "bg-white text-stone-600 hover:bg-stone-50"
                }`}
              >
                {yc === "all" ? "All" : yc}
              </button>
            ))}
          </div>

          {/* Season dropdown */}
          <select
            value={season}
            onChange={(e) => setSeason(e.target.value as LiturgicalSeason | "all")}
            className="text-xs border border-stone-200 rounded-md px-2 py-1.5 bg-white text-stone-700"
          >
            {SEASON_OPTIONS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>

          {/* Occasion dropdown */}
          <select
            value={occasionId}
            onChange={(e) => setOccasionId(e.target.value)}
            className="text-xs border border-stone-200 rounded-md px-2 py-1.5 bg-white text-stone-700 max-w-[280px]"
          >
            {filteredOccasions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>

          <div className="w-px h-6 bg-stone-200" />

          {/* Ensemble selectors */}
          {ensembles.map((ensId, i) => {
            const badge = ENSEMBLE_BADGES[ensId];
            return (
              <div key={i} className="flex items-center gap-1">
                <span
                  className="w-4 h-4 rounded-sm flex items-center justify-center text-[9px] font-bold shrink-0"
                  style={{ backgroundColor: badge?.bg, color: badge?.text }}
                >
                  {badge?.letter}
                </span>
                <select
                  value={ensId}
                  onChange={(e) => updateEnsemble(i, e.target.value as EnsembleId)}
                  className="text-xs border border-stone-200 rounded-md px-2 py-1.5 bg-white text-stone-700"
                >
                  {ENSEMBLE_OPTIONS.map((ens) => (
                    <option key={ens.id} value={ens.id}>
                      {ens.label}
                    </option>
                  ))}
                </select>
                {ensembles.length > 1 && (
                  <button
                    onClick={() => removeEnsemble(i)}
                    className="text-stone-400 hover:text-stone-600 text-xs leading-none"
                    title="Remove"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}
              </div>
            );
          })}

          {ensembles.length < MAX_ENSEMBLES && (
            <button
              onClick={addEnsemble}
              className="flex items-center gap-1 text-xs text-stone-500 hover:text-stone-700 border border-dashed border-stone-300 rounded-md px-2 py-1.5 hover:border-stone-400 transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add
            </button>
          )}

          <div className="w-px h-6 bg-stone-200" />

          {/* Toggle checkboxes */}
          <label className="flex items-center gap-1.5 text-xs text-stone-600 cursor-pointer">
            <input
              type="checkbox"
              checked={hideMassParts}
              onChange={(e) => setHideMassParts(e.target.checked)}
              className="rounded border-stone-300"
            />
            Hide mass parts
          </label>
          <label className="flex items-center gap-1.5 text-xs text-stone-600 cursor-pointer">
            <input
              type="checkbox"
              checked={hideReadings}
              onChange={(e) => setHideReadings(e.target.checked)}
              className="rounded border-stone-300"
            />
            Hide readings
          </label>
        </div>
      </div>

      {/* Grid + Detail Panel */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-hidden">
          {compareColumns && compareColumns.length > 0 ? (
            <ComparisonGrid
              occasion={selectedOccasion!}
              columns={compareColumns}
              hideMassParts={hideMassParts}
              hideReadings={hideReadings}
              onPlanChange={handlePlanChange}
              songs={songs}
              onSelectSong={setSelectedSong}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-stone-400 text-sm">
              Select an occasion to compare ensembles.
            </div>
          )}
        </div>

        {selectedSong && (
          <SongDetailPanel
            song={selectedSong}
            onClose={() => setSelectedSong(null)}
            panelWidth={panelWidth}
            onResizeStart={handleResizeStart}
          />
        )}
      </div>
    </div>
  );
}
