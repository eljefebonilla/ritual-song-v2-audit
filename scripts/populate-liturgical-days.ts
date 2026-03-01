/**
 * Populate liturgical_days table from parsed USCCB calendar JSON
 *
 * Reads src/data/usccb-2026.json and usccb-2027.json,
 * computes derived fields (Gloria, Alleluia, season),
 * matches occasion IDs from date-index.json,
 * and upserts to Supabase.
 *
 * Run: npx tsx scripts/populate-liturgical-days.ts
 * Prereq: Run parse-usccb-calendar.ts first to generate the JSON files
 */
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

// ============================================================
// Types (mirror the parsed JSON structure)
// ============================================================

interface ParsedDay {
  date: string;
  dayOfWeek: string;
  celebrationName: string;
  rank: string;
  colorPrimary: string;
  colorSecondary: string | null;
  colorAlternate: string | null;
  allColors: string[];
  citations: string;
  lectionaryNumber: number | null;
  psalterWeek: string | null;
  optionalMemorials: string[];
  isHolyday: boolean;
  isBVM: boolean;
  isUSA: boolean;
  isTransferred: boolean;
  ecclesiasticalProvince: string | null;
  specialReadingSets: Array<{
    label: string;
    citations: string;
    lectionaryNumber: number | null;
  }>;
  alternateReadings: string | null;
  notes: string[];
}

interface DateIndexEntry {
  date: string;
  occasionId: string;
  season: string;
  name: string;
}

// ============================================================
// Supabase client (uses env vars or .env.local)
// ============================================================

function getSupabaseClient() {
  // Try loading from .env.local if running locally
  const envPath = path.resolve(__dirname, "../.env.local");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf-8");
    for (const line of envContent.split("\n")) {
      const match = line.match(/^([^#=]+)=(.+)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim();
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  }

  const url =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      `Missing Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local`
    );
  }

  return createClient(url, key, { auth: { persistSession: false } });
}

// ============================================================
// Season computation
// ============================================================

interface SeasonBoundary {
  label: string;
  season: string;
  start: string; // YYYY-MM-DD inclusive
  end: string; // YYYY-MM-DD inclusive
}

/**
 * Compute season boundaries for a liturgical year.
 * A liturgical year starts on the First Sunday of Advent.
 */
function computeSeasonBoundaries(
  firstAdventDate: string,
  ashWednesday: string,
  easterSunday: string,
  pentecostSunday: string,
  nextFirstAdvent: string
): SeasonBoundary[] {
  // Helpers
  const addDays = (dateStr: string, days: number): string => {
    const d = new Date(dateStr + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().split("T")[0];
  };

  // Christmas is always Dec 25
  const adventYear = parseInt(firstAdventDate.slice(0, 4));
  const christmas = `${adventYear}-12-25`;

  // Baptism of the Lord: Sunday after Epiphany (Jan 6)
  // If Jan 6 is Sunday, Baptism is the next day (Monday Jan 7)
  // In the US, Epiphany is transferred to the Sunday between Jan 2-8
  // Baptism of the Lord is the Sunday after Epiphany Sunday
  // For simplicity, we'll use the day before Ordinary Time starts
  // Ordinary Time Part 1 starts the day after Baptism of the Lord

  // Monday after Baptism of the Lord = start of Ordinary Time Part 1
  // This is typically around Jan 12-13
  // We'll detect it from the parsed data instead

  const boundaries: SeasonBoundary[] = [
    {
      label: "Advent",
      season: "advent",
      start: firstAdventDate,
      end: addDays(christmas, -1), // Dec 24
    },
    {
      label: "Christmas",
      season: "christmas",
      start: christmas,
      end: "", // will be set below — ends at Baptism of the Lord
    },
    {
      label: "Ordinary Time (Part 1)",
      season: "ordinary",
      start: "", // day after Baptism of the Lord
      end: addDays(ashWednesday, -1),
    },
    {
      label: "Lent",
      season: "lent",
      start: ashWednesday,
      end: addDays(easterSunday, -1), // Holy Saturday (Triduum is technically its own thing)
    },
    {
      label: "Easter",
      season: "easter",
      start: easterSunday,
      end: pentecostSunday, // Pentecost is the last day of Easter season
    },
    {
      label: "Ordinary Time (Part 2)",
      season: "ordinary",
      start: addDays(pentecostSunday, 1),
      end: addDays(nextFirstAdvent, -1),
    },
  ];

  return boundaries;
}

function getSeasonForDate(
  date: string,
  boundaries: SeasonBoundary[]
): string {
  for (const b of boundaries) {
    if (!b.start || !b.end) continue;
    if (date >= b.start && date <= b.end) {
      return b.season;
    }
  }
  return "ordinary"; // fallback
}

// ============================================================
// Gloria / Alleluia computation
// ============================================================

/**
 * Gloria rules:
 * - YES: All Solemnities, all Feasts, all Sundays
 * - EXCEPT: Advent Sundays (no Gloria) and Lent Sundays (no Gloria)
 * - Solemnities during Advent/Lent (Immaculate Conception, St. Joseph, Annunciation) DO get Gloria
 * - NO: weekday Memorials, all weekdays
 */
function computeGloria(
  rank: string,
  season: string,
  dayOfWeek: string
): boolean {
  const isSunday = dayOfWeek.toUpperCase() === "SUN";

  if (rank === "solemnity") return true;
  if (rank === "feast") return true;
  if (isSunday || rank === "sunday") {
    // Sundays get Gloria EXCEPT during Advent and Lent
    return season !== "advent" && season !== "lent";
  }
  return false;
}

/**
 * Alleluia rules:
 * - NO: Ash Wednesday through Holy Saturday (inclusive)
 * - YES: All other days
 */
function computeAlleluia(date: string, ashWednesday: string, holySaturday: string): boolean {
  return date < ashWednesday || date > holySaturday;
}

// ============================================================
// Saint extraction
// ============================================================

function extractSaintInfo(entry: ParsedDay): {
  saintName: string | null;
  saintTitle: string | null;
} {
  const name = entry.celebrationName;

  // Skip if it's a Sunday, weekday, or major celebration
  if (
    name.includes("SUNDAY") ||
    name.includes("Weekday") ||
    name.includes("NATIVITY") ||
    name.includes("EPIPHANY") ||
    name.includes("ASCENSION") ||
    name.includes("PENTECOST") ||
    name.includes("EASTER") ||
    name.includes("Octave") ||
    name.includes("CONCEPTION") ||
    name.includes("HOLY BODY") ||
    name.includes("SACRED HEART") ||
    name.includes("KING OF THE UNIVERSE") ||
    name.includes("ALL SAINTS") ||
    name.includes("All Souls") ||
    name.includes("Holy Week") ||
    name.includes("Ash Wednesday") ||
    name.includes("Christmas Weekday") ||
    name.includes("Advent Weekday") ||
    name.includes("Lenten Weekday") ||
    name.includes("Easter Weekday")
  ) {
    // Check optional memorials for saints
    if (entry.optionalMemorials.length > 0) {
      const first = entry.optionalMemorials[0];
      return parseSaintName(first);
    }
    return { saintName: null, saintTitle: null };
  }

  return parseSaintName(name);
}

function parseSaintName(text: string): {
  saintName: string | null;
  saintTitle: string | null;
} {
  // Remove USA: prefix
  let clean = text.replace(/^USA:\s*/, "");

  // Patterns: "Saint Francis Xavier, Priest" or "Saints Timothy and Titus, Bishops"
  // or "The Presentation of the Lord" (not a saint)
  if (
    !clean.startsWith("Saint") &&
    !clean.startsWith("Blessed") &&
    !clean.includes("Virgin Mary") &&
    !clean.includes("Our Lady") &&
    !clean.includes("Our Lord")
  ) {
    return { saintName: null, saintTitle: null };
  }

  // Split on comma to get name and title
  const commaIdx = clean.indexOf(",");
  if (commaIdx > 0) {
    return {
      saintName: clean.slice(0, commaIdx).trim(),
      saintTitle: clean.slice(commaIdx + 1).trim(),
    };
  }

  return { saintName: clean, saintTitle: null };
}

// ============================================================
// Main population logic
// ============================================================

interface CalendarYearConfig {
  jsonFile: string;
  yearLabel: string;
  liturgicalYearLabel: string; // "2025-2026"
  sundayCycle: string;
  weekdayCycle: string;
  firstAdvent: string;
  ashWednesday: string;
  easterSunday: string;
  pentecostSunday: string;
  nextFirstAdvent: string;
  holySaturday: string;
}

const CALENDAR_CONFIGS: CalendarYearConfig[] = [
  {
    jsonFile: "usccb-2026.json",
    yearLabel: "2026",
    liturgicalYearLabel: "2025-2026",
    sundayCycle: "A",
    weekdayCycle: "2",
    firstAdvent: "2025-11-30",
    ashWednesday: "2026-02-18",
    easterSunday: "2026-04-05",
    pentecostSunday: "2026-05-24",
    nextFirstAdvent: "2026-11-29",
    holySaturday: "2026-04-04",
  },
  {
    jsonFile: "usccb-2027.json",
    yearLabel: "2027",
    liturgicalYearLabel: "2026-2027",
    sundayCycle: "B",
    weekdayCycle: "1",
    firstAdvent: "2026-11-29",
    ashWednesday: "2027-02-10",
    easterSunday: "2027-03-28",
    pentecostSunday: "2027-05-16",
    nextFirstAdvent: "2027-11-28",
    holySaturday: "2027-03-27",
  },
];

async function main() {
  const supabase = getSupabaseClient();

  // Load date-index for occasion matching
  const dateIndexPath = path.resolve(
    __dirname,
    "../src/data/date-index.json"
  );
  const dateIndex: DateIndexEntry[] = JSON.parse(
    fs.readFileSync(dateIndexPath, "utf-8")
  );
  const dateToOccasion = new Map<string, DateIndexEntry>();
  for (const entry of dateIndex) {
    dateToOccasion.set(entry.date, entry);
  }

  for (const config of CALENDAR_CONFIGS) {
    console.log(`\nProcessing ${config.yearLabel} calendar...`);

    // Load parsed JSON
    const jsonPath = path.resolve(
      __dirname,
      `../src/data/${config.jsonFile}`
    );
    const entries: ParsedDay[] = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
    console.log(`  Loaded ${entries.length} entries`);

    // Compute season boundaries
    const boundaries = computeSeasonBoundaries(
      config.firstAdvent,
      config.ashWednesday,
      config.easterSunday,
      config.pentecostSunday,
      config.nextFirstAdvent
    );

    // Fix Christmas season end date — find Baptism of the Lord
    const baptismEntry = entries.find(
      (e) =>
        e.celebrationName.includes("BAPTISM OF THE LORD") &&
        e.date > config.firstAdvent
    );
    if (baptismEntry) {
      // Christmas season ends on Baptism of the Lord
      const christmasBoundary = boundaries.find(
        (b) => b.season === "christmas"
      );
      if (christmasBoundary) {
        christmasBoundary.end = baptismEntry.date;
      }
      // Ordinary Time Part 1 starts the day after
      const ordPart1 = boundaries.find(
        (b) => b.label === "Ordinary Time (Part 1)"
      );
      if (ordPart1) {
        const baptismDate = new Date(baptismEntry.date + "T12:00:00Z");
        baptismDate.setUTCDate(baptismDate.getUTCDate() + 1);
        ordPart1.start = baptismDate.toISOString().split("T")[0];
      }
    }

    console.log("  Season boundaries:");
    for (const b of boundaries) {
      console.log(`    ${b.label}: ${b.start} to ${b.end}`);
    }

    // Build rows for upsert
    const rows: Record<string, unknown>[] = [];

    for (const entry of entries) {
      const season = getSeasonForDate(entry.date, boundaries);
      const gloria = computeGloria(entry.rank, season, entry.dayOfWeek);
      const alleluia = computeAlleluia(
        entry.date,
        config.ashWednesday,
        config.holySaturday
      );

      // Occasion matching
      const occasion = dateToOccasion.get(entry.date);

      // Saint extraction
      const { saintName, saintTitle } = extractSaintInfo(entry);

      rows.push({
        date: entry.date,
        celebration_name: entry.celebrationName,
        rank: entry.rank,
        season,
        color_primary: entry.colorPrimary || "green",
        color_secondary: entry.colorSecondary,
        gloria,
        alleluia,
        lectionary_number: entry.lectionaryNumber,
        psalter_week: entry.psalterWeek,
        occasion_id: occasion?.occasionId || null,
        saint_name: saintName,
        saint_title: saintTitle,
        is_holyday: entry.isHolyday,
        is_transferred: entry.isTransferred,
        ecclesiastical_province: entry.ecclesiasticalProvince || "__universal__",
        liturgical_year_label: config.liturgicalYearLabel,
        sunday_cycle: config.sundayCycle,
        weekday_cycle: config.weekdayCycle,
        source_pdf: `usccb-${config.yearLabel}`,
        optional_memorials: entry.optionalMemorials,
        is_bvm: entry.isBVM,
      });
    }

    console.log(`  Built ${rows.length} rows for upsert`);

    // Upsert in batches (Supabase limit is ~1000 per request)
    const BATCH_SIZE = 100;
    let totalUpserted = 0;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const { data, error } = await supabase
        .from("liturgical_days")
        .upsert(batch, {
          onConflict: "date,ecclesiastical_province",
        });

      if (error) {
        console.error(
          `  Error upserting batch ${i}-${i + batch.length}:`,
          error.message
        );
        // Try individual inserts for debugging
        for (const row of batch) {
          const { error: singleError } = await supabase
            .from("liturgical_days")
            .upsert([row], {
              onConflict: "date,ecclesiastical_province",
            });
          if (singleError) {
            console.error(
              `    Failed: ${(row as any).date} ${(row as any).celebration_name}: ${singleError.message}`
            );
          }
        }
      } else {
        totalUpserted += batch.length;
      }
    }

    console.log(`  Upserted ${totalUpserted} rows`);

    // Summary
    const gloriaCount = rows.filter((r) => r.gloria).length;
    const alleluiaCount = rows.filter((r) => r.alleluia).length;
    const occasionMatchCount = rows.filter((r) => r.occasion_id).length;
    const saintCount = rows.filter((r) => r.saint_name).length;

    console.log(`  Summary:`);
    console.log(`    Gloria YES: ${gloriaCount}`);
    console.log(`    Alleluia YES: ${alleluiaCount}`);
    console.log(`    Occasion matches: ${occasionMatchCount}`);
    console.log(`    Saints identified: ${saintCount}`);

    // Spot checks
    console.log(`\n  Spot checks:`);
    for (const row of rows.slice(0, 3)) {
      console.log(
        `    ${row.date}: ${row.celebration_name} | ${row.season} | gloria:${row.gloria} | alleluia:${row.alleluia} | occasion:${row.occasion_id || "none"}`
      );
    }
    // Find Ash Wednesday
    const ashRow = rows.find(
      (r) => (r as any).celebration_name === "Ash Wednesday"
    );
    if (ashRow) {
      console.log(
        `    ${ashRow.date}: Ash Wednesday | ${ashRow.season} | gloria:${ashRow.gloria} | alleluia:${ashRow.alleluia}`
      );
    }
    // Find Easter
    const easterRow = rows.find((r) =>
      ((r as any).celebration_name as string).includes("EASTER SUNDAY")
    );
    if (easterRow) {
      console.log(
        `    ${easterRow.date}: Easter | ${easterRow.season} | gloria:${easterRow.gloria} | alleluia:${easterRow.alleluia}`
      );
    }
    // Find a Lent Sunday
    const lentSunday = rows.find(
      (r) =>
        ((r as any).celebration_name as string).includes("SUNDAY OF LENT") &&
        (r as any).rank === "sunday"
    );
    if (lentSunday) {
      console.log(
        `    ${lentSunday.date}: ${lentSunday.celebration_name} | ${lentSunday.season} | gloria:${lentSunday.gloria}`
      );
    }
  }

  console.log("\nDone!");
}

main().catch(console.error);
