/**
 * Upload Lyric Gospel Acclamation verse MP3s to Supabase storage
 * and wire verseStoragePath into existing gospelAcclamation music_plan_edits.
 *
 * Each MP3 filename maps to one or more occasion IDs.
 * The storage path is stored in the gospelAcclamation value object
 * so the frontend can play the verse audio directly.
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import fs from "fs";
import path from "path";
config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const BASE_DIR =
  "/Users/jeffreybonilla/Desktop/Hey Jeff Organize/Lyric Psalms and Acclamations/DROPS/AudioFiles_LyricGospelAcclamations";

// Skip files that are full-season recordings or refrain-only
const SKIP_PATTERNS = [/_FULL\./i, /_Refrain/i, /RefrainOnly/i, /Refrain v2/i];

// Named occasion mappings (filename fragment → occasion IDs)
// For ABC occasions that don't have per-year files, the ID ends in -abc or has no suffix
const NAMED_OCCASIONS: Record<string, string[]> = {
  // Advent
  "ADVENT_ImmaculateConception": ["solemnity-immaculate-conception"],

  // Christmas
  "CHRISTMAS_Baptism_ABC": ["baptism-of-the-lord-a", "baptism-of-the-lord-b", "baptism-of-the-lord-c"],
  "CHRISTMAS_Baptism_B_Opt": ["baptism-of-the-lord-b"],
  "CHRISTMAS_Baptism_C_Opt": ["baptism-of-the-lord-c"],
  "CHRISTMAS_Dawn_ABC": ["nativity"],
  "CHRISTMAS_Day_ABC": ["nativity"],
  "CHRISTMAS_Epiphany_ABC": ["the-epiphany-of-the-lord-abc"],
  "CHRISTMAS_HolyFamily_ABC": ["holy-family-a", "holy-family-b", "holy-family-c"],
  "CHRISTMAS_HolyFamily_B+Mary Mother": ["holy-family-b", "jan-1-mary-mother-of-god-abc"],
  "CHRISTMAS_HolyFamily_C_Opt": ["holy-family-c"],
  "CHRISTMAS_Midnight_ABC": ["nativity"],
  "CHRISTMAS_Vigil_ABC": ["nativity"],

  // Easter
  "EASTER_Easter Sunday_ABC": ["easter-sunday-abc"],
  "EASTER_Ascension_ABC": ["ascension-a", "ascension-b", "ascension-c"],
  "EASTER_Pentecost ABC": ["pentecost-a", "pentecost-b", "pentecost-c"],

  // Lent
  "LENT_Ash Wednesday ABC": ["ash-wednesday"],
  "LENT_Holy Thursday_ABC": ["holy-thursday-lords-supper"],
  "LENT_PalmSunday+GoodFriday_ABC": ["palm-sunday-a", "palm-sunday-b", "palm-sunday-c", "good-friday-passion"],
  "LENT_St Joseph_ABC": ["st-joseph-abc"],
  "LENT_Annunciation": ["annunciation-abc"],

  // OT named occasions
  "OT All Saints": ["solemnity-nov-1-all-saints-abc"],
  "OT All Souls 1": ["solemnity-nov-1-all-souls-abc"],
  "OT All Souls 2": ["solemnity-nov-1-all-souls-abc"],
  "OT All Souls 3": ["solemnity-nov-1-all-souls-abc"],
  "OT All Souls 5": ["solemnity-nov-1-all-souls-abc"],
  "OT Annunciation": ["annunciation-abc"],
  "OT Assumption During Day": ["assumption-day-abc"],
  "OT Assumption of BVM": ["assumption-abc"],
  "OT Christ the King ABC": ["solemnity-christ-the-king-a", "solemnity-christ-the-king-b", "solemnity-christ-the-king-c"],
  "OT Dedication of LB": ["the-dedication-of-nov-9-the-lateran-basilica-abc"],
  "OT Exaltation of HC": ["feast-the-exaltation-sep-14-of-the-holy-cross-abc"],
  "OT Immaculate Conception": ["solemnity-immaculate-conception"],
  "OT JtB During Day": [],  // no occasion file found
  "OT JtB Vigil": [],  // no occasion file found
  "OT Presentation of the Lord": ["feast-abc-feb-2-presentation-of-the-lord"],
  "OT Sacred Heart B": [],  // no occasion file found
  "OT St Peter and Paul Vigil": ["ss-peter-paul-apostles-jun-29-at-the-vigil-mass-abc"],
  "OT Transfiguration": ["transfiguration-abc"],
  "OT Trinity Sunday": ["solemnity-most-holy-trinity-a", "solemnity-most-holy-trinity-b", "solemnity-most-holy-trinity-c"],
};

/**
 * Parse a filename into a list of occasion IDs.
 *
 * Patterns:
 * - SEASON_NumberYears.mp3 → season-number-year for each year letter
 * - SEASON_NumberYears+NumberYears.mp3 → compound occasions
 * - OT NumberYear NumberYear ... .mp3 → multiple OT occasions
 * - OT 21A St Peter and Paul During the Day.mp3 → OT + named
 * - Named occasions → lookup in NAMED_OCCASIONS
 */
function parseFilename(filename: string): string[] {
  const base = filename.replace(/\.mp3$/i, "");

  // Check skip patterns
  for (const pat of SKIP_PATTERNS) {
    if (pat.test(filename)) return [];
  }

  // Check named occasions first (exact match on base)
  if (NAMED_OCCASIONS[base] !== undefined) {
    return NAMED_OCCASIONS[base];
  }

  // OT numbered patterns: "OT 12C 16B 20C 26A" or "OT 4B v2"
  if (base.startsWith("OT ")) {
    return parseOTFilename(base);
  }

  // Seasonal numbered: ADVENT_1ABC, EASTER_3AB, LENT_3A, LENT_3B+4B
  const seasonMatch = base.match(/^(ADVENT|CHRISTMAS|EASTER|LENT)_(\d.*)$/);
  if (seasonMatch) {
    return parseSeasonalNumbered(seasonMatch[1], seasonMatch[2]);
  }

  console.log(`  UNMAPPED: ${filename}`);
  return [];
}

function parseOTFilename(base: string): string[] {
  // Remove "OT " prefix
  let rest = base.slice(3).trim();

  // Handle "21A St Peter and Paul During the Day" → extract numbered part + named part
  // Also "OT 6C 4A" → just numbers
  const ids: string[] = [];

  // Check for named suffix after numbers
  const namedSuffix = rest.match(/ (St Peter and Paul During the Day|All Saints|All Souls|Assumption|Christ the King|Trinity)/);
  if (namedSuffix) {
    const namedKey = `OT ${namedSuffix[0].trim()}`;
    if (NAMED_OCCASIONS[namedKey]) {
      ids.push(...NAMED_OCCASIONS[namedKey]);
    }
    rest = rest.slice(0, namedSuffix.index!).trim();
  }

  // Remove " v2" suffix
  rest = rest.replace(/ v\d+$/, "").trim();

  // Parse number+year pairs: "12C 16B 20C 26A" or "3A 20A 23B"
  const pairs = rest.match(/(\d+)([ABC])/gi);
  if (pairs) {
    for (const pair of pairs) {
      const match = pair.match(/(\d+)([ABC])/i);
      if (match) {
        const num = parseInt(match[1], 10);
        const year = match[2].toLowerCase();
        const paddedNum = String(num).padStart(2, "0");

        // OT 3 has special suffix
        if (num === 3) {
          ids.push(`ordinary-time-${paddedNum}-${year}-word-of-god-sunday`);
        } else {
          ids.push(`ordinary-time-${paddedNum}-${year}`);
        }
      }
    }
  }

  return ids;
}

function parseSeasonalNumbered(season: string, numberPart: string): string[] {
  const ids: string[] = [];

  // Handle compound with "+": "3B+4B"
  const compounds = numberPart.split("+");

  for (const part of compounds) {
    const match = part.trim().match(/^(\d+)([ABC]+)$/i);
    if (!match) {
      console.log(`  UNMAPPED seasonal: ${season}_${part}`);
      continue;
    }

    const num = parseInt(match[1], 10);
    const years = match[2].toLowerCase().split("");
    const paddedNum = String(num).padStart(2, "0");

    for (const year of years) {
      let occasionId: string;
      switch (season) {
        case "ADVENT":
          occasionId = `advent-${paddedNum}-${year}`;
          break;
        case "EASTER":
          if (num === 2) {
            occasionId = `easter-02-divine-mercy-${year}`;
          } else {
            occasionId = `easter-${paddedNum}-${year}`;
          }
          break;
        case "LENT":
          // Lent 3A is special: lent-03-a-first-scrutiny
          if (num === 3 && year === "a") {
            occasionId = "lent-03-a-first-scrutiny";
          } else {
            occasionId = `lent-${paddedNum}-${year}`;
          }
          break;
        default:
          occasionId = `${season.toLowerCase()}-${paddedNum}-${year}`;
      }
      ids.push(occasionId);
    }
  }

  return ids;
}

async function main() {
  const seasons = ["Advent", "Christmas", "Easter", "Lent", "OT"];
  let uploaded = 0;
  let linked = 0;
  let skipped = 0;
  let noOccasion = 0;
  let noExistingEdit = 0;

  for (const season of seasons) {
    const seasonDir = path.join(BASE_DIR, season);
    if (!fs.existsSync(seasonDir)) continue;

    // Only top-level files (skip nested duplicate folders)
    const files = fs.readdirSync(seasonDir).filter(
      (f) => f.endsWith(".mp3") && !fs.statSync(path.join(seasonDir, f)).isDirectory()
    );

    console.log(`\n=== ${season} (${files.length} files) ===`);

    for (const file of files) {
      const filePath = path.join(seasonDir, file);
      const occasionIds = parseFilename(file);

      if (occasionIds.length === 0) {
        skipped++;
        continue;
      }

      // Upload MP3 to storage (once per file)
      const storagePath = `lyric-ga-verse/${season.toLowerCase()}/${file.replace(/ /g, "_")}`;
      const fileBuffer = fs.readFileSync(filePath);

      const { error: uploadErr } = await supabase.storage
        .from("song-resources")
        .upload(storagePath, fileBuffer, { contentType: "audio/mpeg", upsert: true });

      if (uploadErr && !uploadErr.message.includes("already exists")) {
        console.error(`  Upload error for ${file}: ${uploadErr.message}`);
        continue;
      }

      uploaded++;

      // For each occasion, update the gospelAcclamation music_plan_edit
      for (const occasionId of occasionIds) {
        for (const ensemble of ["reflections", "heritage"]) {
          const { data: existing } = await supabase
            .from("music_plan_edits")
            .select("occasion_id, ensemble_id, field, value")
            .eq("occasion_id", occasionId)
            .eq("ensemble_id", ensemble)
            .eq("field", "gospelAcclamation")
            .limit(1);

          if (!existing || existing.length === 0) {
            // No existing GA edit for this occasion. Create one with just the verse path.
            const { error: insertErr } = await supabase
              .from("music_plan_edits")
              .upsert(
                {
                  occasion_id: occasionId,
                  ensemble_id: ensemble,
                  field: "gospelAcclamation",
                  value: { verseStoragePath: storagePath },
                  updated_at: new Date().toISOString(),
                },
                { onConflict: "occasion_id,ensemble_id,field" }
              );

            if (insertErr) {
              console.error(`  Insert error: ${occasionId}/${ensemble}: ${insertErr.message}`);
            } else {
              linked++;
            }
            continue;
          }

          // Update existing value to add verseStoragePath
          const val = existing[0].value as Record<string, string>;
          if (val.verseStoragePath === storagePath) {
            // Already linked
            continue;
          }

          val.verseStoragePath = storagePath;

          const { error: updateErr } = await supabase
            .from("music_plan_edits")
            .update({ value: val, updated_at: new Date().toISOString() })
            .eq("occasion_id", occasionId)
            .eq("ensemble_id", ensemble)
            .eq("field", "gospelAcclamation");

          if (updateErr) {
            console.error(`  Update error: ${occasionId}/${ensemble}: ${updateErr.message}`);
          } else {
            linked++;
          }
        }
      }

      if (uploaded <= 10) {
        console.log(`  OK: ${file} -> ${occasionIds.join(", ")}`);
      }
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Uploaded: ${uploaded} | Linked: ${linked} | Skipped: ${skipped}`);
}

main().catch(console.error);
