/**
 * Seed songs from song-library.json into Supabase songs table.
 * Reclassifies using 14-value expanded taxonomy.
 * Seeds mass_settings, songs, song_resources_v2, and calendar_days.
 *
 * Usage: npx tsx scripts/seed-songs-to-supabase.ts
 */
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

dotenv.config({ path: path.join(__dirname, "..", ".env.local") });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ===== TYPES =====

type ExpandedCategory =
  | "song" | "antiphon" | "kyrie" | "gloria" | "sprinkling_rite"
  | "psalm" | "gospel_acclamation_refrain" | "gospel_acclamation_verse"
  | "holy_holy" | "memorial_acclamation" | "great_amen"
  | "lamb_of_god" | "lords_prayer" | "sequence";

interface LibrarySong {
  id: string;
  title: string;
  composer?: string;
  category?: string;
  functions?: string[];
  recordedKey?: string;
  firstLine?: string;
  refrainFirstLine?: string;
  languages?: string[];
  topics?: string[];
  scriptureRefs?: string[];
  liturgicalUse?: string[];
  catalogs?: Record<string, number>;
  credits?: Record<string, unknown>;
  tuneMeter?: Record<string, unknown>;
  resources: Array<{
    id: string;
    type: string;
    label: string;
    url?: string;
    filePath?: string;
    storagePath?: string;
    value?: string;
    source?: string;
    isHighlighted?: boolean;
  }>;
  usageCount: number;
  occasions: string[];
}

// ===== MASS SETTINGS =====

const KNOWN_MASS_SETTINGS: { name: string; composer?: string }[] = [
  { name: "Mass of Creation", composer: "Marty Haugen" },
  { name: "Mass of Glory", composer: "Ken Canedo / Bob Hurd" },
  { name: "Mass of Joy & Peace", composer: "Tony Alonso" },
  { name: "Misa Del Mundo", composer: "Bob Hurd / Jaime Cortez" },
  { name: "Misa Gregoriana" },
  { name: "Mass of the Incarnate Word", composer: "Rudy Lopez" },
  { name: "Mass of New Beginnings", composer: "Jesse Manibusan" },
  { name: "Mass of St. Mary Magdalene", composer: "Sarah Hart / Robert Feduccia" },
  { name: "Mass of Renewal", composer: "Curtis Stephan" },
  { name: "Heritage Mass", composer: "Owen Alstott" },
  { name: "Misa Luna", composer: "Peter Kairoff" },
  { name: "Black Mountain Liturgy", composer: "Ricky Manalo" },
  { name: "Mass of Spirit and Grace", composer: "Ricky Manalo" },
  { name: "Mass of Wisdom", composer: "Steven Janco" },
  { name: "Mass of a Joyful Heart", composer: "Steve Angrisano" },
  { name: "Storrington Mass", composer: "Marty Haugen" },
  { name: "Community Mass", composer: "Richard Proulx" },
  { name: "A New Mass for Congregations", composer: "Carroll Thomas Andrews" },
  { name: "Missa Emmanuel", composer: "Richard Proulx" },
  { name: "Mass of Christ the Savior", composer: "Dan Schutte" },
];

// ===== RECLASSIFICATION =====

function extractMassSettingName(title: string): string | null {
  // Match parenthetical mass setting names
  const parenMatch = title.match(/\(([^)]*(?:Mass of|Misa|Heritage|Storrington|Community|Black Mountain|Missa)[^)]*)\)/i);
  if (parenMatch) return parenMatch[1].trim();

  // Match "Mass of X" patterns without parens for umbrella entries
  const massOfMatch = title.match(/^(Mass of [A-Z][^•–—]+|Misa [A-Z][^•–—]+|Heritage Mass|Storrington Mass|Community Mass|Missa Emmanuel)/i);
  if (massOfMatch) return massOfMatch[1].trim();

  return null;
}

function extractPsalmNumber(title: string): number | null {
  // Try "Ps. 23" or "Psalm 23" patterns
  const psMatch = title.match(/(?:ps\.?|psalm)\s*(\d+)/i);
  if (psMatch) return parseInt(psMatch[1], 10);

  // Common psalm name mappings
  const nameMappings: Record<string, number> = {
    "shepherd me": 23,
    "the lord is my shepherd": 23,
    "the lord is my light": 27,
    "taste and see": 34,
    "if today you hear his voice": 95,
    "be with me lord": 91,
    "blest are they": 1,
    "create in me": 51,
    "lord send out your spirit": 104,
    "the earth is full": 33,
    "i will praise your name": 145,
    "every nation on earth": 72,
    "i will walk": 116,
  };

  const lower = title.toLowerCase();
  for (const [phrase, num] of Object.entries(nameMappings)) {
    if (lower.includes(phrase)) return num;
  }

  return null;
}

function reclassifyFromMassPart(title: string, functions?: string[]): ExpandedCategory {
  const t = title.toLowerCase();

  if (/kyrie|lord have mercy|misa.*kyrie|señor.*piedad/i.test(t)) return "kyrie";
  if (/\bgloria\b|glory to god|gloria patri/i.test(t)) return "gloria";
  if (/sprinkling|asperges/i.test(t)) return "sprinkling_rite";
  if (/holy.*holy|sanctus|santo.*santo/i.test(t)) return "holy_holy";
  if (/memorial.*accl|mystery.*faith|when we eat|we proclaim|save us.*savior|morimos.*tu muerte/i.test(t)) return "memorial_acclamation";
  if (/great.*amen|amén/i.test(t)) return "great_amen";
  if (/lamb.*god|agnus.*dei|cordero.*dios|fraction/i.test(t)) return "lamb_of_god";
  if (/lord'?s?\s*prayer|our.*father|pater.*noster|padre.*nuestro/i.test(t)) return "lords_prayer";
  if (/\bsequence\b|victimae|veni.*sancte/i.test(t)) return "sequence";

  // Check functions array for fallback
  if (functions) {
    if (functions.includes("lords_prayer") || functions.includes("lordsPrayer")) return "lords_prayer";
    if (functions.includes("fraction_rite") || functions.includes("fractionRite")) return "lamb_of_god";
  }

  // Default: keep as song (can't determine specific mass part)
  return "song";
}

function reclassifyFromSong(title: string, functions?: string[]): ExpandedCategory {
  if (!functions) return "song";

  if (functions.includes("lords_prayer") || functions.includes("lordsPrayer")) return "lords_prayer";
  if (functions.includes("fraction_rite") || functions.includes("fractionRite")) return "lamb_of_god";

  const t = title.toLowerCase();
  if ((functions.includes("gloria")) && /gloria|glory to god/i.test(t)) return "gloria";
  if ((functions.includes("penitential_act") || functions.includes("penitentialAct")) && /kyrie|lord have mercy/i.test(t)) return "kyrie";

  return "song";
}

function reclassifyFromGospelAcclamation(title: string, composer?: string): ExpandedCategory {
  const t = title.toLowerCase();

  // Base refrains: short titles, often just "Alleluia (Mass of X)" or "Lenten Gospel Acclamation"
  if (/^alleluia\s*[\(•]/i.test(t) || /^lenten gospel accl/i.test(t) || /^gospel acclamation/i.test(t)) {
    return "gospel_acclamation_refrain";
  }

  // Verse indicators: occasion-specific text in composer field (like "O.T. 14 | C")
  if (composer && /\b[A-Z]\.\s*[A-Z]\.\s*\d+\s*\|\s*[ABC]\b/.test(composer)) {
    return "gospel_acclamation_verse";
  }

  // If title contains season/occasion specifics
  if (/\b(advent|lent|easter|christmas|ordinary|holy\s*week)\b/i.test(t)) {
    return "gospel_acclamation_verse";
  }

  // Default to refrain
  return "gospel_acclamation_refrain";
}

function reclassifySong(song: LibrarySong): ExpandedCategory {
  const oldCat = song.category || "song";
  const title = song.title;
  const functions = song.functions;

  switch (oldCat) {
    case "mass_part":
      return reclassifyFromMassPart(title, functions);
    case "psalm":
      return "psalm";
    case "gospel_acclamation":
      return reclassifyFromGospelAcclamation(title, song.composer);
    case "song":
    default:
      return reclassifyFromSong(title, functions);
  }
}

// ===== BATCH HELPERS =====

async function batchInsert<T extends Record<string, unknown>>(
  table: string,
  rows: T[],
  batchSize = 100,
): Promise<{ inserted: number; errors: string[] }> {
  let inserted = 0;
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabase.from(table).insert(batch);

    if (error) {
      errors.push(`Batch ${Math.floor(i / batchSize)}: ${error.message}`);
      console.error(`  Error inserting batch ${Math.floor(i / batchSize)} into ${table}: ${error.message}`);
    } else {
      inserted += batch.length;
    }

    // Rate limit: 500ms between batches
    if (i + batchSize < rows.length) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  return { inserted, errors };
}

// ===== MAIN =====

async function main() {
  console.log("=== Seed Songs to Supabase ===\n");

  // 1. Load song library
  const libPath = path.join(__dirname, "..", "src", "data", "song-library.json");
  const songs: LibrarySong[] = JSON.parse(fs.readFileSync(libPath, "utf-8"));
  console.log(`Loaded ${songs.length} songs from song-library.json`);

  // 2. Seed mass settings
  console.log("\n--- Seeding mass settings ---");
  const { data: existingSettings } = await supabase.from("mass_settings").select("name");
  const existingNames = new Set((existingSettings || []).map((s: { name: string }) => s.name));

  const newSettings = KNOWN_MASS_SETTINGS.filter((s) => !existingNames.has(s.name));
  if (newSettings.length > 0) {
    const { error } = await supabase.from("mass_settings").insert(newSettings);
    if (error) {
      console.error(`Error seeding mass settings: ${error.message}`);
    } else {
      console.log(`  Inserted ${newSettings.length} mass settings`);
    }
  } else {
    console.log("  Mass settings already exist, skipping");
  }

  // Fetch all settings for ID lookup
  const { data: allSettings } = await supabase.from("mass_settings").select("id, name");
  const settingsByName = new Map<string, string>();
  for (const s of allSettings || []) {
    settingsByName.set(s.name.toLowerCase(), s.id);
  }
  console.log(`  ${settingsByName.size} mass settings in DB`);

  // 3. Reclassify and prepare song rows
  console.log("\n--- Reclassifying songs ---");
  const categoryCounts: Record<string, number> = {};

  const songRows: Array<{
    legacy_id: string;
    title: string;
    composer: string | null;
    category: ExpandedCategory;
    psalm_number: number | null;
    mass_setting_id: string | null;
    functions: string[];
    recorded_key: string | null;
    first_line: string | null;
    refrain_first_line: string | null;
    languages: string[];
    topics: string[];
    scripture_refs: string[];
    liturgical_use: string[];
    catalogs: Record<string, unknown>;
    credits: Record<string, unknown>;
    tune_meter: Record<string, unknown>;
    usage_count: number;
    occasions: string[];
  }> = [];

  for (const song of songs) {
    const category = reclassifySong(song);
    categoryCounts[category] = (categoryCounts[category] || 0) + 1;

    // Extract psalm number
    let psalmNumber: number | null = null;
    if (category === "psalm") {
      psalmNumber = extractPsalmNumber(song.title);
    }

    // Link mass setting
    let massSettingId: string | null = null;
    const settingName = extractMassSettingName(song.title);
    if (settingName) {
      // Try exact match first, then fuzzy
      massSettingId = settingsByName.get(settingName.toLowerCase()) || null;
      if (!massSettingId) {
        // Try partial match
        for (const [name, id] of settingsByName) {
          if (settingName.toLowerCase().includes(name) || name.includes(settingName.toLowerCase())) {
            massSettingId = id;
            break;
          }
        }
      }
    }

    // Handle Mass of Joy & Peace GA edge case:
    // If it's a gospel_acclamation_verse and composer contains occasion identifier,
    // extract the real composer
    let composer = song.composer || null;
    if (category === "gospel_acclamation_verse" && composer && /\|/.test(composer)) {
      // composer field like "O.T. 14 | C" — the real composer is Tony Alonso
      const settingMatch = extractMassSettingName(song.title);
      if (settingMatch) {
        const setting = KNOWN_MASS_SETTINGS.find(
          (s) => s.name.toLowerCase() === settingMatch.toLowerCase()
        );
        if (setting?.composer) {
          composer = setting.composer;
        }
      }
    }

    songRows.push({
      legacy_id: song.id,
      title: song.title,
      composer,
      category,
      psalm_number: psalmNumber,
      mass_setting_id: massSettingId,
      functions: song.functions || [],
      recorded_key: song.recordedKey || null,
      first_line: song.firstLine || null,
      refrain_first_line: song.refrainFirstLine || null,
      languages: song.languages || [],
      topics: song.topics || [],
      scripture_refs: song.scriptureRefs || [],
      liturgical_use: song.liturgicalUse || [],
      catalogs: song.catalogs || {},
      credits: song.credits || {},
      tune_meter: song.tuneMeter || {},
      usage_count: song.usageCount,
      occasions: song.occasions,
    });
  }

  console.log("  Category distribution:");
  for (const [cat, count] of Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${cat}: ${count}`);
  }

  // 4. Check if songs already exist
  const { count: existingSongCount } = await supabase.from("songs").select("id", { count: "exact", head: true });
  if (existingSongCount && existingSongCount > 0) {
    console.log(`\n⚠️  songs table already has ${existingSongCount} rows.`);
    console.log("  Skipping song insertion to avoid duplicates.");
    console.log("  To re-seed, truncate the songs table first.");
  } else {
    // 5. Insert songs in batches
    console.log("\n--- Inserting songs ---");
    const { inserted, errors } = await batchInsert("songs", songRows);
    console.log(`  Inserted ${inserted}/${songRows.length} songs`);
    if (errors.length > 0) {
      console.error(`  ${errors.length} batch errors`);
    }
  }

  // 6. Build legacy_id → UUID mapping
  console.log("\n--- Building ID mapping ---");
  const { data: songIdRows } = await supabase.from("songs").select("id, legacy_id");
  const legacyToUuid = new Map<string, string>();
  for (const row of songIdRows || []) {
    legacyToUuid.set(row.legacy_id, row.id);
  }
  console.log(`  ${legacyToUuid.size} song ID mappings`);

  // 7. Insert resources
  const { count: existingResourceCount } = await supabase
    .from("song_resources_v2")
    .select("id", { count: "exact", head: true });

  if (existingResourceCount && existingResourceCount > 0) {
    console.log(`\n⚠️  song_resources_v2 already has ${existingResourceCount} rows, skipping.`);
  } else {
    console.log("\n--- Inserting resources ---");
    const resourceRows: Array<{
      song_id: string;
      type: string;
      label: string;
      url: string | null;
      file_path: string | null;
      storage_path: string | null;
      value: string | null;
      source: string | null;
      is_highlighted: boolean;
    }> = [];

    for (const song of songs) {
      const songUuid = legacyToUuid.get(song.id);
      if (!songUuid) continue;

      for (const r of song.resources) {
        resourceRows.push({
          song_id: songUuid,
          type: r.type,
          label: r.label || "",
          url: r.url || null,
          file_path: r.filePath || null,
          storage_path: r.storagePath || null,
          value: r.value || null,
          source: r.source || null,
          is_highlighted: r.isHighlighted || false,
        });
      }
    }

    console.log(`  ${resourceRows.length} resources to insert`);
    const { inserted, errors } = await batchInsert("song_resources_v2", resourceRows);
    console.log(`  Inserted ${inserted}/${resourceRows.length} resources`);
    if (errors.length > 0) {
      console.error(`  ${errors.length} batch errors`);
    }
  }

  // 8. Seed calendar_days from liturgical_days
  const { count: existingCalDays } = await supabase
    .from("calendar_days")
    .select("id", { count: "exact", head: true });

  if (existingCalDays && existingCalDays > 0) {
    console.log(`\n⚠️  calendar_days already has ${existingCalDays} rows, skipping.`);
  } else {
    console.log("\n--- Seeding calendar_days from liturgical_days ---");
    const { data: litDays } = await supabase
      .from("liturgical_days")
      .select("date, celebration_name, rank, season, color_primary, occasion_id, is_holyday, psalter_week, optional_memorials");

    if (litDays && litDays.length > 0) {
      const calRows = litDays.map((ld: {
        date: string;
        celebration_name: string;
        rank: string;
        season: string;
        color_primary: string;
        occasion_id: string | null;
        is_holyday: boolean;
        psalter_week: string | null;
        optional_memorials: string[] | null;
      }) => ({
        date: ld.date,
        liturgical_day_name: ld.celebration_name,
        celebration_rank: ld.rank,
        liturgical_color: ld.color_primary,
        season: ld.season,
        ordo_notes: ld.psalter_week ? `Psalter Week ${ld.psalter_week}` : null,
        is_holy_day: ld.is_holyday,
        occasion_id: ld.occasion_id,
      }));

      // Add US holidays
      const holidays = [
        { date: "2025-11-27", holiday_name: "Thanksgiving Day", is_recurring: true, recurrence_type: "yearly" },
        { date: "2025-12-25", holiday_name: "Christmas Day", is_recurring: true, recurrence_type: "yearly" },
        { date: "2026-01-01", holiday_name: "New Year's Day", is_recurring: true, recurrence_type: "yearly" },
        { date: "2026-01-19", holiday_name: "Martin Luther King Jr. Day", is_recurring: true, recurrence_type: "yearly" },
        { date: "2026-02-16", holiday_name: "Presidents' Day", is_recurring: true, recurrence_type: "yearly" },
        { date: "2026-05-25", holiday_name: "Memorial Day", is_recurring: true, recurrence_type: "yearly" },
        { date: "2026-07-04", holiday_name: "Independence Day", is_recurring: true, recurrence_type: "yearly" },
        { date: "2026-09-07", holiday_name: "Labor Day", is_recurring: true, recurrence_type: "yearly" },
        { date: "2026-11-26", holiday_name: "Thanksgiving Day", is_recurring: true, recurrence_type: "yearly" },
        { date: "2026-12-25", holiday_name: "Christmas Day", is_recurring: true, recurrence_type: "yearly" },
        { date: "2027-01-01", holiday_name: "New Year's Day", is_recurring: true, recurrence_type: "yearly" },
      ];

      for (const h of holidays) {
        // Check if this date already has a calendar_day entry
        const existing = calRows.find((r: { date: string }) => r.date === h.date);
        if (existing) {
          (existing as Record<string, unknown>).is_holiday = true;
          (existing as Record<string, unknown>).holiday_name = h.holiday_name;
          (existing as Record<string, unknown>).is_recurring = h.is_recurring;
          (existing as Record<string, unknown>).recurrence_type = h.recurrence_type;
        } else {
          calRows.push({
            date: h.date,
            liturgical_day_name: h.holiday_name,
            celebration_rank: null as unknown as string,
            liturgical_color: null as unknown as string,
            season: null as unknown as string,
            ordo_notes: null,
            is_holy_day: false,
            occasion_id: null,
            ...h,
          } as typeof calRows[0]);
        }
      }

      console.log(`  ${calRows.length} calendar days to insert`);
      const { inserted, errors } = await batchInsert("calendar_days", calRows, 200);
      console.log(`  Inserted ${inserted}/${calRows.length} calendar days`);
      if (errors.length > 0) {
        console.error(`  ${errors.length} batch errors`);
      }
    } else {
      console.log("  No liturgical_days data found. Calendar_days will be empty.");
    }
  }

  // 9. Verify
  console.log("\n=== Verification ===");
  const { count: totalSongs } = await supabase.from("songs").select("id", { count: "exact", head: true });
  const { count: totalResources } = await supabase.from("song_resources_v2").select("id", { count: "exact", head: true });
  const { count: totalSettings } = await supabase.from("mass_settings").select("id", { count: "exact", head: true });
  const { count: totalCalDays } = await supabase.from("calendar_days").select("id", { count: "exact", head: true });

  console.log(`  songs: ${totalSongs}`);
  console.log(`  song_resources_v2: ${totalResources}`);
  console.log(`  mass_settings: ${totalSettings}`);
  console.log(`  calendar_days: ${totalCalDays}`);

  // Category distribution check
  for (const cat of ["song", "psalm", "kyrie", "gloria", "holy_holy", "memorial_acclamation", "great_amen", "lamb_of_god", "lords_prayer", "gospel_acclamation_refrain", "gospel_acclamation_verse", "sprinkling_rite", "sequence", "antiphon"]) {
    const { count } = await supabase.from("songs").select("id", { count: "exact", head: true }).eq("category", cat);
    if (count && count > 0) {
      console.log(`    ${cat}: ${count}`);
    }
  }

  console.log("\nDone!");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
