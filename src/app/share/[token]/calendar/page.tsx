import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import usccbData from "@/data/usccb-2026.json";
import CalendarV2Shell from "@/components/calendar-v2/CalendarV2Shell";
import type { USCCBDay } from "@/components/calendar-v2/types";
import { getLiturgicalYearRange } from "@/lib/liturgical-year";
import { getSharedView } from "@/lib/shared-view";

export const dynamic = "force-dynamic";

interface MassEventRow {
  id: string;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  start_time_12h: string | null;
  end_time_12h: string | null;
  title: string;
  ensemble: string | null;
  event_type: string;
  has_music: boolean;
  celebrant: string | null;
  location: string | null;
  notes: string | null;
  occasion_id: string | null;
  sidebar_note: string | null;
  is_auto_mix: boolean;
}

interface BookingRow {
  mass_event_id: string;
  confirmation: string;
  ministry_roles: { name: string };
}

function formatTime12h(time24: string | null, time12h: string | null): string {
  if (time12h) return time12h;
  if (!time24) return "";
  const [h, m] = time24.split(":").map(Number);
  const suffix = h >= 12 ? "p" : "a";
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour}:${String(m).padStart(2, "0")}${suffix}`;
}

interface Props {
  params: Promise<{ token: string }>;
}

export default async function ShareCalendarPage({ params }: Props) {
  const { token } = await params;
  const view = await getSharedView(token);
  if (!view || !view.config.types.includes("calendar")) notFound();

  const supabase = createAdminClient();
  const dateRange = getLiturgicalYearRange();

  const { data: massEventsRaw } = await supabase
    .from("mass_events")
    .select("*")
    .gte("event_date", dateRange.start)
    .lte("event_date", dateRange.end)
    .order("event_date", { ascending: true })
    .order("start_time", { ascending: true });

  // Public share view: DO NOT expose booking slot person names (PII).
  // Only fetch role/confirmation summary. The recipient is an unauthenticated
  // member of the public, not a logged-in choir member, so no roster leaks.
  const { data: bookingsRaw } = await supabase
    .from("booking_slots")
    .select("mass_event_id, confirmation, ministry_roles(name)")
    .neq("confirmation", "declined");

  const massEvents = ((massEventsRaw as MassEventRow[] | null) ?? []).map((e) => ({
    id: e.id,
    date: e.event_date,
    startTime: e.start_time,
    endTime: e.end_time,
    startTime12h: formatTime12h(e.start_time, e.start_time_12h),
    endTime12h: formatTime12h(e.end_time, e.end_time_12h),
    title: e.title,
    ensemble: e.ensemble,
    eventType: e.event_type,
    hasMusic: e.has_music,
    celebrant: e.celebrant,
    location: e.location,
    notes: e.notes,
    occasionId: e.occasion_id ?? null,
    sidebarNote: e.sidebar_note ?? null,
    isAutoMix: e.is_auto_mix ?? false,
  }));

  // Share view: strip personName. The calendar will still show role badges
  // and confirmation counts, but not who is assigned.
  const bookings = ((bookingsRaw as unknown as BookingRow[] | null) ?? []).map((b) => ({
    massEventId: b.mass_event_id,
    personName: "",
    roleName: (b.ministry_roles as unknown as { name: string })?.name ?? "Unknown",
    confirmation: b.confirmation,
  }));

  const liturgicalDays = (usccbData as USCCBDay[]).filter((d) => d.date);

  return (
    <div className="h-full overflow-auto pt-2">
      <CalendarV2Shell
        liturgicalDays={liturgicalDays}
        massEvents={massEvents}
        bookings={bookings}
        dateRange={dateRange}
      />
    </div>
  );
}
