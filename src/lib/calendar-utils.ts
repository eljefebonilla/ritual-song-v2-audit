// Date and filtering utilities for the Ministry Calendar

import type { CalendarWeek, CalendarEvent } from "./calendar-types";
import type { CommunityId } from "./grid-types";

/**
 * Returns the next upcoming Sunday (or today if it's Sunday) as an ISO date string.
 */
export function getNextSunday(): string {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon, ...
  const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
  const nextSunday = new Date(today);
  nextSunday.setDate(today.getDate() + daysUntilSunday);
  return nextSunday.toISOString().split("T")[0];
}

/**
 * Returns today's date as an ISO date string.
 */
export function getToday(): string {
  return new Date().toISOString().split("T")[0];
}

/**
 * Checks if a date string is in the past (before today).
 */
export function isDatePast(date: string): boolean {
  return date < getToday();
}

/**
 * Checks if a week's Sunday date is in the past.
 */
export function isWeekPast(week: CalendarWeek): boolean {
  return isDatePast(week.sundayDate);
}

/**
 * Filters events in a week by community. "all" returns everything.
 */
export function filterEventsByCommunity(
  events: CalendarEvent[],
  community: CommunityId | "all"
): CalendarEvent[] {
  if (community === "all") return events;
  return events.filter(
    (e) =>
      e.community === null || // non-community events always show
      e.community?.toLowerCase() === community
  );
}

/**
 * Filters weeks: hides past weeks and admin-hidden weeks.
 */
export function getVisibleWeeks(
  weeks: CalendarWeek[],
  options: {
    showPast: boolean;
    hiddenWeekIds: string[];
    isAdmin: boolean;
  }
): CalendarWeek[] {
  let filtered = weeks;

  // Filter past weeks
  if (!options.showPast) {
    const today = getToday();
    filtered = filtered.filter((w) => {
      // Keep week if any event is today or future
      return w.events.some((e) => e.date >= today) || w.sundayDate >= today;
    });
  }

  // Filter admin-hidden weeks (non-admins don't see them at all)
  if (!options.isAdmin && options.hiddenWeekIds.length > 0) {
    filtered = filtered.filter((w) => !options.hiddenWeekIds.includes(w.weekId));
  }

  return filtered;
}

/**
 * Groups events by date within a week.
 */
export function groupEventsByDate(
  events: CalendarEvent[]
): Map<string, CalendarEvent[]> {
  const groups = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const existing = groups.get(event.date) || [];
    existing.push(event);
    groups.set(event.date, existing);
  }
  return groups;
}

/**
 * Gets events for a specific month from all weeks.
 */
export function getEventsForMonth(
  weeks: CalendarWeek[],
  year: number,
  month: number // 0-indexed
): Map<number, CalendarEvent[]> {
  const dayMap = new Map<number, CalendarEvent[]>();

  for (const week of weeks) {
    for (const event of week.events) {
      const eventDate = new Date(event.date + "T12:00:00");
      if (eventDate.getFullYear() === year && eventDate.getMonth() === month) {
        const day = eventDate.getDate();
        const existing = dayMap.get(day) || [];
        existing.push(event);
        dayMap.set(day, existing);
      }
    }
  }

  return dayMap;
}

/**
 * Gets the season color class for a liturgical season.
 */
export function getSeasonColorClass(season: string): string {
  const colors: Record<string, string> = {
    advent: "bg-advent",
    christmas: "bg-christmas",
    lent: "bg-lent",
    easter: "bg-easter",
    ordinary: "bg-ordinary",
    solemnity: "bg-solemnity",
    feast: "bg-feast",
    "holy-week": "bg-solemnity",
    triduum: "bg-solemnity",
  };
  return colors[season] || "bg-stone-400";
}

/**
 * Gets the season text color class.
 */
export function getSeasonTextClass(season: string): string {
  const colors: Record<string, string> = {
    advent: "text-advent",
    christmas: "text-christmas",
    lent: "text-lent",
    easter: "text-easter",
    ordinary: "text-ordinary",
    solemnity: "text-solemnity",
    feast: "text-feast",
    "holy-week": "text-solemnity",
    triduum: "text-solemnity",
  };
  return colors[season] || "text-stone-500";
}

/**
 * Gets the season border color class for a left-border accent.
 */
export function getSeasonBorderClass(season: string): string {
  const colors: Record<string, string> = {
    advent: "border-l-advent",
    christmas: "border-l-christmas",
    lent: "border-l-lent",
    easter: "border-l-easter",
    ordinary: "border-l-ordinary",
    solemnity: "border-l-solemnity",
    feast: "border-l-feast",
    "holy-week": "border-l-solemnity",
    triduum: "border-l-solemnity",
  };
  return colors[season] || "border-l-stone-400";
}

/**
 * Formats a date string to a human-readable label.
 */
export function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr + "T12:00:00");
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/**
 * Formats a date for a month view header.
 */
export function formatMonthYear(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

/**
 * Gets the community display color for badges.
 */
export function getCommunityColor(community: string | null): string {
  if (!community) return "bg-stone-200 text-stone-600";
  const colors: Record<string, string> = {
    reflections: "bg-purple-100 text-purple-700",
    foundations: "bg-blue-100 text-blue-700",
    generations: "bg-green-100 text-green-700",
    heritage: "bg-amber-100 text-amber-700",
    elevations: "bg-rose-100 text-rose-700",
  };
  return colors[community.toLowerCase()] || "bg-stone-200 text-stone-600";
}
