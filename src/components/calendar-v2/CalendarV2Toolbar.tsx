"use client";

interface CalendarV2ToolbarProps {
  showFederalHolidays: boolean;
  setShowFederalHolidays: (v: boolean) => void;
  showStateHolidays: boolean;
  setShowStateHolidays: (v: boolean) => void;
  zipCode: string;
  setZipCode: (v: string) => void;
  stateLabel: string;
  onScrollToToday: () => void;
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
}: CalendarV2ToolbarProps) {
  return (
    <div className="flex shrink-0 items-center gap-5 border-b border-stone-100 bg-white px-5 py-3">
      {/* Title */}
      <div className="flex items-center gap-2.5">
        <h1 className="font-serif text-lg font-light tracking-wide text-stone-700">
          Calendar
        </h1>
        <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-700">
          Sandbox
        </span>
      </div>

      <div className="h-5 w-px bg-stone-200" />

      {/* Federal holidays toggle */}
      <label className="flex cursor-pointer items-center gap-1.5 text-xs text-stone-500">
        <input
          type="checkbox"
          checked={showFederalHolidays}
          onChange={(e) => setShowFederalHolidays(e.target.checked)}
          className="h-3.5 w-3.5 rounded border-stone-300 text-stone-600 accent-stone-600"
        />
        Federal Holidays
      </label>

      {/* State holidays toggle */}
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
        State Holidays
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
          className="w-16 rounded border border-stone-200 bg-stone-50 px-2 py-1 text-xs text-stone-600 placeholder:text-stone-300 focus:border-stone-400 focus:outline-none"
        />
        {stateLabel && (
          <span className="text-xs font-medium text-stone-500">
            {stateLabel}
          </span>
        )}
      </div>

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
