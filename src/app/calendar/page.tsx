import CalendarShell from "@/components/calendar/CalendarShell";
import calendarData from "@/data/ministry-calendar.json";
import type { MinistryCalendar } from "@/lib/calendar-types";

export default function CalendarPage() {
  const calendar = calendarData as MinistryCalendar;

  return (
    <div className="min-h-screen">
      <CalendarShell calendar={calendar} />
    </div>
  );
}
