/**
 * Parse USCCB Liturgical Calendar PDFs into structured JSON
 *
 * Reads 2026 and 2027 USCCB Liturgical Calendar PDFs and outputs
 * structured JSON files at src/data/usccb-2026.json and usccb-2027.json
 *
 * Run: npx tsx scripts/parse-usccb-calendar.ts
 */
import fs from "fs";
import path from "path";
import { PDFParse } from "pdf-parse";

// ============================================================
// Types
// ============================================================

interface RawDayEntry {
  date: string; // YYYY-MM-DD
  dayOfWeek: string; // Mon, Tue, ..., SUN
  celebrationName: string;
  rank: "solemnity" | "feast" | "memorial" | "optional_memorial" | "sunday" | "weekday";
  colorPrimary: string;
  colorSecondary: string | null;
  colorAlternate: string | null; // for "violet or rose" type entries
  allColors: string[]; // every color mentioned
  citations: string; // raw citation string
  lectionaryNumber: number | null;
  psalterWeek: string | null; // I, II, III, IV, Prop
  optionalMemorials: string[]; // text from [brackets]
  isHolyday: boolean;
  isBVM: boolean;
  isUSA: boolean;
  isTransferred: boolean; // for Ascension dual-entry
  ecclesiasticalProvince: string | null; // "Boston/Hartford/..." or "all_other" or null
  specialReadingSets: SpecialReadingSet[];
  alternateReadings: string | null;
  notes: string[];
}

interface SpecialReadingSet {
  label: string; // "Vigil", "Night", "Dawn", "Day", "Morning", "Chrism Mass", "Evening Mass..."
  citations: string;
  lectionaryNumber: number | null;
}

interface CalendarConfig {
  pdfPath: string;
  yearLabel: string; // "2026" or "2027"
  startDate: { year: number; month: number }; // Nov 2025 for 2026 calendar
  sundayCycle: string; // "A" or "B"
  weekdayCycle: string; // "1" or "2"
}

// ============================================================
// Constants
// ============================================================

const DAY_ABBREVS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "SUN"];
const DAY_ABBREV_PATTERN = /^(\d{1,2})\s+(Sun|Mon|Tue|Wed|Thu|Fri|Sat|SUN)\s+/;

const MONTH_HEADER_PATTERN =
  /^(NOVEMBER[–\-]DECEMBER|JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER)\s+(\d{4})$/;

const COLOR_NAMES = [
  "violet",
  "white",
  "red",
  "green",
  "rose",
  "black",
];

const RANK_KEYWORDS: Record<string, RawDayEntry["rank"]> = {
  Solemnity: "solemnity",
  Feast: "feast",
  Memorial: "memorial",
};

const PSALTER_PATTERN = /Pss?\s+(I{1,3}V?|IV|Prop)\s*$/;
const LECTIONARY_PATTERN = /\((\d+[A-Z]?)\)/;

// Page numbers that appear alone on a line
const PAGE_NUMBER_PATTERN = /^\d{1,2}$/;

// Footnote pattern: starts with a digit followed by text
const FOOTNOTE_PATTERN = /^\d{1,2}\s+[A-Z]/;

// ============================================================
// PDF text extraction
// ============================================================

async function extractText(pdfPath: string): Promise<string[]> {
  const buffer = fs.readFileSync(pdfPath);
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  const result = await parser.getText();
  await parser.destroy();

  // Return array of lines from all pages, with page markers
  const lines: string[] = [];
  for (const page of result.pages) {
    lines.push(...page.text.split("\n"));
  }
  return lines;
}

// ============================================================
// Parsing
// ============================================================

function parseColor(colorStr: string): {
  primary: string;
  secondary: string | null;
  alternate: string | null;
  all: string[];
} {
  const trimmed = colorStr.trim().toLowerCase();

  // Handle "or" pattern: "violet or rose"
  if (trimmed.includes(" or ")) {
    const parts = trimmed.split(/\s+or\s+/);
    const allColors = parts.map((p) => p.trim());
    return {
      primary: allColors[0],
      secondary: null,
      alternate: allColors[1] || null,
      all: allColors,
    };
  }

  // Handle slash-separated: "violet/white", "green/red/white"
  const parts = trimmed.split("/").map((p) => p.trim());
  return {
    primary: parts[0],
    secondary: parts.length > 1 ? parts[1] : null,
    alternate: null,
    all: parts,
  };
}

function extractLectionaryNumber(text: string): number | null {
  // Find the LAST parenthesized number — that's the lectionary number
  // Pattern: (###) or (###A)
  const matches = [...text.matchAll(/\((\d+[A-Z]?)\)/g)];
  if (matches.length === 0) return null;
  const last = matches[matches.length - 1];
  const numStr = last[1].replace(/[A-Z]/g, "");
  return parseInt(numStr, 10) || null;
}

function extractPsalterWeek(text: string): string | null {
  // Strip any trailing footnote digits: "Pss I3" -> "Pss I"
  const cleaned = text.replace(/(Pss?\s+(?:I{1,3}V?|IV|Prop))\d+/g, "$1");
  const match = cleaned.match(/Pss?\s+(I{1,3}V?|IV|Prop)/);
  return match ? match[1] : null;
}

function isColorWord(word: string): boolean {
  return COLOR_NAMES.includes(word.toLowerCase());
}

/**
 * Check if a line ends with color information.
 * Colors appear at the end of the celebration header line.
 * Patterns: "violet", "white", "red", "green", "rose", "black",
 *           "violet/white", "green/red/white", "violet or rose"
 */
function extractTrailingColor(line: string): {
  text: string;
  color: string;
} | null {
  const trimmed = line.trim();

  // Try matching "word or word" at end
  const orMatch = trimmed.match(
    /^(.+?)\s+((?:violet|white|red|green|rose|black)\s+or\s+(?:violet|white|red|green|rose|black))$/i
  );
  if (orMatch) {
    return { text: orMatch[1].trim(), color: orMatch[2].trim().toLowerCase() };
  }

  // Try matching slash-separated colors at end
  const slashMatch = trimmed.match(
    /^(.+?)\s+((?:violet|white|red|green|rose|black)(?:\/(?:violet|white|red|green|rose|black))*)$/i
  );
  if (slashMatch) {
    return {
      text: slashMatch[1].trim(),
      color: slashMatch[2].trim().toLowerCase(),
    };
  }

  // Try matching single color at end
  const singleMatch = trimmed.match(
    /^(.+?)\s+(violet|white|red|green|rose|black)$/i
  );
  if (singleMatch) {
    return {
      text: singleMatch[1].trim(),
      color: singleMatch[2].trim().toLowerCase(),
    };
  }

  return null;
}

function isDayHeaderLine(line: string): boolean {
  return DAY_ABBREV_PATTERN.test(line.trim());
}

function isMonthHeader(line: string): RegExpMatchArray | null {
  return line.trim().match(MONTH_HEADER_PATTERN);
}

function isPageNumber(line: string): boolean {
  return PAGE_NUMBER_PATTERN.test(line.trim());
}

function isFootnote(line: string): boolean {
  // Footnotes look like: "3 Citations indicating..." or "8 If necessary..."
  const trimmed = line.trim();
  // Must start with a digit, then space, then capital letter or opening char
  if (/^\d{1,2}\s+[A-Z"'\[\(]/.test(trimmed)) {
    // Exclude day entries (which start with digit + day abbrev)
    if (DAY_ABBREV_PATTERN.test(trimmed)) return false;
    // Exclude lines that are purely citations
    if (
      /^\d{1,2}\s+(Sun|Mon|Tue|Wed|Thu|Fri|Sat|SUN)/i.test(trimmed)
    )
      return false;
    return true;
  }
  return false;
}

function isYearHeader(line: string): boolean {
  return /^YEAR [A-C]\s*–\s*WEEKDAYS\s+(I{1,2}|1|2)$/.test(line.trim());
}

function isSectionHeader(line: string): boolean {
  const t = line.trim();
  return (
    isYearHeader(t) ||
    t === "INTRODUCTION" ||
    t.startsWith("ABBREVIATIONS") ||
    t.startsWith("PROPER CALENDAR") ||
    t.startsWith("PRINCIPAL CELEBRATIONS") ||
    t.startsWith("CYCLES") ||
    t.startsWith("LITURGY OF THE HOURS") ||
    t.startsWith("MISCELLANEOUS NOTES")
  );
}

function isProvinceLine(line: string): boolean {
  const t = line.trim();
  return (
    t.startsWith("Ecclesiastical Provinces of") ||
    t.startsWith("All Other U.S. Ecclesiastical Provinces")
  );
}

interface ParseState {
  currentYear: number;
  currentMonth: number;
  entries: RawDayEntry[];
}

function computeDate(
  state: ParseState,
  dayNum: number
): { date: string; year: number; month: number } {
  let year = state.currentYear;
  let month = state.currentMonth;

  // If day number is less than previous entry's day and we haven't just seen a month header,
  // that shouldn't happen in a well-structured calendar. But if the month header was missed, handle it.
  const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
  return { date: dateStr, year, month };
}

function parseCelebrationName(textBeforeColor: string): {
  name: string;
  isUSA: boolean;
} {
  let name = textBeforeColor.trim();
  let isUSA = false;

  if (name.startsWith("USA:")) {
    isUSA = true;
    name = name.slice(4).trim();
  }

  return { name, isUSA };
}

export function parseCalendarText(
  lines: string[],
  config: CalendarConfig
): RawDayEntry[] {
  const entries: RawDayEntry[] = [];

  // State tracking
  let currentYear = config.startDate.year;
  let currentMonth = config.startDate.month;
  let currentProvince: string | null = null;
  let inFrontMatter = true; // Skip pages before calendar data

  // Build groups: each day entry is a header line + subsequent lines until next day header
  interface DayGroup {
    headerLine: string;
    subsequentLines: string[];
    province: string | null;
  }
  const dayGroups: DayGroup[] = [];
  let currentGroup: DayGroup | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip empty lines
    if (!trimmed) continue;

    // Skip page numbers
    if (isPageNumber(trimmed)) continue;

    // Detect start of calendar data
    if (inFrontMatter) {
      if (isYearHeader(trimmed)) {
        inFrontMatter = false;
      }
      continue;
    }

    // Skip footnotes (lines starting with digit + space + capital that aren't day entries)
    if (isFootnote(trimmed) && !isDayHeaderLine(trimmed)) {
      // Also skip continuation of footnotes
      continue;
    }

    // Skip section headers
    if (isSectionHeader(trimmed)) continue;

    // Handle month headers
    const monthMatch = isMonthHeader(trimmed);
    if (monthMatch) {
      const monthName = monthMatch[1];
      const yearNum = parseInt(monthMatch[2], 10);

      // Handle "NOVEMBER–DECEMBER" or "NOVEMBER-DECEMBER" dual month
      if (monthName.startsWith("NOVEMBER") && monthName.includes("DECEMBER")) {
        currentMonth = 11; // Start with November
        currentYear = yearNum;
      } else {
        const monthMap: Record<string, number> = {
          JANUARY: 1,
          FEBRUARY: 2,
          MARCH: 3,
          APRIL: 4,
          MAY: 5,
          JUNE: 6,
          JULY: 7,
          AUGUST: 8,
          SEPTEMBER: 9,
          OCTOBER: 10,
          NOVEMBER: 11,
          DECEMBER: 12,
        };
        currentMonth = monthMap[monthName] || currentMonth;
        currentYear = yearNum;
      }
      continue;
    }

    // Handle province markers
    if (isProvinceLine(trimmed)) {
      if (trimmed.startsWith("All Other")) {
        currentProvince = "all_other";
      } else {
        // Extract province names
        currentProvince = trimmed
          .replace("Ecclesiastical Provinces of ", "")
          .replace(":", "")
          .trim();
      }
      continue;
    }

    // Handle "or, for the ..." alternative reading lines
    if (trimmed.startsWith("or,") || trimmed.startsWith("or any readings")) {
      if (currentGroup) {
        currentGroup.subsequentLines.push(trimmed);
      }
      continue;
    }

    // Check for day header
    if (isDayHeaderLine(trimmed)) {
      // Save previous group
      if (currentGroup) {
        dayGroups.push(currentGroup);
      }

      // Handle month transition within NOVEMBER-DECEMBER
      // If we see day 1 and current month is 11 and previous entry was > 1, switch to December
      const dayMatch = trimmed.match(/^(\d{1,2})/);
      if (dayMatch) {
        const dayNum = parseInt(dayMatch[1], 10);
        if (dayNum === 1 && currentMonth === 11 && dayGroups.length > 0) {
          // Check if previous group had a high day number
          const prevHeader = dayGroups[dayGroups.length - 1]?.headerLine;
          const prevDay = prevHeader?.match(/^(\d{1,2})/);
          if (prevDay && parseInt(prevDay[1], 10) > 25) {
            currentMonth = 12;
          }
        }
      }

      currentGroup = {
        headerLine: trimmed,
        subsequentLines: [],
        province: currentProvince,
      };
      // Reset province after using it
      currentProvince = null;
      continue;
    }

    // Continuation line — add to current group
    if (currentGroup) {
      // Filter out footnote continuation lines
      if (
        trimmed.startsWith("designated by") ||
        trimmed.startsWith("both from") ||
        trimmed.startsWith("demand in") ||
        trimmed.startsWith("should never") ||
        trimmed.startsWith("celebrated as") ||
        trimmed.startsWith("Calendar, no.") ||
        trimmed.startsWith("is not read on") ||
        trimmed.startsWith("Although not given") ||
        trimmed.startsWith("Nine readings are") ||
        trimmed.startsWith("If necessary,") ||
        trimmed.startsWith("Optional Memorials are")
      ) {
        continue; // footnote continuation
      }
      currentGroup.subsequentLines.push(trimmed);
    }
  }

  // Don't forget the last group
  if (currentGroup) {
    dayGroups.push(currentGroup);
  }

  // Now parse each day group into a RawDayEntry
  // Reset month tracking for the actual parse
  currentYear = config.startDate.year;
  currentMonth = config.startDate.month;

  for (const group of dayGroups) {
    const entry = parseDayGroup(group, currentYear, currentMonth);
    if (entry) {
      // Update month/year from parsed entry
      const [eYear, eMonth] = entry.date.split("-").map(Number);
      currentYear = eYear;
      currentMonth = eMonth;
      entries.push(entry);
    }
  }

  return entries;
}

function parseDayGroup(
  group: { headerLine: string; subsequentLines: string[]; province: string | null },
  currentYear: number,
  currentMonth: number
): RawDayEntry | null {
  const header = group.headerLine;
  const lines = group.subsequentLines;

  // Parse header: [day] [dayAbbrev] [celebrationText] [color]
  const headerMatch = header.match(/^(\d{1,2})\s+(Sun|Mon|Tue|Wed|Thu|Fri|Sat|SUN)\s+(.+)$/i);
  if (!headerMatch) return null;

  const dayNum = parseInt(headerMatch[1], 10);
  const dayAbbrev = headerMatch[2];
  let celebrationAndColor = headerMatch[3];

  // Extract color from end of header line
  const colorExtract = extractTrailingColor(celebrationAndColor);
  let colorStr = "";
  let celebrationText = celebrationAndColor;

  if (colorExtract) {
    celebrationText = colorExtract.text;
    colorStr = colorExtract.color;
  }

  // Check if celebration name continues on next line(s)
  // This happens when the name wraps (e.g., "THE IMMACULATE CONCEPTION OF THE" / "BLESSED VIRGIN MARY")
  const continuationLines: string[] = [];
  let lineIdx = 0;

  while (lineIdx < lines.length) {
    const nextLine = lines[lineIdx];
    const trimmedNext = nextLine.trim();

    // Check if this looks like a continuation of the title
    // (not a rank word, not a citation, not a bracket optional memorial, not a special label)
    const isRankWord = Object.keys(RANK_KEYWORDS).includes(trimmedNext) || trimmedNext.startsWith("Solemnity");
    const isCitation = /^[A-Z][a-z]*\s+\d/.test(trimmedNext) || /^\d\s+[A-Z]/.test(trimmedNext);
    const isBracket = trimmedNext.startsWith("[");
    const isSpecialLabel =
      trimmedNext.startsWith("Vigil:") ||
      trimmedNext.startsWith("Night:") ||
      trimmedNext.startsWith("Dawn:") ||
      trimmedNext.startsWith("Day:") ||
      trimmedNext.startsWith("Morning:") ||
      trimmedNext.startsWith("Chrism Mass:") ||
      trimmedNext.startsWith("Evening Mass");
    const hasLectionary = /\(\d+/.test(trimmedNext);

    // Title continuation: ALLCAPS text, or "(text)" subtitle, or text that doesn't look like anything else
    if (
      !isRankWord &&
      !isCitation &&
      !isBracket &&
      !isSpecialLabel &&
      !hasLectionary &&
      !trimmedNext.startsWith("or,") &&
      !trimmedNext.startsWith("or any") &&
      // These are continuation if they look like a subtitle
      (/^[A-Z(]/.test(trimmedNext) || trimmedNext.startsWith("("))
    ) {
      // Check if it looks like a continuation (all caps, or parenthetical subtitle)
      if (
        /^[A-Z\s,()]+$/.test(trimmedNext) || // ALL CAPS continuation
        trimmedNext.startsWith("(") || // parenthetical subtitle
        trimmedNext === "Bishops and Doctors of the Church" || // multi-line title
        trimmedNext.startsWith("The Octave Day") ||
        trimmedNext.startsWith("Protection of Unborn")
      ) {
        continuationLines.push(trimmedNext);
        lineIdx++;
        continue;
      }
    }
    break;
  }

  // Build full celebration name
  if (continuationLines.length > 0) {
    celebrationText = celebrationText + " " + continuationLines.join(" ");
  }

  // Strip footnote superscript numbers from celebration text
  // These appear as trailing digits: "Holy Thursday)8" or "Holy Saturday9" or "Easter Weekday11"
  celebrationText = celebrationText.replace(/(\))(\d{1,2})$/, "$1"); // "(Holy Thursday)8" -> "(Holy Thursday)"
  celebrationText = celebrationText.replace(/([a-zA-Z])(\d{1,2})$/, "$1"); // "Holy Saturday9" -> "Holy Saturday"
  // Also handle bracket content with footnote: "[Saint X]4" -> "[Saint X]"
  celebrationText = celebrationText.replace(/(\])(\d{1,2})$/, "$1");

  // Parse celebration name and USA prefix
  const { name: celebrationName, isUSA } = parseCelebrationName(celebrationText);

  // Process remaining lines (color parsed after loop since it may appear on citation line)
  let rank: RawDayEntry["rank"] = "weekday";
  const optionalMemorials: string[] = [];
  let isHolyday = false;
  let isBVM = false;
  let citationParts: string[] = [];
  const specialReadingSets: SpecialReadingSet[] = [];
  let alternateReadings: string | null = null;
  const notes: string[] = [];

  // Determine rank from celebration name casing
  // ALLCAPS names are typically Sundays or Solemnities
  if (/^[A-Z\s:,.()]+$/.test(celebrationName) && celebrationName.length > 5) {
    // Could be a Sunday or Solemnity — will be refined below
  }

  for (; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx].trim();

    // Rank line
    if (line === "Solemnity" || line.startsWith("Solemnity ")) {
      rank = "solemnity";
      if (line.includes("[Holyday of Obligation]")) {
        isHolyday = true;
      }
      continue;
    }
    if (line === "Feast") {
      rank = "feast";
      continue;
    }
    if (line === "Memorial") {
      rank = "memorial";
      continue;
    }

    // Holyday on its own line or combined with Solemnity
    if (line === "[Holyday of Obligation]") {
      isHolyday = true;
      continue;
    }

    // Optional memorials in brackets
    if (line.startsWith("[")) {
      let bracketText = line;
      // Handle multi-line brackets
      while (!bracketText.includes("]") && lineIdx + 1 < lines.length) {
        lineIdx++;
        bracketText += " " + lines[lineIdx].trim();
      }

      // Extract content from brackets, stripping footnote numbers
      const bracketContent = bracketText
        .replace(/^\[/, "")
        .replace(/\]\d*$/, "") // strip "]" and optional trailing footnote digit
        .trim();

      // Check for special markers
      if (bracketContent === "BVM") {
        isBVM = true;
      } else if (bracketContent === "Holyday of Obligation") {
        isHolyday = true;
      } else {
        // Could be multiple optional memorials separated by ";"
        const memorials = bracketContent.split(";").map((m) => m.trim());
        for (const mem of memorials) {
          if (mem === "BVM") {
            isBVM = true;
          } else if (mem.startsWith("USA:")) {
            optionalMemorials.push(mem);
          } else {
            optionalMemorials.push(mem);
          }
        }
        // If there are optional memorials, this implies optional_memorial rank
        // (unless already set higher)
        if (rank === "weekday" && optionalMemorials.length > 0) {
          rank = "weekday"; // stays weekday — the optional memorial is just an option
        }
      }
      continue;
    }

    // Special reading set labels
    if (
      line.startsWith("Vigil:") ||
      line.startsWith("Night:") ||
      line.startsWith("Dawn:") ||
      line.startsWith("Day:") ||
      line.startsWith("Chrism Mass:") ||
      line.startsWith("Evening Mass")
    ) {
      const colonIdx = line.indexOf(":");
      const label = line.slice(0, colonIdx).trim();
      let citationStr = line.slice(colonIdx + 1).trim();

      // Handle continuation
      while (
        lineIdx + 1 < lines.length &&
        !lines[lineIdx + 1].trim().match(/^(Vigil|Night|Dawn|Day|Chrism|Evening|\[|Memorial|Feast|Solemnity|\d{1,2}\s+(Sun|Mon|Tue|Wed|Thu|Fri|Sat|SUN))/) &&
        !lines[lineIdx + 1].trim().startsWith("or,") &&
        /^[A-Za-z0-9(]/.test(lines[lineIdx + 1].trim()) &&
        /[/,;]/.test(lines[lineIdx + 1].trim().charAt(0)) === false
      ) {
        // Check if next line is a continuation of citations
        const nextTrimmed = lines[lineIdx + 1].trim();
        if (
          /^[A-Z][a-z]+\s+\d/.test(nextTrimmed) || // Book reference
          /^or[\s,]/.test(nextTrimmed) || // "or" alternative
          nextTrimmed.startsWith("(") || // continuation parens
          /^[a-z]/.test(nextTrimmed) // lowercase continuation
        ) {
          lineIdx++;
          citationStr += " " + nextTrimmed;
        } else {
          break;
        }
      }

      specialReadingSets.push({
        label,
        citations: citationStr,
        lectionaryNumber: extractLectionaryNumber(citationStr),
      });
      continue;
    }

    // Morning: label on a citation line
    if (line.startsWith("Morning:")) {
      const citationStr = line.slice(8).trim();
      specialReadingSets.push({
        label: "Morning",
        citations: citationStr,
        lectionaryNumber: extractLectionaryNumber(citationStr),
      });
      continue;
    }

    // "or," alternative readings
    if (line.startsWith("or,") || line.startsWith("or any")) {
      alternateReadings = line;
      continue;
    }

    // Extended Vigil continuation
    if (line.startsWith("or, for the Extended Vigil:")) {
      // Part of the previous special reading set
      if (specialReadingSets.length > 0) {
        specialReadingSets[specialReadingSets.length - 1].citations +=
          " " + line;
      }
      continue;
    }

    // Citation lines — everything else that contains scripture references
    // These contain book abbreviations, chapter:verse, slashes, and (lectionary#)
    if (
      /[A-Z][a-z]*\s+\d/.test(line) || // "Is 2:1-5" pattern
      /^\d\s+[A-Z]/.test(line) || // "1 Cor 3:1" pattern
      (line.includes("(") && /\d/.test(line)) // has (lectionary number)
    ) {
      // Check if the citation line has a color at the end (some PDFs put color there)
      const citColorExtract = extractTrailingColor(line);
      if (citColorExtract && !colorStr) {
        // Color was on the citation line, not the header
        citationParts.push(citColorExtract.text);
        colorStr = citColorExtract.color;
      } else {
        citationParts.push(line);
      }
      continue;
    }

    // Check for standalone "Pss Prop" or "Pss I" etc.
    if (/^Pss?\s+(I{1,3}V?|IV|Prop)$/.test(line)) {
      citationParts.push(line);
      continue;
    }

    // Anything else is a note
    notes.push(line);
  }

  // Combine citation parts
  let fullCitation = citationParts.join(" ").trim();

  // Filter out any footnote content that slipped into citations
  // Footnote text starts with lowercase and doesn't contain book abbreviations at the start
  if (fullCitation && /^[a-z]/.test(fullCitation) && !fullCitation.startsWith("or")) {
    fullCitation = "";
  }

  // Extract lectionary number and psalter week from combined citation
  let lectionaryNumber = fullCitation ? extractLectionaryNumber(fullCitation) : null;
  // If no lectionary from main citations, use the last special reading set
  if (!lectionaryNumber && specialReadingSets.length > 0) {
    lectionaryNumber = specialReadingSets[specialReadingSets.length - 1].lectionaryNumber;
  }
  const psalterWeek = extractPsalterWeek(fullCitation);

  // Determine rank for Sundays if not already set
  if (rank === "weekday" && dayAbbrev.toUpperCase() === "SUN") {
    // Sundays are at least "sunday" rank, but some are Solemnities/Feasts
    // If the celebration name is all-caps, likely a major Sunday
    rank = "weekday"; // we'll use the rank that was parsed, or default
  }

  // Compute date
  // Handle the transition from Nov to Dec in NOVEMBER-DECEMBER section
  let month = currentMonth;
  let year = currentYear;

  // Smart month detection: if previous entry in same parse was day 30+ and now we're at day 1,
  // month must have advanced. This is handled by the caller.

  const date = `${year}-${String(month).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;

  // Parse color (done here because color may have been found on citation line)
  const colorInfo = parseColor(colorStr);

  return {
    date,
    dayOfWeek: dayAbbrev,
    celebrationName: celebrationName.trim(),
    rank,
    colorPrimary: colorInfo.primary,
    colorSecondary: colorInfo.secondary,
    colorAlternate: colorInfo.alternate,
    allColors: colorInfo.all,
    citations: fullCitation || specialReadingSets.map((s) => `${s.label}: ${s.citations}`).join("; "),
    lectionaryNumber,
    psalterWeek,
    optionalMemorials,
    isHolyday,
    isBVM,
    isUSA,
    isTransferred: false,
    ecclesiasticalProvince: group.province,
    specialReadingSets,
    alternateReadings,
    notes,
  };
}

// ============================================================
// Post-processing: fix dates, merge duplicates, etc.
// ============================================================

function postProcess(entries: RawDayEntry[], config: CalendarConfig): RawDayEntry[] {
  // Fix sequential dates
  let lastMonth = config.startDate.month;
  let lastYear = config.startDate.year;
  let lastDay = 0;

  for (const entry of entries) {
    const dayNum = parseInt(entry.date.split("-")[2], 10);

    // Detect month transition
    if (dayNum < lastDay) {
      // Month advanced
      lastMonth++;
      if (lastMonth > 12) {
        lastMonth = 1;
        lastYear++;
      }
    }
    lastDay = dayNum;

    // Recompute date
    entry.date = `${lastYear}-${String(lastMonth).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
  }

  // Mark Ascension transferred entries
  for (let i = 0; i < entries.length - 1; i++) {
    if (
      entries[i].date === entries[i + 1].date &&
      entries[i].ecclesiasticalProvince !== entries[i + 1].ecclesiasticalProvince
    ) {
      entries[i].isTransferred = true;
      entries[i + 1].isTransferred = true;
    }
  }

  // Refine ranks based on known rules
  for (const entry of entries) {
    const nameUpper = entry.celebrationName.toUpperCase();
    const isSunday = entry.dayOfWeek.toUpperCase() === "SUN";

    // Sundays
    if (isSunday && entry.rank === "weekday") {
      // Some Sundays are Solemnities
      if (
        nameUpper.includes("EASTER SUNDAY") ||
        nameUpper.includes("PENTECOST") ||
        nameUpper.includes("EPIPHANY") ||
        nameUpper.includes("MOST HOLY BODY") ||
        nameUpper.includes("KING OF THE UNIVERSE") ||
        nameUpper.includes("ALL SAINTS") ||
        nameUpper.includes("ASCENSION")
      ) {
        entry.rank = "solemnity";
      } else if (
        nameUpper.includes("HOLY FAMILY") ||
        nameUpper.includes("BAPTISM OF THE LORD")
      ) {
        entry.rank = "feast";
      } else {
        // All other Sundays get "sunday" pseudo-rank — but since our type doesn't have it,
        // treat regular Sundays as "sunday" which we'll add to the type
        // For now, mark as "feast" since Sundays outrank memorials
        // Actually — let's keep it clean. Sundays in the liturgical calendar
        // have their own rank between Feast and Solemnity.
        // We'll treat them as "sunday" — but the type only allows specific values.
        // Let's just leave them as "weekday" and add a `isSunday` marker in post-processing.
        // ACTUALLY: per the plan, we have a "sunday" rank in the CelebrationRank type.
        // But this raw parse type doesn't include it yet. We'll handle in the populate script.
        // For the raw JSON, mark them distinctly:
        (entry as any).rank = "sunday";
      }
    }

    // Octave days
    if (entry.celebrationName.includes("within the Octave")) {
      if (entry.rank === "weekday") {
        entry.rank = "solemnity";
      }
    }

    // Holy Thursday, Good Friday, Holy Saturday — these are special
    if (nameUpper.includes("HOLY THURSDAY") || nameUpper.includes("LORD'S SUPPER")) {
      if (entry.rank === "weekday") entry.rank = "solemnity";
    }
    if (nameUpper.includes("GOOD FRIDAY") || nameUpper.includes("PASSION OF THE LORD") && entry.dayOfWeek === "Fri") {
      if (entry.rank === "weekday") entry.rank = "solemnity";
    }
    if (nameUpper.includes("HOLY SATURDAY") || nameUpper.includes("EASTER VIGIL")) {
      if (entry.rank === "weekday") entry.rank = "solemnity";
    }

    // Palm Sunday
    if (nameUpper.includes("PALM SUNDAY")) {
      (entry as any).rank = "sunday";
    }

    // Strip trailing footnote numbers from Pss references in citations
    entry.citations = entry.citations.replace(/Pss?\s+(I{1,3}V?|IV|Prop)\d+/, (m) => {
      // "Pss I3" -> "Pss I"
      return m.replace(/\d+$/, "");
    });
  }

  return entries;
}

// ============================================================
// Main
// ============================================================

const CONFIGS: CalendarConfig[] = [
  {
    pdfPath:
      "/Users/jeffreybonilla/St Monica Dropbox/Music Ministry/Administration/USCCB Liturgical Calendars/2026 USCCB Liturgical Calendar.pdf",
    yearLabel: "2026",
    startDate: { year: 2025, month: 11 }, // Nov 2025
    sundayCycle: "A",
    weekdayCycle: "2",
  },
  {
    pdfPath:
      "/Users/jeffreybonilla/St Monica Dropbox/Music Ministry/Administration/USCCB Liturgical Calendars/2027 USCCB Liturgical Calendar.pdf",
    yearLabel: "2027",
    startDate: { year: 2026, month: 11 }, // Nov 2026
    sundayCycle: "B",
    weekdayCycle: "1",
  },
];

async function main() {
  for (const config of CONFIGS) {
    console.log(`\nParsing ${config.yearLabel} calendar...`);
    console.log(`  PDF: ${path.basename(config.pdfPath)}`);

    const lines = await extractText(config.pdfPath);
    console.log(`  Extracted ${lines.length} lines`);

    let entries = parseCalendarText(lines, config);
    console.log(`  Parsed ${entries.length} raw day entries`);

    entries = postProcess(entries, config);
    console.log(`  Post-processed ${entries.length} entries`);

    // Output
    const outDir = path.resolve(__dirname, "../src/data");
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    const outPath = path.join(outDir, `usccb-${config.yearLabel}.json`);
    fs.writeFileSync(outPath, JSON.stringify(entries, null, 2));
    console.log(`  Written to: ${outPath}`);

    // Summary stats
    const ranks = entries.reduce(
      (acc, e) => {
        acc[e.rank] = (acc[e.rank] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );
    console.log(`  Ranks:`, ranks);

    const colors = entries.reduce(
      (acc, e) => {
        acc[e.colorPrimary] = (acc[e.colorPrimary] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );
    console.log(`  Colors:`, colors);

    // Show first 5 and last 5
    console.log(`\n  First 5 entries:`);
    for (const e of entries.slice(0, 5)) {
      console.log(
        `    ${e.date} ${e.dayOfWeek} | ${e.celebrationName} | ${e.rank} | ${e.colorPrimary}`
      );
    }
    console.log(`  Last 5 entries:`);
    for (const e of entries.slice(-5)) {
      console.log(
        `    ${e.date} ${e.dayOfWeek} | ${e.celebrationName} | ${e.rank} | ${e.colorPrimary}`
      );
    }

    // Spot checks — different dates per calendar year
    console.log(`\n  Spot checks:`);
    const spotDates =
      config.yearLabel === "2026"
        ? [
            "2025-12-25", // Christmas
            "2026-02-18", // Ash Wednesday
            "2026-04-05", // Easter
            "2026-04-02", // Holy Thursday
            "2026-04-03", // Good Friday
            "2026-12-08", // Immaculate Conception
          ]
        : [
            "2026-12-25", // Christmas
            "2027-02-10", // Ash Wednesday
            "2027-03-28", // Easter
            "2027-03-25", // Holy Thursday
            "2027-03-26", // Good Friday
            "2027-11-29", // First Sunday of Advent (next year)
          ];
    for (const d of spotDates) {
      const matches = entries.filter((e) => e.date === d);
      if (matches.length > 0) {
        for (const m of matches) {
          console.log(
            `    ${m.date}: ${m.celebrationName} | ${m.rank} | ${m.colorPrimary} | lect:${m.lectionaryNumber} | gloria:- | holyday:${m.isHolyday}${m.ecclesiasticalProvince ? ` | province:${m.ecclesiasticalProvince}` : ""}`
          );
        }
      } else {
        console.log(`    ${d}: NOT FOUND`);
      }
    }
  }
}

main().catch(console.error);
