import CalendarShell from "@/components/calendar/CalendarShell";
import calendarData from "@/data/ministry-calendar.json";
import { createClient } from "@/lib/supabase/server";
import type {
  MinistryCalendar,
  CalendarWeek,
  CalendarEvent,
  CalendarEventType,
} from "@/lib/calendar-types";
import type { LiturgicalSeason } from "@/lib/types";

const SEASON_EMOJI: Record<string, string> = {
  advent: "\u{1F7E3}",
  christmas: "\u2B50",
  ordinary: "\u{1F7E2}",
  lent: "\u{1F7E4}",
  easter: "\u{1F7E1}",
  solemnity: "\u26AA",
  feast: "\u{1F534}",
};

/**
 * Transform flat Supabase mass_events rows into MinistryCalendar grouped format.
 */
function buildCalendarFromRows(
  rows: Record<string, unknown>[]
): MinistryCalendar {
  const weekMap = new Map<string, CalendarWeek>();

  for (const row of rows) {
    const weekId = (row.liturgical_week as string) || "unknown";

    if (!weekMap.has(weekId)) {
      const season = (row.season as string) || "ordinary";
      weekMap.set(weekId, {
        weekId,
        liturgicalName:
          (row.liturgical_name as string) || weekId.toUpperCase(),
        theme: "",
        season: season as LiturgicalSeason,
        seasonEmoji: SEASON_EMOJI[season] || "\u26AA",
        sundayDate: (row.event_date as string) || "",
        events: [],
      });
    }

    const week = weekMap.get(weekId)!;

    const event: CalendarEvent = {
      id: (row.id as string) || undefined,
      date: (row.event_date as string) || "",
      dayOfWeek: (row.day_of_week as string) || "",
      startTime: (row.start_time as string) || null,
      endTime: (row.end_time as string) || null,
      startTime12h: (row.start_time_12h as string) || "",
      endTime12h: (row.end_time_12h as string) || "",
      title: (row.title as string) || "",
      community: (row.community as string) || null,
      eventType: ((row.event_type as string) || "mass") as CalendarEventType,
      hasMusic: (row.has_music as boolean) ?? false,
      isAutoMix: (row.is_auto_mix as boolean) ?? false,
      celebrant: (row.celebrant as string) || null,
      location: (row.location as string) || null,
      notes: (row.notes as string) || null,
      sidebarNote: (row.sidebar_note as string) || null,
      occasionId: (row.occasion_id as string) || null,
    };

    week.events.push(event);

    // Use the earliest Sunday-like date as sundayDate for the week
    if (
      event.dayOfWeek === "Sunday" &&
      (!week.sundayDate || event.date < week.sundayDate)
    ) {
      week.sundayDate = event.date;
    }
  }

  const weeks = Array.from(weekMap.values()).sort((a, b) =>
    a.sundayDate.localeCompare(b.sundayDate)
  );

  // Derive date range
  const dates = weeks.map((w) => w.sundayDate).filter(Boolean);

  return {
    title: "Ministry Calendar",
    yearCycle: "C",
    startDate: dates[0] || "",
    endDate: dates[dates.length - 1] || "",
    weeks,
  };
}

export default async function CalendarPage() {
  let calendar: MinistryCalendar;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("mass_events")
      .select("*")
      .order("event_date", { ascending: true })
      .order("start_time", { ascending: true });

    if (!error && data && data.length > 0) {
      calendar = buildCalendarFromRows(data);
    } else {
      // Fallback to static JSON if Supabase is empty or errors
      calendar = calendarData as MinistryCalendar;
    }
  } catch {
    // Fallback to static JSON on any error
    calendar = calendarData as MinistryCalendar;
  }

  return (
    <div className="min-h-screen">
      <CalendarShell calendar={calendar} />
    </div>
  );
}
