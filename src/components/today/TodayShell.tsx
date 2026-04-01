"use client";

import type { LiturgicalDay } from "@/lib/types";
import type { CalendarEvent } from "@/lib/calendar-types";
import { LITURGICAL_COLOR_HEX, LITURGICAL_COLOR_LIGHT, LITURGICAL_COLOR_LABEL } from "@/lib/liturgical-colors";
import { SEASON_COLORS } from "@/lib/liturgical-colors";
import { rankLabel } from "@/lib/liturgical-helpers";
import { getEnsembleColor } from "@/lib/calendar-utils";
import CantorBriefingCard from "./CantorBriefingCard";

interface TodayShellProps {
  date: string;
  liturgicalDay: LiturgicalDay | null;
  massEvents: CalendarEvent[];
  nextFeast: { date: string; name: string; daysUntil: number } | null;
}

function formatDisplayDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function TodayShell({
  date,
  liturgicalDay,
  massEvents,
  nextFeast,
}: TodayShellProps) {
  if (!liturgicalDay) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-stone-800 mb-2">Today</h1>
        <p className="text-stone-500">{formatDisplayDate(date)}</p>
        <div className="mt-8 text-center text-stone-400">
          <p>No liturgical data available for today.</p>
        </div>
      </div>
    );
  }

  const colorHex = LITURGICAL_COLOR_HEX[liturgicalDay.colorPrimary];
  const colorLight = LITURGICAL_COLOR_LIGHT[liturgicalDay.colorPrimary];
  const colorName = LITURGICAL_COLOR_LABEL[liturgicalDay.colorPrimary];
  const seasonInfo = SEASON_COLORS[liturgicalDay.season];

  // Separate masses with music (for cantor cards) from other events
  const massesWithMusic = massEvents.filter(
    (e) => e.eventType === "mass" && e.hasMusic
  );
  const otherEvents = massEvents.filter(
    (e) => e.eventType !== "mass" || !e.hasMusic
  );

  return (
    <div className="max-w-3xl mx-auto pb-12">
      {/* Ombre hero — fades from liturgical color to parchment */}
      <div
        className="px-6 pt-8 pb-6"
        style={{ backgroundImage: `linear-gradient(to bottom, color-mix(in srgb, ${colorHex}, transparent 85%), var(--color-background))` }}
      >
        {/* Rank badge */}
        <div className="flex items-center gap-2 mb-2">
          <span
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: colorHex }}
          />
          <span className="text-[11px] font-medium uppercase tracking-wide" style={{ color: colorHex }}>
            {rankLabel(liturgicalDay.rank)}
          </span>
          <span className="text-[11px] text-muted">|</span>
          <span className="text-[11px] text-muted">{colorName}</span>
        </div>

        {/* Celebration name */}
        <h1 className="font-serif text-[1.375rem] font-semibold text-parish-charcoal mb-1">
          {liturgicalDay.celebrationName}
        </h1>

        {/* Season + date */}
        <p className="text-sm text-muted">
          <span style={{ color: seasonInfo?.primary }}>{seasonInfo?.label || liturgicalDay.season}</span>
          {" \u2022 "}
          {formatDisplayDate(date)}
        </p>
      </div>

      {/* Quick stats row */}
      <div className="px-6 py-3 flex flex-wrap gap-4 border-b border-stone-200 bg-white">
        <QuickStat
          label="Gloria"
          value={liturgicalDay.gloria}
          note={
            !liturgicalDay.gloria && (liturgicalDay.season === "advent" || liturgicalDay.season === "lent")
              ? `Omitted during ${seasonInfo?.label || liturgicalDay.season}`
              : undefined
          }
        />
        <QuickStat
          label="Alleluia"
          value={liturgicalDay.alleluia}
          note={
            !liturgicalDay.alleluia
              ? "Use Lenten Gospel Acclamation"
              : undefined
          }
        />
        {liturgicalDay.psalterWeek && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-stone-400">Psalter</span>
            <span className="text-xs font-semibold text-stone-700 bg-stone-100 px-1.5 py-0.5 rounded">
              Week {liturgicalDay.psalterWeek}
            </span>
          </div>
        )}
        {liturgicalDay.lectionaryNumber && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-stone-400">Lectionary</span>
            <span className="text-xs font-semibold text-stone-700 bg-stone-100 px-1.5 py-0.5 rounded">
              #{liturgicalDay.lectionaryNumber}
            </span>
          </div>
        )}
      </div>

      {/* Saint spotlight */}
      {liturgicalDay.saintName && (
        <div className="mx-6 mt-4 p-4 rounded-lg border-l-[3px] bg-white" style={{ borderLeftColor: colorHex }}>
          <p className="text-sm font-semibold text-stone-800">
            {liturgicalDay.saintName}
          </p>
          {liturgicalDay.saintTitle && (
            <p className="text-xs text-stone-500 mt-0.5">
              {liturgicalDay.saintTitle}
            </p>
          )}
        </div>
      )}

      {/* Optional memorials */}
      {liturgicalDay.optionalMemorials && liturgicalDay.optionalMemorials.length > 0 && (
        <div className="mx-6 mt-3 p-3 bg-stone-50 rounded-lg">
          <p className="text-[10px] uppercase tracking-wide text-stone-400 font-semibold mb-1">
            Optional Memorials
          </p>
          {liturgicalDay.optionalMemorials.map((m, i) => (
            <p key={i} className="text-xs text-stone-600">
              {m}
            </p>
          ))}
        </div>
      )}

      {/* Today's Masses */}
      {massEvents.length > 0 && (
        <div className="mx-6 mt-6">
          <h2 className="text-sm font-semibold text-stone-700 uppercase tracking-wide mb-3">
            Today&apos;s Masses
          </h2>
          <div className="space-y-2">
            {massEvents.map((evt, i) => {
              const ensembleStyle = getEnsembleColor(evt.ensemble);
              return (
                <div
                  key={i}
                  className="flex items-center gap-3 p-3 bg-white rounded-lg border border-stone-100"
                >
                  <span className="text-sm font-medium text-stone-700 w-16 shrink-0">
                    {evt.startTime12h || "TBD"}
                  </span>
                  <span className="text-sm text-stone-800">{evt.title}</span>
                  {evt.ensemble && (
                    <span
                      className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                      style={ensembleStyle}
                    >
                      {evt.ensemble}
                    </span>
                  )}
                  {evt.celebrant && (
                    <span className="text-xs text-stone-400 ml-auto">
                      {evt.celebrant}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Cantor Briefing Cards */}
      {massesWithMusic.length > 0 && (
        <div className="mx-6 mt-8">
          <h2 className="text-sm font-semibold text-stone-700 uppercase tracking-wide mb-3">
            Cantor Briefing
          </h2>
          <div className="space-y-4">
            {massesWithMusic.map((evt, i) => (
              <CantorBriefingCard
                key={i}
                event={evt}
                liturgicalDay={liturgicalDay}
              />
            ))}
          </div>
        </div>
      )}

      {/* Other events */}
      {otherEvents.length > 0 && massesWithMusic.length > 0 && (
        <div className="mx-6 mt-6">
          <h2 className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide mb-2">
            Other Events
          </h2>
          {otherEvents.map((evt, i) => (
            <div key={i} className="flex items-center gap-2 py-1.5 text-xs text-stone-500">
              <span>{evt.startTime12h || "TBD"}</span>
              <span>{evt.title}</span>
            </div>
          ))}
        </div>
      )}

      {/* Countdown to next feast */}
      {nextFeast && (
        <div className="mx-6 mt-8 p-4 bg-stone-50 rounded-lg text-center">
          <p className="text-xs text-stone-400 uppercase tracking-wide">Coming up</p>
          <p className="text-lg font-semibold text-stone-700 mt-1">
            {nextFeast.daysUntil === 1
              ? "Tomorrow"
              : `${nextFeast.daysUntil} days`}
          </p>
          <p className="text-sm text-stone-500">{nextFeast.name}</p>
        </div>
      )}

      {/* Link to occasion page if available */}
      {liturgicalDay.occasionId && (
        <div className="mx-6 mt-4 text-center">
          <a
            href={`/occasion/${liturgicalDay.occasionId}`}
            className="text-sm text-parish-burgundy hover:underline"
          >
            View full occasion details &rarr;
          </a>
        </div>
      )}
    </div>
  );
}

function QuickStat({
  label,
  value,
  note,
}: {
  label: string;
  value: boolean;
  note?: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-stone-400">{label}</span>
      {value ? (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#16a34a"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#a8a29e"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      )}
      {note && <span className="text-[10px] text-stone-400">{note}</span>}
    </div>
  );
}
