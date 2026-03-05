"use client";

import { useCallback } from "react";
import { LITURGICAL_COLOR_HEX } from "@/lib/liturgical-colors";
import type { LiturgicalColor } from "@/lib/types";
import type { CalendarV2Filters } from "./types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EVENT_TYPES = [
  { value: "mass", label: "Mass" },
  { value: "rehearsal", label: "Rehearsal" },
  { value: "special", label: "Special" },
  { value: "school", label: "School" },
  { value: "sacrament", label: "Sacrament" },
  { value: "devotion", label: "Devotion" },
  { value: "meeting", label: "Meeting" },
  { value: "other", label: "Other" },
];

const RANKS = [
  { value: "sunday", label: "Sunday" },
  { value: "solemnity", label: "Solemnity" },
  { value: "feast", label: "Feast" },
  { value: "memorial", label: "Memorial" },
  { value: "optional_memorial", label: "Optional Memorial" },
  { value: "weekday", label: "Weekday" },
];

const LIT_COLORS: { value: string; label: string; hex: string }[] = [
  { value: "green", label: "Green", hex: LITURGICAL_COLOR_HEX.green },
  { value: "violet", label: "Violet", hex: LITURGICAL_COLOR_HEX.violet },
  { value: "white", label: "White", hex: LITURGICAL_COLOR_HEX.white },
  { value: "red", label: "Red", hex: LITURGICAL_COLOR_HEX.red },
  { value: "rose", label: "Rose", hex: LITURGICAL_COLOR_HEX.rose },
  { value: "black", label: "Black", hex: LITURGICAL_COLOR_HEX.black ?? "#1c1917" },
];

const STAFFING_MODES = [
  { value: "all", label: "All events" },
  { value: "needs", label: "Needs staffing" },
  { value: "has", label: "Has personnel" },
  { value: "role", label: "Specific role..." },
];

const STAFFING_ROLES = [
  "Cantor", "Cantor & Piano", "Psalmist",
  "Music Director", "Director", "Accompanist",
  "Piano", "Pianist", "Organist",
  "A. Guitar", "E. Guitar", "B. Guitar",
  "E. Bass", "Bassist",
  "Drums", "Drums/Percussion",
  "Choir", "Soprano", "Alto", "Tenor", "Bass",
  "Livestream TD", "Sound", "Playback",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toggleInSet(set: Set<string>, value: string): Set<string> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

// ---------------------------------------------------------------------------
// Section wrapper
// ---------------------------------------------------------------------------

function Section({
  title,
  open,
  onToggle,
  children,
  count,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  count?: number;
}) {
  return (
    <div className="border-b border-stone-100 last:border-b-0">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-5 py-3 text-left transition-colors hover:bg-stone-50/60"
      >
        <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
          {title}
        </span>
        <div className="flex items-center gap-2">
          {count !== undefined && count > 0 && (
            <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-stone-700 px-1 text-[9px] font-bold text-white">
              {count}
            </span>
          )}
          <svg
            className={`h-3.5 w-3.5 text-stone-400 transition-transform ${open ? "rotate-180" : ""}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </button>
      {open && <div className="px-5 pb-3">{children}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface CalendarV2FilterPanelProps {
  filters: CalendarV2Filters;
  onFiltersChange: (filters: CalendarV2Filters) => void;
  onClose: () => void;
  celebrants: string[];
}

export default function CalendarV2FilterPanel({
  filters,
  onFiltersChange,
  onClose,
  celebrants,
}: CalendarV2FilterPanelProps) {
  // Track which sections are open
  const openSections = new Set(["eventType", "rank", "color", "staffing", "celebrant", "dayFeatures"]);

  const update = useCallback(
    (patch: Partial<CalendarV2Filters>) => {
      onFiltersChange({ ...filters, ...patch });
    },
    [filters, onFiltersChange]
  );

  // Count active (non-default) filters
  const activeCount =
    (EVENT_TYPES.length - filters.eventTypes.size) +
    (RANKS.length - filters.ranks.size) +
    (LIT_COLORS.length - filters.colors.size) +
    (filters.staffingMode !== "all" ? 1 : 0) +
    (filters.holydaysOnly ? 1 : 0) +
    (filters.bvmOnly ? 1 : 0) +
    (filters.hasMusicOnly ? 1 : 0) +
    (filters.celebrant !== "all" ? 1 : 0);

  const clearAll = useCallback(() => {
    onFiltersChange({
      eventTypes: new Set(EVENT_TYPES.map((t) => t.value)),
      ranks: new Set(RANKS.map((r) => r.value)),
      colors: new Set(LIT_COLORS.map((c) => c.value)),
      staffingMode: "all",
      staffingRole: null,
      holydaysOnly: false,
      bvmOnly: false,
      hasMusicOnly: false,
      celebrant: "all",
    });
  }, [onFiltersChange]);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/10 backdrop-blur-[1px]"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 z-50 flex h-full w-80 flex-col border-l border-stone-200 bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <h2 className="font-serif text-base font-light tracking-wide text-stone-700">
              Filters
            </h2>
            {activeCount > 0 && (
              <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-stone-700 px-1.5 text-[10px] font-bold text-white">
                {activeCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {activeCount > 0 && (
              <button
                onClick={clearAll}
                className="text-xs font-medium text-stone-400 transition-colors hover:text-stone-700"
              >
                Clear all
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-md p-1 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
            >
              <svg className="h-4.5 w-4.5" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Scrollable sections */}
        <div className="flex-1 overflow-y-auto">
          {/* Event Type */}
          <Section
            title="Event Type"
            open={openSections.has("eventType")}
            onToggle={() => {}}
            count={EVENT_TYPES.length - filters.eventTypes.size}
          >
            <div className="space-y-0.5">
              {EVENT_TYPES.map((t) => (
                <label
                  key={t.value}
                  className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-stone-50"
                >
                  <input
                    type="checkbox"
                    checked={filters.eventTypes.has(t.value)}
                    onChange={() =>
                      update({ eventTypes: toggleInSet(filters.eventTypes, t.value) })
                    }
                    className="h-3.5 w-3.5 rounded border-stone-300 accent-stone-700"
                  />
                  <span className="text-xs text-stone-600">{t.label}</span>
                </label>
              ))}
            </div>
          </Section>

          {/* Liturgical Rank */}
          <Section
            title="Liturgical Rank"
            open={openSections.has("rank")}
            onToggle={() => {}}
            count={RANKS.length - filters.ranks.size}
          >
            <div className="space-y-0.5">
              {RANKS.map((r) => (
                <label
                  key={r.value}
                  className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-stone-50"
                >
                  <input
                    type="checkbox"
                    checked={filters.ranks.has(r.value)}
                    onChange={() =>
                      update({ ranks: toggleInSet(filters.ranks, r.value) })
                    }
                    className="h-3.5 w-3.5 rounded border-stone-300 accent-stone-700"
                  />
                  <span className="text-xs text-stone-600">{r.label}</span>
                </label>
              ))}
            </div>
          </Section>

          {/* Liturgical Color */}
          <Section
            title="Liturgical Color"
            open={openSections.has("color")}
            onToggle={() => {}}
            count={LIT_COLORS.length - filters.colors.size}
          >
            <div className="flex flex-wrap gap-2 py-1">
              {LIT_COLORS.map((c) => {
                const active = filters.colors.has(c.value);
                return (
                  <button
                    key={c.value}
                    onClick={() =>
                      update({ colors: toggleInSet(filters.colors, c.value) })
                    }
                    className={`group/swatch flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all ${
                      active
                        ? "border-stone-300 bg-white text-stone-700 shadow-sm"
                        : "border-stone-100 bg-stone-50 text-stone-300"
                    }`}
                    title={c.label}
                  >
                    <span
                      className={`inline-block h-3 w-3 rounded-full border ${
                        c.value === "white"
                          ? "border-stone-300"
                          : "border-transparent"
                      }`}
                      style={{
                        backgroundColor: c.hex,
                        opacity: active ? 1 : 0.3,
                      }}
                    />
                    {c.label}
                  </button>
                );
              })}
            </div>
          </Section>

          {/* Staffing */}
          <Section
            title="Staffing"
            open={openSections.has("staffing")}
            onToggle={() => {}}
            count={filters.staffingMode !== "all" ? 1 : 0}
          >
            <div className="space-y-0.5">
              {STAFFING_MODES.map((m) => (
                <label
                  key={m.value}
                  className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-stone-50"
                >
                  <input
                    type="radio"
                    name="staffing"
                    checked={filters.staffingMode === m.value}
                    onChange={() =>
                      update({
                        staffingMode: m.value as CalendarV2Filters["staffingMode"],
                        staffingRole: m.value === "role" ? filters.staffingRole : null,
                      })
                    }
                    className="h-3.5 w-3.5 border-stone-300 accent-stone-700"
                  />
                  <span className="text-xs text-stone-600">{m.label}</span>
                </label>
              ))}
              {filters.staffingMode === "role" && (
                <select
                  value={filters.staffingRole ?? ""}
                  onChange={(e) => update({ staffingRole: e.target.value || null })}
                  className="ml-7 mt-1 w-48 rounded border border-stone-200 bg-stone-50 px-2 py-1.5 text-xs text-stone-600 focus:border-stone-400 focus:outline-none"
                >
                  <option value="">Select role...</option>
                  {STAFFING_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </Section>

          {/* Celebrant */}
          <Section
            title="Celebrant"
            open={openSections.has("celebrant")}
            onToggle={() => {}}
            count={filters.celebrant !== "all" ? 1 : 0}
          >
            <select
              value={filters.celebrant}
              onChange={(e) => update({ celebrant: e.target.value })}
              className="w-full rounded border border-stone-200 bg-stone-50 px-2 py-1.5 text-xs text-stone-600 focus:border-stone-400 focus:outline-none"
            >
              <option value="all">All Celebrants</option>
              {celebrants.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Section>

          {/* Day Features */}
          <Section
            title="Day Features"
            open={openSections.has("dayFeatures")}
            onToggle={() => {}}
            count={
              (filters.holydaysOnly ? 1 : 0) +
              (filters.bvmOnly ? 1 : 0) +
              (filters.hasMusicOnly ? 1 : 0)
            }
          >
            <div className="space-y-0.5">
              <label className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-stone-50">
                <input
                  type="checkbox"
                  checked={filters.holydaysOnly}
                  onChange={(e) => update({ holydaysOnly: e.target.checked })}
                  className="h-3.5 w-3.5 rounded border-stone-300 accent-stone-700"
                />
                <span className="text-xs text-stone-600">Holydays of Obligation only</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-stone-50">
                <input
                  type="checkbox"
                  checked={filters.bvmOnly}
                  onChange={(e) => update({ bvmOnly: e.target.checked })}
                  className="h-3.5 w-3.5 rounded border-stone-300 accent-stone-700"
                />
                <span className="text-xs text-stone-600">BVM Saturdays only</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-stone-50">
                <input
                  type="checkbox"
                  checked={filters.hasMusicOnly}
                  onChange={(e) => update({ hasMusicOnly: e.target.checked })}
                  className="h-3.5 w-3.5 rounded border-stone-300 accent-stone-700"
                />
                <span className="text-xs text-stone-600">Events with music only</span>
              </label>
            </div>
          </Section>
        </div>
      </div>
    </>
  );
}
