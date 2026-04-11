/**
 * Upload Lyric Psalter MP3s and link to correct occasions.
 *
 * For each MP3 track:
 * 1. Map track name → occasion ID
 * 2. Read psalm reading from occasion JSON to get psalm number + antiphon
 * 3. Find or create the correct Lyric Psalter song
 * 4. Upload MP3 to Supabase storage
 * 5. Link as audio resource
 * 6. Write to music_plan_edits for Reflections + Heritage
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const OCCASIONS_DIR = "src/data/occasions";
const LP_DIR = "/Users/jeffreybonilla/Desktop/Lyric Psalter Recordings";

// Map track occasion names to occasion ID patterns
const OCCASION_MAP: Record<string, string> = {
  "1st Sunday of Advent": "advent-01",
  "2nd Sunday of Advent": "advent-02",
  "3rd Sunday of Advent": "advent-03",
  "4th Sunday of Advent": "advent-04",
  "Holy Family of Jesus Mary and Joseph": "holy-family",
  "Epiphany of the Lord": "the-epiphany-of-the-lord-abc",
  "Baptism of the Lord": "baptism-of-the-lord",
  "1st Sunday of Lent": "lent-01",
  "2nd Sunday of Lent": "lent-02",
  "3rd Sunday of Lent": "lent-03",
  "4th Sunday of Lent": "lent-04",
  "5th Sunday of Lent": "lent-05",
  "Palm Sunday": "palm-sunday",
  "Easter Day": "easter-sunday-abc",
  "2nd Sunday of Easter": "easter-02-divine-mercy",
  "3rd Sunday of Easter": "easter-03",
  "4th Sunday of Easter": "easter-04",
  "5th Sunday of Easter": "easter-05",
  "6th Sunday of Easter": "easter-06",
  "Ascension of the Lord": "ascension",
  "7th Sunday of Easter": "easter-07",
  "Pentecost Sunday -  During the Day": "pentecost",
  "Pentecost Sunday -  Vigil": "pentecost-vigil-abc",
  "Most Holy  Trinity": "solemnity-most-holy-trinity",
  "Most Holy Trinity": "solemnity-most-holy-trinity",
  "Most Holy Body and Blood of Christ": "solemnity-body-blood-of-christ",
  "Our Lord Jesus Christ King of the Universe": "solemnity-christ-the-king",
  "Palm SundayCommon Psalm for Holy Week": "palm-sunday",
  "Easter DayCommon Psalm for the Season of Easter": "easter-sunday-abc",
  "Easter SundayCommon Psalm for the Season of Easter": "easter-sunday-abc",
  "3rd Sunday of Lent23rd Sunday in OT": "lent-03",
  "4th Sunday of Lent4th Sunday of Easter": "lent-04",
  "The Epiphany of the Lord": "the-epiphany-of-the-lord-abc",
  "Holy Family of Jesus Mary and Joseph Optional Year B Reading": "holy-family",
  "Baptism of the Lord Optional Year B Reading": "baptism-of-the-lord",
  "Common Psalm for the Season of Easter": "easter-sunday-abc",
  // B/C year variant names (no "in", capital "Of")
  "1st Sunday Of Lent": "lent-01",
  "2nd Sunday Of Lent": "lent-02",
  "3rd Sunday Of Lent": "lent-03",
  "4th Sunday Of Lent": "lent-04",
  "2nd Sunday Of Advent5th Sunday Of Lent": "advent-02",
  "3rd Sunday Of Advent": "advent-03",
  "4th Sunday Of Advent": "advent-04",
  "2nd Sunday Of Easter": "easter-02-divine-mercy",
  "3rd Sunday Of Easter10th Sunday In Ordinary Time": "easter-03",
  "4th Sunday Of Easter": "easter-04",
  "5th Sunday Of Easter": "easter-05",
  "Sixth Sunday of Easter": "easter-06",
  "Seventh Sunday of Easter": "easter-07",
  "Pentecost During the Day": "pentecost",
  "Pentecost Sunday Solemnity": "pentecost",
  "Pentecost SundayVigil": "pentecost-vigil-abc",
  "Pentecost Vigil": "pentecost-vigil-abc",
  "The Ascension of the Lord": "ascension",
  "The Ascension of the Lord at Mass During the Day": "ascension",
  "The Most Holy Trinity": "solemnity-most-holy-trinity",
  "The Most Holy Body and Blood of Christ": "solemnity-body-blood-of-christ",
  "Easter Day  Common Psalm For The Easter Season": "easter-sunday-abc",
  "Palm Sunday  Common Psalm For The Holy Week": "palm-sunday",
  "Epiphany Of The Lord": "the-epiphany-of-the-lord-abc",
  "Baptism Of The Lord Ps 29": "baptism-of-the-lord",
  "Baptism Of The Lord Ps 104": "baptism-of-the-lord",
  "Holy Family Of Jesus Mary And Joseph Ps 84": "holy-family",
  "Holy Family Of Jesus Mary And Joseph Ps128": "holy-family",
  "Ash Wednesday": "ash-wednesday",
  "The Chrism Mass Holy Thursday": "holy-thursday-lords-supper",
  "Thursday of the Lords Supper": "holy-thursday-lords-supper",
  "Friday of the Passion of the Lord": "good-friday-passion",
  "The Nativity of the Lord - Vigil": "nativity",
  "The Nativity of the Lord - Night": "nativity",
  "The Nativity of the Lord - Dawn": "nativity",
  "The Nativity of the Lord - Day": "nativity",
  "January 1Mary the Holy Mother of God": "jan-1-mary-mother-of-god-abc",
  "All Saints": "solemnity-nov-1-all-saints-abc",
  "All Souls Day": "solemnity-nov-1-all-souls-abc",
  "Assumption During The Day": "assumption-abc",
  "Assumption Vigil": "assumption-vigil-abc",
  "Immaculate Conception Of The Blessed Virgin Mary": "solemnity-immaculate-conception",
  "Presentation Of The Lord": "feast-abc-feb-2-presentation-of-the-lord",
  "Transfiguration": "transfiguration-abc",
  "Exaltation Of The Holy Cross": "feast-the-exaltation-sep-14-of-the-holy-cross-abc",
  "Dedication Of The Lateran Basillca": "the-dedication-of-nov-9-the-lateran-basilica-abc",
  "Sts Peter And Paul During The Day": "ss-peter-paul-apostles-jun-29-mass-during-the-day-abc",
  "Sts Peter And Paul Vigil": "ss-peter-paul-apostles-jun-29-at-the-vigil-mass-abc",
  "Nativity Of St John The Baptist During The Day": "nativity",
  "Nativity Of St John The Baptist Vigil": "nativity",
  "St Joseph": "annunciation-abc",
  "Annunciation": "annunciation-abc",
  "Thanksgiving Day Ps 113": "thanksgiving",
  "Thanksgiving Day Ps 138": "thanksgiving",
  "Thanksgiving Day Ps 145": "thanksgiving",
  "19th  20th Sunday in Ordinary Time": "ordinary-time-19",
  "9th and 21st Sunday Orsinary Time": "ordinary-time-09",
  "The Most Sacred Heart of Jesus - A": "solemnity-most-holy-trinity",
  "The Most Sacred Heart of Jesus - C": "solemnity-most-holy-trinity",
  "The Easter VigilThe Most Sacred Heart of Jesus": "easter-vigil",
};

// Generate OT occasion IDs — both "in Ordinary Time" and "Ordinary Time" patterns
for (let i = 2; i <= 34; i++) {
  const ordinal = i === 2 ? "2nd" : i === 3 ? "3rd" : i === 21 ? "21st" : i === 22 ? "22nd" : i === 23 ? "23rd" : i === 31 ? "31st" : i === 32 ? "32nd" : i === 33 ? "33rd" : `${i}th`;
  const id = `ordinary-time-${String(i).padStart(2, "0")}`;
  OCCASION_MAP[`${ordinal} Sunday in Ordinary Time`] = id;
  OCCASION_MAP[`${ordinal} Sunday Ordinary Time`] = id; // B/C variant without "in"
}

// Generate OT occasion IDs (2nd through 34th)
for (let i = 2; i <= 34; i++) {
  const ordinal = i === 2 ? "2nd" : i === 3 ? "3rd" : i === 21 ? "21st" : i === 22 ? "22nd" : i === 23 ? "23rd" : i === 31 ? "31st" : i === 32 ? "32nd" : i === 33 ? "33rd" : `${i}th`;
  OCCASION_MAP[`${ordinal} Sunday in Ordinary Time`] = `ordinary-time-${String(i).padStart(2, "0")}`;
}

function findOccasionId(trackName: string, yearSuffix: string): string | null {
  // Clean track name: remove "Track N " prefix
  const clean = trackName.replace(/^Track \d+ /, "").replace(/\.mp3$/i, "");

  // Handle compound names like "3rd Sunday of Lent23rd Sunday in OT"
  const parts = clean.split(/(?<=\))(?=[A-Z0-9])/);
  const primary = parts[0].trim();

  const pattern = OCCASION_MAP[primary] || OCCASION_MAP[clean];
  if (!pattern) return null;

  // Add year suffix
  if (pattern.endsWith("-abc") || pattern === "easter-sunday-abc" || pattern === "pentecost-vigil-abc") {
    return pattern;
  }
  return `${pattern}-${yearSuffix}`;
}

function getOccasionPsalm(occasionId: string): { psalmNumber: number; antiphon: string } | null {
  // Try to find the occasion JSON
  const candidates = [
    `${occasionId}.json`,
    // Try without year suffix for ABC occasions
  ];

  for (const fname of candidates) {
    const fpath = path.join(OCCASIONS_DIR, fname);
    if (!fs.existsSync(fpath)) continue;

    const data = JSON.parse(fs.readFileSync(fpath, "utf8"));
    const psalmReading = data.readings?.find((r: { type: string }) => r.type === "psalm");
    if (!psalmReading) continue;

    const match = psalmReading.citation.match(/Ps\s+(\d+)/);
    if (!match) continue;

    // Extract antiphon (second line of citation)
    const lines = psalmReading.citation.split("\n");
    const antiphon = (lines[1] || "").trim();

    return { psalmNumber: parseInt(match[1], 10), antiphon };
  }
  return null;
}

async function findOrCreateLPSong(psalmNumber: number, antiphon: string): Promise<{ id: string; title: string; composer: string } | null> {
  const composer = "The Lyric Psalter • Tony Alonso & Marty Haugen";

  // Try exact antiphon match
  const shortAntiphon = antiphon.replace(/[.,;!?]+$/, "").trim();
  const titlePattern = `Ps ${psalmNumber} ${shortAntiphon}`;

  const { data: exact } = await supabase.from("songs")
    .select("id, title, composer")
    .eq("psalm_number", psalmNumber)
    .ilike("composer", "%Lyric Psalter%Tony Alonso%")
    .ilike("title", `%${shortAntiphon.slice(0, 20)}%`)
    .limit(1);

  if (exact && exact.length > 0) {
    return { id: exact[0].id, title: exact[0].title, composer: exact[0].composer || composer };
  }

  // Try any LP song with this psalm number
  const { data: any } = await supabase.from("songs")
    .select("id, title, composer, usage_count")
    .eq("psalm_number", psalmNumber)
    .ilike("composer", "%Lyric Psalter%Tony Alonso%")
    .order("usage_count", { ascending: false })
    .limit(1);

  if (any && any.length > 0) {
    return { id: any[0].id, title: any[0].title, composer: any[0].composer || composer };
  }

  // Create new LP song entry
  const newTitle = `Ps ${psalmNumber} ${shortAntiphon.slice(0, 60)}${shortAntiphon.length > 60 ? "..." : ""}`;
  const legacyId = `ps-${psalmNumber}-${shortAntiphon.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 50)}--the-lyric-psalter-tony-alonso-marty-haugen`;

  const { data: created, error } = await supabase.from("songs").insert({
    legacy_id: legacyId,
    title: newTitle,
    composer,
    category: "psalm",
    psalm_number: psalmNumber,
    functions: ["psalm", "responsorial"],
    usage_count: 0,
    occasions: [],
  }).select("id, title, composer").single();

  if (error) {
    console.error(`  Failed to create song: ${error.message}`);
    return null;
  }

  console.log(`  Created new LP song: ${created.title}`);
  return { id: created.id, title: created.title, composer: created.composer || composer };
}

async function main() {
  const years = [
    { dir: "X-89100 The Lyric Psalter Year A", suffix: "a" },
    { dir: "X-89200 The Lyric Psalter Year B", suffix: "b" },
    { dir: "X-89300 The Lyric Psalter Year C", suffix: "c" },
    { dir: "X-89000 The Lyric Psalter", suffix: "common" },
  ];

  let uploaded = 0, linked = 0, skipped = 0, failed = 0;

  for (const year of years) {
    const yearDir = path.join(LP_DIR, year.dir);
    if (!fs.existsSync(yearDir)) continue;

    const mp3s = findMp3s(yearDir);
    console.log(`\n=== ${year.dir} (${mp3s.length} tracks) ===`);

    for (const mp3Path of mp3s) {
      const trackName = path.basename(mp3Path);
      const occasionId = findOccasionId(trackName, year.suffix);

      if (!occasionId) {
        console.log(`  SKIP (no occasion map): ${trackName}`);
        skipped++;
        continue;
      }

      const psalm = getOccasionPsalm(occasionId);
      if (!psalm) {
        console.log(`  SKIP (no psalm reading): ${occasionId} <- ${trackName}`);
        skipped++;
        continue;
      }

      const song = await findOrCreateLPSong(psalm.psalmNumber, psalm.antiphon);
      if (!song) {
        failed++;
        continue;
      }

      // Upload MP3
      const storagePath = `lyric-psalter/${occasionId}.mp3`;
      const file = fs.readFileSync(mp3Path);

      const { error: uploadErr } = await supabase.storage
        .from("song-resources")
        .upload(storagePath, file, { contentType: "audio/mpeg", upsert: true });

      if (uploadErr) {
        // Might already exist
        if (!uploadErr.message.includes("already exists")) {
          console.error(`  Upload error: ${uploadErr.message}`);
          failed++;
          continue;
        }
      }

      const url = supabase.storage.from("song-resources").getPublicUrl(storagePath).data.publicUrl;

      // Check if resource already linked
      const { data: existing } = await supabase.from("song_resources_v2")
        .select("id")
        .eq("song_id", song.id)
        .eq("storage_path", storagePath)
        .limit(1);

      if (!existing || existing.length === 0) {
        await supabase.from("song_resources_v2").insert({
          song_id: song.id,
          type: "audio",
          label: `Lyric Psalter (${occasionId})`,
          url,
          storage_path: storagePath,
          source: "lyric_psalter_cd",
        });
        linked++;
      }

      // Write to music plan edits for Reflections + Heritage
      for (const ensemble of ["reflections", "heritage"]) {
        await supabase.from("music_plan_edits").upsert({
          occasion_id: occasionId,
          ensemble_id: ensemble,
          field: "responsorialPsalm",
          value: { psalm: song.title, setting: song.composer },
          updated_at: new Date().toISOString(),
        }, { onConflict: "occasion_id,ensemble_id,field" });
      }

      uploaded++;
      console.log(`  OK: ${trackName} -> ${occasionId} -> ${song.title}`);
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Uploaded: ${uploaded} | Linked: ${linked} | Skipped: ${skipped} | Failed: ${failed}`);
}

function findMp3s(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findMp3s(full));
    } else if (entry.name.endsWith(".mp3")) {
      results.push(full);
    }
  }
  return results;
}

main().catch(console.error);
