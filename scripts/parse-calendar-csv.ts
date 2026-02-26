/**
 * One-time script to parse the Ministry Director Calendar CSV
 * into structured JSON for the calendar view.
 *
 * Run: npx tsx scripts/parse-calendar-csv.ts
 */

import * as fs from "fs";
import * as path from "path";
import Papa from "papaparse";

// ─── Types ──────────────────────────────────────────────────────────────────

interface CalendarWeek {
  weekId: string;
  liturgicalName: string;
  theme: string;
  season: string;
  seasonEmoji: string;
  sundayDate: string;
  events: CalendarEvent[];
}

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

// ─── Occasion ID Lookup ─────────────────────────────────────────────────────

const allOccasions: Array<{
  id: string;
  name: string;
  year: string;
  season: string;
  nextDate: string;
}> = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, "../src/data/all-occasions.json"),
    "utf-8"
  )
);

// Build a lookup map: normalized name → occasion ID (for Year A and ABC only)
const occasionLookup = new Map<string, string>();
for (const occ of allOccasions) {
  if (occ.year === "A" || occ.year === "ABC") {
    const normalized = normalizeName(occ.name);
    occasionLookup.set(normalized, occ.id);
  }
}

function normalizeName(name: string): string {
  return name
    .replace(/\[.*?\]/g, "") // remove [A], [ABC], etc.
    .replace(/\n/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

// ─── Season Emoji Mapping ───────────────────────────────────────────────────

const SEASON_EMOJI_MAP: Record<string, string> = {
  "🟣": "advent", // also lent - disambiguate by context
  "🟢": "ordinary",
  "🔴": "holy-week", // also pentecost
  "⚪": "christmas", // also easter, solemnities
  "🔵": "triduum",
};

// ─── Month Mapping ──────────────────────────────────────────────────────────

const MONTH_MAP: Record<string, number> = {
  Jan: 0,
  Feb: 1,
  Mar: 2,
  Apr: 3,
  May: 4,
  Jun: 5,
  Jul: 6,
  Aug: 7,
  Sep: 8,
  Oct: 9,
  Nov: 10,
  Dec: 11,
};

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

// ─── Time Parsing ───────────────────────────────────────────────────────────

function parseTime12h(t: string): string | null {
  if (!t) return null;
  t = t.trim();
  if (t === "ALL WEEK" || t === "TBD" || t.includes("?")) return null;

  const match = t.match(/^(\d{1,2}):(\d{2})(a|p)$/i);
  if (!match) return null;

  let hours = parseInt(match[1], 10);
  const minutes = match[2];
  const ampm = match[3].toLowerCase();

  if (ampm === "p" && hours !== 12) hours += 12;
  if (ampm === "a" && hours === 12) hours = 0;

  return `${hours.toString().padStart(2, "0")}:${minutes}`;
}

// ─── Community Extraction ───────────────────────────────────────────────────

function extractCommunity(title: string): string | null {
  const communities = [
    "Reflections",
    "Foundations",
    "Generations",
    "Heritage",
    "Elevations",
  ];
  for (const c of communities) {
    if (title.includes(c)) return c;
  }
  // Check for "SIMBANG GABI" which replaces a community mass
  if (title.includes("SIMBANG GABI")) return "Reflections";
  return null;
}

// ─── Celebrant Extraction ───────────────────────────────────────────────────

function extractCelebrant(text: string): string | null {
  // Match (Fr. Name), (Msgr. Name), etc.
  const match = text.match(
    /\((Fr\.\s+\w+|Msgr\.\s+\w+|Deacon\s+\w+|Bishop\s+\w+)\)/i
  );
  return match ? match[1] : null;
}

// ─── Event Type Classification ──────────────────────────────────────────────

function classifyEvent(title: string, notes: string): string {
  const t = title.toLowerCase();
  const n = notes.toLowerCase();

  if (
    t.includes("mass") ||
    t.includes("vigil") ||
    t.includes("liturgy") ||
    t.includes("christmas eve")
  )
    return "mass";
  if (t.includes("baptism")) return "sacrament";
  if (t.includes("reconcili") || t.includes("confession")) return "sacrament";
  if (t.includes("stations") || t.includes("exposition")) return "devotion";
  if (t.includes("rehearsal") || t.includes("reh.") || t.includes("reh "))
    return "rehearsal";
  if (t.includes("smprep") || n.includes("smprep") || t.includes("school"))
    return "school";
  if (
    t.includes("holiday") ||
    t.includes("🇺🇸") ||
    t.includes("thanksgiving") ||
    t.includes("christmas party") ||
    t.includes("black friday")
  )
    return "holiday";
  if (t.includes("meeting") || t.includes("mtg")) return "meeting";
  if (
    t.includes("retreat") ||
    t.includes("concert") ||
    t.includes("showcase") ||
    t.includes("posadas") ||
    t.includes("cornerstone") ||
    t.includes("recongress") ||
    t.includes("youth day")
  )
    return "special";

  return "other";
}

// ─── Clean Title ────────────────────────────────────────────────────────────

function cleanTitle(raw: string): string {
  return raw
    .replace(/\s*\|\s*♫\s*/g, "") // remove "| ♫"
    .replace(/♫\s*-?\s*/g, "") // remove "♫ -" or "♫"
    .replace(/\(Fr\.\s+\w+\)/g, "") // remove celebrant from title
    .replace(/\(Msgr\.\s+\w+\)/g, "")
    .replace(/\(Deacon\s+\w+\)/g, "")
    .trim();
}

// ─── Season Disambiguation ──────────────────────────────────────────────────

// Track what season we're in based on the liturgical headers
let currentSeason = "ordinary";
let lentStarted = false;
let easterStarted = false;

function disambiguateSeason(emoji: string, headerText: string): string {
  const h = headerText.toUpperCase();

  if (emoji === "🟣") {
    if (
      h.includes("LENT") ||
      h.includes("ASH WEDNESDAY") ||
      lentStarted
    ) {
      lentStarted = true;
      return "lent";
    }
    return "advent";
  }

  if (emoji === "⚪") {
    if (
      h.includes("EASTER") ||
      h.includes("ASCENSION") ||
      h.includes("PENTECOST") ||
      easterStarted
    ) {
      easterStarted = true;
      return "easter";
    }
    if (h.includes("NATIVITY") || h.includes("CHRISTMAS") || h.includes("HOLY FAMILY") || h.includes("EPIPHANY") || h.includes("BAPTISM OF THE LORD") || h.includes("MARY")) {
      return "christmas";
    }
    // Solemnities
    if (h.includes("SOL.") || h.includes("SOLEMNITY") || h.includes("TRINITY") || h.includes("BODY") || h.includes("CHRIST THE KING") || h.includes("ALL SAINTS") || h.includes("ALL SOULS")) {
      return "solemnity";
    }
    return "christmas";
  }

  if (emoji === "🔴") {
    if (h.includes("PALM")) return "lent";
    if (h.includes("GOOD FRIDAY")) return "lent";
    if (h.includes("PENTECOST")) return "easter";
    return "feast";
  }

  if (emoji === "🔵") return "lent"; // Holy Thursday is part of Triduum/Lent

  if (emoji === "🟢") {
    lentStarted = false;
    easterStarted = false;
    return "ordinary";
  }

  return currentSeason;
}

// ─── Match Occasion ID ──────────────────────────────────────────────────────

function matchOccasionId(liturgicalName: string): string | null {
  const normalized = normalizeName(liturgicalName);

  // Direct match first
  for (const [key, id] of occasionLookup.entries()) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return id;
    }
  }

  // Try simplified matching
  const simplified = normalized
    .replace(/SOL\.\s*—?\s*/g, "SOLEMNITY ")
    .replace(/FEAST\s*—?\s*/g, "FEAST ")
    .replace(/\|.*/g, "")
    .replace(/\s+/g, " ")
    .trim();

  // Specific mappings for tricky names
  const manualMappings: Record<string, string> = {
    "FIRST SUNDAY OF ADVENT": "advent-01-a",
    "SECOND SUNDAY OF ADVENT": "advent-02-a",
    "THIRD SUNDAY OF ADVENT": "advent-03-a",
    "FOURTH SUNDAY OF ADVENT": "advent-04-a",
    "FIRST SUNDAY OF LENT": "lent-01-a",
    "SECOND SUNDAY OF LENT": "lent-02-a",
    "THIRD SUNDAY OF LENT": "lent-03-a",
    "FOURTH SUNDAY OF LENT": "lent-04-a",
    "FIFTH SUNDAY OF LENT": "lent-05-a",
    "PALM SUNDAY": "palm-sunday-a",
    "EASTER SUNDAY": "easter-sunday-abc",
    "ASH WEDNESDAY": "ash-wednesday",
    "HOLY THURSDAY": "easter-sunday-abc", // no separate ID
    "GOOD FRIDAY": "easter-sunday-abc", // no separate ID
    "HOLY FAMILY": "holy-family-a",
    "THE EPIPHANY OF THE LORD": "the-epiphany-of-the-lord-abc",
    "THE BAPTISM OF THE LORD": "baptism-of-the-lord-a",
    "THE NATIVITY OF THE LORD": "nativity",
    "IMMACULATE CONCEPTION": "solemnity-immaculate-conception",
    "OUR LADY OF GUADALUPE": "feast-our-lady-of-guadalupe-abc",
    "CHRIST THE KING": "solemnity-christ-the-king-a",
    "MARY, THE HOLY MOTHER OF GOD": "jan-1-mary-mother-of-god-abc",
  };

  for (const [pattern, id] of Object.entries(manualMappings)) {
    if (simplified.includes(pattern)) return id;
  }

  // Try "SECOND SUNDAY IN O.T." → ordinary-time-02-a
  const otMatch = simplified.match(
    /(\w+)\s+SUNDAY\s+IN\s+O(?:RDINARY)?\s*\.?\s*T(?:IME)?/i
  );
  if (otMatch) {
    const ordinals: Record<string, string> = {
      SECOND: "02",
      "2ND": "02",
      THIRD: "03",
      "3RD": "03",
      FOURTH: "04",
      "4TH": "04",
      FIFTH: "05",
      "5TH": "05",
      SIXTH: "06",
      "6TH": "06",
      SEVENTH: "07",
      "7TH": "07",
      EIGHTH: "08",
      "8TH": "08",
      NINTH: "09",
      "9TH": "09",
      TENTH: "10",
      "10TH": "10",
      ELEVENTH: "11",
      "11TH": "11",
      TWELFTH: "12",
      "12TH": "12",
      THIRTEENTH: "13",
      "13TH": "13",
      FOURTEENTH: "14",
      "14TH": "14",
      FIFTEENTH: "15",
      "15TH": "15",
      SIXTEENTH: "16",
      "16TH": "16",
      SEVENTEENTH: "17",
      "17TH": "17",
      EIGHTEENTH: "18",
      "18TH": "18",
      NINETEENTH: "19",
      "19TH": "19",
      TWENTIETH: "20",
      "20TH": "20",
      "TWENTY-FIRST": "21",
      "21ST": "21",
      "TWENTY-SECOND": "22",
      "22ND": "22",
      "TWENTY-THIRD": "23",
      "23RD": "23",
      "TWENTY-FOURTH": "24",
      "24TH": "24",
      "TWENTY-FIFTH": "25",
      "25TH": "25",
      "TWENTY-SIXTH": "26",
      "26TH": "26",
      "TWENTY-SEVENTH": "27",
      "27TH": "27",
      "TWENTY-EIGHTH": "28",
      "28TH": "28",
      "TWENTY-NINTH": "29",
      "29TH": "29",
      THIRTIETH: "30",
      "30TH": "30",
      "THIRTY-FIRST": "31",
      "31ST": "31",
      "THIRTY-SECOND": "32",
      "32ND": "32",
      "THIRTY-THIRD": "33",
      "33RD": "33",
      "THIRTY-FOURTH": "34",
      "34TH": "34",
    };
    const num = ordinals[otMatch[1].toUpperCase()];
    if (num) return `ordinary-time-${num}-a`;
  }

  // Easter weeks
  const easterMatch = simplified.match(
    /(\w+)\s+SUNDAY\s+OF\s+EASTER/i
  );
  if (easterMatch) {
    const ordinals: Record<string, string> = {
      SECOND: "02",
      THIRD: "03",
      FOURTH: "04",
      FIFTH: "05",
      SIXTH: "06",
      SEVENTH: "07",
    };
    const num = ordinals[easterMatch[1].toUpperCase()];
    if (num) return `easter-${num}-a`;
  }

  return null;
}

// ─── Main Parser ────────────────────────────────────────────────────────────

function main() {
  const csvPath = path.resolve(
    __dirname,
    "../../RITUALSONG/Calendar Template/MM CAL (Ministry Director Meeting) - 25_26 Cycle A.csv"
  );

  if (!fs.existsSync(csvPath)) {
    // Try alternative path
    const altPath = path.resolve(
      process.env.HOME || "",
      "Dropbox (Personal)/RITUALSONG/Calendar Template/MM CAL (Ministry Director Meeting) - 25_26 Cycle A.csv"
    );
    if (!fs.existsSync(altPath)) {
      console.error("CSV file not found at:", csvPath);
      console.error("Also tried:", altPath);
      process.exit(1);
    }
    return parseCSV(altPath);
  }
  return parseCSV(csvPath);
}

function parseCSV(csvPath: string) {
  const csvContent = fs.readFileSync(csvPath, "utf-8");
  const result = Papa.parse(csvContent, {
    header: false,
    skipEmptyLines: false,
  });

  const rows = result.data as string[][];
  console.log(`Parsed ${rows.length} rows from CSV`);

  const weeks: CalendarWeek[] = [];
  let currentWeek: CalendarWeek | null = null;
  let currentDate = "";
  let currentMonth = "";
  let currentDayOfWeek = "";
  let weekCounter = 0;

  // Year context: Nov-Dec = 2025, Jan onwards = 2026
  function getYear(month: string): number {
    return month === "Nov" || month === "Dec" ? 2025 : 2026;
  }

  function buildISODate(
    dayNum: string,
    monthAbbr: string
  ): string {
    const month = MONTH_MAP[monthAbbr];
    if (month === undefined) return "";
    const year = getYear(monthAbbr);
    const day = parseInt(dayNum.trim(), 10);
    if (isNaN(day)) return "";
    return `${year}-${(month + 1).toString().padStart(2, "0")}-${day
      .toString()
      .padStart(2, "0")}`;
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 2) continue;

    const col0 = (row[0] || "").trim(); // blank usually
    const col1 = (row[1] || "").trim(); // season emoji or ♫ or ?
    const col2 = (row[2] || "").trim(); // day number or week header text
    const col3 = (row[3] || "").trim(); // "Month, Day" or continuation
    const col4 = (row[4] || "").trim(); // start time
    const col5 = (row[5] || "").trim(); // —
    const col6 = (row[6] || "").trim(); // end time
    const col7 = (row[7] || "").trim(); // blank
    const col8 = (row[8] || "").trim(); // event title
    const col9 = (row[9] || "").trim(); // notes
    const col10 = (row[10] || "").trim(); // blank or continuation
    const col11 = (row[11] || "").trim(); // ←
    const col12 = (row[12] || "").trim(); // blank
    const col13 = (row[13] || "").trim(); // sidebar note

    // Skip the header row
    if (col2 === "DATE" || col8 === "EVENT") continue;

    // ─── Detect week header ─────────────────────────────────────────
    const seasonEmojis = ["🟣", "🟢", "🔴", "⚪", "🔵"];
    const isWeekHeader =
      seasonEmojis.includes(col1) &&
      col2.trim().length > 5 &&
      !col4 && // no time = it's a header, not an event
      (col2.includes("SUNDAY") ||
        col2.includes("ADVENT") ||
        col2.includes("LENT") ||
        col2.includes("EASTER") ||
        col2.includes("NATIVITY") ||
        col2.includes("HOLY") ||
        col2.includes("GOOD") ||
        col2.includes("SOL.") ||
        col2.includes("Sol.") ||
        col2.includes("Feast") ||
        col2.includes("FEAST") ||
        col2.includes("EPIPHANY") ||
        col2.includes("BAPTISM") ||
        col2.includes("PENTECOST") ||
        col2.includes("ASCENSION") ||
        col2.includes("TRINITY") ||
        col2.includes("BODY") ||
        col2.includes("CHRIST THE KING") ||
        col2.includes("ALL SAINTS") ||
        col2.includes("ALL SOULS") ||
        col2.includes("MARY"));

    if (isWeekHeader) {
      // Save previous week
      if (currentWeek && currentWeek.events.length > 0) {
        weeks.push(currentWeek);
      }

      const headerText = col2.trim();
      const parts = headerText.split("|").map((s) => s.trim());
      const liturgicalName = parts[0]
        .replace(/^\s+/, "")
        .replace(/\s+$/, "")
        .trim();
      const theme = parts.length > 1 ? parts[1].trim() : "";

      const season = disambiguateSeason(col1, headerText);
      currentSeason = season;

      weekCounter++;
      const occasionId = matchOccasionId(liturgicalName);

      // Generate weekId
      let weekId = occasionId
        ? occasionId.replace(/-a$/, "").replace(/-abc$/, "")
        : `week-${weekCounter}`;

      currentWeek = {
        weekId,
        liturgicalName,
        theme,
        season,
        seasonEmoji: col1,
        sundayDate: "", // will be set when we see the Sunday
        events: [],
      };

      continue;
    }

    // ─── Detect holiday/annotation headers (not week headers) ───────
    const isAnnotationHeader =
      !col4 &&
      !col8 &&
      col2.trim().length > 3 &&
      !seasonEmojis.includes(col1) &&
      (col2.includes("🇺🇸") ||
        col2.includes("RECONGRESS") ||
        col2.includes("Friday of") ||
        col2.includes("St. Patrick") ||
        col2.includes("NEW YEAR") ||
        col2.includes("THANKSGIVING") ||
        col2.includes("MARTIN LUTHER") ||
        col2.includes("PRESIDENT") ||
        col2.includes("INDEPEND") ||
        col2.includes("MEMORIAL DAY") ||
        col2.includes("LABOR DAY") ||
        col2.includes("HALLOWEEN") ||
        col2.includes("General Notes"));

    if (isAnnotationHeader) {
      // Create an annotation event if there's meaningful content
      if (
        col2.includes("🇺🇸") ||
        col2.includes("RECONGRESS") ||
        col2.includes("NEW YEAR")
      ) {
        // This is a holiday/special annotation - add as event
        if (currentWeek) {
          const title = col2
            .replace("🇺🇸", "")
            .replace(/\s+/g, " ")
            .trim();
          if (title.length > 2) {
            currentWeek.events.push({
              date: currentDate,
              dayOfWeek: currentDayOfWeek,
              startTime: null,
              endTime: null,
              startTime12h: "",
              endTime12h: "",
              title,
              community: null,
              eventType: "holiday",
              hasMusic: false,
              isAutoMix: false,
              celebrant: null,
              location: null,
              notes: col9 || null,
              sidebarNote: col13 || null,
              occasionId: null,
            });
          }
        }
      }
      continue;
    }

    // ─── Detect date rows (col2 has a number, col3 has "Month, Day") ─
    const dayNum = col2.replace(/\s/g, "");
    const hasDateInfo = /^\d{1,2}$/.test(dayNum) && col3.includes(",");

    if (hasDateInfo) {
      const monthMatch = col3.match(/^(\w{3}),\s*(\w{3})/);
      if (monthMatch) {
        currentMonth = monthMatch[1];
        currentDayOfWeek =
          DAY_NAMES.find((d) =>
            d.toLowerCase().startsWith(monthMatch[2].toLowerCase())
          ) || monthMatch[2];
        currentDate = buildISODate(dayNum, currentMonth);

        // If this is a Sunday, set the week's Sunday date
        if (
          currentDayOfWeek === "Sunday" &&
          currentWeek &&
          !currentWeek.sundayDate
        ) {
          currentWeek.sundayDate = currentDate;
        }
      }
    }

    // ─── Create event from row ──────────────────────────────────────
    const hasEvent = col8.trim().length > 0;
    const hasTime = col4.trim().length > 0;

    if (hasEvent && currentWeek && currentDate) {
      const rawTitle = col8;
      const rawNotes = col9;
      const community = extractCommunity(rawTitle);
      const celebrant =
        extractCelebrant(rawTitle) || extractCelebrant(rawNotes);
      const title = cleanTitle(rawTitle);
      const hasMusic =
        rawTitle.includes("♫") || col1 === "♫";
      const isAutoMix =
        rawNotes.toLowerCase().includes("auto-mix") ||
        rawNotes.toLowerCase().includes("auto mix");

      // Determine location from notes
      let location: string | null = null;
      const locationPatterns = [
        /Church\s*\(Livestreamed\)/i,
        /Outdoor Mass/i,
        /Church/i,
        /Loc\.\s*-?\s*(.*)/i,
        /Location:\s*(.*)/i,
      ];
      for (const pat of locationPatterns) {
        const m = rawNotes.match(pat);
        if (m) {
          location = m[0].replace(/^Loc\.\s*-?\s*/, "").replace(/^Location:\s*/, "");
          break;
        }
      }

      const sidebarNote = col13 || null;
      const eventType = classifyEvent(rawTitle, rawNotes);

      // Clean notes: remove location, auto-mix, celebrant info that we already extracted
      let cleanedNotes = rawNotes
        .replace(/Auto-Mix/gi, "")
        .replace(/Church\s*\(Livestreamed\)/gi, "")
        .replace(/Outdoor Mass/gi, "")
        .replace(/^Church$/gi, "")
        .replace(/\(Fr\.\s+\w+\)/g, "")
        .replace(/\(Msgr\.\s+\w+\)/g, "")
        .trim();
      if (cleanedNotes.length < 2) cleanedNotes = "";

      currentWeek.events.push({
        date: currentDate,
        dayOfWeek: currentDayOfWeek,
        startTime: parseTime12h(col4),
        endTime: parseTime12h(col6),
        startTime12h: col4.trim(),
        endTime12h: col6.trim(),
        title,
        community,
        eventType,
        hasMusic,
        isAutoMix,
        celebrant,
        location,
        notes: cleanedNotes || null,
        sidebarNote,
        occasionId: currentWeek.weekId.endsWith("-a")
          ? currentWeek.weekId
          : matchOccasionId(currentWeek.liturgicalName),
      });
    } else if (hasTime && col4.trim() !== "General Notes:" && currentWeek && currentDate) {
      // Row with time but no event title in col8 — might have title elsewhere
      // Some rows have the event spread oddly; skip truly empty ones
    }
  }

  // Don't forget the last week
  if (currentWeek && currentWeek.events.length > 0) {
    weeks.push(currentWeek);
  }

  // ─── Post-processing ───────────────────────────────────────────────

  // Fill in missing Sunday dates
  for (const week of weeks) {
    if (!week.sundayDate) {
      // Infer from the first Sunday event, or first event + find Sunday
      const sundayEvent = week.events.find((e) => e.dayOfWeek === "Sunday");
      if (sundayEvent) {
        week.sundayDate = sundayEvent.date;
      } else if (week.events.length > 0) {
        // Use the first event's date as a reference
        week.sundayDate = week.events[0].date;
      }
    }
  }

  // Sort weeks by Sunday date
  weeks.sort((a, b) => a.sundayDate.localeCompare(b.sundayDate));

  // ─── Output ─────────────────────────────────────────────────────────

  const calendar = {
    title: "Ministry Director Calendar 25-26 Cycle A",
    yearCycle: "A",
    startDate: "2025-11-22",
    endDate: "2026-11-27",
    weeks,
  };

  const outputPath = path.resolve(
    __dirname,
    "../src/data/ministry-calendar.json"
  );
  fs.writeFileSync(outputPath, JSON.stringify(calendar, null, 2));

  console.log(`\n✅ Generated ${outputPath}`);
  console.log(`   ${weeks.length} liturgical weeks`);
  console.log(
    `   ${weeks.reduce((n, w) => n + w.events.length, 0)} total events`
  );
  console.log(`   Date range: ${calendar.startDate} to ${calendar.endDate}`);

  // Print summary
  console.log("\n📅 Weeks:");
  for (const w of weeks) {
    const occLink = matchOccasionId(w.liturgicalName) ? "✓" : " ";
    console.log(
      `   ${occLink} ${w.sundayDate} ${w.seasonEmoji} ${w.liturgicalName.substring(0, 50).padEnd(52)} (${w.events.length} events)`
    );
  }
}

main();
