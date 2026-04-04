#!/usr/bin/env npx tsx
/**
 * Bulk Upload Cover Art — St. Monica's worship aid cover images
 *
 * Reads from the Dropbox cover art folder, normalizes occasion codes,
 * uploads images to Supabase storage, and creates parish_cover_art records.
 *
 * Usage: npx tsx scripts/bulk-upload-covers.ts [--dry-run]
 *
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, readdirSync, statSync } from "fs";
import { join, extname } from "path";

const COVERS_DIR =
  "/Users/jeffreybonilla/St Monica Dropbox/Livestream Mass Media/Digital Worship Aids/Worship Aid Covers";

const DRY_RUN = process.argv.includes("--dry-run");

// St. Monica's parish ID (query from DB on first run)
let PARISH_ID = "";

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Normalize a folder name like "260222 01LENT_A" to an occasion code
 * that matches our liturgical calendar IDs.
 *
 * Mapping rules:
 * - Strip the date prefix (YYMMDD or YYMMDD-DD)
 * - Convert to lowercase with hyphens: "01LENT_A" -> "lent-01-a"
 * - Handle special cases: PalmSun, Triduum_Easter, Nativity, etc.
 */
function normalizeOccasionCode(folderName: string): {
  code: string;
  cycle: string;
} | null {
  // Strip leading date (YYMMDD or YYMMDD-DD or YYMMDD_DD)
  const withoutDate = folderName.replace(/^\d{6}[-_]?\d{0,2}\s*/, "").trim();
  if (!withoutDate || withoutDate === "_ARCHIVE") return null;

  // Special cases
  const specials: Record<string, { code: string; cycle: string }> = {
    Nativity: { code: "christmas-nativity", cycle: "all" },
    "Holy Family": { code: "christmas-holy-family", cycle: "all" },
    Epiphany: { code: "christmas-epiphany", cycle: "all" },
    PalmSun: { code: "holyweek-palm-sunday", cycle: "all" },
    Triduum_Easter: { code: "easter-triduum", cycle: "all" },
    "CSW": { code: "ordinary-csw", cycle: "all" },
  };

  for (const [key, val] of Object.entries(specials)) {
    if (withoutDate.includes(key)) return val;
  }

  // Standard pattern: "01Advent_A", "03LENT_A", "05OT_A"
  const match = withoutDate.match(
    /^(\d{2})([A-Za-z]+)_([ABC])(?:\s.*)?$/
  );
  if (match) {
    const [, num, season, cycle] = match;
    const seasonMap: Record<string, string> = {
      advent: "advent",
      lent: "lent",
      ot: "ordinary",
      easter: "easter",
    };
    const normalizedSeason = seasonMap[season.toLowerCase()] || season.toLowerCase();
    return {
      code: `${normalizedSeason}-${num.replace(/^0/, "")}-${cycle.toLowerCase()}`,
      cycle: cycle.toUpperCase(),
    };
  }

  // Baptism pattern: "Baptism_A"
  const baptismMatch = withoutDate.match(/^([A-Za-z]+)_([ABC])$/);
  if (baptismMatch) {
    return {
      code: baptismMatch[1].toLowerCase(),
      cycle: baptismMatch[2].toUpperCase(),
    };
  }

  console.warn(`  [skip] Could not normalize: "${folderName}" -> "${withoutDate}"`);
  return null;
}

/**
 * Find the best cover image in a folder.
 * Prefers: *WA.png > *WA.jpg > *HOME.jpg > first image
 */
function findBestImage(dirPath: string): string | null {
  const files = readdirSync(dirPath).filter((f) =>
    /\.(png|jpg|jpeg|webp)$/i.test(f)
  );
  if (files.length === 0) return null;

  const wa = files.find((f) => /WA\.(png|jpg)$/i.test(f));
  if (wa) return join(dirPath, wa);

  const home = files.find((f) => /HOME\.(png|jpg)$/i.test(f));
  if (home) return join(dirPath, home);

  return join(dirPath, files[0]);
}

async function main() {
  const supabase = getSupabase();

  // Find St. Monica's parish
  const { data: parishes } = await supabase
    .from("parishes")
    .select("id, name")
    .ilike("name", "%monica%")
    .limit(1);

  if (!parishes?.[0]) {
    console.error("St. Monica parish not found in DB");
    process.exit(1);
  }
  PARISH_ID = parishes[0].id;
  console.log(`Parish: ${parishes[0].name} (${PARISH_ID})`);
  console.log(`Source: ${COVERS_DIR}`);
  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}\n`);

  const folders = readdirSync(COVERS_DIR).filter((f) => {
    const stat = statSync(join(COVERS_DIR, f));
    return stat.isDirectory() && f !== "_ARCHIVE";
  });

  let uploaded = 0;
  let skipped = 0;

  for (const folder of folders) {
    const normalized = normalizeOccasionCode(folder);
    if (!normalized) {
      skipped++;
      continue;
    }

    const imagePath = findBestImage(join(COVERS_DIR, folder));
    if (!imagePath) {
      console.log(`  [skip] No images in: ${folder}`);
      skipped++;
      continue;
    }

    const ext = extname(imagePath).slice(1).toLowerCase();
    const storagePath = `covers/${PARISH_ID}/${normalized.code}_${normalized.cycle.toLowerCase()}.${ext}`;

    console.log(`  ${folder} -> ${normalized.code} (${normalized.cycle}) -> ${storagePath}`);

    if (!DRY_RUN) {
      const bytes = readFileSync(imagePath);
      const contentType = ext === "png" ? "image/png" : "image/jpeg";

      const { error: uploadErr } = await supabase.storage
        .from("song-resources")
        .upload(storagePath, bytes, { contentType, upsert: true });

      if (uploadErr) {
        console.error(`    Upload failed: ${uploadErr.message}`);
        continue;
      }

      const { data: urlData } = supabase.storage
        .from("song-resources")
        .getPublicUrl(storagePath);

      const { error: dbErr } = await supabase
        .from("parish_cover_art")
        .upsert(
          {
            parish_id: PARISH_ID,
            occasion_code: normalized.code,
            cycle: normalized.cycle,
            source: "uploaded",
            storage_path: storagePath,
            image_url: urlData.publicUrl,
          },
          { onConflict: "parish_id,occasion_code,cycle" }
        );

      if (dbErr) {
        console.error(`    DB insert failed: ${dbErr.message}`);
        continue;
      }
    }

    uploaded++;
  }

  console.log(`\nDone. Uploaded: ${uploaded}, Skipped: ${skipped}`);
}

main().catch(console.error);
