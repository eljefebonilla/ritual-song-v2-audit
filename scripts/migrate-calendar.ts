/**
 * migrate-calendar.ts
 *
 * Migrates ministry-calendar.json → Supabase mass_events rows.
 *
 * Usage:
 *   npx tsx scripts/migrate-calendar.ts
 *   npx tsx scripts/migrate-calendar.ts --dry-run
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

// Load .env.local manually (no dotenv dependency needed)
const envPath = path.join(__dirname, "../.env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx);
    const value = trimmed.slice(eqIdx + 1);
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

const CALENDAR_PATH = path.join(__dirname, "../src/data/ministry-calendar.json");

interface CalendarEvent {
  date: string;
  dayOfWeek: string;
  startTime: string | null;
  endTime: string | null;
  startTime12h: string;
  endTime12h: string;
  title: string;
  community: string | null;
  eventType: string;
  hasMusic: boolean;
  isAutoMix: boolean;
  celebrant: string | null;
  location: string | null;
  notes: string | null;
  sidebarNote: string | null;
  occasionId: string | null;
}

interface CalendarWeek {
  weekId: string;
  liturgicalName: string;
  theme: string;
  season: string;
  seasonEmoji: string;
  sundayDate: string;
  events: CalendarEvent[];
}

interface MinistryCalendar {
  title: string;
  yearCycle: string;
  startDate: string;
  endDate: string;
  weeks: CalendarWeek[];
}

async function main() {
  const isDryRun = process.argv.includes("--dry-run");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const raw = fs.readFileSync(CALENDAR_PATH, "utf-8");
  const calendar: MinistryCalendar = JSON.parse(raw);

  console.log(`Calendar: ${calendar.title}`);
  console.log(`Year Cycle: ${calendar.yearCycle}`);
  console.log(`Date Range: ${calendar.startDate} – ${calendar.endDate}`);
  console.log(`Weeks: ${calendar.weeks.length}`);

  // Flatten all events with week context
  const rows: Record<string, unknown>[] = [];

  for (const week of calendar.weeks) {
    for (const event of week.events) {
      rows.push({
        title: event.title,
        event_date: event.date,
        start_time: event.startTime || null,
        end_time: event.endTime || null,
        start_time_12h: event.startTime12h || null,
        end_time_12h: event.endTime12h || null,
        location: event.location || "St. Monica Catholic Community",
        event_type: event.eventType,
        community: event.community || null,
        day_of_week: event.dayOfWeek,
        has_music: event.hasMusic,
        is_auto_mix: event.isAutoMix,
        celebrant: event.celebrant || null,
        notes: event.notes || null,
        sidebar_note: event.sidebarNote || null,
        occasion_id: event.occasionId || null,
        liturgical_week: week.weekId,
        liturgical_name: week.liturgicalName,
        season: week.season,
        season_emoji: week.seasonEmoji,
      });
    }
  }

  console.log(`\nTotal events to insert: ${rows.length}`);

  if (isDryRun) {
    console.log("\n--dry-run: No changes written to database.");
    // Show sample rows
    for (const row of rows.slice(0, 3)) {
      console.log(`  ${row.event_date} ${row.start_time_12h || "all day"} — ${row.title} (${row.community || "all"})`);
    }
    return;
  }

  // Clear existing events first
  console.log("\nClearing existing mass_events...");
  const { error: deleteError } = await supabase
    .from("mass_events")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000"); // Delete all rows

  if (deleteError) {
    console.error("Error clearing mass_events:", deleteError);
    process.exit(1);
  }

  // Insert in batches of 100
  const BATCH_SIZE = 100;
  let inserted = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from("mass_events").insert(batch);

    if (error) {
      console.error(`Error inserting batch at offset ${i}:`, error);
      process.exit(1);
    }

    inserted += batch.length;
    process.stdout.write(`\rInserted ${inserted}/${rows.length} events...`);
  }

  console.log(`\n\nMigration complete! ${inserted} events inserted.`);
}

main().catch(console.error);
