import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rowToLiturgicalDay } from "@/lib/liturgical-helpers";
import type { LiturgicalDay } from "@/lib/types";
import type { CalendarEvent, CalendarEventType } from "@/lib/calendar-types";
import TodayShell from "@/components/today/TodayShell";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  // Get today's date in Pacific time
  const now = new Date();
  const pacificDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now); // "YYYY-MM-DD"

  // Fetch today's liturgical day, today's mass events, and next major feast — all in parallel
  const [litResult, eventsResult, nextFeastResult] = await Promise.all([
    adminClient
      .from("liturgical_days")
      .select("*")
      .eq("date", pacificDate),
    supabase
      .from("mass_events")
      .select("*")
      .eq("event_date", pacificDate)
      .order("start_time", { ascending: true }),
    adminClient
      .from("liturgical_days")
      .select("date, celebration_name, rank, color_primary")
      .gt("date", pacificDate)
      .in("rank", ["solemnity", "feast"])
      .order("date", { ascending: true })
      .limit(1),
  ]);

  // Process liturgical day
  let liturgicalDay: LiturgicalDay | null = null;
  if (!litResult.error && litResult.data && litResult.data.length > 0) {
    // Prefer the __universal__ entry
    const universal = litResult.data.find(
      (d: Record<string, unknown>) => d.ecclesiastical_province === "__universal__"
    );
    liturgicalDay = rowToLiturgicalDay(universal || litResult.data[0]);
  }

  // Process mass events
  const massEvents: CalendarEvent[] = [];
  if (!eventsResult.error && eventsResult.data) {
    for (const row of eventsResult.data) {
      massEvents.push({
        id: row.id as string,
        date: row.event_date as string,
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
      });
    }
  }

  // Process next major feast
  let nextFeast: { date: string; name: string; daysUntil: number } | null = null;
  if (!nextFeastResult.error && nextFeastResult.data && nextFeastResult.data.length > 0) {
    const feast = nextFeastResult.data[0];
    const feastDate = new Date(feast.date + "T12:00:00");
    const todayDate = new Date(pacificDate + "T12:00:00");
    const daysUntil = Math.round(
      (feastDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    nextFeast = {
      date: feast.date as string,
      name: feast.celebration_name as string,
      daysUntil,
    };
  }

  return (
    <TodayShell
      date={pacificDate}
      liturgicalDay={liturgicalDay}
      massEvents={massEvents}
      nextFeast={nextFeast}
    />
  );
}
