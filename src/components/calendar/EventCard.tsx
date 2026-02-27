"use client";

import Link from "next/link";
import type { CalendarEvent } from "@/lib/calendar-types";
import { getCommunityColor } from "@/lib/calendar-utils";

interface EventCardProps {
  event: CalendarEvent;
  isPast: boolean;
}

export default function EventCard({ event, isPast }: EventCardProps) {
  const communityStyle = getCommunityColor(event.community);
  const hasOccasionLink = event.occasionId && event.eventType === "mass";

  const card = (
    <div
      className={`flex items-start gap-3 px-3 py-2 rounded-lg transition-colors group ${
        isPast
          ? "opacity-50"
          : "hover:bg-stone-50"
      } ${hasOccasionLink ? "cursor-pointer" : ""}`}
    >
      {/* Time column */}
      <div className="w-24 shrink-0 text-right">
        {event.startTime12h ? (
          <span className="text-xs font-medium text-stone-500 tabular-nums">
            {event.startTime12h}
            {event.endTime12h && (
              <span className="text-stone-400"> – {event.endTime12h}</span>
            )}
          </span>
        ) : (
          <span className="text-xs text-stone-400 italic">All day</span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Title */}
          <span
            className={`text-sm font-medium ${
              isPast ? "text-stone-500" : "text-stone-900"
            } ${hasOccasionLink ? "group-hover:text-parish-burgundy" : ""}`}
          >
            {event.title}
          </span>

          {/* Music indicator */}
          {event.hasMusic && (
            <span className="text-xs" title="Music">
              ♫
            </span>
          )}

          {/* Auto-Mix badge */}
          {event.isAutoMix && (
            <span className="text-[10px] px-1.5 py-0.5 bg-stone-100 text-stone-500 rounded font-medium">
              Auto-Mix
            </span>
          )}

          {/* Community badge */}
          {event.community && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded font-medium"
              style={communityStyle}
            >
              {event.community}
            </span>
          )}
        </div>

        {/* Details row */}
        {(event.celebrant || event.notes || event.location) && (
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {event.celebrant && (
              <span className="text-xs text-stone-500">{event.celebrant}</span>
            )}
            {event.location && event.location !== "Church" && (
              <span className="text-xs text-stone-400">
                📍 {event.location}
              </span>
            )}
            {event.notes && (
              <span className="text-xs text-stone-400">{event.notes}</span>
            )}
          </div>
        )}

        {/* Sidebar note */}
        {event.sidebarNote && (
          <div className="text-xs text-amber-600 mt-0.5 italic">
            {event.sidebarNote}
          </div>
        )}
      </div>

      {/* Link indicator */}
      {hasOccasionLink && (
        <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-stone-400"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </div>
      )}
    </div>
  );

  if (hasOccasionLink) {
    return <Link href={`/occasion/${event.occasionId}`}>{card}</Link>;
  }

  return card;
}
