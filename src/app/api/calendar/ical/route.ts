import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/calendar/ical — Generate RFC 5545 .ics feed
 * Query params:
 *   ?ensemble=Reflections  — filter by ensemble
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);

  let query = supabase
    .from("mass_events")
    .select("*")
    .order("event_date", { ascending: true })
    .order("start_time", { ascending: true });

  const ensemble = searchParams.get("ensemble");
  if (ensemble && ensemble !== "all") {
    query = query.eq("ensemble", ensemble);
  }

  const { data: events, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const calName = ensemble
    ? `St. Monica Music — ${ensemble}`
    : "St. Monica Music Ministry";

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//St Monica Catholic Community//Music Ministry//EN",
    `X-WR-CALNAME:${calName}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  for (const evt of events ?? []) {
    const uid = `${evt.id}@ritualsong.stmonica.net`;
    const summary = escapeIcal(evt.title);
    const location = evt.location ? escapeIcal(evt.location) : "";
    const description = buildDescription(evt);

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${uid}`);
    lines.push(`SUMMARY:${summary}`);

    if (evt.start_time && evt.event_date) {
      // Timed event
      const dtStart = toIcalDateTime(evt.event_date, evt.start_time);
      lines.push(`DTSTART:${dtStart}`);
      if (evt.end_time) {
        const dtEnd = toIcalDateTime(evt.event_date, evt.end_time);
        lines.push(`DTEND:${dtEnd}`);
      } else {
        // Default 1-hour duration
        const dtEnd = toIcalDateTime(evt.event_date, evt.start_time, 60);
        lines.push(`DTEND:${dtEnd}`);
      }
    } else if (evt.event_date) {
      // All-day event
      const dateStr = evt.event_date.replace(/-/g, "");
      lines.push(`DTSTART;VALUE=DATE:${dateStr}`);
      lines.push(`DTEND;VALUE=DATE:${dateStr}`);
    }

    if (location) lines.push(`LOCATION:${location}`);
    if (description) lines.push(`DESCRIPTION:${description}`);
    if (evt.ensemble) lines.push(`CATEGORIES:${escapeIcal(evt.ensemble)}`);

    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");

  const icsBody = lines.join("\r\n");

  return new NextResponse(icsBody, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="stmonica-music.ics"',
      "Cache-Control": "public, max-age=3600",
    },
  });
}

/** Convert "2025-11-30" + "17:30" to iCal DTSTART format "20251130T173000" */
function toIcalDateTime(date: string, time: string, addMinutes = 0): string {
  const [y, m, d] = date.split("-");
  const [h, min] = time.split(":");
  const totalMin = parseInt(h) * 60 + parseInt(min) + addMinutes;
  const hours = Math.floor(totalMin / 60) % 24;
  const mins = totalMin % 60;
  return `${y}${m}${d}T${pad(hours)}${pad(mins)}00`;
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

/** Escape text for iCal: commas, semicolons, newlines */
function escapeIcal(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

/** Build a description string from event metadata */
function buildDescription(evt: Record<string, unknown>): string {
  const parts: string[] = [];
  if (evt.ensemble) parts.push(`Ensemble: ${evt.ensemble}`);
  if (evt.celebrant) parts.push(`Celebrant: ${evt.celebrant}`);
  if (evt.event_type) parts.push(`Type: ${evt.event_type}`);
  if (evt.has_music) parts.push("Live music");
  if (evt.notes) parts.push(`${evt.notes}`);
  return escapeIcal(parts.join(" | "));
}
