/**
 * Pure computation functions for liturgical calendar fields.
 * Extracted from scripts/populate-liturgical-days.ts so they can be
 * reused by the /api/admin/regenerate-calendar endpoint.
 */

// ============================================================
// Types
// ============================================================

export interface SeasonBoundary {
  label: string;
  season: string;
  start: string; // YYYY-MM-DD inclusive
  end: string; // YYYY-MM-DD inclusive
}

export interface CalendarYearConfig {
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

export const CALENDAR_YEAR_CONFIGS: CalendarYearConfig[] = [
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

// ============================================================
// Helpers
// ============================================================

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split("T")[0];
}

// ============================================================
// Season computation
// ============================================================

/**
 * Compute season boundaries for a liturgical year.
 * A liturgical year starts on the First Sunday of Advent.
 */
export function computeSeasonBoundaries(
  firstAdventDate: string,
  ashWednesday: string,
  easterSunday: string,
  pentecostSunday: string,
  nextFirstAdvent: string
): SeasonBoundary[] {
  const adventYear = parseInt(firstAdventDate.slice(0, 4));
  const christmas = `${adventYear}-12-25`;

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
      end: "", // set externally after finding Baptism of the Lord
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
      end: addDays(easterSunday, -1),
    },
    {
      label: "Easter",
      season: "easter",
      start: easterSunday,
      end: pentecostSunday,
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

export function getSeasonForDate(
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
 * - EXCEPT: Good Friday and Holy Saturday (no Gloria, despite solemnity rank)
 * - Solemnities during Advent/Lent DO get Gloria (unless Triduum)
 * - NO: weekday Memorials, all weekdays
 */
export function computeGloria(
  rank: string,
  season: string,
  dayOfWeek: string,
  celebrationName?: string
): boolean {
  // Triduum exception: Good Friday and Holy Saturday never have Gloria
  if (celebrationName) {
    const name = celebrationName.toLowerCase();
    if (name.includes("good friday") || name.includes("passion of the lord")) return false;
    if (name.includes("holy saturday")) return false;
  }

  const isSunday = dayOfWeek.toUpperCase() === "SUN";

  if (rank === "solemnity") return true;
  if (rank === "feast") return true;
  if (isSunday || rank === "sunday") {
    return season !== "advent" && season !== "lent";
  }
  return false;
}

/**
 * Alleluia rules:
 * - NO: Ash Wednesday through Holy Saturday (inclusive)
 * - YES: All other days
 */
export function computeAlleluia(
  date: string,
  ashWednesday: string,
  holySaturday: string
): boolean {
  return date < ashWednesday || date > holySaturday;
}
