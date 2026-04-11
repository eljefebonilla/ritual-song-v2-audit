#!/usr/bin/env node
/**
 * Upload mass part CONG reprint images to Supabase.
 *
 * For each entry:
 * 1. Read the local image file (TIFF/GIF/PNG)
 * 2. Upload to Supabase Storage bucket "song-resources" at {legacy_id}/{filename}
 * 3. Insert a song_resources_v2 row with tags: ["CONG"]
 *
 * Usage:
 *   node scripts/upload-mass-reprints.mjs --dry-run   # preview, no uploads
 *   node scripts/upload-mass-reprints.mjs             # full upload
 */

import { readFileSync } from "fs";
import { join, dirname, basename, extname } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
config({ path: join(root, ".env.local") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const BUCKET = "song-resources";
const DRY_RUN = process.argv.includes("--dry-run");

const MUSIC = "/Users/jeffreybonilla/Dropbox/RITUALSONG/Song Folders/Music";
const MASS = `${MUSIC}/_Mass Parts`;
const SETTINGS = `${MASS}/_ Mass Settings (As in we do more that just one piece the setting)`;

// ── Mapping: gap song title -> { legacyIds to try, local file path } ──────────

const UPLOADS = [
  {
    title: "Kyrie - Misa Del Mundo",
    legacyIds: [
      "kyrie-misa-del-mundo--only-if-needed-talk-to-presider",
      "kyrie-misa-del-mundo--manibusan",
    ],
    file: `${MASS}/01 Kyries (unless part of mass setting that we do other parts from)/Kyrie (Misa del Mundo) - Manibusan/10804AY_Ea01794_102357_400_01_01 (1).gif`,
  },
  {
    title: "Glory to God (Mass of Joy & Peace)",
    legacyIds: [
      "glory-to-god-mass-of-joy-peace--tony-alonso-thru-composed",
      "glory-to-god-mass-of-joy-peace--tony-alonso-arr-by-dan-houze",
      "glory-to-god-mass-of-joy-peace--alonso-arr-by-lockwood",
    ],
    file: `${SETTINGS}/Joy and Peace - Alonso/03a Glory to God assembly refrain.tif`,
  },
  {
    title: "Glory, Glory, Gloria!",
    legacyIds: [
      "glory-glory-gloria--bonilla-wilson-vocal-arr-by-lockwood-phan",
    ],
    file: `${SETTINGS}/Setting Sun - Bonilla_Wilson/Reprints/TIFF/Folk Gloria Reprint.tiff`,
  },
  {
    title: "Glory to God (Through-composed / Mass of Renewal)",
    legacyIds: [
      "glory-to-god-through-composed-setting--mass-of-renewal-curtis-stephan",
    ],
    file: `${SETTINGS}/Renewal - Stephan/Glory-to-God-10195.gif`,
  },
  {
    title: "Kyrie (Gift of God) - Adapted Version",
    legacyIds: [
      "kyrie-gift-of-god-adapted-version--marty-haugen-arranged-by-david-locwood",
    ],
    file: `${MASS}/01 Kyries (unless part of mass setting that we do other parts from)/Kyrie - Haugen_Lockwood/Kyrie - Haugen_Lockwood Reprint.tiff`,
  },
  {
    title: "Kyrie (Mass of Colour)",
    legacyIds: [
      "kyrie-mass-of-colour-optional-tropes--jeffrey-bonilla-david-lockwood",
    ],
    file: `${SETTINGS}/Colour - Bonilla_Lockwood/Reprints/Kyrie Mass of Colour Reprint.tiff`,
  },
  {
    title: "Hallelujah (adapted for Liturgy)",
    legacyIds: [
      "hallelujah-adapted-for-liturgy--leonard-cohen",
    ],
    file: `${MASS}/04 Gospel Acclamations (unless part of mass setting that we do other parts from)/Hallelujah - Cohen/Hallelujah Cohen Reprint.tiff`,
  },
  {
    title: "Halle, Halle, Halle",
    legacyIds: [
      "halle-halle-halle--marty-haugen",
      "halle-halle-halle",
    ],
    file: `${MASS}/04 Gospel Acclamations (unless part of mass setting that we do other parts from)/Halle, Halle Halle - Haugen/Halle-Halle-Halle-RS396-1-2351.tif`,
  },
  {
    title: "Advent and Christmastide Gospel Acclamation",
    legacyIds: [
      "advent-and-christmastide-gospel-acclamation--christmas-holy-family-abc-option",
    ],
    file: `${MASS}/04 Gospel Acclamations (unless part of mass setting that we do other parts from)/Advent Gospel Acclamation - Bolduc/Advent Gospel Acclamation - Bolduc Reprint.tiff`,
  },
  {
    title: "Corpus Christi Sequence (Page 1)",
    legacyIds: [
      "corpus-christi-sequence--james-poppleton",
      "corpus-christi-sequence",
    ],
    file: `${MASS}/03 Sequences/Corpus Christi Sequence/Corpus Christi Sequence P1.gif`,
  },
  {
    title: "Pentecost Sequence (Archer)",
    legacyIds: [
      "pentecost-sequence-archer--pent-abc-come-holy-spirit-fill",
      "pentecost-sequence-archer",
    ],
    file: `${MASS}/03 Sequences/Pentecost Sequence - Archer/Pentecost Sequence - Archer/Pentecost Sequence - Archer2.png`,
  },
  {
    title: "A Joyful Christmas Gloria",
    legacyIds: [
      "a-joyful-christmas-gloria--arr-jeanne-cotter-tony-alonso",
    ],
    file: `${MASS}/02 Glorias (unless part of mass setting that we do other parts from)/A Christmas Gloria - Gibson/A-Christmas-Gloria-90922.gif`,
  },
];

// ── MIME type lookup ──────────────────────────────────────────────────────────

function getMime(ext) {
  const map = {
    ".gif": "image/gif",
    ".tif": "image/tiff",
    ".tiff": "image/tiff",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".pdf": "application/pdf",
  };
  return map[ext.toLowerCase()] || "application/octet-stream";
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(DRY_RUN ? "=== DRY RUN ===" : "=== UPLOADING ===");
  console.log(`${UPLOADS.length} mass part reprints to process\n`);

  let uploaded = 0;
  let skipped = 0;
  let errors = 0;

  for (const entry of UPLOADS) {
    // 1. Verify file exists
    let buffer;
    try {
      buffer = readFileSync(entry.file);
    } catch {
      console.log(`  SKIP  ${entry.title} - file not found: ${basename(entry.file)}`);
      skipped++;
      continue;
    }

    // 2. Find the song UUID via legacy_id
    let uuid = null;
    let matchedLegacyId = null;
    for (const lid of entry.legacyIds) {
      const { data } = await supabase
        .from("songs")
        .select("id")
        .eq("legacy_id", lid)
        .maybeSingle();
      if (data?.id) {
        uuid = data.id;
        matchedLegacyId = lid;
        break;
      }
    }

    if (!uuid) {
      console.log(`  SKIP  ${entry.title} - no song UUID found for legacy IDs: ${entry.legacyIds.join(", ")}`);
      skipped++;
      continue;
    }

    // 3. Check if CONG resource already exists
    const { data: existing } = await supabase
      .from("song_resources_v2")
      .select("id")
      .eq("song_id", uuid)
      .contains("tags", ["CONG"])
      .limit(1);

    if (existing && existing.length > 0) {
      console.log(`  EXISTS ${entry.title} - already has CONG resource`);
      skipped++;
      continue;
    }

    // 4. Upload to storage
    const ext = extname(entry.file);
    const filename = `${basename(entry.file)}`;
    const storagePath = `${matchedLegacyId}/${filename}`;

    if (DRY_RUN) {
      console.log(`  WOULD UPLOAD  ${entry.title}`);
      console.log(`    -> ${storagePath} (${(buffer.length / 1024).toFixed(0)} KB)`);
      console.log(`    -> song_id: ${uuid}`);
      uploaded++;
      continue;
    }

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, buffer, {
        contentType: getMime(ext),
        upsert: true,
      });

    if (uploadError) {
      console.log(`  ERROR ${entry.title}: ${uploadError.message}`);
      errors++;
      continue;
    }

    // 5. Get public URL
    const { data: urlData } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(storagePath);

    // 6. Insert DB row
    const { error: insertError } = await supabase
      .from("song_resources_v2")
      .insert({
        song_id: uuid,
        type: "sheet_music",
        label: "Congregational",
        url: urlData.publicUrl,
        storage_path: storagePath,
        source: "parish_library",
        is_highlighted: false,
        tags: ["CONG"],
      });

    if (insertError) {
      console.log(`  DB ERROR ${entry.title}: ${insertError.message}`);
      errors++;
      continue;
    }

    console.log(`  OK    ${entry.title} -> ${storagePath}`);
    uploaded++;
  }

  console.log(`\n=== DONE ===`);
  console.log(`  Uploaded: ${uploaded}`);
  console.log(`  Skipped:  ${skipped}`);
  console.log(`  Errors:   ${errors}`);
}

main().catch(console.error);
