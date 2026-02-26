import fs from "fs";
import path from "path";
import Papa from "papaparse";
import type {
  LiturgicalOccasion,
  LiturgicalYear,
  LiturgicalSeason,
  OccasionDate,
  Reading,
  Antiphon,
  MusicPlan,
  SongEntry,
  LibrarySong,
} from "../src/lib/types";

// ───── CONFIGURATION ─────

const CSV_PATH = path.join(
  __dirname,
  "../../CSV Drops to Claude/MASS PREP V2 - MASTER.csv"
);
const OUTPUT_DIR = path.join(__dirname, "../src/data");
const OCCASIONS_DIR = path.join(OUTPUT_DIR, "occasions");

// Each occasion uses 3 columns: data col, spacer, spacer
const COL_GROUP_SIZE = 3;

// ───── CSV ROW LAYOUT (0-indexed papaparse rows) ─────

const ROW = {
  // Dates
  primaryDate: 0, // "Year A — Nov 30, 2025 (Sun)"
  dateExtra: [3, 4, 5, 6] as number[], // Future cycle dates

  // Calendar markers
  weekMarkers: 8, // "THIS WEEK" / "NEXT WEEK" in specific columns

  // Occasion identity
  occasionName: 10, // "ADVENT 01 [A]"
  lectionary: 11, // "001•A | Stay Awake, Be Ready"
  thematicTag: 12, // "Apocalyptic Watch (Mt 24)"

  // Planning reminders (row 14 = label, 15-21 = content)
  planningLabel: 14,
  planningStart: 15,
  planningEnd: 21,

  // Ritual text / Readings section
  entranceAntiphon1Cite: 23, // "Entrance Antiphon | Cf. Ps 25 (24):1-3"
  entranceAntiphon1Text: 24,
  entranceAntiphon2Label: 25,
  entranceAntiphon2Text: 26,
  firstReadingCite: 28, // "Reading I | Is 2:1-5"
  firstReadingSummary: 29,
  psalmCiteRefrain: 30, // "Ps 122:1-2... Let us go rejoicing..."
  secondReadingCite: 31, // "Reading II | Rom 13:11-14"
  secondReadingSummary: 32,
  gospelVerseCite: 34, // "Verse before the Gospel | cf. Ps 85:8"
  gospelVerseText: 35,
  gospelCite: 37, // "Gospel | Mt 24:37-44"
  gospelSummary: 38,
  communionAntiphon1Cite: 40,
  communionAntiphon1Text: 41,
  communionAntiphon2Label: 42,
  communionAntiphon2Text: 43,
};

// Community section offsets (relative to community start row)
const OFFSET = {
  name: 0,
  date: 1,
  presider: 7,
  prelude: 10, // title row (+1=composer, +2=desc)
  gathering: 15,
  penitentialAct: 19,
  gloria: 22,
  psalm: 26, // title (+1=setting/composer)
  gospelAccl: 29, // title (+1=composer, +2=verse)
  offertory: 35,
  massSetting: 39, // name (+1=composer)
  lordsPrayer: 45,
  fractionRite: 48,
  communionStart: 51,
  // sending: DYNAMIC — scan for "Sending"/"Sending Song" label
};

// Community definitions with start rows
const COMMUNITY_DEFS = [
  { name: "Reflections", id: "reflections", startRow: 46 },
  { name: "Foundations", id: "foundations", startRow: 114 },
  { name: "Generations", id: "generations", startRow: 179 },
  { name: "Heritage", id: "heritage", startRow: 249 },
  { name: "Elevations", id: "elevations", startRow: 317 },
];

// Labels that appear as fixed template text (not song data)
const SLOT_LABELS = new Set([
  "Prelude Song",
  "Gathering Song",
  "Penitential Act",
  "Gloria",
  "Responsorial Psalm",
  "Gospel Acclamation",
  "Offertory Song",
  "Eucharistic Acclamations",
  "Holy",
  "Mystery of Faith",
  "Amen",
  "The Lord's Prayer",
  "Fraction Rite",
  "Communion Songs",
  "Sending",
  "Sending Song",
  "Sending Forth",
  "Title",
  "Composer",
  "Description",
  "Psalm",
  "Verse",
  "INTRODUCTORY RITES",
  "LITURGY OF THE WORD",
  "LITURGY OF THE EUCHARIST",
  "THE CONCLUDING RITES",
  "AT THIS MASS",
  "PRESIDER",
  "Mass Setting Name",
  "Choir Practice Tracks",
  "N/A",
  "Planning Reminders",
  "Ritual Text",
]);

// ───── HELPERS ─────

function cell(rows: string[][], row: number, col: number): string {
  if (row < 0 || row >= rows.length) return "";
  if (col < 0 || col >= rows[row].length) return "";
  return (rows[row][col] || "").trim();
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Returns true if the value is actual data (not empty, "N/A", or a template label) */
function isData(val: string): boolean {
  if (!val) return false;
  if (SLOT_LABELS.has(val)) return false;
  if (val.startsWith("N/A")) return false;
  // Filter template placeholder values
  if (val === "Song Title" || val === "Composer/s" || val === "Composer(s) •  Aranger(s)") return false;
  if (val.startsWith("Ps ?")) return false;
  // Filter generic placeholders
  if (val === "Setting" || val === "Mass Setting" || val === "Composer") return false;
  if (val === "Composer/s" || val === "Mass Setting?") return false;
  return true;
}

/** Strip the label prefix from "Reading I | Is 2:1-5" → "Is 2:1-5" */
function stripPrefix(raw: string): string {
  if (!raw.includes("|")) return raw;
  return raw
    .split("|")
    .slice(1)
    .join("|")
    .trim();
}

function detectSeason(name: string): {
  season: LiturgicalSeason;
  label: string;
  order: number;
} {
  const upper = name.toUpperCase();
  if (upper.startsWith("ADVENT"))
    return { season: "advent", label: "Advent", order: extractOrder(name) };
  if (
    upper.startsWith("CHRISTMAS") ||
    upper.includes("EPIPHANY") ||
    upper.includes("HOLY FAMILY") ||
    upper.includes("MARY, THE HOLY")
  )
    return {
      season: "christmas",
      label: "Christmas",
      order: extractOrder(name),
    };
  if (
    upper.startsWith("LENT") ||
    upper.includes("ASH WEDNESDAY") ||
    upper.includes("PALM SUNDAY")
  )
    return { season: "lent", label: "Lent", order: extractOrder(name) };
  if (
    upper.includes("TRIDUUM") ||
    upper.includes("HOLY THURSDAY") ||
    upper.includes("GOOD FRIDAY") ||
    upper.includes("EASTER VIGIL")
  )
    return { season: "lent", label: "Lent", order: extractOrder(name) };
  if (
    upper.startsWith("EASTER") ||
    upper.includes("ASCENSION") ||
    upper.includes("PENTECOST")
  )
    return { season: "easter", label: "Easter", order: extractOrder(name) };
  if (
    upper.includes("SOLEMNITY") ||
    upper.includes("TRINITY") ||
    upper.includes("CORPUS CHRISTI") ||
    upper.includes("SACRED HEART") ||
    upper.includes("CHRIST THE KING") ||
    upper.includes("ALL SAINTS") ||
    upper.includes("ALL SOULS") ||
    upper.includes("IMMACULATE")
  )
    return {
      season: "solemnity",
      label: "Solemnity",
      order: extractOrder(name),
    };
  if (
    upper.includes("FEAST") ||
    upper.includes("PRESENTATION") ||
    upper.includes("TRANSFIGURATION") ||
    upper.includes("EXALTATION")
  )
    return { season: "feast", label: "Feast", order: extractOrder(name) };
  return { season: "ordinary", label: "Ordinary Time", order: extractOrder(name) };
}

function extractOrder(name: string): number {
  const match = name.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

function detectYear(name: string): LiturgicalYear {
  if (name.includes("[ABC]")) return "ABC";
  if (name.includes("[A]")) return "A";
  if (name.includes("[B]")) return "B";
  if (name.includes("[C]")) return "C";
  return "ABC";
}

function parseDates(dateStrings: string[]): OccasionDate[] {
  const dates: OccasionDate[] = [];
  for (const raw of dateStrings) {
    if (!raw) continue;
    const lines = raw
      .split(/\n|;/)
      .map((s) => s.trim())
      .filter(Boolean);
    for (const line of lines) {
      const dayMatch = line.match(/\((Sun|Mon|Tue|Wed|Thu|Fri|Sat)\)/);
      const dateMatch = line.match(/(\w{3}\s+\d{1,2},\s*\d{4})/);
      if (dateMatch) {
        dates.push({
          date: parseUSDate(dateMatch[1]),
          label: line,
          dayOfWeek: dayMatch ? dayMatch[1] : "",
        });
      }
    }
  }
  return dates;
}

function parseUSDate(str: string): string {
  try {
    const d = new Date(str);
    if (isNaN(d.getTime())) return "";
    return d.toISOString().split("T")[0];
  } catch {
    return "";
  }
}

function makeSong(
  rows: string[][],
  titleRow: number,
  col: number
): SongEntry | undefined {
  const title = cell(rows, titleRow, col);
  if (!isData(title)) return undefined;
  const composer = cell(rows, titleRow + 1, col);
  const desc = cell(rows, titleRow + 2, col);
  return {
    title,
    composer: isData(composer) ? composer : undefined,
    description: isData(desc) ? desc : undefined,
  };
}

function parseCommunionSongs(
  rows: string[][],
  startRow: number,
  endRow: number,
  col: number
): SongEntry[] {
  const songs: SongEntry[] = [];
  let r = startRow;
  while (r <= endRow - 2) {
    const title = cell(rows, r, col);
    if (isData(title)) {
      const composer = cell(rows, r + 1, col);
      const desc = cell(rows, r + 2, col);
      songs.push({
        title,
        composer: isData(composer) ? composer : undefined,
        description: isData(desc) ? desc : undefined,
      });
      r += 3;
    } else {
      r += 1;
    }
  }
  return songs;
}

/** Find the "Sending"/"Sending Song" label row in a community block */
function findSendingLabelRow(
  rows: string[][],
  searchStart: number,
  searchEnd: number,
  col: number
): number {
  for (let r = searchStart; r <= searchEnd; r++) {
    const val = cell(rows, r, col);
    if (
      val === "Sending" ||
      val === "Sending Song" ||
      val === "Sending Forth"
    ) {
      return r;
    }
    // Also check column 1 for "THE CONCLUDING RITES" as a hint
    const col1 = cell(rows, r, 1);
    if (col1 === "THE CONCLUDING RITES") {
      for (let sr = r; sr <= Math.min(r + 5, searchEnd); sr++) {
        const v = cell(rows, sr, col);
        if (
          v === "Sending" ||
          v === "Sending Song" ||
          v === "Sending Forth"
        ) {
          return sr;
        }
      }
    }
  }
  return -1;
}

function parseMusicPlan(
  rows: string[][],
  startRow: number,
  endRow: number,
  communityName: string,
  communityId: string,
  col: number
): MusicPlan {
  const plan: MusicPlan = {
    community: communityName,
    communityId: communityId,
    date: cell(rows, startRow + OFFSET.date, col),
    presider: cell(rows, startRow + OFFSET.presider, col) || undefined,
  };

  plan.prelude = makeSong(rows, startRow + OFFSET.prelude, col);
  plan.gathering = makeSong(rows, startRow + OFFSET.gathering, col);
  plan.penitentialAct = makeSong(rows, startRow + OFFSET.penitentialAct, col);
  plan.gloria = makeSong(rows, startRow + OFFSET.gloria, col);

  const psalm = cell(rows, startRow + OFFSET.psalm, col);
  if (isData(psalm)) {
    plan.responsorialPsalm = {
      psalm,
      setting: cell(rows, startRow + OFFSET.psalm + 1, col) || undefined,
    };
  }

  const gaTitle = cell(rows, startRow + OFFSET.gospelAccl, col);
  if (isData(gaTitle)) {
    plan.gospelAcclamation = {
      title: gaTitle,
      composer:
        cell(rows, startRow + OFFSET.gospelAccl + 1, col) || undefined,
      verse: cell(rows, startRow + OFFSET.gospelAccl + 2, col) || undefined,
    };
  }

  plan.offertory = makeSong(rows, startRow + OFFSET.offertory, col);

  const msName = cell(rows, startRow + OFFSET.massSetting, col);
  if (isData(msName)) {
    plan.eucharisticAcclamations = {
      massSettingName: msName,
      composer:
        cell(rows, startRow + OFFSET.massSetting + 1, col) || undefined,
    };
  }

  plan.lordsPrayer = makeSong(rows, startRow + OFFSET.lordsPrayer, col);
  plan.fractionRite = makeSong(rows, startRow + OFFSET.fractionRite, col);

  // Communion songs: variable length section
  const commStart = startRow + OFFSET.communionStart;
  const sendingLabel = findSendingLabelRow(rows, commStart, endRow, col);

  if (sendingLabel > 0) {
    const commEnd = sendingLabel - 1;
    const commSongs = parseCommunionSongs(rows, commStart, commEnd, col);
    if (commSongs.length > 0) plan.communionSongs = commSongs;
    // Sending song title is the row after the label
    plan.sending = makeSong(rows, sendingLabel + 1, col);
  } else {
    // No sending label found — treat rest as communion
    const commSongs = parseCommunionSongs(rows, commStart, endRow, col);
    if (commSongs.length > 0) plan.communionSongs = commSongs;
  }

  return plan;
}

function hasMusicData(plan: MusicPlan): boolean {
  return !!(
    plan.prelude ||
    plan.gathering ||
    plan.penitentialAct ||
    plan.gloria ||
    plan.responsorialPsalm ||
    plan.gospelAcclamation ||
    plan.offertory ||
    plan.eucharisticAcclamations ||
    plan.lordsPrayer ||
    plan.fractionRite ||
    plan.communionSongs ||
    plan.sending
  );
}

// ───── SONG LIBRARY EXTRACTION ─────

function extractSongLibrary(occasions: LiturgicalOccasion[]): LibrarySong[] {
  const songMap = new Map<string, { song: LibrarySong; key: string }>();

  function songKey(title: string, composer?: string): string {
    return `${title.toLowerCase().trim()}|||${(composer || "").toLowerCase().trim()}`;
  }

  function songSlug(title: string, composer?: string): string {
    const base = slugify(title);
    if (composer) return `${base}--${slugify(composer)}`;
    return base;
  }

  function trackSong(
    title: string,
    composer: string | undefined,
    occasionId: string
  ) {
    const key = songKey(title, composer);
    const existing = songMap.get(key);
    if (existing) {
      existing.song.usageCount++;
      if (!existing.song.occasions.includes(occasionId)) {
        existing.song.occasions.push(occasionId);
      }
    } else {
      songMap.set(key, {
        key,
        song: {
          id: songSlug(title, composer),
          title,
          composer: composer || undefined,
          resources: [],
          usageCount: 1,
          occasions: [occasionId],
        },
      });
    }
  }

  for (const occ of occasions) {
    for (const plan of occ.musicPlans) {
      const slots: (SongEntry | undefined)[] = [
        plan.prelude,
        plan.gathering,
        plan.penitentialAct,
        plan.gloria,
        plan.offertory,
        plan.lordsPrayer,
        plan.fractionRite,
        plan.sending,
      ];
      if (plan.communionSongs) slots.push(...plan.communionSongs);

      for (const s of slots) {
        if (s?.title) trackSong(s.title, s.composer, occ.id);
      }

      if (plan.responsorialPsalm?.psalm) {
        trackSong(
          plan.responsorialPsalm.psalm,
          plan.responsorialPsalm.setting,
          occ.id
        );
      }
      if (plan.gospelAcclamation?.title) {
        trackSong(
          plan.gospelAcclamation.title,
          plan.gospelAcclamation.composer,
          occ.id
        );
      }
      if (plan.eucharisticAcclamations?.massSettingName) {
        trackSong(
          plan.eucharisticAcclamations.massSettingName,
          plan.eucharisticAcclamations.composer,
          occ.id
        );
      }
    }
  }

  // Ensure unique IDs (slugify can collapse different composers to same slug)
  const songs = [...songMap.values()]
    .map((v) => v.song)
    .sort((a, b) => b.usageCount - a.usageCount);

  const seenIds = new Map<string, number>();
  for (const song of songs) {
    const baseId = song.id;
    const count = seenIds.get(baseId) || 0;
    seenIds.set(baseId, count + 1);
    if (count > 0) {
      song.id = `${baseId}-${count}`;
    }
  }

  return songs;
}

// ───── MAIN ─────

function main() {
  console.log("Reading CSV...");
  const csvText = fs.readFileSync(CSV_PATH, "utf-8");
  const parsed = Papa.parse<string[]>(csvText, {
    header: false,
    skipEmptyLines: false,
  });
  const rows = parsed.data;
  console.log(`Parsed ${rows.length} rows, ${rows[0]?.length || 0} columns`);

  const occasions: LiturgicalOccasion[] = [];
  const numCols = rows[0]?.length || 0;

  // Track column → occasion ID for THIS WEEK / NEXT WEEK markers
  const colToId = new Map<number, string>();

  for (let c = 2; c < numCols; c += COL_GROUP_SIZE) {
    const name = cell(rows, ROW.occasionName, c);
    if (!name) continue;

    const year = detectYear(name);
    const { season, label, order } = detectSeason(name);
    const id = slugify(name);

    colToId.set(c, id);

    // Collect dates from multiple rows
    const dateStrings = [
      cell(rows, ROW.primaryDate, c),
      ...ROW.dateExtra.map((r) => cell(rows, r, c)),
    ];
    const dates = parseDates(dateStrings);

    // Parse lectionary: "001•A | Stay Awake, Be Ready"
    const lectRaw = cell(rows, ROW.lectionary, c);
    let lectNumber = "";
    let gospelTitle = "";
    if (lectRaw) {
      const parts = lectRaw.split("|").map((s) => s.trim());
      lectNumber = parts[0] || "";
      gospelTitle = parts.slice(1).join("|").trim();
    }

    const lectionary = {
      number: lectNumber,
      gospelTitle,
      thematicTag: cell(rows, ROW.thematicTag, c),
      thematicDetail: undefined as string | undefined,
    };

    // ── Readings ──
    const readings: Reading[] = [];

    const firstCite = cell(rows, ROW.firstReadingCite, c);
    if (firstCite) {
      readings.push({
        type: "first",
        citation: stripPrefix(firstCite),
        summary: cell(rows, ROW.firstReadingSummary, c),
      });
    }

    const psalmRaw = cell(rows, ROW.psalmCiteRefrain, c);
    if (psalmRaw) {
      readings.push({
        type: "psalm",
        citation: psalmRaw,
        summary: "",
        antiphon: psalmRaw,
      });
    }

    const secondCite = cell(rows, ROW.secondReadingCite, c);
    if (secondCite) {
      readings.push({
        type: "second",
        citation: stripPrefix(secondCite),
        summary: cell(rows, ROW.secondReadingSummary, c),
      });
    }

    const verseCite = cell(rows, ROW.gospelVerseCite, c);
    if (verseCite) {
      readings.push({
        type: "gospel_verse",
        citation: stripPrefix(verseCite),
        summary: cell(rows, ROW.gospelVerseText, c),
      });
    }

    const gospelCite = cell(rows, ROW.gospelCite, c);
    if (gospelCite) {
      readings.push({
        type: "gospel",
        citation: stripPrefix(gospelCite),
        summary: cell(rows, ROW.gospelSummary, c),
      });
    }

    // ── Antiphons ──
    const antiphons: Antiphon[] = [];

    const ea1Cite = cell(rows, ROW.entranceAntiphon1Cite, c);
    const ea1Text = cell(rows, ROW.entranceAntiphon1Text, c);
    if (ea1Cite && ea1Text) {
      antiphons.push({
        type: "entrance",
        option: 1,
        citation: stripPrefix(ea1Cite),
        text: ea1Text,
      });
    }

    const ea2Text = cell(rows, ROW.entranceAntiphon2Text, c);
    if (ea2Text && ea2Text !== "N/A") {
      antiphons.push({
        type: "entrance",
        option: 2,
        citation: cell(rows, ROW.entranceAntiphon2Label, c) || "Option II",
        text: ea2Text,
      });
    }

    const ca1Cite = cell(rows, ROW.communionAntiphon1Cite, c);
    const ca1Text = cell(rows, ROW.communionAntiphon1Text, c);
    if (ca1Cite && ca1Text) {
      antiphons.push({
        type: "communion",
        option: 1,
        citation: stripPrefix(ca1Cite),
        text: ca1Text,
      });
    }

    const ca2Text = cell(rows, ROW.communionAntiphon2Text, c);
    if (ca2Text && ca2Text !== "N/A") {
      antiphons.push({
        type: "communion",
        option: 2,
        citation: cell(rows, ROW.communionAntiphon2Label, c) || "Option II",
        text: ca2Text,
      });
    }

    // ── Planning notes ──
    const planningNotes: string[] = [];
    for (let r = ROW.planningStart; r <= ROW.planningEnd; r++) {
      const note = cell(rows, r, c);
      if (note) planningNotes.push(note);
    }

    // ── Music plans for all 5 communities ──
    const musicPlans: MusicPlan[] = [];
    for (let i = 0; i < COMMUNITY_DEFS.length; i++) {
      const comm = COMMUNITY_DEFS[i];
      const nextStart = COMMUNITY_DEFS[i + 1]?.startRow ?? rows.length;
      const endRow = nextStart - 1;

      const plan = parseMusicPlan(
        rows,
        comm.startRow,
        endRow,
        comm.name,
        comm.id,
        c
      );
      if (hasMusicData(plan)) {
        musicPlans.push(plan);
      }
    }

    occasions.push({
      id,
      name,
      year,
      season,
      seasonLabel: label,
      seasonOrder: order,
      dates,
      lectionary,
      readings,
      antiphons,
      planningNotes,
      musicPlans,
    });
  }

  console.log(`Extracted ${occasions.length} occasions`);

  // ── Write output ──
  fs.mkdirSync(OCCASIONS_DIR, { recursive: true });

  // Individual occasion files
  for (const occ of occasions) {
    fs.writeFileSync(
      path.join(OCCASIONS_DIR, `${occ.id}.json`),
      JSON.stringify(occ, null, 2)
    );
  }

  // All occasions summary (lightweight)
  const allOccasions = occasions.map((o) => ({
    id: o.id,
    name: o.name,
    year: o.year,
    season: o.season,
    seasonLabel: o.seasonLabel,
    seasonOrder: o.seasonOrder,
    nextDate: o.dates[0]?.date || null,
  }));
  fs.writeFileSync(
    path.join(OUTPUT_DIR, "all-occasions.json"),
    JSON.stringify(allOccasions, null, 2)
  );

  // Seasons
  const seasonMap = new Map<
    string,
    { id: string; label: string; color: string; occasions: any[] }
  >();
  const seasonColors: Record<string, string> = {
    advent: "#6B21A8",
    christmas: "#CA8A04",
    lent: "#581C87",
    easter: "#CA8A04",
    ordinary: "#166534",
    solemnity: "#991B1B",
    feast: "#B91C1C",
  };

  for (const occ of occasions) {
    if (!seasonMap.has(occ.season)) {
      seasonMap.set(occ.season, {
        id: occ.season,
        label: occ.seasonLabel,
        color: seasonColors[occ.season] || "#166534",
        occasions: [],
      });
    }
    seasonMap.get(occ.season)!.occasions.push({
      id: occ.id,
      name: occ.name,
      year: occ.year,
      seasonOrder: occ.seasonOrder,
    });
  }
  fs.writeFileSync(
    path.join(OUTPUT_DIR, "seasons.json"),
    JSON.stringify([...seasonMap.values()], null, 2)
  );

  // Calendar: find this week and next week based on current liturgical year dates
  let thisWeek: string | null = null;
  let nextWeek: string | null = null;

  {
    const today = new Date().toISOString().split("T")[0];
    // Only consider dates within the current liturgical year window (~2 years)
    const yearFloor = "2025-01-01";
    const yearCeil = "2027-01-01";

    const currentYearDated = occasions
      .map((o) => {
        const relevantDate = o.dates.find(
          (d) => d.date >= yearFloor && d.date < yearCeil
        );
        return { id: o.id, date: relevantDate?.date || null };
      })
      .filter((o) => o.date)
      .sort((a, b) => a.date!.localeCompare(b.date!));

    // "This week" = most recent occasion whose date <= today (already celebrated or today)
    // "Next week" = first upcoming occasion whose date > today
    for (const o of currentYearDated) {
      if (o.date! <= today) {
        thisWeek = o.id;
      }
      if (o.date! > today && !nextWeek) {
        nextWeek = o.id;
      }
    }
  }

  fs.writeFileSync(
    path.join(OUTPUT_DIR, "calendar.json"),
    JSON.stringify({ thisWeek, nextWeek }, null, 2)
  );

  // ── Song Library ──
  const songLibrary = extractSongLibrary(occasions);
  fs.writeFileSync(
    path.join(OUTPUT_DIR, "song-library.json"),
    JSON.stringify(songLibrary, null, 2)
  );
  console.log(`Extracted ${songLibrary.length} unique songs for library`);

  // Stats
  const plansWithData = occasions.reduce(
    (sum, o) => sum + o.musicPlans.length,
    0
  );
  const totalPlans = occasions.length * COMMUNITY_DEFS.length;
  console.log(`Music plans: ${plansWithData}/${totalPlans} with data`);
  console.log(`Calendar: thisWeek=${thisWeek}, nextWeek=${nextWeek}`);
  console.log(`Done! Output in ${OUTPUT_DIR}`);
}

main();
