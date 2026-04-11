/**
 * Upload parish calendar events (masses, weddings, funerals, etc.)
 * to the mass_events table in Supabase.
 *
 * Usage: npx tsx scripts/upload-parish-calendar.ts
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Map input event types to DB enum values
function mapEventType(type: string): string {
  const map: Record<string, string> = {
    Mass: "mass",
    Wedding: "wedding",
    Funeral: "funeral",
    Baptisms: "sacrament",
    Rosary: "devotion",
    Special: "special",
    Liturgy: "other",
  };
  return map[type] || "other";
}

// Generate a human-readable title from event data
function generateTitle(ev: RawEvent): string {
  const type = ev.type;
  const time = formatTime12h(ev.time);

  if (type === "Mass") {
    if (ev.intention && ev.intention !== "No Mass Intentions") {
      return `${time} Mass`;
    }
    return `${time} Mass`;
  }
  if (type === "Wedding") {
    return `Wedding: ${ev.intention || "TBD"}`;
  }
  if (type === "Funeral") {
    return `Funeral: ${ev.intention || "TBD"}`;
  }
  if (type === "Baptisms") {
    return "Baptisms";
  }
  if (type === "Rosary") {
    return `Rosary: ${ev.intention || ""}`.trim();
  }
  if (type === "Liturgy") {
    return ev.notes || "Liturgy";
  }
  if (type === "Special") {
    return ev.intention || "Special Event";
  }
  return `${type}: ${ev.intention || ""}`.trim();
}

function formatTime12h(time24: string): string {
  const [h, m] = time24.split(":").map(Number);
  const ampm = h >= 12 ? "pm" : "am";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return m === 0 ? `${h12}${ampm}` : `${h12}:${String(m).padStart(2, "0")}${ampm}`;
}

function getDayOfWeek(dateStr: string): string {
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return days[new Date(dateStr + "T12:00:00").getDay()];
}

interface RawEvent {
  date: string;
  time: string;
  celebrant: string | null;
  type: string;
  intention: string | null;
  notes: string | null;
  location: string | null;
}

const events: RawEvent[] = [
  {"date":"2026-04-06","time":"07:00","celebrant":"Fr. Vince","type":"Mass","intention":"No Mass Intentions","notes":"Duty & 5:30pm Confessions: Fr. Eusebio | Schools on Easter Vacation | Fr. David departs early","location":null},
  {"date":"2026-04-06","time":"12:10","celebrant":"Fr. Eusebio","type":"Mass","intention":"Fran Curry\u2020","notes":null,"location":null},
  {"date":"2026-04-07","time":"07:00","celebrant":"Fr. Park","type":"Mass","intention":"Patricia Linda Widiker\u2020","notes":"Duty & 5:30pm Confessions: Fr. Vince | Schools on Easter Vacation | Fr. David returns 4/9 - Late","location":null},
  {"date":"2026-04-07","time":"12:10","celebrant":"Fr. Vince","type":"Mass","intention":"Mary Ann Gallati\u2020","notes":null,"location":null},
  {"date":"2026-04-08","time":"07:00","celebrant":"Fr. Vince","type":"Mass","intention":"Maria Del Carmen","notes":"Duty & 5:30pm Confessions: Fr. Park | Schools on Easter Vacation | Fr. David returns 4/9 - Late","location":null},
  {"date":"2026-04-08","time":"12:10","celebrant":"Fr. Park","type":"Mass","intention":"Charlie O\u2019Keefe\u2020","notes":null,"location":null},
  {"date":"2026-04-09","time":"07:00","celebrant":"Fr. Park","type":"Mass","intention":"Jerry Jacobs\u2020","notes":"Duty & 5:30pm Confessions: Fr. Eusebio | Schools on Easter Vacation | Fr. David returns Late","location":null},
  {"date":"2026-04-09","time":"12:10","celebrant":"Fr. Eusebio","type":"Mass","intention":"Mary Cruz\u2020","notes":null,"location":null},
  {"date":"2026-04-10","time":"07:00","celebrant":"Fr. Eusebio","type":"Mass","intention":"Mary Niland\u2020","notes":"Duty & 5:30pm Confessions: Fr. Park | Schools on Easter Vacation","location":null},
  {"date":"2026-04-10","time":"12:10","celebrant":"Fr. Park","type":"Mass","intention":"Geraldine Duignan","notes":null,"location":null},
  {"date":"2026-04-10","time":"16:00","celebrant":"Msgr. Torgerson","type":"Wedding","intention":"Samano & Sandoval","notes":null,"location":null},
  {"date":"2026-04-11","time":"08:00","celebrant":"Fr. Park","type":"Mass","intention":"Stephanie Metter Nemec\u2020","notes":"Duty & 4:30pm Confessions: Fr. Eusebio | Archbishop Awards Dinner \u2013 Beverly Hilton","location":null},
  {"date":"2026-04-11","time":"11:00","celebrant":"Msgr. Torgerson","type":"Wedding","intention":"Nguyen & Hu","notes":null,"location":null},
  {"date":"2026-04-11","time":"13:00","celebrant":"Fr. Park","type":"Wedding","intention":"Nusinow & Bacalao","notes":null,"location":null},
  {"date":"2026-04-11","time":"17:30","celebrant":"Fr. Eusebio","type":"Mass","intention":"Charlotte Schmidt\u2020","notes":null,"location":null},
  {"date":"2026-04-12","time":"07:30","celebrant":"Fr. Vince","type":"Mass","intention":"Matthew Pisani\u2020","notes":"Duty: Fr. Park (No Confessions) | Fr. Eusebio 2nd Sunday Adoration after 11:30am Mass in Bessette Chapel","location":null},
  {"date":"2026-04-12","time":"09:30","celebrant":"Msgr. Torgerson","type":"Mass","intention":"Frank Borgia\u2020","notes":null,"location":null},
  {"date":"2026-04-12","time":"11:30","celebrant":"Fr. David","type":"Mass","intention":"St. Monica Parishioners","notes":null,"location":null},
  {"date":"2026-04-12","time":"13:15","celebrant":"Deacon Kevin","type":"Baptisms","intention":"General Baptisms","notes":null,"location":null},
  {"date":"2026-04-12","time":"15:15","celebrant":"Msgr. Torgerson","type":"Liturgy","intention":null,"notes":"Liturgy (pb)","location":null},
  {"date":"2026-04-12","time":"17:30","celebrant":"Fr. Park","type":"Mass","intention":"Stephanie Metter Nemec\u2020","notes":null,"location":null},
  {"date":"2026-04-13","time":"07:00","celebrant":"Fr. Vince","type":"Mass","intention":"No Mass Intentions","notes":"Duty & 5:30pm Confessions: Fr. Eusebio","location":null},
  {"date":"2026-04-13","time":"12:10","celebrant":"Fr. Eusebio","type":"Mass","intention":"No Mass Intentions","notes":null,"location":null},
  {"date":"2026-04-14","time":"07:00","celebrant":"Fr. Park","type":"Mass","intention":"John O\u2019Donnell\u2020","notes":"Duty & 5:30pm Confessions: Fr. Vince","location":null},
  {"date":"2026-04-14","time":"12:10","celebrant":"Fr. Vince","type":"Mass","intention":"Massimo Ludovisi\u2020","notes":null,"location":null},
  {"date":"2026-04-15","time":"07:00","celebrant":"Fr. Vince","type":"Mass","intention":"Jim Oss\u2020","notes":"Duty & 5:30pm Confessions: Fr. Park","location":null},
  {"date":"2026-04-15","time":"12:10","celebrant":"Fr. Park","type":"Mass","intention":"Timothy Gallati","notes":null,"location":null},
  {"date":"2026-04-16","time":"07:00","celebrant":"Fr. Park","type":"Mass","intention":"Richard Gurry\u2020","notes":"Duty & 5:30pm Confessions: Fr. David","location":null},
  {"date":"2026-04-16","time":"12:10","celebrant":"Fr. David","type":"Mass","intention":"Soledad Sanaigo\u2020","notes":null,"location":null},
  {"date":"2026-04-17","time":"07:00","celebrant":"Fr. Eusebio","type":"Mass","intention":"Grant Ramey\u2020","notes":"Duty & 5:30pm Confessions: Fr. Park | Fr. Eusebio - 3rd Friday Adoration (7:30am\u20138:30am & 7pm\u20138pm)","location":null},
  {"date":"2026-04-17","time":"10:10","celebrant":"Msgr. Torgerson","type":"Special","intention":"TK & Kinder Mass with 5 Baptisms","notes":null,"location":null},
  {"date":"2026-04-17","time":"12:10","celebrant":"Fr. Park","type":"Mass","intention":"Jim Oss\u2020","notes":null,"location":null},
  {"date":"2026-04-17","time":"19:00","celebrant":null,"type":"Rosary","intention":"Gasca","notes":null,"location":null},
  {"date":"2026-04-18","time":"08:00","celebrant":"Fr. Park","type":"Mass","intention":"Fr. Willy Raymond, CSC\u2020","notes":"Mass in Bessette Chapel | Duty & 4:30pm Confessions: Fr. Park | Fr. Vince departs for Ava Maria Press Board \u2013 returns late on 4/22","location":"Bessette Chapel"},
  {"date":"2026-04-18","time":"08:30","celebrant":"Msgr. Torgerson","type":"Funeral","intention":"Gasca","notes":null,"location":null},
  {"date":"2026-04-18","time":"10:30","celebrant":"Msgr. Torgerson","type":"Liturgy","intention":"Savitzky","notes":"Liturgy (pb)","location":null},
  {"date":"2026-04-18","time":"13:00","celebrant":"Visiting Priest","type":"Wedding","intention":"Knona & Alugbue","notes":null,"location":null},
  {"date":"2026-04-18","time":"15:00","celebrant":"Fr. Eusebio","type":"Wedding","intention":"Ellison & Halpin","notes":null,"location":null},
  {"date":"2026-04-18","time":"17:30","celebrant":"Fr. Eusebio","type":"Mass","intention":"Cecilia Nguyen Thican\u2020","notes":null,"location":null},
  {"date":"2026-04-19","time":"07:30","celebrant":"Fr. Park","type":"Mass","intention":"Soledad Agbayani\u2020","notes":"Duty: Fr. Eusebio (No Confessions) | Fr. Vince returns 4/22 - Late | Confirmation Rehearsal 12:30pm\u20132pm","location":null},
  {"date":"2026-04-19","time":"09:30","celebrant":"Msgr. Torgerson","type":"Mass","intention":"Ana Lydia Monaco","notes":null,"location":null},
  {"date":"2026-04-19","time":"11:30","celebrant":"Fr. Eusebio","type":"Mass","intention":"Mary Therese Ferro\u2020","notes":null,"location":null},
  {"date":"2026-04-19","time":"17:30","celebrant":"Fr. David","type":"Mass","intention":"St. Monica Parishioners","notes":null,"location":null},
];

async function upload() {
  // First check for existing events in this date range to avoid duplicates
  const { data: existing, error: fetchErr } = await supabase
    .from("mass_events")
    .select("id, event_date, start_time, event_type")
    .gte("event_date", "2026-04-06")
    .lte("event_date", "2026-04-19");

  if (fetchErr) {
    console.error("Error fetching existing events:", fetchErr.message);
    process.exit(1);
  }

  console.log(`Found ${existing?.length || 0} existing events in 2026-04-06 to 2026-04-19`);

  // Build lookup set for dedup: "date|time|type"
  const existingSet = new Set(
    (existing || []).map((e) => `${e.event_date}|${e.start_time}|${e.event_type}`)
  );

  const rows = events.map((ev) => {
    const eventType = mapEventType(ev.type);
    const title = generateTitle(ev);
    const time12h = formatTime12h(ev.time);
    const dayOfWeek = getDayOfWeek(ev.date);

    return {
      title,
      description: ev.intention && ev.intention !== "No Mass Intentions" ? ev.intention : null,
      event_date: ev.date,
      start_time: ev.time + ":00",
      start_time_12h: time12h,
      day_of_week: dayOfWeek,
      event_type: eventType,
      celebrant: ev.celebrant,
      notes: ev.notes,
      location: ev.location || "St. Monica Catholic Community",
      has_music: false,
      is_auto_mix: false,
      needs_volunteers: false,
    };
  });

  // Filter out duplicates
  const newRows = rows.filter(
    (r) => !existingSet.has(`${r.event_date}|${r.start_time}|${r.event_type}`)
  );

  if (newRows.length === 0) {
    console.log("All events already exist. Nothing to upload.");
    return;
  }

  console.log(`Uploading ${newRows.length} new events (${rows.length - newRows.length} duplicates skipped)...`);

  const { data, error } = await supabase
    .from("mass_events")
    .insert(newRows)
    .select("id, title, event_date, start_time");

  if (error) {
    console.error("Upload error:", error.message);
    process.exit(1);
  }

  console.log(`Uploaded ${data.length} events:`);
  for (const row of data) {
    console.log(`  ${row.event_date} ${row.start_time} - ${row.title}`);
  }
}

upload().catch(console.error);
