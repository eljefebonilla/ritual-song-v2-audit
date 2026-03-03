/**
 * fix-liturgical-dates.js
 *
 * Computes correct liturgical calendar dates for all occasions in all-occasions.json.
 *
 * Year A: Advent 2025 (Nov 30, 2025) through Christ the King 2026 (Nov 22, 2026)
 * Year B: Advent 2026 (Nov 29, 2026) through Christ the King 2027 (Nov 21, 2027)
 * Year C: Advent 2027 (Nov 27, 2027) through Christ the King 2028 (Nov 26, 2028)
 *
 * Easter dates:
 *   2026: April 5
 *   2027: March 28
 *   2028: April 16
 */

const fs = require("fs");
const path = require("path");

const DATA_PATH = path.join(__dirname, "../src/data/all-occasions.json");

// ─── Date helpers ────────────────────────────────────────────────────────────

function pad(n) {
  return String(n).padStart(2, "0");
}

function fmt(d) {
  // YYYY-MM-DD
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function dayOfWeek(d) {
  return d.getDay(); // 0=Sun
}

/** Return the Sunday on or before the given date */
function sundayOnOrBefore(d) {
  const dow = dayOfWeek(d);
  return addDays(d, -dow);
}

/** Return the Sunday nearest to the given date */
function sundayNearest(d) {
  const dow = dayOfWeek(d);
  if (dow <= 3) return addDays(d, -dow); // Sun-Wed → go back
  return addDays(d, 7 - dow); // Thu-Sat → go forward
}

/** Return the Sunday after the given date (strictly after) */
function sundayAfter(d) {
  const dow = dayOfWeek(d);
  return addDays(d, 7 - dow);
}

/** Return the Nth day-of-week in a given month/year. dow: 0=Sun. n: 1-based. */
function nthDayOfWeek(year, month, dow, n) {
  const first = new Date(year, month, 1);
  const firstDow = dayOfWeek(first);
  let day = 1 + ((dow - firstDow + 7) % 7) + (n - 1) * 7;
  return new Date(year, month, day);
}

/** Last Thursday in November = Thanksgiving */
function thanksgiving(year) {
  // 4th Thursday of November
  return nthDayOfWeek(year, 10, 4, 4); // month 10 = November, dow 4 = Thursday
}

/** Memorial Day = last Monday of May */
function memorialDay(year) {
  const may31 = new Date(year, 4, 31);
  const dow = dayOfWeek(may31);
  // Go back to Monday
  const diff = (dow - 1 + 7) % 7;
  return addDays(may31, -diff);
}

function makeDate(y, m, d) {
  return new Date(y, m - 1, d);
}

// ─── Liturgical calendar computation ─────────────────────────────────────────

/**
 * Compute all key liturgical anchor dates for a given cycle.
 * cycleYear: the calendar year containing Easter.
 *   Year A: cycleYear=2026 (Easter Apr 5 2026)
 *   Year B: cycleYear=2027 (Easter Mar 28 2027)
 *   Year C: cycleYear=2028 (Easter Apr 16 2028)
 */
function computeAnchors(cycleYear) {
  const easterDates = {
    2026: makeDate(2026, 4, 5),
    2027: makeDate(2027, 3, 28),
    2028: makeDate(2028, 4, 16),
  };

  const easter = easterDates[cycleYear];
  if (!easter) throw new Error(`No Easter date for ${cycleYear}`);

  // Advent 1 = Sunday nearest Nov 30 of the PREVIOUS calendar year
  const adventYear = cycleYear - 1;
  const nov30 = makeDate(adventYear, 11, 30);
  const advent1 = sundayNearest(nov30);

  // Christmas is fixed
  const christmas = makeDate(adventYear, 12, 25);

  // Holy Family = Sunday within the Octave of Christmas (Dec 26-31 or Jan 1)
  // It's the first Sunday after Dec 25. If Dec 25 is Sunday, Holy Family is Dec 30.
  let holyFamily;
  if (dayOfWeek(christmas) === 0) {
    // Christmas is Sunday → Holy Family is the following Sunday (Dec 31... wait no)
    // Actually when Christmas falls on Sunday, Holy Family is celebrated on Dec 30 (Friday)
    // In the US, it's moved to Dec 30.
    holyFamily = makeDate(adventYear, 12, 30);
  } else {
    // First Sunday after Dec 25
    holyFamily = sundayAfter(christmas);
  }

  // Mary Mother of God = Jan 1
  const maryMotherOfGod = makeDate(cycleYear, 1, 1);

  // Epiphany in the US = Sunday between Jan 2 and Jan 8
  // (the Sunday after Jan 1)
  const jan2 = makeDate(cycleYear, 1, 2);
  let epiphany;
  if (dayOfWeek(jan2) === 0) {
    epiphany = jan2;
  } else {
    epiphany = sundayAfter(makeDate(cycleYear, 1, 1));
  }

  // 2nd Sunday after Christmas: the Sunday between Jan 2-8 that isn't Epiphany.
  // In the US where Epiphany is celebrated on the Sunday between Jan 2-8,
  // the 2nd Sunday after Christmas is typically suppressed (replaced by Epiphany).
  // But when there are two Sundays between Jan 1 and Jan 6+, both can exist.
  // Actually: 2nd Sunday after Christmas only occurs if there's a Sunday between
  // Dec 29-31 AND another between Jan 2-5 before Epiphany.
  // In practice, in the ADLA (Archdiocese of LA), Epiphany replaces 2nd Sunday after Christmas.
  // The occasion ID confirms this: "2nd-sun-after-christmas-abc-epiphany-replaces-in-adla"
  // So this occasion gets the same date as Epiphany.
  const secondSunAfterChristmas = epiphany; // Same date in ADLA

  // Baptism of the Lord = Sunday after Epiphany
  // BUT if Epiphany falls on Jan 7 or 8, Baptism is the next day (Monday)
  let baptismOfLord;
  if (epiphany.getDate() >= 7 && epiphany.getMonth() === 0) {
    // Epiphany is Jan 7 or 8 → Baptism is the Monday after
    baptismOfLord = addDays(epiphany, 1);
  } else {
    baptismOfLord = sundayAfter(epiphany);
  }

  // Ordinary Time begins the day after Baptism of the Lord
  // OT Week 1 doesn't really exist as a Sunday (Baptism replaces it)
  // OT Week 2 Sunday is the Sunday after Baptism of the Lord
  const otWeek2Start = sundayAfter(baptismOfLord);

  // Ash Wednesday = 46 days before Easter
  const ashWednesday = addDays(easter, -46);

  // Lent 1 = Sunday after Ash Wednesday
  const lent1 = sundayAfter(ashWednesday);

  // Last OT Sunday before Lent
  const lastOtSundayBeforeLent = addDays(lent1, -7);

  // Figure out which OT week that last Sunday before Lent is
  // OT Week 2 starts on otWeek2Start
  // Number of weeks from OT Week 2 start to last Sunday before Lent
  const weeksBeforeLent = Math.round(
    (lastOtSundayBeforeLent - otWeek2Start) / (7 * 24 * 60 * 60 * 1000)
  );
  const lastOtWeekBeforeLent = 2 + weeksBeforeLent;

  // Palm Sunday = Sunday before Easter
  const palmSunday = addDays(easter, -7);

  // Holy Thursday = Thursday before Easter
  const holyThursday = addDays(easter, -3);

  // Good Friday = Friday before Easter
  const goodFriday = addDays(easter, -2);

  // Easter Vigil = Saturday before Easter
  const easterVigil = addDays(easter, -1);

  // Pentecost = 50 days after Easter (7 weeks)
  const pentecost = addDays(easter, 49);

  // Pentecost Vigil = day before Pentecost
  const pentecostVigil = addDays(pentecost, -1);

  // Ascension: In many US dioceses, transferred to Sunday (7th Sunday of Easter)
  // = 6 weeks after Easter = Easter + 42 days
  // Actually, Ascension Thursday = Easter + 39 days
  // In the ADLA it's transferred to the 7th Sunday of Easter
  const ascension = addDays(easter, 42); // 7th Sunday of Easter

  // Trinity Sunday = Sunday after Pentecost
  const trinitySunday = addDays(pentecost, 7);

  // Corpus Christi = Sunday after Trinity
  const corpusChristi = addDays(pentecost, 14);

  // Christ the King = last Sunday of the liturgical year = Sunday before Advent 1 of NEXT cycle
  const nextAdvent1Nov30 = makeDate(cycleYear, 11, 30);
  const nextAdvent1 = sundayNearest(nextAdvent1Nov30);
  const christTheKing = addDays(nextAdvent1, -7);

  // OT resumes after Pentecost
  // The Sunday after Pentecost is Trinity Sunday (not an OT Sunday)
  // The Sunday after Trinity is Corpus Christi (not an OT Sunday)
  // OT resumes on the Sunday after Corpus Christi
  const otResumeSunday = addDays(corpusChristi, 7);

  // Christ the King is OT Week 34 (the last week)
  // Count backwards from Christ the King to figure out which OT week resumes
  const weeksFromResumeToCtK = Math.round(
    (christTheKing - otResumeSunday) / (7 * 24 * 60 * 60 * 1000)
  );
  const firstOtWeekAfterPentecost = 34 - weeksFromResumeToCtK;

  return {
    advent1,
    christmas,
    holyFamily,
    maryMotherOfGod,
    epiphany,
    secondSunAfterChristmas,
    baptismOfLord,
    otWeek2Start,
    lastOtWeekBeforeLent,
    ashWednesday,
    lent1,
    palmSunday,
    holyThursday,
    goodFriday,
    easterVigil,
    easter,
    ascension,
    pentecost,
    pentecostVigil,
    trinitySunday,
    corpusChristi,
    otResumeSunday,
    firstOtWeekAfterPentecost,
    christTheKing,
    cycleYear,
    adventYear,
  };
}

/**
 * Given anchors and an OT week number (2-34), return the date of that Sunday.
 * Returns null if that week is suppressed (displaced by Lent or post-Pentecost solemnities).
 */
function ordinaryTimeSunday(anchors, weekNum) {
  if (weekNum < 2 || weekNum > 34) return null;

  // Before Lent: weeks 2 through lastOtWeekBeforeLent
  if (weekNum <= anchors.lastOtWeekBeforeLent) {
    const date = addDays(anchors.otWeek2Start, (weekNum - 2) * 7);
    // Verify it's before Ash Wednesday
    if (date < anchors.ashWednesday) {
      return date;
    }
    return null; // Suppressed
  }

  // After Pentecost: weeks firstOtWeekAfterPentecost through 34
  if (weekNum >= anchors.firstOtWeekAfterPentecost) {
    // Christ the King = week 34
    const weeksBeforeCtK = 34 - weekNum;
    const date = addDays(anchors.christTheKing, -weeksBeforeCtK * 7);
    return date;
  }

  // Week falls in the gap (during Lent/Easter) - not celebrated
  return null;
}

// ─── Process occasions ───────────────────────────────────────────────────────

function computeDateForOccasion(occ, anchorsA, anchorsB, anchorsC) {
  const { id, year, season, seasonOrder } = occ;

  function getAnchors(yr) {
    if (yr === "A") return anchorsA;
    if (yr === "B") return anchorsB;
    if (yr === "C") return anchorsC;
    return null;
  }

  // For year-specific occasions
  function computeSingle(anchors) {
    // ADVENT
    if (season === "advent") {
      // seasonOrder 1-4 = Advent weeks 1-4
      if (seasonOrder >= 1 && seasonOrder <= 4) {
        return fmt(addDays(anchors.advent1, (seasonOrder - 1) * 7));
      }
    }

    // CHRISTMAS
    if (season === "christmas") {
      if (id.startsWith("holy-family")) {
        return fmt(anchors.holyFamily);
      }
    }

    // ORDINARY TIME
    if (season === "ordinary") {
      // Baptism of the Lord
      if (id.startsWith("baptism-of-the-lord")) {
        return fmt(anchors.baptismOfLord);
      }

      // Regular OT Sundays (seasonOrder = week number 2-33)
      if (seasonOrder >= 2 && seasonOrder <= 33) {
        const date = ordinaryTimeSunday(anchors, seasonOrder);
        return date ? fmt(date) : null;
      }
    }

    // LENT
    if (season === "lent") {
      // Lent weeks 1-5
      if (seasonOrder >= 1 && seasonOrder <= 5) {
        return fmt(addDays(anchors.lent1, (seasonOrder - 1) * 7));
      }
      // Palm Sunday (seasonOrder 0 with "palm" in id)
      if (id.startsWith("palm-sunday")) {
        return fmt(anchors.palmSunday);
      }
    }

    // EASTER
    if (season === "easter") {
      // Easter weeks 2-7
      if (seasonOrder >= 2 && seasonOrder <= 7) {
        // Easter 2 = 1 week after Easter, Easter 3 = 2 weeks, etc.
        // Easter 7 is the Sunday before Pentecost.
        // But Ascension (in ADLA) is on Easter 7 Sunday.
        // Let's check if this is ascension
        if (id.startsWith("ascension")) {
          return fmt(anchors.ascension);
        }
        if (id.startsWith("easter-07")) {
          // Easter 7 Sunday = Ascension in ADLA. But there IS an Easter 07 occasion too.
          // Easter 07 = 6 weeks after Easter
          return fmt(addDays(anchors.easter, (seasonOrder - 1) * 7));
        }
        return fmt(addDays(anchors.easter, (seasonOrder - 1) * 7));
      }
      // Ascension (seasonOrder 0)
      if (id.startsWith("ascension")) {
        return fmt(anchors.ascension);
      }
      // Pentecost (seasonOrder 0)
      if (id.startsWith("pentecost-") && !id.includes("vigil") && !id.includes("ext")) {
        return fmt(anchors.pentecost);
      }
    }

    // SOLEMNITY
    if (season === "solemnity") {
      if (id.includes("trinity")) {
        return fmt(anchors.trinitySunday);
      }
      if (id.includes("body-blood") || id.includes("corpus")) {
        return fmt(anchors.corpusChristi);
      }
      if (id.includes("christ-the-king")) {
        return fmt(anchors.christTheKing);
      }
    }

    return undefined; // Signal that we didn't handle it
  }

  // ─── ABC occasions (fixed dates or shared) ──────────────────────────────

  if (year === "ABC") {
    // Compute dates for all 3 years
    let dateA, dateB, dateC;

    // FIXED-DATE occasions
    if (id === "nativity") {
      dateA = fmt(makeDate(2025, 12, 25));
      dateB = fmt(makeDate(2026, 12, 25));
      dateC = fmt(makeDate(2027, 12, 25));
    } else if (id === "jan-1-mary-mother-of-god-abc") {
      dateA = fmt(makeDate(2026, 1, 1));
      dateB = fmt(makeDate(2027, 1, 1));
      dateC = fmt(makeDate(2028, 1, 1));
    } else if (id === "solemnity-immaculate-conception") {
      dateA = fmt(makeDate(2025, 12, 8));
      dateB = fmt(makeDate(2026, 12, 8));
      dateC = fmt(makeDate(2027, 12, 8));
    } else if (id === "feast-our-lady-of-guadalupe-abc") {
      dateA = fmt(makeDate(2025, 12, 12));
      dateB = fmt(makeDate(2026, 12, 12));
      dateC = fmt(makeDate(2027, 12, 12));
    } else if (id === "feast-abc-feb-2-presentation-of-the-lord") {
      dateA = fmt(makeDate(2026, 2, 2));
      dateB = fmt(makeDate(2027, 2, 2));
      dateC = fmt(makeDate(2028, 2, 2));
    } else if (id === "independence-day") {
      dateA = fmt(makeDate(2026, 7, 4));
      dateB = fmt(makeDate(2027, 7, 4));
      dateC = fmt(makeDate(2028, 7, 4));
    } else if (id === "feast-of-st-monica") {
      dateA = fmt(makeDate(2026, 8, 27));
      dateB = fmt(makeDate(2027, 8, 27));
      dateC = fmt(makeDate(2028, 8, 27));
    } else if (id === "feast-the-exaltation-sep-14-of-the-holy-cross-abc") {
      dateA = fmt(makeDate(2026, 9, 14));
      dateB = fmt(makeDate(2027, 9, 14));
      dateC = fmt(makeDate(2028, 9, 14));
    } else if (id === "memorial-abc-feast-of-st-francis-oct-4") {
      dateA = fmt(makeDate(2026, 10, 4));
      dateB = fmt(makeDate(2027, 10, 4));
      dateC = fmt(makeDate(2028, 10, 4));
    } else if (id === "solemnity-nov-1-all-saints-abc") {
      // All Saints falls within OT of the cycle year (Jan-Nov of Easter year)
      dateA = fmt(makeDate(2026, 11, 1));
      dateB = fmt(makeDate(2027, 11, 1));
      dateC = fmt(makeDate(2028, 11, 1));
    } else if (id === "solemnity-nov-1-all-souls-abc") {
      dateA = fmt(makeDate(2026, 11, 2));
      dateB = fmt(makeDate(2027, 11, 2));
      dateC = fmt(makeDate(2028, 11, 2));
    } else if (id === "the-dedication-of-nov-9-the-lateran-basilica-abc") {
      dateA = fmt(makeDate(2026, 11, 9));
      dateB = fmt(makeDate(2027, 11, 9));
      dateC = fmt(makeDate(2028, 11, 9));
    } else if (id === "veteran-s-day") {
      dateA = fmt(makeDate(2026, 11, 11));
      dateB = fmt(makeDate(2027, 11, 11));
      dateC = fmt(makeDate(2028, 11, 11));

    // MOVABLE ABC occasions
    } else if (id === "2nd-sun-after-christmas-abc-epiphany-replaces-in-adla") {
      dateA = fmt(anchorsA.secondSunAfterChristmas);
      dateB = fmt(anchorsB.secondSunAfterChristmas);
      dateC = fmt(anchorsC.secondSunAfterChristmas);
    } else if (id === "the-epiphany-of-the-lord-abc") {
      dateA = fmt(anchorsA.epiphany);
      dateB = fmt(anchorsB.epiphany);
      dateC = fmt(anchorsC.epiphany);
    } else if (id === "mlk-day") {
      // MLK Day = 3rd Monday of January
      dateA = fmt(nthDayOfWeek(2026, 0, 1, 3)); // Jan 2026
      dateB = fmt(nthDayOfWeek(2027, 0, 1, 3)); // Jan 2027
      dateC = fmt(nthDayOfWeek(2028, 0, 1, 3)); // Jan 2028
    } else if (id === "ash-wednesday") {
      dateA = fmt(anchorsA.ashWednesday);
      dateB = fmt(anchorsB.ashWednesday);
      dateC = fmt(anchorsC.ashWednesday);
    } else if (id === "holy-thursday-lords-supper") {
      dateA = fmt(anchorsA.holyThursday);
      dateB = fmt(anchorsB.holyThursday);
      dateC = fmt(anchorsC.holyThursday);
    } else if (id === "good-friday-passion") {
      dateA = fmt(anchorsA.goodFriday);
      dateB = fmt(anchorsB.goodFriday);
      dateC = fmt(anchorsC.goodFriday);
    } else if (id === "easter-vigil") {
      dateA = fmt(anchorsA.easterVigil);
      dateB = fmt(anchorsB.easterVigil);
      dateC = fmt(anchorsC.easterVigil);
    } else if (id === "easter-sunday-abc" || id === "easter-sunday-resurrection") {
      dateA = fmt(anchorsA.easter);
      dateB = fmt(anchorsB.easter);
      dateC = fmt(anchorsC.easter);
    } else if (id === "pentecost-ext-vigil-abc") {
      dateA = fmt(addDays(anchorsA.pentecost, -1));
      dateB = fmt(addDays(anchorsB.pentecost, -1));
      dateC = fmt(addDays(anchorsC.pentecost, -1));
    } else if (id === "pentecost-vigil-abc") {
      dateA = fmt(addDays(anchorsA.pentecost, -1));
      dateB = fmt(addDays(anchorsB.pentecost, -1));
      dateC = fmt(addDays(anchorsC.pentecost, -1));
    } else if (id === "memorial-day") {
      dateA = fmt(memorialDay(2026));
      dateB = fmt(memorialDay(2027));
      dateC = fmt(memorialDay(2028));
    } else if (id === "ss-peter-paul-apostles-jun-29-at-the-vigil-mass-abc") {
      dateA = fmt(makeDate(2026, 6, 28));
      dateB = fmt(makeDate(2027, 6, 28));
      dateC = fmt(makeDate(2028, 6, 28));
    } else if (id === "ss-peter-paul-apostles-jun-29-mass-during-the-day-abc") {
      dateA = fmt(makeDate(2026, 6, 29));
      dateB = fmt(makeDate(2027, 6, 29));
      dateC = fmt(makeDate(2028, 6, 29));
    } else if (id === "thanksgiving") {
      // Thanksgiving = 4th Thursday of November in the Advent-year
      // For Year A, Advent starts Nov 30, 2025, so Thanksgiving 2025 is in Year A's range
      // Actually, Year A's liturgical year runs Advent 2025 through Christ the King 2026
      // Thanksgiving 2025 is before Advent 2025 starts, so it's in the PREVIOUS liturgical year
      // But the occasion is ABC... let's use the cycleYear's Thanksgiving
      dateA = fmt(thanksgiving(2026));
      dateB = fmt(thanksgiving(2027));
      dateC = fmt(thanksgiving(2028));
      // Wait — Thanksgiving in November comes AFTER most of OT and before Advent.
      // Year A spans Nov 30 2025 to Nov 22 2026. Thanksgiving 2026 would be Nov 26, 2026.
      // That's AFTER Christ the King (Nov 22) and before Advent 1 Year B (Nov 29).
      // So Thanksgiving falls in a weird gap. Let's just assign it to the cycle year.
      // Actually Thanksgiving 2025 is Nov 27 — that's 3 days before Advent 1 Year A (Nov 30).
      // Let's think about this differently. The app just needs to show when it happens.
      // For the liturgical year that starts with Advent of adventYear:
      //   Thanksgiving falls in late November of BOTH adventYear and cycleYear.
      //   The one in adventYear is just before the liturgical year starts.
      //   The one in cycleYear is at the end, just after Christ the King.
      // The most useful date is the one in the cycleYear (the one they'd actually plan for).
      // Let's keep cycleYear Thanksgiving.
    } else {
      console.warn(`  UNHANDLED ABC occasion: ${id}`);
      return { nextDate: occ.nextDate };
    }

    return {
      nextDate: dateA, // Primary date = Year A
      nextDates: { a: dateA, b: dateB, c: dateC },
    };
  }

  // ─── Year-specific occasions (A, B, or C) ─────────────────────────────

  const anchors = getAnchors(year);
  if (!anchors) {
    console.warn(`  Unknown year "${year}" for ${id}`);
    return { nextDate: occ.nextDate };
  }

  const result = computeSingle(anchors);
  if (result === undefined) {
    console.warn(`  UNHANDLED occasion: ${id} (season=${season}, order=${seasonOrder})`);
    return { nextDate: occ.nextDate };
  }

  return { nextDate: result };
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main() {
  const data = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));

  const anchorsA = computeAnchors(2026);
  const anchorsB = computeAnchors(2027);
  const anchorsC = computeAnchors(2028);

  // Debug: print anchors
  console.log("=== Year A Anchors ===");
  for (const [k, v] of Object.entries(anchorsA)) {
    if (v instanceof Date) console.log(`  ${k}: ${fmt(v)}`);
    else console.log(`  ${k}: ${v}`);
  }
  console.log();
  console.log("=== Year B Anchors ===");
  for (const [k, v] of Object.entries(anchorsB)) {
    if (v instanceof Date) console.log(`  ${k}: ${fmt(v)}`);
    else console.log(`  ${k}: ${v}`);
  }
  console.log();
  console.log("=== Year C Anchors ===");
  for (const [k, v] of Object.entries(anchorsC)) {
    if (v instanceof Date) console.log(`  ${k}: ${fmt(v)}`);
    else console.log(`  ${k}: ${v}`);
  }
  console.log();

  let changed = 0;
  let unhandled = 0;

  for (const occ of data) {
    const result = computeDateForOccasion(occ, anchorsA, anchorsB, anchorsC);

    if (result.nextDate !== occ.nextDate) {
      console.log(
        `  ${occ.id}: ${occ.nextDate} → ${result.nextDate}`
      );
      occ.nextDate = result.nextDate;
      changed++;
    }

    if (result.nextDates) {
      occ.nextDates = result.nextDates;
    }
  }

  console.log(`\nChanged ${changed} dates out of ${data.length} occasions.`);

  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2) + "\n", "utf8");
  console.log("Written to", DATA_PATH);
}

main();
