"use client";

import type { CalendarWeek } from "@/lib/calendar-types";
import type { CommunityId } from "@/lib/grid-types";
import {
  filterEventsByCommunity,
  groupEventsByDate,
  formatDateLabel,
  isDatePast,
} from "@/lib/calendar-utils";
import WeekHeader from "./WeekHeader";
import EventCard from "./EventCard";

interface AgendaViewProps {
  weeks: CalendarWeek[];
  communityFilter: CommunityId | "all";
  hiddenWeekIds: string[];
  onToggleHidden: (weekId: string) => void;
}

export default function AgendaView({
  weeks,
  communityFilter,
  hiddenWeekIds,
  onToggleHidden,
}: AgendaViewProps) {
  if (weeks.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-stone-400">
        <div className="text-center">
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mx-auto mb-3 text-stone-300"
          >
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <p className="text-sm">No upcoming events</p>
          <p className="text-xs mt-1">
            Try showing past dates or changing the community filter
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="divide-y divide-stone-100">
      {weeks.map((week) => {
        const isHidden = hiddenWeekIds.includes(week.weekId);
        const filteredEvents = filterEventsByCommunity(
          week.events,
          communityFilter
        );

        if (filteredEvents.length === 0 && !isHidden) return null;

        const eventsByDate = groupEventsByDate(filteredEvents);
        const sortedDates = Array.from(eventsByDate.keys()).sort();

        return (
          <div key={week.weekId} className="py-3">
            <WeekHeader
              week={week}
              isHidden={isHidden}
              onToggleHidden={onToggleHidden}
            />

            {!isHidden && (
              <div className="mt-2 space-y-1">
                {sortedDates.map((date) => {
                  const events = eventsByDate.get(date) || [];
                  const past = isDatePast(date);

                  return (
                    <div key={date}>
                      {/* Date subheader */}
                      <div className="flex items-center gap-2 px-3 py-1">
                        <span
                          className={`text-xs font-medium ${
                            past ? "text-stone-400" : "text-stone-600"
                          }`}
                        >
                          {formatDateLabel(date)}
                        </span>
                        <div className="flex-1 h-px bg-stone-100" />
                      </div>

                      {/* Events for this date */}
                      {events.map((event, idx) => (
                        <EventCard
                          key={`${event.date}-${event.startTime}-${idx}`}
                          event={event}
                          isPast={past}
                        />
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
