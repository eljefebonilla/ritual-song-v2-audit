"use client";

import { useState } from "react";
import { LITURGICAL_COLOR_HEX } from "@/lib/liturgical-colors";
import type { LiturgicalColor } from "@/lib/types";
import type { DayData, BookingPersonnel, MassEventV2, Holiday } from "./types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const HIGH_RANKS = new Set(["sunday", "solemnity"]);
const SHOW_CITATIONS_RANKS = new Set(["sunday", "solemnity", "feast"]);
const RANK_LABELS: Record<string, string> = {
  solemnity: "Solemnity",
  feast: "Feast",
  memorial: "Memorial",
  optional_memorial: "Optional Memorial",
};

function getDayNumber(dateStr: string): number {
  return new Date(dateStr + "T12:00:00").getDate();
}

function getShortDay(dayOfWeek: string): string {
  return dayOfWeek.toUpperCase().slice(0, 3);
}

function getBorderColor(colorPrimary: string): string {
  const key = colorPrimary as LiturgicalColor;
  return LITURGICAL_COLOR_HEX[key] ?? LITURGICAL_COLOR_HEX.green;
}

function getColorLabel(colorPrimary: string): string {
  const labels: Record<string, string> = {
    violet: "violet",
    white: "white",
    red: "red",
    green: "green",
    rose: "rose",
    black: "black",
  };
  return labels[colorPrimary] ?? colorPrimary;
}

function groupPersonnelByRole(personnel: BookingPersonnel[]): [string, string[]][] {
  const roleMap = new Map<string, string[]>();
  for (const p of personnel) {
    const arr = roleMap.get(p.roleName) ?? [];
    arr.push(p.personName);
    roleMap.set(p.roleName, arr);
  }
  return Array.from(roleMap.entries());
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const ROLE_ORDER = [
  "Celebrant",
  "Music Director", "Director",
  "Accompanist",
  "Cantor & Piano", "Cantor",
  "Psalmist",
  "Section Leaders",
  "Soprano", "Alto", "Tenor", "Bass",
  "Choir",
  "Piano", "Pianist", "Organist",
  "A. Guitar", "E. Guitar", "B. Guitar", "Guitarist",
  "E. Bass", "Bassist",
  "Drums", "Drums/Percussion", "Percussion", "Drummer",
  "Instrumentalist", "Other",
  "Livestream TD", "Livestream",
  "Sound", "Sound Person",
  "Playback",
];

function PersonnelSection({
  celebrant,
  personnel,
}: {
  celebrant: string | null;
  personnel: [string, string[]][];
}) {
  const [expanded, setExpanded] = useState(false);

  if (!celebrant && personnel.length === 0) return null;

  // Build ordered single-column list
  const rows: [string, string][] = [];

  if (celebrant) {
    rows.push(["Celebrant", celebrant]);
  }

  const personnelMap = new Map<string, string>();
  for (const [role, names] of personnel) {
    const displayRole = role === "Bass (Vocal)" ? "Bass" : role;
    personnelMap.set(displayRole, names.join(", "));
  }

  for (const role of ROLE_ORDER) {
    if (role === "Celebrant") continue;
    const names = personnelMap.get(role);
    if (names) {
      rows.push([role, names]);
      personnelMap.delete(role);
    }
  }
  // Anything not in the defined order goes at the end
  for (const [role, names] of personnelMap) {
    rows.push([role, names]);
  }

  const count = rows.length;

  return (
    <div className="mt-1.5">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-[11px] text-stone-400 hover:text-stone-600 transition-colors"
      >
        <svg
          className={`h-3 w-3 transition-transform ${expanded ? "rotate-90" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <span className="font-medium">
          {count} {count === 1 ? "person" : "people"} assigned
        </span>
      </button>
      {expanded && (
        <div className="mt-1.5 ml-1 space-y-0.5 border-l-2 border-stone-100 pl-3">
          {rows.map(([role, names]) => (
            <PersonnelRow key={role} role={role} names={names} />
          ))}
        </div>
      )}
    </div>
  );
}

function PersonnelRow({ role, names }: { role: string; names: string }) {
  return (
    <div className="flex items-baseline gap-2 text-[11px] leading-relaxed">
      <span className="w-20 shrink-0 text-right font-medium uppercase tracking-wide text-stone-400">
        {role}
      </span>
      <span className="text-stone-600">{names}</span>
    </div>
  );
}

function EventCard({
  event,
  personnel,
}: {
  event: MassEventV2;
  personnel: BookingPersonnel[];
}) {
  const personnelGroups = groupPersonnelByRole(personnel);

  return (
    <div className="group/event ml-8 mr-2 mb-1.5 rounded-lg border border-stone-100 bg-white px-3.5 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all hover:border-stone-200 hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
      <div className="flex items-baseline gap-2">
        <span className="text-sm font-medium text-stone-800">
          {event.startTime12h}
        </span>
        <span className="text-sm text-stone-700">{event.title}</span>
        {event.ensemble && (
          <>
            <span className="text-stone-300">&middot;</span>
            <span className="text-sm font-medium text-stone-500">
              {event.ensemble}
            </span>
          </>
        )}
      </div>
      <PersonnelSection celebrant={event.celebrant} personnel={personnelGroups} />
      {event.notes && (
        <div className="mt-1.5 text-xs italic text-stone-400">{event.notes}</div>
      )}
    </div>
  );
}

function USFlag({ className }: { className?: string }) {
  return (
    <svg className={className ?? "h-3.5 w-5"} viewBox="0 0 60 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Stripes */}
      <rect width="60" height="40" fill="#B22234" />
      <rect y="3.08" width="60" height="3.08" fill="white" />
      <rect y="9.23" width="60" height="3.08" fill="white" />
      <rect y="15.38" width="60" height="3.08" fill="white" />
      <rect y="21.54" width="60" height="3.08" fill="white" />
      <rect y="27.69" width="60" height="3.08" fill="white" />
      <rect y="33.85" width="60" height="3.08" fill="white" />
      {/* Canton */}
      <rect width="24" height="21.54" fill="#3C3B6E" />
      {/* Stars (simplified 3x3 grid) */}
      <circle cx="4" cy="3.5" r="1.2" fill="white" />
      <circle cx="8" cy="3.5" r="1.2" fill="white" />
      <circle cx="12" cy="3.5" r="1.2" fill="white" />
      <circle cx="16" cy="3.5" r="1.2" fill="white" />
      <circle cx="20" cy="3.5" r="1.2" fill="white" />
      <circle cx="6" cy="7" r="1.2" fill="white" />
      <circle cx="10" cy="7" r="1.2" fill="white" />
      <circle cx="14" cy="7" r="1.2" fill="white" />
      <circle cx="18" cy="7" r="1.2" fill="white" />
      <circle cx="4" cy="10.5" r="1.2" fill="white" />
      <circle cx="8" cy="10.5" r="1.2" fill="white" />
      <circle cx="12" cy="10.5" r="1.2" fill="white" />
      <circle cx="16" cy="10.5" r="1.2" fill="white" />
      <circle cx="20" cy="10.5" r="1.2" fill="white" />
      <circle cx="6" cy="14" r="1.2" fill="white" />
      <circle cx="10" cy="14" r="1.2" fill="white" />
      <circle cx="14" cy="14" r="1.2" fill="white" />
      <circle cx="18" cy="14" r="1.2" fill="white" />
      <circle cx="4" cy="17.5" r="1.2" fill="white" />
      <circle cx="8" cy="17.5" r="1.2" fill="white" />
      <circle cx="12" cy="17.5" r="1.2" fill="white" />
      <circle cx="16" cy="17.5" r="1.2" fill="white" />
      <circle cx="20" cy="17.5" r="1.2" fill="white" />
    </svg>
  );
}

function StateFlag({ state, className }: { state: string; className?: string }) {
  return (
    <svg className={className ?? "h-3.5 w-5"} viewBox="0 0 60 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="60" height="40" rx="2" fill="#1E3A5F" />
      <text x="30" y="25" textAnchor="middle" fill="white" fontSize="16" fontWeight="bold" fontFamily="sans-serif">
        {state}
      </text>
    </svg>
  );
}

function HolidayBadge({ holiday }: { holiday: Holiday }) {
  const isFederal = holiday.type === "federal";
  return (
    <span
      className={`ml-8 mb-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
        isFederal
          ? "bg-slate-50 text-slate-600 border border-slate-150"
          : "bg-amber-50/70 text-amber-700 border border-amber-200/60"
      }`}
    >
      {isFederal ? (
        <USFlag className="h-3 w-4 rounded-[1px] shadow-[0_0_0_0.5px_rgba(0,0,0,0.1)]" />
      ) : (
        <StateFlag state={holiday.state ?? ""} className="h-3 w-4 rounded-[1px] shadow-[0_0_0_0.5px_rgba(0,0,0,0.1)]" />
      )}
      {holiday.name}
    </span>
  );
}

function RankBadge({ rank }: { rank: string }) {
  const label = RANK_LABELS[rank];
  if (!label) return null;

  const colors: Record<string, string> = {
    solemnity: "bg-amber-50 text-amber-800 border-amber-200",
    feast: "bg-rose-50 text-rose-700 border-rose-200",
    memorial: "bg-sky-50 text-sky-700 border-sky-200",
    optional_memorial: "bg-stone-50 text-stone-500 border-stone-200",
  };

  return (
    <span
      className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-medium tracking-wide ${
        colors[rank] ?? "bg-stone-50 text-stone-500 border-stone-200"
      }`}
    >
      {label}
    </span>
  );
}

function ColorDot({ color }: { color: string }) {
  const hex = getBorderColor(color);
  return (
    <span
      className="inline-block h-2 w-2 rounded-full"
      style={{ backgroundColor: hex }}
      title={getColorLabel(color)}
    />
  );
}

// ---------------------------------------------------------------------------
// DayRow
// ---------------------------------------------------------------------------

interface DayRowProps {
  day: DayData;
  isToday: boolean;
  onAddEvent: (date: string) => void;
}

export default function DayRow({ day, isToday, onAddEvent }: DayRowProps) {
  const [hovered, setHovered] = useState(false);
  const lit = day.liturgical;
  if (!lit) return null;

  const isHighRank = HIGH_RANKS.has(lit.rank);
  const showCitations = SHOW_CITATIONS_RANKS.has(lit.rank);
  const hasEvents = day.events.length > 0;
  const hasHolidays = day.holidays.length > 0;
  const isCompact = !isHighRank && !hasEvents && !hasHolidays && !lit.isHolyday;

  const borderColor = getBorderColor(lit.colorPrimary);
  const dayNum = getDayNumber(day.date);
  const shortDay = getShortDay(lit.dayOfWeek);

  // Compact weekday row
  if (isCompact) {
    return (
      <div
        id={`day-${day.date}`}
        className={`group relative flex items-center gap-3 py-1.5 pr-4 transition-colors ${
          isToday ? "bg-amber-50/40" : "hover:bg-stone-50/60"
        }`}
        style={{ borderLeft: `4px solid ${borderColor}` }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div className="flex w-14 shrink-0 items-baseline justify-end gap-1.5 pl-3">
          <span className="text-lg font-light text-stone-400">{dayNum}</span>
          <span className="text-[10px] uppercase tracking-widest text-stone-300">
            {shortDay}
          </span>
        </div>
        <span className="text-sm italic text-stone-400 font-sans">
          {lit.celebrationName}
        </span>
        {lit.optionalMemorials.length > 0 && (
          <span className="text-xs text-stone-300">
            [{lit.optionalMemorials.join("; ")}]
          </span>
        )}
        {hovered && (
          <button
            onClick={() => onAddEvent(day.date)}
            className="absolute right-3 rounded-md border border-stone-200 bg-white px-2 py-0.5 text-xs text-stone-400 opacity-0 transition-opacity group-hover:opacity-100 hover:border-stone-300 hover:text-stone-600"
          >
            + Event
          </button>
        )}
      </div>
    );
  }

  // Full day row
  return (
    <div
      id={`day-${day.date}`}
      className={`group relative py-3 pr-4 transition-colors ${
        isToday ? "bg-amber-50/40" : "hover:bg-stone-50/40"
      }`}
      style={{ borderLeft: `4px solid ${borderColor}` }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Header line */}
      <div className="flex items-baseline gap-3 pl-3">
        <div className="flex w-11 shrink-0 items-baseline justify-end gap-1.5">
          <span
            className={`font-light text-stone-700 ${
              isHighRank ? "text-3xl" : "text-2xl"
            }`}
          >
            {dayNum}
          </span>
        </div>
        <span className="text-[10px] uppercase tracking-widest text-stone-400 pt-0.5">
          {shortDay}
        </span>
        <span
          className={`flex-1 ${
            isHighRank
              ? "font-serif text-base font-medium text-stone-800"
              : "text-sm italic text-stone-500"
          }`}
        >
          {lit.celebrationName}
        </span>
      </div>

      {/* Rank + Holyday line */}
      {(RANK_LABELS[lit.rank] || lit.isHolyday) && (
        <div className="mt-1 flex items-center gap-2 pl-[68px]">
          <RankBadge rank={lit.rank} />
          {lit.isHolyday && (
            <span className="text-[10px] font-medium uppercase tracking-wider text-amber-700">
              Holyday of Obligation
            </span>
          )}
        </div>
      )}

      {/* Citations */}
      {showCitations && lit.citations && (
        <div className="mt-1 pl-[68px] text-xs italic text-stone-400 leading-relaxed">
          {lit.citations}
        </div>
      )}

      {/* Optional memorials */}
      {lit.optionalMemorials.length > 0 && (
        <div className="mt-1 pl-[68px] text-xs text-stone-400">
          [{lit.optionalMemorials.join("; ")}]
        </div>
      )}

      {/* Events */}
      {hasEvents && (
        <div className="mt-2.5 space-y-1.5">
          {day.events.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              personnel={day.personnel.get(event.id) ?? []}
            />
          ))}
        </div>
      )}

      {/* Holidays */}
      {hasHolidays && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {day.holidays.map((h, i) => (
            <HolidayBadge key={`${h.name}-${i}`} holiday={h} />
          ))}
        </div>
      )}

      {/* Add event button (hover) */}
      {hovered && (
        <button
          onClick={() => onAddEvent(day.date)}
          className="absolute right-3 bottom-3 rounded-md border border-stone-200 bg-white px-2 py-0.5 text-xs text-stone-400 opacity-0 transition-opacity group-hover:opacity-100 hover:border-stone-300 hover:text-stone-600"
        >
          + Event
        </button>
      )}
    </div>
  );
}
