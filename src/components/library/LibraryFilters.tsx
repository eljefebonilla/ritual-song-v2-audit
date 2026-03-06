"use client";

import { useState } from "react";
import LiturgicalCalendar from "./LiturgicalCalendar";
import type { ScriptureSubFilter } from "@/lib/scripture-matching";

// --- Constants ---

const SEASON_OPTIONS = [
  { value: "advent", label: "Advent", color: "bg-purple-700" },
  { value: "christmas", label: "Christmas", color: "bg-yellow-600" },
  { value: "lent", label: "Lent", color: "bg-purple-900" },
  { value: "easter", label: "Easter", color: "bg-amber-600" },
  { value: "ordinary", label: "Ordinary Time", color: "bg-green-700" },
  { value: "solemnity", label: "Solemnities", color: "bg-red-800" },
  { value: "feast", label: "Feasts", color: "bg-red-700" },
];

const GENRE_OPTIONS = [
  { value: "traditional", label: "Traditional" },
  { value: "contemporary", label: "Contemporary" },
  { value: "crossover", label: "Cross-Over" },
  { value: "gospel", label: "Gospel" },
  { value: "chant", label: "Chant" },
  { value: "global", label: "Global/World" },
];

const RESOURCE_OPTIONS = [
  { value: "audio", label: "Has Audio" },
  { value: "lead_sheet", label: "Has Lead Sheet" },
  { value: "aim", label: "Has AIM" },
];

const ENSEMBLE_OPTIONS = [
  { value: "all", label: "All Ensembles", detail: "" },
  { value: "reflections", label: "Reflections", detail: "Sat Vigil · 5:30p" },
  { value: "foundations", label: "Foundations", detail: "Sun · 7:30a" },
  { value: "generations", label: "Generations", detail: "Sun · 9:00a" },
  { value: "heritage", label: "Heritage", detail: "Sun · 10:30a" },
  { value: "elevations", label: "Elevations", detail: "Sun · 5:30p" },
];

// --- Types ---

interface DateOccasion {
  date: string;
  occasionId: string;
  season: string;
  name: string;
}

export interface LibraryFiltersProps {
  genreFilters: Set<string>;
  seasonFilters: Set<string>;
  resourceFilters: Set<string>;
  selectedDate: string | null;
  selectedEnsemble: string | null;
  dateOccasionMap: Map<string, DateOccasion>;
  onGenreChange: (filters: Set<string>) => void;
  onSeasonChange: (filters: Set<string>) => void;
  onResourceChange: (filters: Set<string>) => void;
  onDateSelect: (date: string | null) => void;
  onEnsembleSelect: (ensemble: string | null) => void;
  onClearAll: () => void;
  activeCount: number;
  loadingOccasion: boolean;
  scriptureMatchMode: boolean;
  onScriptureMatchToggle: (on: boolean) => void;
  scriptureSubFilter: ScriptureSubFilter;
  onScriptureSubFilterChange: (filter: ScriptureSubFilter) => void;
}

// --- Sub-components ---

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`transition-transform ${open ? "rotate-90" : ""}`}
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function SectionHeader({
  label,
  isOpen,
  onToggle,
}: {
  label: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center justify-between w-full px-1 py-1.5 text-left"
    >
      <span className="text-[11px] font-semibold text-stone-600 uppercase tracking-wide">
        {label}
      </span>
      <ChevronIcon open={isOpen} />
    </button>
  );
}

// --- Main Component ---

export default function LibraryFilters({
  genreFilters,
  seasonFilters,
  resourceFilters,
  selectedDate,
  selectedEnsemble,
  dateOccasionMap,
  onGenreChange,
  onSeasonChange,
  onResourceChange,
  onDateSelect,
  onEnsembleSelect,
  onClearAll,
  activeCount,
  loadingOccasion,
  scriptureMatchMode,
  onScriptureMatchToggle,
  scriptureSubFilter,
  onScriptureSubFilterChange,
}: LibraryFiltersProps) {
  const [openSections, setOpenSections] = useState<Set<string>>(
    new Set(["calendar", "genre"])
  );

  const toggleSection = (id: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleInSet = (
    current: Set<string>,
    value: string,
    onChange: (next: Set<string>) => void
  ) => {
    const next = new Set(current);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    onChange(next);
  };

  return (
    <div className="space-y-1">
      {/* Header */}
      <div className="flex items-center justify-between px-1 pb-2">
        <h3 className="text-xs font-bold text-stone-700 uppercase tracking-wide">
          Narrow Your Search
          {activeCount > 0 && (
            <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 text-[9px] font-bold bg-stone-800 text-white rounded-full">
              {activeCount}
            </span>
          )}
        </h3>
        {activeCount > 0 && (
          <button
            onClick={onClearAll}
            className="text-[10px] text-stone-400 hover:text-stone-600 transition-colors"
          >
            Clear all
          </button>
        )}
      </div>

      {/* 1. Calendar + Ensemble */}
      <div className="border-t border-stone-100 pt-1">
        <SectionHeader
          label="Calendar"
          isOpen={openSections.has("calendar")}
          onToggle={() => toggleSection("calendar")}
        />
        {openSections.has("calendar") && (
          <div className="px-1 pb-2 space-y-2">
            <LiturgicalCalendar
              selectedDate={selectedDate}
              onDateSelect={onDateSelect}
              dateOccasionMap={dateOccasionMap}
            />

            {loadingOccasion && !scriptureMatchMode && (
              <p className="text-[10px] text-stone-400 italic">Loading songs...</p>
            )}

            {/* Scripture Match toggle */}
            {selectedDate && (
              <div className="space-y-1">
                <label className="flex items-center gap-2 px-1 py-1 rounded hover:bg-stone-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={scriptureMatchMode}
                    onChange={(e) => onScriptureMatchToggle(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-stone-300 text-amber-700 focus:ring-amber-400 focus:ring-1"
                  />
                  <span className="text-[11px] font-semibold text-amber-800">Scripture Match</span>
                </label>

                {scriptureMatchMode && (
                  <div className="pl-6 space-y-0.5">
                    {(
                      [
                        { value: "all", label: "All Readings" },
                        { value: "first", label: "1st Reading" },
                        { value: "second", label: "2nd Reading" },
                        { value: "gospel", label: "Gospel" },
                      ] as { value: ScriptureSubFilter; label: string }[]
                    ).map((opt) => (
                      <label
                        key={opt.value}
                        className="flex items-center gap-2 px-1 py-0.5 rounded hover:bg-stone-50 cursor-pointer"
                      >
                        <input
                          type="radio"
                          name="scripture-sub"
                          checked={scriptureSubFilter === opt.value}
                          onChange={() => onScriptureSubFilterChange(opt.value)}
                          className="w-3 h-3 border-stone-300 text-amber-700 focus:ring-amber-400 focus:ring-1"
                        />
                        <span className="text-[11px] text-stone-600">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Ensemble radio buttons */}
            <div className="space-y-0.5">
              <p className="text-[10px] font-semibold text-stone-500 uppercase tracking-wide">
                Ensemble
              </p>
              {!selectedDate && (
                <p className="text-[10px] text-stone-400 italic">Select a date first</p>
              )}
              {ENSEMBLE_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex items-center gap-2 px-1 py-1 rounded cursor-pointer transition-colors ${
                    selectedDate
                      ? "hover:bg-stone-50"
                      : "opacity-40 cursor-default"
                  }`}
                >
                  <input
                    type="radio"
                    name="ensemble"
                    disabled={!selectedDate}
                    checked={
                      selectedDate
                        ? opt.value === "all"
                          ? selectedEnsemble === null
                          : selectedEnsemble === opt.value
                        : false
                    }
                    onChange={() =>
                      onEnsembleSelect(opt.value === "all" ? null : opt.value)
                    }
                    className="w-3.5 h-3.5 border-stone-300 text-stone-800 focus:ring-stone-400 focus:ring-1"
                  />
                  <span className="text-xs text-stone-600">{opt.label}</span>
                  {opt.detail && (
                    <span className="text-[9px] text-stone-400 ml-auto tabular-nums">{opt.detail}</span>
                  )}
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 2. Liturgical Season */}
      <div className="border-t border-stone-100 pt-1">
        <SectionHeader
          label="Liturgical Season"
          isOpen={openSections.has("season")}
          onToggle={() => toggleSection("season")}
        />
        {openSections.has("season") && (
          <div className="space-y-0.5 pb-1">
            {SEASON_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className="flex items-center gap-2 px-1 py-1 rounded hover:bg-stone-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={seasonFilters.has(opt.value)}
                  onChange={() =>
                    toggleInSet(seasonFilters, opt.value, onSeasonChange)
                  }
                  className="w-3.5 h-3.5 rounded border-stone-300 text-stone-800 focus:ring-stone-400 focus:ring-1"
                />
                <span
                  className={`w-2 h-2 rounded-full ${opt.color} shrink-0`}
                />
                <span className="text-xs text-stone-600">{opt.label}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* 3. Genre */}
      <div className="border-t border-stone-100 pt-1">
        <SectionHeader
          label="Genre"
          isOpen={openSections.has("genre")}
          onToggle={() => toggleSection("genre")}
        />
        {openSections.has("genre") && (
          <div className="space-y-0.5 pb-1">
            {GENRE_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className="flex items-center gap-2 px-1 py-1 rounded hover:bg-stone-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={genreFilters.has(opt.value)}
                  onChange={() =>
                    toggleInSet(genreFilters, opt.value, onGenreChange)
                  }
                  className="w-3.5 h-3.5 rounded border-stone-300 text-stone-800 focus:ring-stone-400 focus:ring-1"
                />
                <span className="text-xs text-stone-600">{opt.label}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* 4. Resources */}
      <div className="border-t border-stone-100 pt-1">
        <SectionHeader
          label="Resources"
          isOpen={openSections.has("resource")}
          onToggle={() => toggleSection("resource")}
        />
        {openSections.has("resource") && (
          <div className="space-y-0.5 pb-1">
            {RESOURCE_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className="flex items-center gap-2 px-1 py-1 rounded hover:bg-stone-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={resourceFilters.has(opt.value)}
                  onChange={() =>
                    toggleInSet(resourceFilters, opt.value, onResourceChange)
                  }
                  className="w-3.5 h-3.5 rounded border-stone-300 text-stone-800 focus:ring-stone-400 focus:ring-1"
                />
                <span className="text-xs text-stone-600">{opt.label}</span>
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
