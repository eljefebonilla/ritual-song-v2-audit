"use client";

import type { LiturgicalDay } from "@/lib/types";
import type { CalendarEvent } from "@/lib/calendar-types";
import { LITURGICAL_COLOR_HEX, LITURGICAL_COLOR_LIGHT, LITURGICAL_COLOR_LABEL, SEASON_COLORS } from "@/lib/liturgical-colors";
import { rankLabel } from "@/lib/liturgical-helpers";
import { getCommunityColor } from "@/lib/calendar-utils";
import Link from "next/link";

interface DayDetailPanelProps {
  date: string;
  litDay: LiturgicalDay | null;
  events: CalendarEvent[];
  onClose: () => void;
}

export default function DayDetailPanel({ date, litDay, events, onClose }: DayDetailPanelProps) {
  const displayDate = new Date(date + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const colorHex = litDay ? LITURGICAL_COLOR_HEX[litDay.colorPrimary] : "#78716c";
  const colorLight = litDay ? LITURGICAL_COLOR_LIGHT[litDay.colorPrimary] : "#fafaf9";
  const colorName = litDay ? LITURGICAL_COLOR_LABEL[litDay.colorPrimary] : undefined;
  const seasonInfo = litDay ? SEASON_COLORS[litDay.season] : undefined;

  return (
    <div className="border border-stone-200 rounded-lg overflow-hidden bg-white shadow-sm mx-4 mb-4">
      {/* Color bar */}
      <div className="h-[6px]" style={{ backgroundColor: colorHex }} />

      {/* Header */}
      <div className="px-4 pt-4 pb-3 relative" style={{ backgroundColor: colorLight }}>
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1 rounded hover:bg-black/5 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {litDay ? (
          <>
            <div className="flex items-center gap-2 mb-1.5">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: colorHex }}
              />
              <span
                className="text-[10px] font-semibold uppercase tracking-wide"
                style={{ color: colorHex }}
              >
                {rankLabel(litDay.rank)}
              </span>
              {colorName && (
                <>
                  <span className="text-[10px] text-stone-400">|</span>
                  <span className="text-[10px] text-stone-500">{colorName}</span>
                </>
              )}
            </div>

            <h3 className="text-lg font-bold text-stone-900 mb-0.5 pr-6">
              {litDay.celebrationName}
            </h3>

            <p className="text-xs text-stone-500">
              <span style={{ color: seasonInfo?.primary }}>
                {seasonInfo?.label || litDay.season}
              </span>
              {" \u2022 "}
              {displayDate}
            </p>
          </>
        ) : (
          <>
            <h3 className="text-lg font-bold text-stone-900 mb-0.5 pr-6">
              {displayDate}
            </h3>
            <p className="text-xs text-stone-400">No liturgical data</p>
          </>
        )}
      </div>

      {/* Quick stats */}
      {litDay && (
        <div className="px-4 py-2.5 flex flex-wrap gap-4 border-b border-stone-200 bg-white">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-stone-400">Gloria</span>
            {litDay.gloria ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a8a29e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-stone-400">Alleluia</span>
            {litDay.alleluia ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a8a29e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            )}
          </div>
          {litDay.psalterWeek && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-stone-400">Psalter</span>
              <span className="text-[10px] font-semibold text-stone-700 bg-stone-100 px-1.5 py-0.5 rounded">
                Week {litDay.psalterWeek}
              </span>
            </div>
          )}
          {litDay.lectionaryNumber && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-stone-400">Lectionary</span>
              <span className="text-[10px] font-semibold text-stone-700 bg-stone-100 px-1.5 py-0.5 rounded">
                #{litDay.lectionaryNumber}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Saint spotlight */}
      {litDay?.saintName && (
        <div
          className="mx-4 mt-3 p-3 rounded-md border-l-[3px] bg-white"
          style={{ borderLeftColor: colorHex }}
        >
          <p className="text-sm font-semibold text-stone-800">
            {litDay.saintName}
          </p>
          {litDay.saintTitle && (
            <p className="text-xs text-stone-500 mt-0.5">
              {litDay.saintTitle}
            </p>
          )}
        </div>
      )}

      {/* Optional memorials */}
      {litDay?.optionalMemorials && litDay.optionalMemorials.length > 0 && (
        <div className="mx-4 mt-2 p-2.5 bg-stone-50 rounded-md">
          <p className="text-[9px] uppercase tracking-wide text-stone-400 font-semibold mb-1">
            Optional Memorials
          </p>
          {litDay.optionalMemorials.map((m, i) => (
            <p key={i} className="text-xs text-stone-600">{m}</p>
          ))}
        </div>
      )}

      {/* BVM indicator */}
      {litDay?.isBVM && (
        <div className="mx-4 mt-2 p-2.5 bg-blue-50 rounded-md">
          <p className="text-xs text-blue-700">
            Optional Memorial of the Blessed Virgin Mary may be observed on this Saturday.
          </p>
        </div>
      )}

      {/* Masses & Events */}
      {events.length > 0 && (
        <div className="px-4 pt-3 pb-2">
          <p className="text-[9px] uppercase tracking-wide text-stone-400 font-semibold mb-2">
            Masses &amp; Events
          </p>
          <div className="space-y-1.5">
            {events.map((evt, i) => {
              const communityStyle = getCommunityColor(evt.community);
              const content = (
                <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-stone-50 hover:bg-stone-100 transition-colors">
                  <span className="text-xs font-medium text-stone-700 w-12 shrink-0">
                    {evt.startTime12h || "—"}
                  </span>
                  <span className="text-xs text-stone-800 flex-1 truncate">
                    {evt.title}
                  </span>
                  {evt.community && (
                    <span
                      className="text-[9px] font-semibold px-1.5 py-0.5 rounded shrink-0"
                      style={communityStyle}
                    >
                      {evt.community}
                    </span>
                  )}
                  {evt.celebrant && (
                    <span className="text-[10px] text-stone-400 shrink-0">
                      {evt.celebrant}
                    </span>
                  )}
                </div>
              );

              return evt.occasionId ? (
                <Link key={i} href={`/occasion/${evt.occasionId}`}>
                  {content}
                </Link>
              ) : (
                <div key={i}>{content}</div>
              );
            })}
          </div>
        </div>
      )}

      {/* Footer link */}
      <div className="px-4 pb-3 pt-1">
        <Link
          href={`/day/${date}`}
          className="text-xs text-stone-400 hover:text-stone-600 transition-colors"
        >
          View full day page &rarr;
        </Link>
      </div>
    </div>
  );
}
