#!/usr/bin/env node
/**
 * Batch 2: Upload reprints from ~/Desktop/REPRINTS TO ADD/
 */

import { readFileSync } from "fs";
import { join, dirname, basename, extname } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env.local") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const BUCKET = "song-resources";
const DRY_RUN = process.argv.includes("--dry-run");
const SRC = "/Users/jeffreybonilla/Desktop/REPRINTS TO ADD";

const UPLOADS = [
  // The 7 gap songs Jeff provided
  {
    title: "Alleluia (Mass of Joy & Peace)",
    legacyIds: ["alleluia-mass-of-joy-peace--song-title"],
    file: `${SRC}/Mass of Joy & Peace (Alonso)/Mass-of-Joy-and-Peace-Gospel-Acclamation-Revised-Order-of-Mass-G3208-1-87092.tif`,
  },
  {
    title: "Easter Alleluia (Refrain)",
    legacyIds: ["easter-alleluia-refrain--the-lyric-gospel-acclamations-tony-alonso", "easter-alleluia-refrain"],
    file: `${SRC}/Easter Alleluia/Easter-Alleluia-Psalm-118-and-Gospel-Acclamation-OCT5019-1-92155.tif`,
  },
  {
    title: "Praise to You, Lord Jesus Christ",
    legacyIds: ["praise-to-you-lord-jesus-christ--ed-archer"],
    file: `${SRC}/Praise to You, Lord Jesus Christ (Archer)/Lenten-Gospel-Acclamation-CG22-1-70672.tif`,
  },
  {
    title: "Hallelujah, Hallelu!",
    legacyIds: ["hallelujah-hallelu", "hallelujah-hallelu--michael-mahler"],
    file: `${SRC}/Hallelujah, Hallelu!/Hallelujah-Hallelu-CG2-1-6745.tif`,
  },
  {
    title: "Setting from Mass of the Desert (Alleluia)",
    legacyIds: ["setting-from-mass-of-the-desert"],
    file: `${SRC}/Mass of the Desert (Booth)/Alleluia (Mass of the Desert).gif`,
  },
  {
    title: "Setting from Mass of Endless Mercy (Alleluia)",
    legacyIds: ["setting-from-mass-of-endless-mercy", "mass-of-endless-mercy"],
    file: `${SRC}/Mass of Endless Mercy/Alleluia (Mass of Endles Mercy).gif`,
  },
  {
    title: "Setting from Mass of St. Kilian (Alleluia)",
    legacyIds: ["setting-from-mass-of-st-kilian"],
    file: `${SRC}/Mass of St. Kilian/Alleluia (Mass of St. Kilian).gif`,
  },

  // Bonus: Full Mass of Joy & Peace set
  {
    title: "Joy & Peace - Kyrie",
    legacyIds: ["mass-of-joy-peace--tony-alonso"],
    file: `${SRC}/Mass of Joy & Peace (Alonso)/Mass-of-Joy-and-Peace-Kyrie-Revised-Order-of-Mass-G3206-1-87090.tif`,
    tag: "CONG",
    label: "Kyrie",
  },
  {
    title: "Joy & Peace - Glory to God (NEW higher quality)",
    legacyIds: ["glory-to-god-mass-of-joy-peace--tony-alonso-thru-composed"],
    file: `${SRC}/Mass of Joy & Peace (Alonso)/Mass-of-Joy-and-Peace-Glory-to-God-Revised-Order-of-Mass-G3207-1-87091.tif`,
    skipIfExists: true, // we already uploaded the assembly refrain version
  },
  {
    title: "Joy & Peace - Lenten Gospel Acclamation",
    legacyIds: ["alleluia-mass-of-joy-peace--song-title"],
    file: `${SRC}/Mass of Joy & Peace (Alonso)/Mass-of-Joy-and-Peace-Lenten-Gospel-Acclamation-Revised-Order-of-Mass-G3209-1-98959.tif`,
  },
  {
    title: "Joy & Peace - Holy Holy Holy",
    legacyIds: ["mass-of-joy-peace--tony-alonso"],
    file: `${SRC}/Mass of Joy & Peace (Alonso)/Mass-of-Joy-and-Peace-Holy-Holy-Holy-Revised-Order-of-Mass-G3211-1-87093.tif`,
  },
  {
    title: "Joy & Peace - Memorial Acclamations",
    legacyIds: ["mass-of-joy-peace--tony-alonso"],
    file: `${SRC}/Mass of Joy & Peace (Alonso)/Mass-of-Joy-and-Peace-Memorial-Acclamations-Revised-Order-of-Mass-G3213-1-87094.tif`,
  },
  {
    title: "Joy & Peace - Amen",
    legacyIds: ["mass-of-joy-peace--tony-alonso"],
    file: `${SRC}/Mass of Joy & Peace (Alonso)/Mass-of-Joy-and-Peace-Amen-Revised-Order-of-Mass-G3215-1-87095.tif`,
  },
  {
    title: "Joy & Peace - Lamb of God",
    legacyIds: ["lamb-of-god-mass-of-joy-peace--tony-alonso", "lamb-of-god-mass-of-joy-peace"],
    file: `${SRC}/Mass of Joy & Peace (Alonso)/Mass-of-Joy-and-Peace-Lamb-of-God-Revised-Order-of-Mass-G3216-1-87096.tif`,
  },
];

function getMime(ext) {
  const map = { ".gif": "image/gif", ".tif": "image/tiff", ".tiff": "image/tiff", ".png": "image/png" };
  return map[ext.toLowerCase()] || "application/octet-stream";
}

async function main() {
  console.log(DRY_RUN ? "=== DRY RUN ===" : "=== UPLOADING ===");
  let uploaded = 0, skipped = 0, errors = 0;

  for (const entry of UPLOADS) {
    let buffer;
    try { buffer = readFileSync(entry.file); }
    catch { console.log(`  SKIP  ${entry.title} - file not found`); skipped++; continue; }

    let uuid = null, matchedLegacyId = null;
    for (const lid of entry.legacyIds) {
      const { data } = await supabase.from("songs").select("id").eq("legacy_id", lid).maybeSingle();
      if (data?.id) { uuid = data.id; matchedLegacyId = lid; break; }
    }
    if (!uuid) { console.log(`  SKIP  ${entry.title} - no UUID`); skipped++; continue; }

    if (entry.skipIfExists) {
      const { data: existing } = await supabase.from("song_resources_v2").select("id").eq("song_id", uuid).contains("tags", ["CONG"]).limit(1);
      if (existing?.length > 0) { console.log(`  EXISTS ${entry.title}`); skipped++; continue; }
    }

    const ext = extname(entry.file);
    const storagePath = `${matchedLegacyId}/${basename(entry.file)}`;

    if (DRY_RUN) {
      console.log(`  WOULD  ${entry.title} -> ${storagePath} (${(buffer.length/1024).toFixed(0)} KB)`);
      uploaded++; continue;
    }

    const { error: upErr } = await supabase.storage.from(BUCKET).upload(storagePath, buffer, { contentType: getMime(ext), upsert: true });
    if (upErr) { console.log(`  ERROR ${entry.title}: ${upErr.message}`); errors++; continue; }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
    const { error: dbErr } = await supabase.from("song_resources_v2").insert({
      song_id: uuid, type: "sheet_music", label: entry.label || "Congregational",
      url: urlData.publicUrl, storage_path: storagePath,
      source: "parish_library", is_highlighted: false, tags: [entry.tag || "CONG"],
    });
    if (dbErr) { console.log(`  DB ERR ${entry.title}: ${dbErr.message}`); errors++; continue; }

    console.log(`  OK    ${entry.title} -> ${storagePath}`);
    uploaded++;
  }

  console.log(`\n=== DONE: ${uploaded} uploaded, ${skipped} skipped, ${errors} errors ===`);
}

main().catch(console.error);
