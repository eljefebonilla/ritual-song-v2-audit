"use client";

import type { LiturgicalOccasion, LiturgicalSeason } from "@/lib/types";
import type { YearCycleFilter, CommunityId } from "@/lib/grid-types";
import { COMMUNITY_OPTIONS, SEASON_OPTIONS } from "@/lib/grid-types";
import { useUser } from "@/lib/user-context";

interface FilterToolbarProps {
  yearCycle: YearCycleFilter;
  setYearCycle: (v: YearCycleFilter) => void;
  season: LiturgicalSeason | "all";
  setSeason: (v: LiturgicalSeason | "all") => void;
  communityId: CommunityId;
  setCommunityId: (v: CommunityId) => void;
  rangeStart: number;
  rangeEnd: number;
  setRangeStart: (v: number) => void;
  setRangeEnd: (v: number) => void;
  totalOccasions: number;
  occasions: LiturgicalOccasion[];
  hidePastWeeks: boolean;
  setHidePastWeeks: (v: boolean) => void;
}

const YEAR_CYCLES: { id: YearCycleFilter; label: string }[] = [
  { id: "A", label: "Year A" },
  { id: "B", label: "Year B" },
  { id: "C", label: "Year C" },
  { id: "all", label: "All" },
];

const RANGE_PRESETS = [
  { label: "4 weeks", count: 4 },
  { label: "8 weeks", count: 8 },
  { label: "12 weeks", count: 12 },
  { label: "All", count: -1 },
];

export default function FilterToolbar({
  yearCycle,
  setYearCycle,
  season,
  setSeason,
  communityId,
  setCommunityId,
  rangeStart,
  rangeEnd,
  setRangeStart,
  setRangeEnd,
  totalOccasions,
  hidePastWeeks,
  setHidePastWeeks,
}: FilterToolbarProps) {
  const { role, setRole } = useUser();

  const handleRangePreset = (count: number) => {
    setRangeStart(0);
    setRangeEnd(count === -1 ? totalOccasions : count);
  };

  const handlePageBack = () => {
    const span = rangeEnd - rangeStart;
    const newStart = Math.max(0, rangeStart - span);
    setRangeStart(newStart);
    setRangeEnd(newStart + span);
  };

  const handlePageForward = () => {
    const span = rangeEnd - rangeStart;
    const newStart = Math.min(totalOccasions - span, rangeStart + span);
    if (newStart >= 0) {
      setRangeStart(newStart);
      setRangeEnd(Math.min(newStart + span, totalOccasions));
    }
  };

  const canPageBack = rangeStart > 0;
  const canPageForward = rangeEnd < totalOccasions;

  return (
    <div className="bg-white border-b border-stone-200 px-4 py-3 shrink-0">
      {/* Top row */}
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-lg font-bold text-stone-900">
          Planner
          <span className="text-sm font-normal text-stone-400 ml-2">
            {totalOccasions} occasions
          </span>
        </h1>
        <div className="flex items-center gap-2">
          <span className="text-xs text-stone-400">View as:</span>
          <div className="flex bg-stone-100 rounded-lg p-0.5">
            <button
              onClick={() => setRole("admin")}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                role === "admin"
                  ? "bg-white text-stone-900 shadow-sm"
                  : "text-stone-500 hover:text-stone-700"
              }`}
            >
              Music Director
            </button>
            <button
              onClick={() => setRole("member")}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                role === "member"
                  ? "bg-white text-stone-900 shadow-sm"
                  : "text-stone-500 hover:text-stone-700"
              }`}
            >
              Choir Member
            </button>
          </div>
        </div>
      </div>

      {/* Filter row */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Year Cycle */}
        <div className="flex items-center gap-1.5">
          <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">Cycle</label>
          <div className="flex bg-stone-100 rounded-lg p-0.5">
            {YEAR_CYCLES.map((yc) => (
              <button
                key={yc.id}
                onClick={() => setYearCycle(yc.id)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                  yearCycle === yc.id
                    ? "bg-white text-stone-900 shadow-sm"
                    : "text-stone-500 hover:text-stone-700"
                }`}
              >
                {yc.label}
              </button>
            ))}
          </div>
        </div>

        <div className="w-px h-6 bg-stone-200" />

        {/* Season */}
        <div className="flex items-center gap-1.5">
          <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">Season</label>
          <select
            value={season}
            onChange={(e) => {
              setSeason(e.target.value as LiturgicalSeason | "all");
              setRangeStart(0);
            }}
            className="text-xs border border-stone-200 rounded-md px-2 py-1.5 bg-white text-stone-700 focus:outline-none focus:ring-1 focus:ring-stone-400"
          >
            {SEASON_OPTIONS.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </div>

        <div className="w-px h-6 bg-stone-200" />

        {/* Community */}
        <div className="flex items-center gap-1.5">
          <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">Community</label>
          <select
            value={communityId}
            onChange={(e) => setCommunityId(e.target.value as CommunityId)}
            className="text-xs border border-stone-200 rounded-md px-2 py-1.5 bg-white text-stone-700 focus:outline-none focus:ring-1 focus:ring-stone-400"
          >
            {COMMUNITY_OPTIONS.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </div>

        <div className="w-px h-6 bg-stone-200" />

        {/* Range presets */}
        <div className="flex items-center gap-1.5">
          <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">Show</label>
          <div className="flex bg-stone-100 rounded-lg p-0.5">
            {RANGE_PRESETS.map((rp) => {
              const isActive =
                rp.count === -1
                  ? rangeEnd === totalOccasions && rangeStart === 0
                  : rangeEnd - rangeStart === rp.count && rangeStart === 0;
              return (
                <button
                  key={rp.label}
                  onClick={() => handleRangePreset(rp.count)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                    isActive
                      ? "bg-white text-stone-900 shadow-sm"
                      : "text-stone-500 hover:text-stone-700"
                  }`}
                >
                  {rp.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Page navigation */}
        <div className="flex items-center gap-1">
          <button
            onClick={handlePageBack}
            disabled={!canPageBack}
            className={`p-1 rounded transition-colors ${
              canPageBack ? "text-stone-500 hover:text-stone-900 hover:bg-stone-100" : "text-stone-200 cursor-not-allowed"
            }`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
          <span className="text-xs text-stone-400 tabular-nums min-w-[4rem] text-center">
            {rangeStart + 1}–{rangeEnd} of {totalOccasions}
          </span>
          <button
            onClick={handlePageForward}
            disabled={!canPageForward}
            className={`p-1 rounded transition-colors ${
              canPageForward ? "text-stone-500 hover:text-stone-900 hover:bg-stone-100" : "text-stone-200 cursor-not-allowed"
            }`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
          </button>
        </div>

        <div className="w-px h-6 bg-stone-200" />

        {/* Hide past weeks toggle */}
        <label className="flex items-center gap-1.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={hidePastWeeks}
            onChange={(e) => setHidePastWeeks(e.target.checked)}
            className="rounded border-stone-300 text-parish-burgundy focus:ring-parish-burgundy"
          />
          <span className="text-xs text-stone-600">Hide past weeks</span>
        </label>
      </div>
    </div>
  );
}
