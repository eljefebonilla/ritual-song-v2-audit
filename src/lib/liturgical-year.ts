/**
 * Compute liturgical year boundaries from any reference date.
 *
 * The liturgical year begins on the First Sunday of Advent,
 * which is the Sunday closest to November 30 (between Nov 27 and Dec 3).
 * It ends the Saturday before the next First Sunday of Advent.
 */

/** Find the First Sunday of Advent for a given civil year's Advent. */
function firstSundayOfAdvent(civilYear: number): Date {
  // Nov 30 of that year
  const nov30 = new Date(civilYear, 10, 30); // month is 0-indexed
  const day = nov30.getDay(); // 0=Sun, 1=Mon, ...
  // Find the nearest Sunday to Nov 30
  // If day <= 3 (Sun-Wed), go back to that Sunday
  // If day >= 4 (Thu-Sat), go forward to next Sunday
  const offset = day <= 3 ? -day : 7 - day;
  const advent = new Date(civilYear, 10, 30 + offset);
  return advent;
}

/** Get the start and end dates of the liturgical year containing the given date. */
export function getLiturgicalYearRange(referenceDate: Date = new Date()): {
  start: string;
  end: string;
  yearLabel: string;
} {
  const year = referenceDate.getFullYear();

  // Check if the reference date is before or after this year's Advent
  const thisYearAdvent = firstSundayOfAdvent(year);

  let startDate: Date;
  if (referenceDate >= thisYearAdvent) {
    // We are in the liturgical year that starts this Advent
    startDate = thisYearAdvent;
  } else {
    // We are in the liturgical year that started last year's Advent
    startDate = firstSundayOfAdvent(year - 1);
  }

  // End date is the Saturday before the NEXT First Sunday of Advent
  const nextAdvent = firstSundayOfAdvent(startDate.getFullYear() + 1);
  const endDate = new Date(nextAdvent);
  endDate.setDate(endDate.getDate() - 1);

  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const startYear = startDate.getFullYear();
  const endYear = endDate.getFullYear();

  return {
    start: fmt(startDate),
    end: fmt(endDate),
    yearLabel: `${startYear}–${endYear}`,
  };
}

/**
 * Determine the liturgical season for a given date string (YYYY-MM-DD).
 *
 * Uses the USCCB liturgical day data when available; falls back to
 * approximate date-range heuristics based on computed year boundaries.
 *
 * Easter is computed via the Anonymous Gregorian algorithm.
 */
export function getLiturgicalSeason(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const year = d.getFullYear();

  // Compute Easter for this civil year
  const easter = computeEaster(year);
  const easterStr = fmt(easter);

  // Key dates derived from Easter
  const ashWed = addDays(easter, -46);
  const palmSun = addDays(easter, -7);
  const holySat = addDays(easter, -1);
  const pentecost = addDays(easter, 49);

  // Advent boundaries
  const advent = firstSundayOfAdvent(year);
  const adventStr = fmt(advent);
  const prevAdvent = firstSundayOfAdvent(year - 1);

  // Christmas boundaries
  // Baptism of the Lord: Sunday after Jan 6, or Jan 7 if Jan 6 is Sunday
  const jan6 = new Date(year, 0, 6);
  const jan6Day = jan6.getDay();
  const baptism = jan6Day === 0 ? new Date(year, 0, 7) : addDays(jan6, 7 - jan6Day);

  // Season detection
  if (dateStr >= fmt(ashWed) && dateStr < fmt(palmSun)) return "Lent";
  if (dateStr >= fmt(palmSun) && dateStr <= fmt(holySat)) return "Holy Week";
  if (dateStr >= easterStr && dateStr <= fmt(pentecost)) return "Easter";

  // Check if we're in the Advent that starts this year
  if (dateStr >= adventStr) return "Advent";

  // Check if we're in the Advent/Christmas from previous year
  if (dateStr < fmt(baptism)) {
    // Could be Christmas or Advent from previous year's cycle
    const prevAdventStr = fmt(prevAdvent);
    const dec25 = `${year - 1}-12-25`;
    if (dateStr < prevAdventStr) return "Ordinary Time";
    if (dateStr < dec25) return "Advent";
    return "Christmas";
  }

  // Dec 25 through end of year
  if (d.getMonth() === 11 && d.getDate() >= 25) return "Christmas";

  return "Ordinary Time";
}

function computeEaster(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1; // 0-indexed
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month, day);
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}
