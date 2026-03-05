"use client";

const ENSEMBLES = [
  { value: "all", label: "All Ensembles" },
  { value: "reflections", label: "Reflections" },
  { value: "foundations", label: "Foundations" },
  { value: "generations", label: "Generations" },
  { value: "heritage", label: "Heritage" },
  { value: "elevations", label: "Elevations" },
];

interface CalendarV2ToolbarProps {
  showFederalHolidays: boolean;
  setShowFederalHolidays: (v: boolean) => void;
  showStateHolidays: boolean;
  setShowStateHolidays: (v: boolean) => void;
  zipCode: string;
  setZipCode: (v: string) => void;
  stateLabel: string;
  onScrollToToday: () => void;
  ensembleFilter: string;
  setEnsembleFilter: (v: string) => void;
  hidePast: boolean;
  setHidePast: (v: boolean) => void;
  totalDays: number;
}

export default function CalendarV2Toolbar({
  showFederalHolidays,
  setShowFederalHolidays,
  showStateHolidays,
  setShowStateHolidays,
  zipCode,
  setZipCode,
  stateLabel,
  onScrollToToday,
  ensembleFilter,
  setEnsembleFilter,
  hidePast,
  setHidePast,
  totalDays,
}: CalendarV2ToolbarProps) {
  // Calculate days elapsed
  const today = new Date();
  const startDate = new Date("2025-11-30");
  const elapsed = Math.max(0, Math.min(totalDays, Math.floor((today.getTime() - startDate.getTime()) / 86400000)));

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-2 border-b border-stone-100 bg-white px-5 py-3">
      {/* Title + progress */}
      <div className="flex items-center gap-2.5">
        <h1 className="font-serif text-lg font-light tracking-wide text-stone-700">
          Calendar
        </h1>
        <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-700">
          Sandbox
        </span>
        <span className="text-[10px] tabular-nums text-stone-400">
          Day {elapsed} of {totalDays}
        </span>
      </div>

      <div className="h-5 w-px bg-stone-200" />

      {/* Ensemble filter */}
      <select
        value={ensembleFilter}
        onChange={(e) => setEnsembleFilter(e.target.value)}
        className="rounded border border-stone-200 bg-stone-50 px-2 py-1 text-xs text-stone-600 focus:border-stone-400 focus:outline-none"
      >
        {ENSEMBLES.map((e) => (
          <option key={e.value} value={e.value}>
            {e.label}
          </option>
        ))}
      </select>

      <div className="h-5 w-px bg-stone-200" />

      {/* Holiday toggles */}
      <label className="flex cursor-pointer items-center gap-1.5 text-xs text-stone-500">
        <input
          type="checkbox"
          checked={showFederalHolidays}
          onChange={(e) => setShowFederalHolidays(e.target.checked)}
          className="h-3.5 w-3.5 rounded border-stone-300 text-stone-600 accent-stone-600"
        />
        Federal
      </label>

      <label
        className={`flex items-center gap-1.5 text-xs ${
          !stateLabel
            ? "cursor-not-allowed text-stone-300"
            : "cursor-pointer text-stone-500"
        }`}
      >
        <input
          type="checkbox"
          checked={showStateHolidays}
          onChange={(e) => setShowStateHolidays(e.target.checked)}
          disabled={!stateLabel}
          className="h-3.5 w-3.5 rounded border-stone-300 text-stone-600 accent-stone-600 disabled:opacity-40"
        />
        State
      </label>

      {/* Zip code input */}
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          value={zipCode}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, "").slice(0, 5);
            setZipCode(v);
          }}
          placeholder="ZIP"
          maxLength={5}
          className="w-14 rounded border border-stone-200 bg-stone-50 px-2 py-1 text-xs text-stone-600 placeholder:text-stone-300 focus:border-stone-400 focus:outline-none"
        />
        {stateLabel && (
          <span className="text-[10px] font-medium text-stone-500">
            {stateLabel}
          </span>
        )}
      </div>

      <div className="h-5 w-px bg-stone-200" />

      {/* Hide past toggle */}
      <label className="flex cursor-pointer items-center gap-1.5 text-xs text-stone-500">
        <input
          type="checkbox"
          checked={hidePast}
          onChange={(e) => setHidePast(e.target.checked)}
          className="h-3.5 w-3.5 rounded border-stone-300 text-stone-600 accent-stone-600"
        />
        Hide past
      </label>

      <div className="flex-1" />

      {/* Today button */}
      <button
        onClick={onScrollToToday}
        className="rounded-md border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 transition-colors hover:border-stone-300 hover:bg-stone-50"
      >
        Today
      </button>
    </div>
  );
}
