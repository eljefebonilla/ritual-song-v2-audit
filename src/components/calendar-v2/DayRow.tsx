"use client";

import { useState } from "react";
import Link from "next/link";
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

function getEnsembleStyle(ensemble: string | null): { backgroundColor: string; color: string } {
  const COLORS: Record<string, { backgroundColor: string; color: string }> = {
    reflections:  { backgroundColor: "#f1f4f6", color: "#5a6a78" },
    foundations:  { backgroundColor: "#f5e9e5", color: "#8b6b5a" },
    generations:  { backgroundColor: "#fff8da", color: "#8a7a3a" },
    heritage:     { backgroundColor: "#eef1eb", color: "#5a6b54" },
    elevations:   { backgroundColor: "#eeebf6", color: "#6b5a8a" },
  };
  if (!ensemble) return { backgroundColor: "#f5f5f4", color: "#78716c" };
  return COLORS[ensemble.toLowerCase()] || { backgroundColor: "#f5f5f4", color: "#78716c" };
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
  isPast,
  onEdit,
}: {
  event: MassEventV2;
  personnel: BookingPersonnel[];
  isPast: boolean;
  onEdit?: (event: MassEventV2) => void;
}) {
  const personnelGroups = groupPersonnelByRole(personnel);
  const ensembleStyle = getEnsembleStyle(event.ensemble);
  const hasOccasionLink = event.occasionId && event.eventType === "mass";

  const card = (
    <div
      className={`group/event ml-8 mr-2 mb-1.5 rounded-lg border border-stone-100 bg-white px-3.5 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all hover:border-stone-200 hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)] ${
        isPast ? "opacity-50" : ""
      } ${hasOccasionLink ? "cursor-pointer" : ""}`}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-medium text-stone-800 tabular-nums">
          {event.startTime12h}
          {event.endTime12h && (
            <span className="text-stone-400"> – {event.endTime12h}</span>
          )}
        </span>
        <span className={`text-sm text-stone-700 ${hasOccasionLink ? "group-hover/event:text-parish-burgundy" : ""}`}>
          {event.title}
        </span>
        {event.ensemble && (
          <span
            className="rounded px-1.5 py-0.5 text-[10px] font-medium"
            style={ensembleStyle}
          >
            {event.ensemble}
          </span>
        )}
        {event.isAutoMix && (
          <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-medium text-stone-500">
            Auto-Mix
          </span>
        )}
        {onEdit && (
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEdit(event); }}
            className="ml-auto rounded p-0.5 text-stone-300 opacity-0 transition-opacity group-hover/event:opacity-100 hover:text-stone-600"
            aria-label="Edit event"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
        )}
        {hasOccasionLink && (
          <svg
            className="h-3.5 w-3.5 text-stone-300 opacity-0 transition-opacity group-hover/event:opacity-100"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        )}
      </div>
      {/* Details row */}
      {(event.location || event.notes) && (
        <div className="mt-1 flex items-center gap-2 flex-wrap text-xs text-stone-400">
          {event.location && event.location !== "Church" && (
            <span className="flex items-center gap-0.5">
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              {event.location}
            </span>
          )}
          {event.notes && (
            <span>{event.notes}</span>
          )}
        </div>
      )}
      {/* Sidebar note */}
      {event.sidebarNote && (
        <div className="mt-1 text-xs italic text-amber-600">{event.sidebarNote}</div>
      )}
      <PersonnelSection celebrant={event.celebrant} personnel={personnelGroups} />
    </div>
  );

  if (hasOccasionLink) {
    return <Link href={`/occasion/${event.occasionId}`}>{card}</Link>;
  }
  return card;
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

function StateFlagCA({ cls }: { cls: string }) {
  return (
    <svg className={cls} viewBox="0 0 60 40" xmlns="http://www.w3.org/2000/svg">
      <rect width="60" height="40" fill="white" />
      <rect y="32" width="60" height="8" fill="#BC002D" />
      {/* Red star */}
      <polygon points="12,4 13.5,9 18.5,9 14.5,12 16,17 12,14 8,17 9.5,12 5.5,9 10.5,9" fill="#BC002D" />
      {/* Bear silhouette */}
      <ellipse cx="30" cy="22" rx="12" ry="7" fill="#8B5E3C" />
      <ellipse cx="21" cy="18" rx="3" ry="3.5" fill="#8B5E3C" />
      <ellipse cx="39" cy="18" rx="3" ry="3.5" fill="#8B5E3C" />
      <rect x="19" y="26" width="4" height="5" rx="1" fill="#8B5E3C" />
      <rect x="25" y="26" width="4" height="5" rx="1" fill="#8B5E3C" />
      <rect x="31" y="26" width="4" height="5" rx="1" fill="#8B5E3C" />
      <rect x="37" y="26" width="4" height="5" rx="1" fill="#8B5E3C" />
      <circle cx="22" cy="19" r="1" fill="#333" />
      <ellipse cx="30" cy="20" rx="2" ry="1" fill="#5C3A1E" />
    </svg>
  );
}

function StateFlagTX({ cls }: { cls: string }) {
  return (
    <svg className={cls} viewBox="0 0 60 40" xmlns="http://www.w3.org/2000/svg">
      <rect width="20" height="40" fill="#002868" />
      <rect x="20" width="40" height="20" fill="white" />
      <rect x="20" y="20" width="40" height="20" fill="#BF0A30" />
      <polygon points="10,8 11.8,13.5 17.5,13.5 12.8,17 14.6,22.5 10,19 5.4,22.5 7.2,17 2.5,13.5 8.2,13.5" fill="white" />
    </svg>
  );
}

function StateFlagNY({ cls }: { cls: string }) {
  return (
    <svg className={cls} viewBox="0 0 60 40" xmlns="http://www.w3.org/2000/svg">
      <rect width="60" height="40" fill="#002D72" />
      {/* Simplified coat of arms */}
      <circle cx="30" cy="20" r="10" fill="#E8D4A2" stroke="#8B7340" strokeWidth="1" />
      <rect x="26" y="14" width="8" height="12" rx="1" fill="#002D72" />
      <polygon points="30,12 32,16 28,16" fill="#E8A000" />
      <text x="30" y="31" textAnchor="middle" fill="white" fontSize="5" fontWeight="bold" fontFamily="sans-serif">EXCELSIOR</text>
    </svg>
  );
}

function StateFlagFL({ cls }: { cls: string }) {
  return (
    <svg className={cls} viewBox="0 0 60 40" xmlns="http://www.w3.org/2000/svg">
      <rect width="60" height="40" fill="white" />
      {/* Red saltire (X) */}
      <line x1="0" y1="0" x2="60" y2="40" stroke="#C8102E" strokeWidth="6" />
      <line x1="60" y1="0" x2="0" y2="40" stroke="#C8102E" strokeWidth="6" />
      {/* Seal center */}
      <circle cx="30" cy="20" r="8" fill="#F4E5C0" stroke="#8B7340" strokeWidth="0.8" />
      <circle cx="30" cy="18" r="2.5" fill="#FFB800" />
      <rect x="27" y="20" width="6" height="4" rx="0.5" fill="#4A8C5C" />
    </svg>
  );
}

function StateFlagIL({ cls }: { cls: string }) {
  return (
    <svg className={cls} viewBox="0 0 60 40" xmlns="http://www.w3.org/2000/svg">
      <rect width="60" height="40" fill="white" />
      {/* Eagle */}
      <circle cx="30" cy="16" r="4" fill="#8B6914" />
      <polygon points="30,10 26,18 34,18" fill="#8B6914" />
      {/* Shield */}
      <rect x="27" y="19" width="6" height="8" rx="1" fill="#002868" />
      <rect x="28" y="20" width="4" height="2" fill="#BF0A30" />
      <rect x="28" y="24" width="4" height="2" fill="#BF0A30" />
      <text x="30" y="36" textAnchor="middle" fill="#002868" fontSize="5" fontWeight="bold" fontFamily="sans-serif">ILLINOIS</text>
    </svg>
  );
}

function StateFlagPA({ cls }: { cls: string }) {
  return (
    <svg className={cls} viewBox="0 0 60 40" xmlns="http://www.w3.org/2000/svg">
      <rect width="60" height="40" fill="#002868" />
      <circle cx="30" cy="20" r="12" fill="#1A3F7A" stroke="#D4AF37" strokeWidth="1" />
      {/* Simplified coat of arms */}
      <rect x="25" y="14" width="10" height="12" rx="2" fill="#000" />
      <rect x="26" y="15" width="8" height="5" fill="#FFD700" />
      <rect x="26" y="21" width="8" height="4" fill="#4A8C5C" />
      <circle cx="23" cy="20" r="3" fill="#8B6914" />
      <circle cx="37" cy="20" r="3" fill="#8B6914" />
    </svg>
  );
}

function StateFlagOH({ cls }: { cls: string }) {
  return (
    <svg className={cls} viewBox="0 0 60 40" xmlns="http://www.w3.org/2000/svg">
      {/* Ohio burgee (swallowtail) shape */}
      <polygon points="0,0 50,0 60,20 50,40 0,40" fill="#002868" />
      <polygon points="0,4 48,4 56,20 48,36 0,36" fill="none" stroke="#BF0A30" strokeWidth="4" />
      <polygon points="0,12 44,12 50,20 44,28 0,28" fill="white" />
      <polygon points="0,16 42,16 47,20 42,24 0,24" fill="#BF0A30" />
      {/* White circle with red center */}
      <circle cx="14" cy="20" r="7" fill="white" />
      <circle cx="14" cy="20" r="4" fill="#BF0A30" />
    </svg>
  );
}

function StateFlagGA({ cls }: { cls: string }) {
  return (
    <svg className={cls} viewBox="0 0 60 40" xmlns="http://www.w3.org/2000/svg">
      <rect width="60" height="13.3" fill="#BF0A30" />
      <rect y="13.3" width="60" height="13.4" fill="white" />
      <rect y="26.7" width="60" height="13.3" fill="#BF0A30" />
      <rect width="24" height="26.7" fill="#002868" />
      {/* Coat of arms simplified */}
      <circle cx="12" cy="13.3" r="7" fill="#D4AF37" />
      <rect x="9" y="8" width="6" height="10" rx="1" fill="#002868" />
      <text x="12" y="14" textAnchor="middle" fill="white" fontSize="4" fontWeight="bold" fontFamily="sans-serif">GA</text>
    </svg>
  );
}

function StateFlagNC({ cls }: { cls: string }) {
  return (
    <svg className={cls} viewBox="0 0 60 40" xmlns="http://www.w3.org/2000/svg">
      <rect x="16" width="44" height="20" fill="#002868" />
      <rect x="16" y="20" width="44" height="20" fill="white" />
      <rect width="16" height="40" fill="#BF0A30" />
      <text x="8" y="23" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold" fontFamily="sans-serif">N</text>
      <polygon points="8,6 9.2,9.5 13,9.5 10,11.5 11,15 8,13 5,15 6,11.5 3,9.5 6.8,9.5" fill="#D4AF37" />
    </svg>
  );
}

function StateFlagMA({ cls }: { cls: string }) {
  return (
    <svg className={cls} viewBox="0 0 60 40" xmlns="http://www.w3.org/2000/svg">
      <rect width="60" height="40" fill="white" />
      {/* Blue shield */}
      <rect x="22" y="8" width="16" height="20" rx="2" fill="#002868" />
      {/* Native figure */}
      <circle cx="30" cy="14" r="3" fill="#D4AF37" />
      <rect x="28" y="17" width="4" height="8" fill="#D4AF37" />
      {/* Star */}
      <polygon points="30,5 30.8,7.5 33,7.5 31.2,9 31.8,11.5 30,10 28.2,11.5 28.8,9 27,7.5 29.2,7.5" fill="white" />
      <text x="30" y="36" textAnchor="middle" fill="#002868" fontSize="4.5" fontWeight="bold" fontFamily="sans-serif">MASS.</text>
    </svg>
  );
}

const STATE_FLAG_COMPONENTS: Record<string, ({ cls }: { cls: string }) => React.ReactElement> = {
  CA: StateFlagCA,
  TX: StateFlagTX,
  NY: StateFlagNY,
  FL: StateFlagFL,
  IL: StateFlagIL,
  PA: StateFlagPA,
  OH: StateFlagOH,
  GA: StateFlagGA,
  NC: StateFlagNC,
  MA: StateFlagMA,
};

function StateFlag({ state, className }: { state: string; className?: string }) {
  const cls = className ?? "h-3.5 w-5";
  const FlagComponent = STATE_FLAG_COMPONENTS[state];
  if (FlagComponent) return <FlagComponent cls={cls} />;
  // Fallback for states without a custom flag
  return (
    <svg className={cls} viewBox="0 0 60 40" xmlns="http://www.w3.org/2000/svg">
      <rect width="60" height="40" rx="2" fill="#1E3A5F" />
      <text x="30" y="26" textAnchor="middle" fill="white" fontSize="16" fontWeight="bold" fontFamily="sans-serif">
        {state}
      </text>
    </svg>
  );
}

// Holidays that duplicate liturgical celebrations — suppress the badge
const LITURGICAL_HOLIDAYS = new Set([
  "christmas day",
  "good friday",
  "easter sunday",
  "easter",
]);

function isRedundantHoliday(holiday: Holiday, litName: string | undefined): boolean {
  if (!litName) return false;
  const hLower = holiday.name.toLowerCase();
  // Exact match on known liturgical holidays
  if (LITURGICAL_HOLIDAYS.has(hLower)) return true;
  // Christmas Eve when lit day is already a Christmas vigil
  if (hLower === "christmas eve" && litName.toLowerCase().includes("nativity")) return true;
  return false;
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

function ColorDot({ color, celebrationName }: { color: string; celebrationName?: string }) {
  const hex = getBorderColor(color);
  if (color === "white") {
    const isHolyThursday = celebrationName?.toLowerCase().includes("holy thursday");
    return (
      <span
        className="inline-block h-2 w-2 rounded-full"
        style={{ backgroundColor: "#ffffff", border: `1.5px solid ${isHolyThursday ? "#2563EB" : hex}` }}
        title={getColorLabel(color)}
      />
    );
  }
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
  isPast: boolean;
  hidePast: boolean;
  onAddEvent?: (date: string) => void;
  onEditEvent?: (event: MassEventV2) => void;
}

export default function DayRow({ day, isToday, isPast, hidePast, onAddEvent, onEditEvent }: DayRowProps) {
  const [hovered, setHovered] = useState(false);
  const lit = day.liturgical;
  if (!lit) return null;
  if (hidePast && isPast) return null;

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
        {hovered && onAddEvent && (
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

      {/* Rank + Holyday + Liturgical indicators */}
      {(RANK_LABELS[lit.rank] || lit.isHolyday || lit.lectionaryNumber || lit.psalterWeek) && (
        <div className="mt-1 flex items-center gap-2 pl-[68px] flex-wrap">
          <RankBadge rank={lit.rank} />
          {lit.isHolyday && (
            <span className="text-[10px] font-medium uppercase tracking-wider text-amber-700">
              Holyday of Obligation
            </span>
          )}
          {lit.lectionaryNumber && (
            <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[10px] tabular-nums font-medium text-stone-500">
              #{lit.lectionaryNumber}
            </span>
          )}
          {lit.psalterWeek && (
            <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-medium text-stone-500">
              Wk {lit.psalterWeek}
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

      {/* BVM indicator */}
      {lit.isBVM && (
        <div className="mt-1.5 ml-[68px] mr-4 rounded-md bg-blue-50/60 px-3 py-1.5 text-[11px] text-blue-600">
          Optional Memorial of the Blessed Virgin Mary
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
              isPast={isPast}
              onEdit={onEditEvent}
            />
          ))}
        </div>
      )}

      {/* Holidays (suppress when redundant with liturgical day) */}
      {hasHolidays && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {day.holidays
            .filter((h) => !isRedundantHoliday(h, lit.celebrationName))
            .map((h, i) => (
              <HolidayBadge key={`${h.name}-${i}`} holiday={h} />
            ))}
        </div>
      )}

      {/* Add event button (hover, admin only) */}
      {hovered && onAddEvent && (
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
